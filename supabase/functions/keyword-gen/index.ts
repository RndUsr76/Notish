import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function getAvailableModels(): Promise<string[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
  );
  if (!res.ok) throw new Error(`ListModels failed: ${res.status}`);
  const { models } = await res.json();

  return (models as any[])
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name.replace('models/', '') as string)
    .sort((a, b) => {
      const rank = (name: string) => {
        // Try flash models first, prefer 1.5 if 2.0 has quota issues
        if (name.includes('1.5') && name.includes('flash')) return 0;
        if (name.includes('2.0') && name.includes('flash')) return 1;
        if (name.includes('flash')) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No Authorization header');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    const { text } = await req.json();
    if (!text) throw new Error('No text provided');

    const availableModels = await getAvailableModels();
    let lastError = 'All models failed';

    for (const modelId of availableModels) {
      try {
        console.log(`Trying model: ${modelId}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Analyze the following text and find AT MOST 5 natural, searchable keywords that best summarize it. Text language is Swedish. Output ONLY the keywords as a comma-separated list.\n\nTEXT:\n${text}` }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 100 },
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resultText) {
            const keywords = resultText.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
            return new Response(JSON.stringify({ success: true, keywords }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
          }
        }
        
        lastError = data.error?.message || `Status ${response.status} from ${modelId}`;
        console.warn(`${modelId} failed: ${lastError}`);
        
        // If it's a quota error, we continue to the next model
        if (lastError.includes('Quota exceeded') || lastError.includes('exceeded your current quota')) {
          continue;
        } else {
          // If it's a different error, we might want to throw or continue
          continue;
        }

      } catch (e: any) {
        lastError = e.message;
        console.warn(`Exception with ${modelId}: ${lastError}`);
      }
    }

    throw new Error(lastError);

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: error.message === 'Unauthorized' ? 401 : 400,
    });
  }
});

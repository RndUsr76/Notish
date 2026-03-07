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
        if (name.includes('1.5') && name.includes('flash')) return 0;
        if (name.includes('2.0') && name.includes('flash')) return 1;
        if (name.includes('flash')) return 2;
        return 3;
      };
      return rank(a) - rank(b);
    });
}

const SYSTEM_PROMPT = `Du är en expert på att extrahera sökordsinnehåll från personliga anteckningar.
Ditt mål är att hjälpa användaren att organisera sina tankar genom att hitta mellan 3 och 5 relevanta sökord.

Instruktioner:
1. Analysera texten noggrant för att förstå huvudteman, projekt eller ämnen.
2. Extrahera 3-5 sökord som bäst sammanfattar innehållet.
3. Sökorden ska vara "sökbara" – dvs. ord som användaren sannolikt skulle skriva i en sökruta för att hitta denna specifika anteckning igen.
4. Prioritera ord som redan finns i texten, men skapa egna om det behövs för att ge en bättre sammanfattning.
5. Analysera textens tema och det som ta fram keywords som på ett bra sätt sammanfattar texten och dess budskap.
6. Sökorden ska vara på samma språk som texten (oftast svenska).
7. Svara ENDAST med sökorden separerade med kommatecken. Inget annat.

Exempel:
Text: "Idag planerade jag trädgården. Jag ska plantera morötter och tomater till våren."
Output: trädgårdsplanering, odling, morötter, tomater, vårprojekt`;

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
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ 
              parts: [
                { text: SYSTEM_PROMPT },
                { text: `TEXT ATT ANALYSERA:\n${text}` }
              ] 
            }],
            generationConfig: { 
              temperature: 0.2, 
              maxOutputTokens: 150 
            },
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resultText) {
            const keywords = resultText.split(',')
              .map((k: string) => k.trim())
              .filter((k: string) => k.length > 0 && k.length < 30); // Rimlig längd
            return new Response(JSON.stringify({ success: true, keywords }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200,
            });
          }
        }
        
        lastError = data.error?.message || `Status ${response.status} from ${modelId}`;
        if (lastError.includes('Quota exceeded')) continue;
      } catch (e: any) {
        lastError = e.message;
      }
    }

    throw new Error(lastError);

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});

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

const SYSTEM_PROMPT = `Du är en expert på att omstrukturera och förbättra text.
Din uppgift är att ta korta, ofullständiga anteckningar eller stödord och skriva om dem till en sammanhängande, läsbar och välformulerad text.

Instruktioner:
1. Bevara ALLA rubriker (headings, t.ex. # eller ##) exakt som de är, på samma plats. Stryk dem aldrig.
2. Utvärdera om texten faktiskt mår bäst av att vara i punktform. Om det rör sig om väldigt kortfattad och kärnfull information (t.ex. en checklista eller uppräkningar), behåll punkterna och snygga bara till språket i dem. Gör endast om till löptext (brödtext) om det faktiskt ger mervärde och texten har en naturligt berättande struktur.
3. Förbättra flytet och grammatiken utan att ändra grundbetydelsen.
4. Hitta inte på ny information som saknas i originaltexten.
5. Använd ett professionellt men naturligt och lättläst språk.
6. Bevara textens ursprungliga språk.
7. Svara ENDAST med den förbättrade texten formaterad i Markdown. Inga inledande fraser som "Här är texten".
8. Använd INTE block av typen \`\`\`markdown runt svaret.

Här är texten som ska fixas:`;

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
                { text: text }
              ] 
            }],
            generationConfig: { 
              temperature: 0.4, 
              maxOutputTokens: 2048 
            },
          }),
        });

        const data = await response.json();
        if (response.ok) {
          const resultText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (resultText) {
            return new Response(JSON.stringify({ success: true, fixed_text: resultText }), {
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

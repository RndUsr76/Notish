import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { encode } from 'https://deno.land/std@0.168.0/encoding/base64.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

const TIMEOUT_MS = 25000;

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
      // Prefer flash models, prefer newer versions
      const rank = (name: string) => {
        if (name.includes('2.0') && name.includes('flash')) return 0;
        if (name.includes('flash')) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STRUCTURING_PROMPT = `You are a note structuring assistant. You will receive an audio recording of someone speaking a note or a thought.

Your task:
1. Transcribe the audio accurately (keep the original language)
2. Structure the transcription into a clean, well-organized note

Output rules:
- Start with a short, descriptive title (as a heading #)
- Use bullet points for lists or action items
- Use paragraphs for narrative content
- Add relevant #hashtags at the end based on the content
- Keep the same language as the speaker
- Do NOT add information that wasn't spoken
- Do NOT wrap the response in markdown code blocks`;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY missing');

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    if (!audioFile) throw new Error('No audio file provided');

    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = encode(audioBuffer);
    const mimeType = audioFile.type || 'audio/webm';

    const availableModels = await getAvailableModels();
    console.log('Available models:', availableModels.slice(0, 5).join(', '));

    let lastError = 'All models failed';

    for (const modelId of availableModels) {
      try {
        console.log(`Trying ${modelId}...`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: audioBase64 } },
                { text: STRUCTURING_PROMPT },
              ],
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        });

        clearTimeout(timeout);

        const data = await response.json();

        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`Success with ${modelId}`);
            return new Response(
              JSON.stringify({ success: true, structured_note: text, model: modelId }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
          }
        }

        lastError = data.error?.message || `Status ${response.status}`;
        console.warn(`${modelId} failed: ${lastError}`);

      } catch (e: any) {
        lastError = e.name === 'AbortError' ? `${modelId} timed out after ${TIMEOUT_MS / 1000}s` : e.message;
        console.warn(lastError);
      }
    }

    return new Response(
      JSON.stringify({ success: false, error: lastError }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});

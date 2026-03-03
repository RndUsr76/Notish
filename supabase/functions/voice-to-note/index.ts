import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// Use Deno's native way to handle base64 to avoid memory issues
import { encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

// Restricted list to avoid timeouts (trying too many models takes too long)
const MODELS_TO_TRY = [
  'gemini-flash-latest',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash'
];

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

    // Efficient base64 encoding
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = encode(audioBuffer);
    const mimeType = audioFile.type || 'audio/webm';
    
    let lastError = null;
    
    for (const modelId of MODELS_TO_TRY) {
      try {
        console.log(`Trying ${modelId}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`;
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { inline_data: { mime_type: mimeType, data: audioBase64 } },
                { text: STRUCTURING_PROMPT }
              ]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 }
          }),
        });

        const data = await response.json();

        if (response.ok) {
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return new Response(JSON.stringify({ success: true, structured_note: text, model: modelId }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            });
          }
        }
        
        lastError = data.error?.message || `Status ${response.status}`;
        console.warn(`${modelId} failed: ${lastError}`);
        
        // If it's a 404 (not found), don't bother with other 1.5/2.0 names as they might also fail
        if (response.status === 404) continue;
        
      } catch (e) {
        lastError = e.message;
      }
    }

    return new Response(JSON.stringify({ success: false, error: lastError }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 // Return success:false instead of 5xx to keep client happy
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});

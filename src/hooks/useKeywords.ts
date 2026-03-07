import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useKeywords() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateKeywords = useCallback(async (text: string): Promise<string[] | null> => {
    if (!text.trim()) return null;
    
    setIsGenerating(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-keywords`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
        }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.error || 'Failed to generate keywords');
      }

      return data.keywords;
    } catch (err: any) {
      console.error('Keyword generation error:', err);
      setError(err.message || 'Failed to generate keywords');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { generateKeywords, isGenerating, error };
}

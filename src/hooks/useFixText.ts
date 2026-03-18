import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useFixText() {
  const [isFixing, setIsFixing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fixText = useCallback(async (text: string) => {
    setIsFixing(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('fix-text', {
        body: { text }
      });

      if (invokeError) {
        throw invokeError;
      }

      if (data && data.success) {
        return data.fixed_text as string;
      } else {
        throw new Error(data?.error || 'Kunde inte fixa texten');
      }
    } catch (err: any) {
      console.error('Error fixing text:', err);
      setError(err.message || 'Ett oväntat fel inträffade');
      return null;
    } finally {
      setIsFixing(false);
    }
  }, []);

  return { fixText, isFixing, error };
}

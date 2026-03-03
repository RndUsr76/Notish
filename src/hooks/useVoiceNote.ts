import { useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type VoiceNoteStatus =
  | 'idle'
  | 'recording'
  | 'processing'
  | 'done'
  | 'error';

interface UseVoiceNoteReturn {
  status: VoiceNoteStatus;
  error: string | null;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancel: () => void;
}

export function useVoiceNote(
  onResult: (structuredNote: string) => void
): UseVoiceNoteReturn {
  const [status, setStatus] = useState<VoiceNoteStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  const cancel = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setStatus('idle');
    setError(null);
    setRecordingDuration(0);
  }, [cleanup]);

  const processAudio = useCallback(
    async (audioBlob: Blob) => {
      setStatus('processing');

      try {
        // Get the current session for auth
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error('Not authenticated');
        }

        // Prepare form data
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');

        // Call the Supabase Edge Function using the SDK (handles auth headers)
        const { data, error: invokeError } = await supabase.functions.invoke('voice-to-note', {
          body: formData,
        });

        console.log('Edge Function Response:', { data, invokeError });

        if (invokeError) {
          throw new Error(invokeError.message || 'Failed to call edge function');
        }

        if (!data || !data.success) {
          throw new Error(data?.error || 'Failed to process voice note');
        }

        setStatus('done');
        onResult(data.structured_note);

        // Reset after a brief moment
        setTimeout(() => {
          setStatus('idle');
          setRecordingDuration(0);
        }, 2000);
      } catch (err: any) {
        console.error('Voice note processing error:', err);
        setError(err.message || 'Failed to process voice note');
        setStatus('error');
      }
    },
    [onResult]
  );

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setRecordingDuration(0);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg;codecs=opus';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });

        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }

        // Stop tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        // Only process if we have data
        if (audioBlob.size > 0) {
          processAudio(audioBlob);
        } else {
          setStatus('idle');
        }
      };

      // Start recording
      mediaRecorder.start(250); // Collect data every 250ms
      setStatus('recording');

      // Start duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      cleanup();

      if (err.name === 'NotAllowedError') {
        setError('Mikrofonen nekades åtkomst. Tillåt mikrofonen i webbläsarinställningarna.');
      } else if (err.name === 'NotFoundError') {
        setError('Ingen mikrofon hittades. Anslut en mikrofon och försök igen.');
      } else {
        setError(err.message || 'Kunde inte starta inspelning');
      }
      setStatus('error');
    }
  }, [cleanup, processAudio]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === 'recording'
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return {
    status,
    error,
    recordingDuration,
    startRecording,
    stopRecording,
    cancel,
  };
}

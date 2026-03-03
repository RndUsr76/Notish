import { Mic, Square, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useVoiceNote } from '../hooks/useVoiceNote';

interface VoiceNoteButtonProps {
  onResult: (structuredNote: string) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNoteButton({ onResult }: VoiceNoteButtonProps) {
  const { status, error, recordingDuration, startRecording, stopRecording, cancel } =
    useVoiceNote(onResult);

  if (status === 'idle') {
    return (
      <button
        onClick={startRecording}
        className="toolbar-btn voice-btn"
        title="Tala in en notering"
      >
        <Mic size={18} />
      </button>
    );
  }

  if (status === 'recording') {
    return (
      <div className="voice-recording-bar">
        <div className="voice-pulse" />
        <span className="voice-label">Spelar in... {formatDuration(recordingDuration)}</span>
        <button
          onClick={stopRecording}
          className="voice-stop-btn"
          title="Stoppa inspelning"
        >
          <Square size={14} />
        </button>
        <button
          onClick={cancel}
          className="voice-cancel-btn"
          title="Avbryt"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="voice-recording-bar processing">
        <Loader2 size={16} className="voice-spinner" />
        <span className="voice-label">Bearbetar...</span>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="voice-recording-bar done">
        <CheckCircle2 size={16} className="voice-done-icon" />
        <span className="voice-label">Klart!</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="voice-recording-bar error">
        <AlertCircle size={16} className="voice-error-icon" />
        <span className="voice-label voice-error-text" title={error || undefined}>
          {error || 'Något gick fel'}
        </span>
        <button onClick={cancel} className="voice-cancel-btn" title="Stäng">
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}

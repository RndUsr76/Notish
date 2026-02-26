import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Editor } from './components/Editor';
import { useNotes } from './hooks/useNotes';
import { Auth } from './components/Auth';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Plus } from 'lucide-react';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  
  const { 
    notes, 
    activeNote, 
    allKeywords,
    allProjects,
    setActiveNoteId, 
    createNote, 
    deleteNote, 
    saveNote,
    updateNoteProject,
    isLoading,
    isSaving 
  } = useNotes();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [zoom, setZoom] = useState(() => {
    const saved = localStorage.getItem('notish_zoom');
    return saved ? parseFloat(saved) : 100;
  });

  const handleZoomIn = () => {
    setZoom((prev: number) => {
      const next = Math.min(prev + 10, 200);
      localStorage.setItem('notish_zoom', next.toString());
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev: number) => {
      const next = Math.max(prev - 10, 50);
      localStorage.setItem('notish_zoom', next.toString());
      return next;
    });
  };

  if (!session) {
    return <Auth />;
  }

  return (
    <div className="app-container" style={{ '--zoom': `${zoom}%` } as React.CSSProperties}>
      <Sidebar 
        notes={notes} 
        activeNoteId={activeNote?.id || null} 
        onSelectNote={setActiveNoteId} 
        onCreateNote={createNote} 
        onMoveNoteToProject={updateNoteProject}
        user={session.user}
      />
      
      <main className="main-content">
        {activeNote ? (
          <Editor 
            key={activeNote.id}
            content={activeNote.content}
            project={activeNote.project}
            isSaving={isSaving}
            zoom={zoom}
            allKeywords={allKeywords}
            allProjects={allProjects}
            onUpdate={(content: any, text: string) => saveNote(activeNote.id, content, text)}
            onUpdateProject={(project: string) => updateNoteProject(activeNote.id, project)}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onDelete={() => deleteNote(activeNote.id)}
          />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-icon-box">N</div>
            <h2 className="welcome-title">
              {isLoading ? 'Loading your notes...' : 'Select a note to start editing'}
            </h2>
            {!isLoading && (
              <>
                <p className="welcome-text">
                  Or create a new one to capture your thoughts and stay organized.
                </p>
                <button onClick={createNote} className="btn-primary">
                  <Plus size={20} />
                  Create New Note
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

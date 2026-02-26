import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { Note } from '../lib/supabase';
import { debounce } from 'lodash';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId) // Filter by user_id
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
      if (data && data.length > 0 && !activeNoteId) {
        setActiveNoteId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchNotes();
    } else {
      setNotes([]);
      setActiveNoteId(null);
      setIsLoading(false);
    }
  }, [userId]);

  const activeNote = notes.find(n => n.id === activeNoteId) || null;

  const createNote = async () => {
    if (!userId) return;
    try {
      const newNote = {
        content: { type: 'doc', content: [] },
        text_content: '',
        tags: [],
        project: 'General',
        user_id: userId
      };

      const { data, error } = await supabase
        .from('notes')
        .insert([newNote])
        .select()
        .single();

      if (error) throw error;
      setNotes([data, ...notes]);
      setActiveNoteId(data.id);
      return data;
    } catch (error) {
      console.error('Error creating note:', error);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      const updatedNotes = notes.filter(n => n.id !== id);
      setNotes(updatedNotes);
      if (activeNoteId === id) {
        setActiveNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const saveNote = useCallback(
    debounce(async (id: string, content: any, textContent: string) => {
      setIsSaving(true);
      
      // Extract hashtags
      const hashtagRegex = /#([\w-]+)/g;
      const tags = Array.from(new Set((textContent.match(hashtagRegex) || []).map(t => t.toLowerCase())));
      const now = new Date().toISOString();

      try {
        const { error } = await supabase
          .from('notes')
          .update({
            content,
            text_content: textContent,
            tags,
            updated_at: now,
          })
          .eq('id', id);

        if (error) throw error;
        
        setNotes(prev => prev.map(n => n.id === id ? { ...n, content, text_content: textContent, tags, updated_at: now } : n));
      } catch (error) {
        console.error('Error saving note:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  const updateNoteProject = async (id: string, project: string) => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('notes')
        .update({ project, updated_at: now })
        .eq('id', id);

      if (error) throw error;
      setNotes(prev => prev.map(n => n.id === id ? { ...n, project, updated_at: now } : n));
    } catch (error) {
      console.error('Error updating project:', error);
    }
  };

  const allKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(note => {
      note.tags?.forEach(tag => {
        const name = (tag.startsWith('#') ? tag.slice(1) : tag).toLowerCase();
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.keys(counts);
  }, [notes]);

  const allProjects = useMemo(() => {
    const projects = new Set(notes.map(n => n.project || 'General'));
    return Array.from(projects).sort();
  }, [notes]);

  const selectNote = useCallback((id: string | null) => {
    if (activeNoteId && activeNoteId !== id) {
      const currentNote = notes.find(n => n.id === activeNoteId);
      // If note is empty (only whitespace or empty), delete it
      if (currentNote && !currentNote.text_content.trim()) {
        deleteNote(activeNoteId);
      }
    }
    setActiveNoteId(id);
  }, [activeNoteId, notes, deleteNote]);

  return {
    notes,
    activeNote,
    allKeywords,
    allProjects,
    setActiveNoteId: selectNote,
    createNote,
    deleteNote,
    saveNote,
    updateNoteProject,
    isLoading,
    isSaving,
  };
}

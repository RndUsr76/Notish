import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Mock storage for local-only mode
class MockSupabase {
  getNotes() {
    const data = localStorage.getItem('notish_mock_notes');
    return data ? JSON.parse(data) : [];
  }
  saveNotes(notes: any[]) {
    localStorage.setItem('notish_mock_notes', JSON.stringify(notes));
  }
  from(_table: string) {
    return {
      select: () => ({
        order: () => Promise.resolve({ data: this.getNotes(), error: null })
      }),
      insert: (rows: any[]) => {
        const notes = this.getNotes();
        const newRows = rows.map(r => ({ 
          ...r, 
          id: crypto.randomUUID(), 
          project: r.project || 'General',
          created_at: new Date().toISOString(), 
          updated_at: new Date().toISOString() 
        }));
        this.saveNotes([...newRows, ...notes]);
        return { select: () => ({ single: () => Promise.resolve({ data: newRows[0], error: null }) }) };
      },
      update: (updates: any) => ({
        eq: (col: string, val: any) => {
          const notes = this.getNotes();
          const updated = notes.map((n: any) => n[col] === val ? { ...n, ...updates } : n);
          this.saveNotes(updated);
          const single = updated.find((n: any) => n[col] === val);
          return { select: () => ({ single: () => Promise.resolve({ data: single, error: null }) }) };
        }
      }),
      delete: () => ({
        eq: (col: string, val: any) => {
          const notes = this.getNotes();
          const filtered = notes.filter((n: any) => n[col] !== val);
          this.saveNotes(filtered);
          return Promise.resolve({ error: null });
        }
      })
    } as any;
  }
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new MockSupabase() as any;


export interface Note {
  id: string;
  user_id: string;
  content: any; // TipTap JSON
  text_content: string;
  tags: string[];
  project: string; // Folder-like structure
  created_at: string;
  updated_at: string;
}

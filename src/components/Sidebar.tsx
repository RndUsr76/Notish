import type { Note } from '../lib/supabase';
import { Plus, Search, Folder, ChevronRight, ChevronDown, List, Tag, LogOut } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onMoveNoteToProject: (noteId: string, projectId: string) => void;
  user: User;
}

type ViewMode = 'project' | 'keyword';

export function Sidebar({ notes, activeNoteId, onSelectNote, onCreateNote, onMoveNoteToProject, user }: SidebarProps) {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({ 'General': true });
  const [keywordClicks, setKeywordClicks] = useState<Record<string, number>>({});
  const [showAllKeywords, setShowAllKeywords] = useState(false);

  useEffect(() => {
    if (user.id) {
      const saved = localStorage.getItem(`notish_keyword_clicks_${user.id}`);
      setKeywordClicks(saved ? JSON.parse(saved) : {});
    }
  }, [user.id]);

  useEffect(() => {
    if (user.id) {
      localStorage.setItem(`notish_keyword_clicks_${user.id}`, JSON.stringify(keywordClicks));
    }
  }, [keywordClicks, user.id]);

  const allKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(note => {
      note.tags?.forEach(tag => {
        const name = (tag.startsWith('#') ? tag.slice(1) : tag).toLowerCase();
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.keys(counts).sort();
  }, [notes]);

  const topKeywords = useMemo(() => {
    return Object.entries(keywordClicks)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([name]) => name);
  }, [keywordClicks]);

  const handleKeywordClick = (keyword: string) => {
    setKeywordClicks(prev => ({
      ...prev,
      [keyword]: (prev[keyword] || 0) + 1
    }));
    setSelectedKeyword(keyword);
    setViewMode('keyword');
    setShowAllKeywords(false);
  };

  const filteredNotes = useMemo(() => {
    let result = notes;
    
    if (search) {
      result = result.filter(n => n.text_content.toLowerCase().includes(search.toLowerCase()));
    }

    if (viewMode === 'keyword' && selectedKeyword) {
      result = result.filter(n => n.tags?.some(t => t.toLowerCase() === `#${selectedKeyword.toLowerCase()}` || t.toLowerCase() === selectedKeyword.toLowerCase()));
    }

    return result;
  }, [notes, search, viewMode, selectedKeyword]);

  const projectGroups = useMemo(() => {
    const groups: Record<string, Note[]> = {};
    filteredNotes.forEach(note => {
      const p = note.project || 'General';
      if (!groups[p]) groups[p] = [];
      groups[p].push(note);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredNotes]);

  const toggleProject = (project: string) => {
    setExpandedProjects(prev => ({ ...prev, [project]: !prev[project] }));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, project: string) => {
    e.preventDefault();
    const noteId = e.dataTransfer.getData('noteId');
    if (noteId) {
      onMoveNoteToProject(noteId, project);
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container" onClick={() => { setViewMode('project'); setSelectedKeyword(null); }} style={{ cursor: 'pointer' }}>
          <div className="logo-box">N</div>
          <span className="welcome-title" style={{ fontSize: '18px', marginBottom: 0 }}>Notish</span>
        </div>
        <button onClick={onCreateNote} className="toolbar-btn">
          <Plus size={20} />
        </button>
      </div>

      <div className="sidebar-search">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={14} />
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="keyword-section">
        <div className="top-keywords">
          {topKeywords.map(kw => (
            <button 
              key={kw} 
              className={`keyword-pill ${selectedKeyword === kw && viewMode === 'keyword' ? 'active' : ''}`}
              onClick={() => handleKeywordClick(kw)}
            >
              #{kw}
            </button>
          ))}
          <button 
            className="keyword-pill-more"
            onClick={() => setShowAllKeywords(!showAllKeywords)}
            title="All keywords"
          >
            <Tag size={14} />
          </button>
        </div>

        {showAllKeywords && (
          <div className="all-keywords-dropdown">
            {allKeywords.length > 0 ? allKeywords.map(kw => (
              <button key={kw} onClick={() => handleKeywordClick(kw)}>#{kw}</button>
            )) : <div className="no-keywords">No keywords found</div>}
          </div>
        )}

        {viewMode === 'keyword' && (
          <button className="view-mode-toggle" onClick={() => { setViewMode('project'); setSelectedKeyword(null); }}>
             <List size={14} /> Project view
          </button>
        )}
      </div>

      <div className="note-list">
        {projectGroups.map(([project, projectNotes]) => (
          <div 
            key={project} 
            className="project-group"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, project)}
          >
            <div className="project-header" onClick={() => toggleProject(project)}>
              {expandedProjects[project] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <Folder size={14} className="folder-icon" />
              <span>{project}</span>
              <span className="project-count">{projectNotes.length}</span>
            </div>
            
            {expandedProjects[project] && (
              <div className="project-content">
                {projectNotes.map(note => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    isActive={note.id === activeNoteId}
                    onClick={() => onSelectNote(note.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="user-profile">
        <div className="user-info">
          <div className="user-avatar">
            {user.email?.[0].toUpperCase()}
          </div>
          <div className="user-email" title={user.email}>
            {user.email}
          </div>
        </div>
        <button 
          onClick={() => supabase.auth.signOut()} 
          className="toolbar-btn logout-btn"
          title="Sign Out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}

function NoteItem({ note, isActive, onClick }: { note: Note, isActive: boolean, onClick: () => void }) {
  const title = note.text_content.trim().split('\n')[0] || 'Untitled Note';
  const preview = note.text_content.trim().split('\n').slice(1).join(' ').slice(0, 60);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('noteId', note.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      className={`note-item ${isActive ? 'active' : ''}`}
    >
      <div className="note-title">{title}</div>
      <div className="note-meta">
        <div className="note-preview">{preview || 'No additional content...'}</div>
        <div className="note-time">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: false })}
        </div>
      </div>
    </button>
  );
}

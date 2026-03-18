import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

import { useEffect, useState, useCallback } from 'react';
import { Bold, Italic, List, ListOrdered, Heading1, Heading2, Trash2, CheckCircle2, Folder, ZoomIn, ZoomOut, Plus, Wand2, Loader2 } from 'lucide-react';

import { Extension } from '@tiptap/core';
import { VoiceNoteButton } from './VoiceNoteButton';
import { useFixText } from '../hooks/useFixText';

interface EditorProps {
  content: any;
  project: string;
  allKeywords: string[];
  onUpdate: (content: any, text: string) => void;
  onUpdateProject: (project: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onDelete: () => void;
  isSaving: boolean;
  zoom: number;
  allProjects: string[];
}

// Custom extension to auto-hashtag previously used keywords
const AutoHashtag = Extension.create({
  name: 'autoHashtag',
  addOptions() {
    return {
      allKeywords: [] as string[],
    }
  },
  addKeyboardShortcuts() {
    return {
      Space: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;
        
        // Get word before cursor
        const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, ' ');
        const words = textBefore.split(/\s+/);
        const lastWord = words[words.length - 1];
        
        if (lastWord && !lastWord.startsWith('#')) {
          const lowerWord = lastWord.toLowerCase();
          if (this.options.allKeywords.includes(lowerWord)) {
            const startPos = $from.pos - lastWord.length;
            this.editor.commands.insertContentAt({ from: startPos, to: $from.pos }, `#${lastWord} `);
            return true;
          }
        }
        return false;
      },
    }
  }
});

/**
 * Converts a markdown string from the LLM to TipTap-compatible JSON.
 */
function markdownToTiptap(md: string): any {
  const lines = md.split('\n');
  const content: any[] = [];
  let inList: 'bullet' | 'ordered' | null = null;
  let listItems: any[] = [];

  const flushList = () => {
    if (inList && listItems.length > 0) {
      content.push({
        type: inList === 'ordered' ? 'orderedList' : 'bulletList',
        content: listItems,
      });
      listItems = [];
      inList = null;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    // Headings
    const h1Match = trimmed.match(/^#\s+(.+)/);
    const h2Match = trimmed.match(/^##\s+(.+)/);
    if (h2Match) {
      flushList();
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: h2Match[1] }],
      });
      continue;
    }
    if (h1Match) {
      flushList();
      content.push({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: h1Match[1] }],
      });
      continue;
    }

    // Bullet list
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      if (inList !== 'bullet') {
        flushList();
        inList = 'bullet';
      }
      listItems.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: bulletMatch[1] }] }],
      });
      continue;
    }

    // Ordered list
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    if (orderedMatch) {
      if (inList !== 'ordered') {
        flushList();
        inList = 'ordered';
      }
      listItems.push({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: orderedMatch[1] }] }],
      });
      continue;
    }

    // Regular paragraph
    flushList();
    content.push({
      type: 'paragraph',
      content: [{ type: 'text', text: trimmed }],
    });
  }

  flushList();
  return { type: 'doc', content };
}

export function Editor({ content, project, allKeywords, allProjects, onUpdate, onUpdateProject, onZoomIn, onZoomOut, onDelete, isSaving, zoom }: EditorProps) {
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const { fixText, isFixing } = useFixText();
  const editor = useEditor({
    extensions: [
      StarterKit,
      AutoHashtag.configure({
        allKeywords,
      }),
      Placeholder.configure({
        placeholder: 'Start writing your note... use #tags to organize',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON(), editor.getText());
    },
  });

  const handleVoiceResult = useCallback((structuredNote: string) => {
    if (!editor) return;

    const tiptapJson = markdownToTiptap(structuredNote);

    // If the editor is empty, replace all content; otherwise append
    const currentText = editor.getText().trim();
    if (!currentText) {
      editor.commands.setContent(tiptapJson);
    } else {
      // Insert at end
      editor.commands.focus('end');
      // Add a separator paragraph
      editor.commands.insertContent([
        { type: 'paragraph', content: [] },
        { type: 'horizontalRule' },
        ...tiptapJson.content,
      ]);
    }

    // Trigger save
    onUpdate(editor.getJSON(), editor.getText());
  }, [editor, onUpdate]);

  const handleFixText = useCallback(async () => {
    if (!editor) return;

    const text = editor.getText();
    if (!text.trim()) return;

    const fixed = await fixText(text);
    if (fixed) {
      const tiptapJson = markdownToTiptap(fixed);
      editor.commands.setContent(tiptapJson);
      onUpdate(editor.getJSON(), editor.getText());
    }
  }, [editor, fixText, onUpdate]);





  if (!editor) return null;

  return (
    <div className="main-content">
      <div className="toolbar">
        <div className="toolbar-group">
          <div style={{ position: 'relative' }}>
            <div 
              className="project-badge" 
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
            >
              <Folder size={14} className="folder-icon" />
              <span>{project}</span>
            </div>
            
            {showProjectDropdown && (
              <div className="project-dropdown">
                {allProjects.map(p => (
                  <button 
                    key={p} 
                    className="project-option"
                    onClick={() => {
                      onUpdateProject(p);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <Folder size={12} className="folder-icon" />
                    {p}
                  </button>
                ))}
                <button 
                  className="project-option create"
                  onClick={() => {
                    const newProject = prompt('New project name:');
                    if (newProject) onUpdateProject(newProject);
                    setShowProjectDropdown(false);
                  }}
                >
                  <Plus size={12} />
                  New Project...
                </button>
              </div>
            )}
          </div>
          <div className="divider" />
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
          >
            <Bold size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
          >
            <Italic size={18} />
          </button>
          <div className="divider" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 1 }) ? 'active' : ''}`}
          >
            <Heading1 size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`toolbar-btn ${editor.isActive('heading', { level: 2 }) ? 'active' : ''}`}
          >
            <Heading2 size={18} />
          </button>
          <div className="divider" />
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
          >
            <List size={18} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
          >
            <ListOrdered size={18} />
          </button>
          <div className="divider" />
          <VoiceNoteButton onResult={handleVoiceResult} />
          <div className="divider" />
          <button
            onClick={handleFixText}
            disabled={isFixing}
            className={`toolbar-btn keyword-gen-btn ${isFixing ? 'loading' : ''}`}
            title="Fixa texten"
          >
            {isFixing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Wand2 size={18} />
            )}
            <span className="btn-label">Fix text</span>
          </button>
          <div className="divider" />

          <div className="zoom-controls">
            <button onClick={onZoomOut} className="toolbar-btn" title="Zoom Out">
              <ZoomOut size={18} />
            </button>
            <span className="zoom-value">{zoom}%</span>
            <button onClick={onZoomIn} className="toolbar-btn" title="Zoom In">
              <ZoomIn size={18} />
            </button>
          </div>
        </div>

        <div className="toolbar-group">
          <div className="status-badge">
            <div className={`status-dot ${isSaving ? 'saving' : 'saved'}`} />
            <span>{isSaving ? 'Syncing...' : 'Saved'}</span>
            {!isSaving && <CheckCircle2 size={12} className="text-green-500" style={{ marginLeft: '-4px' }} />}
          </div>
          <div className="divider" />
          <button
            onClick={() => {
              if (confirm('Delete this note?')) onDelete();
            }}
            className="toolbar-btn"
            style={{ color: '#ef4444' }}
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="editor-content-wrapper">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

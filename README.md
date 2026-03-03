# 📓 Notish

A premium, minimalist note-taking application designed for focus, organization, and effortless capture.

## 🚀 Purpose & Philosophy
Notish is built for users who want a high-performance, aesthetically pleasing workspace to capture thoughts. It focuses on three core pillars:
1.  **Fast Entry**: Rich-text editing with automatic hashtag extraction.
2.  **Voice Capture**: Speech-to-structured-text using Large Language Models (LLM).
3.  **Automatic Organization**: Project-based folders and pervasive hashtag filtering.

---

## 🛠 Tech Stack

### Core
- **Frontend**: React 19 + TypeScript + Vite.
- **Styling**: Vanilla CSS with a heavy focus on HSL-based design tokens, glassmorphism, and smooth micro-animations.
- **Editor**: [TipTap](https://tiptap.dev/) (Headless rich-text framework).
- **Icons**: [Lucide React](https://lucide.dev/).

### Backend (Supabase)
- **Database**: PostgreSQL (with JSONB for rich text and Arrays for tags).
- **Authentication**: Supabase Auth (Email/Password & Social).
- **Edge Functions**: Deno-based serverless functions for secure LLM API orchestration.

### AI Integration
- **LLM**: Google Gemini 1.5/2.0 Flash (via Edge Functions).
- **Capabilities**: Real-time audio transcription + intelligent markdown structuring.

---

## 🏗 Architecture & Key Logic

### 1. Data Structure
Notes are stored in a `notes` table. The `content` field stores the TipTap JSON structure, while `text_content` stores a plain-text version used for searching and tag extraction.

### 2. Hashtag System (`useNotes.ts`)
The app automatically extracts hashtags (e.g., `#idea`, `#todo`) from the note content using regex. These tags are then used to populate the sidebar for global filtering.

### 3. Voice-to-Note Flow
1.  **Capture**: User records audio via `MediaRecorder` API in the browser (`useVoiceNote.ts`).
2.  **Edge Function**: The audio blob is sent to the Supabase Edge Function `voice-to-note`.
3.  **LLM Processing**:
    - The function utilizes **Gemini 1.5/2.0 Flash**.
    - It uses a custom prompt to transcribe and simultaneously structure the note into headers and bullet points.
    - **Robustness**: Includes a fallback mechanism that rotates between model variants if one is overloaded (503) or rate-limited (429).
4.  **Insertion**: The returned structured markdown is converted into TipTap JSON and inserted into the active note.

### 4. Authentication & Security
- **Multi-tenancy**: Every note is tied to a `user_id`.
- **Row Level Security (RLS)**: The database enforces that users can only read/write their own notes. Global API keys for Gemini are stored in Supabase Secrets, never exposed to the frontend.

---

## 📂 Project Structure
```text
/src
  /components      # UI Components (Editor, Sidebar, VoiceButton, etc.)
  /hooks           # Business logic (useNotes for state, useVoiceNote for AI)
  /lib             # Supabase client and shared types
  /assets          # Static assets
/supabase
  /functions       # Deno serverless functions (AI logic)
  schema.sql       # Database table definitions and RLS policies
```

---

## ⚙️ Setup & Deployment

### 1. Supabase Preparation
1.  Create a project on [Supabase.com](https://supabase.com).
2.  Run the contents of `supabase/schema.sql` in the SQL Editor.
3.  Enable Email or Social auth in the Auth settings.

### 2. LLM Configuration
1.  Obtain a Gemini API key from [Google AI Studio](https://aistudio.google.com/).
2.  Install Supabase CLI: `npm install -g supabase`.
3.  Login: `supabase login`.
4.  Set the API key secret:
    ```bash
    supabase secrets set GEMINI_API_KEY=your_key_here
    ```
5.  Deploy the function:
    ```bash
    supabase functions deploy voice-to-note
    ```

### 3. Local Development
1.  Clone the repo and `npm install`.
2.  Create a `.env` file:
    ```env
    VITE_SUPABASE_URL=your_project_url
    VITE_SUPABASE_ANON_KEY=your_anon_key
    ```
3.  Run `npm run dev`.

---

## 🎨 Design System
The app uses a strict CSS variable system in `index.css`:
- `--bg-primary`: Deep dark background (#050505).
- `--accent`: Vibrant blue (#3b82f6) used for focus points.
- Animations: Subtle `@keyframes voice-pulse-anim` for the recorder and `transition: var(--transition)` for all interactive elements.

# Notish - Premium Personal Notes App

A clean, robust, and fast notes application built for focus.

## Features
- **Rich-text Note Editing**: Support for headings, lists, bold, italic, and more via TipTap.
- **Hashtag-based Organization**: Automatic tag extraction from note content.
- **Dynamic Sidebar**: Notes grouped by tags, sorted by most recently updated.
- **Dark Mode UI**: Professional, distraction-free aesthetic.
- **Autosave**: Changes are saved automatically as you type.
- **Supabase Integration**: Production-ready persistence.

## Tech Stack
- **Frontend**: React + TypeScript + Vite
- **Styling**: Vanilla CSS (Modern CSS Variables)
- **Editor**: TipTap (Headless Rich-Text)
- **Database**: Supabase
- **Icons**: Lucide React

## Setup Instructions

### 1. Database Setup (Supabase)
Run the following SQL in your Supabase SQL Editor:

```sql
create table notes (
  id uuid default gen_random_uuid() primary key,
  content jsonb not null default '{}'::jsonb,
  text_content text not null default '',
  tags text[] not null default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS (Optional for local MVP, but recommended)
-- alter table notes enable row level security;
-- create policy "All can access" on notes for all using (true);
```

### 2. Local Setup
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Configure Supabase:
   Create a `.env` file based on `.env.example` and fill in your credentials.
   *Note: If no credentials are provided, the app will run in **Mock Mode** using LocalStorage.*

4. Run the development server:
   ```bash
   npm run dev
   ```

## Design Choices
- **Vanilla CSS**: Used for maximum control over the "premium" feel and micro-interactions.
- **TipTap**: Chosen for its extensibility and ease of hashtag extraction.
- **Mock Mode**: Built-in fallback to LocalStorage ensures the MVP is "one-click" runnable even without a configured database.
- **Tag Grouping**: Normalizes `#tag` to `tag` for clean sidebar organization while keeping the user's hashtag syntax in the note.

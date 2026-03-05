# Polarkivet — Tauri Image Catalogue App: Architecture & Phased Plan

## Context

A portable desktop app for Mac and Windows that catalogues and searches images stored on a file share. The app must:
- Run without any server infrastructure
- Be distributable as a single binary placed on the file share itself
- Use OS-level file share auth pass-through (no custom auth code needed)
- Index images, extract metadata, generate thumbnails, and expose search

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Tauri App (cross-platform desktop shell)           │
│                                                     │
│  ┌──────────────────┐   IPC (Tauri commands)        │
│  │  Frontend        │◄──────────────────────────►  │
│  │  React + TS      │                   Rust Core   │
│  │  Vite bundler    │                               │
│  │                  │  ┌─────────────────────────┐  │
│  │  - Thumbnail grid│  │  Scanner                │  │
│  │  - Search bar    │  │  walkdir crate          │  │
│  │  - Lightbox view │  │  Recursive dir walk     │  │
│  │  - Settings pane │  ├─────────────────────────┤  │
│  │  - Scan progress │  │  Metadata extractor     │  │
│  └──────────────────┘  │  kamadak-exif crate     │  │
│                         │  image dimensions, date │  │
│                         ├─────────────────────────┤  │
│                         │  Thumbnail generator    │  │
│                         │  image crate (resize)   │  │
│                         │  stored in AppData      │  │
│                         ├─────────────────────────┤  │
│                         │  SQLite (rusqlite)      │  │
│                         │  images table + FTS5    │  │
│                         │  bundled, no install    │  │
│                         └─────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │ reads images via OS file API
         ▼
  File Share (SMB/NFS mounted by OS)
  Auth: pass-through via OS credentials
```

## Key Data Model (SQLite)

```sql
CREATE TABLE images (
  id          INTEGER PRIMARY KEY,
  path        TEXT UNIQUE NOT NULL,     -- absolute path on disk
  filename    TEXT NOT NULL,
  ext         TEXT,
  size_bytes  INTEGER,
  width       INTEGER,
  height      INTEGER,
  taken_at    TEXT,                     -- EXIF DateTimeOriginal
  indexed_at  TEXT NOT NULL,
  thumb_path  TEXT                      -- local cache path
);

CREATE VIRTUAL TABLE images_fts USING fts5(
  filename, path, content=images, content_rowid=id
);
```

## Rust Crate Dependencies

| Crate | Purpose |
|---|---|
| `tauri` + `tauri-build` | App shell, IPC, packaging |
| `walkdir` | Recursive directory traversal |
| `image` | Thumbnail generation (resize to 256px) |
| `kamadak-exif` | EXIF metadata extraction |
| `rusqlite` (bundled) | Embedded SQLite with FTS5 |
| `serde` + `serde_json` | Serialisation for IPC |
| `tokio` | Async runtime for background scanning |
| `chrono` | Date/time parsing and formatting |

## Frontend Stack

- React 18 + TypeScript
- Vite (Tauri default)
- TanStack Query (async state for Tauri commands)
- CSS Modules or Tailwind (TBD per preference)

---

## Phased Execution Plan

Each phase is self-contained and produces a working (if incomplete) app.

---

### Phase 1: Project Scaffold + DB Schema + Basic Scanner

**Goal:** Runnable Tauri app that walks a hardcoded directory, finds image files, and stores paths in SQLite.

**Tasks:**
1. `create-tauri-app` with React + TypeScript template
2. Add Rust deps: `walkdir`, `rusqlite` (bundled), `serde`, `serde_json`
3. Create SQLite DB in platform AppData dir on app startup
4. Run schema migrations (create tables + FTS5)
5. Implement `scan_directory(path: String)` Tauri command
   - Walk all files with image extensions (jpg, jpeg, png, gif, tiff, webp, heic)
   - Insert into `images` table (path, filename, ext, size_bytes)
   - Emit progress events via `tauri::Window::emit`
6. Basic React UI: text input for path + "Scan" button + console log output
7. Verify: scan runs, rows appear in DB

**Files to create/modify:**
- `src-tauri/src/main.rs`
- `src-tauri/src/db.rs` (schema + connection)
- `src-tauri/src/scanner.rs` (walkdir logic)
- `src-tauri/Cargo.toml`
- `src/App.tsx` (minimal scan trigger UI)

---

### Phase 2: Metadata Extraction + Thumbnail Generation

**Goal:** Each indexed image gets EXIF metadata and a local thumbnail stored in AppData.

**Tasks:**
1. Add Rust deps: `image`, `kamadak-exif`, `chrono`
2. Extend scanner to extract per-image:
   - Dimensions (width/height) via `image` crate
   - EXIF DateTimeOriginal → `taken_at` field
3. Thumbnail generation:
   - Resize longest edge to 256px, preserve aspect ratio
   - Save as JPEG to `AppData/polarkivet/thumbs/<hash>.jpg` (hash of path)
   - Store `thumb_path` in DB
4. Update `images` table with new columns
5. Run thumbnailing as a background Tauri async command with progress events
6. Verify: thumbnails appear on disk, DB rows have metadata

**Files to create/modify:**
- `src-tauri/src/scanner.rs` (extend with metadata + thumbs)
- `src-tauri/src/thumbs.rs` (thumbnail helper)
- `src-tauri/src/db.rs` (schema update)

---

### Phase 3: Frontend — Grid Browse UI

**Goal:** Functional thumbnail grid showing all indexed images.

**Tasks:**
1. Add TanStack Query + Tauri invoke wrapper
2. Implement `list_images(offset, limit)` Tauri command returning paginated results
3. Implement `get_thumb_url(thumb_path)` — use Tauri `asset://` protocol or `convertFileSrc` to serve local file
4. Build React components:
   - `<ImageGrid>` — virtualised/paginated thumbnail grid
   - `<ImageCard>` — single thumbnail tile with filename + date
   - `<ScanProgress>` — progress bar listening to scan events
5. Wire scan button to actual scan command with live progress
6. Verify: grid renders thumbnails from a real directory

**Files to create/modify:**
- `src/components/ImageGrid.tsx`
- `src/components/ImageCard.tsx`
- `src/components/ScanProgress.tsx`
- `src/hooks/useImages.ts`
- `src-tauri/src/commands.rs` (list_images command)

---

### Phase 4: Search

**Goal:** Full-text search across filenames + fuzzy filter by date range.

**Tasks:**
1. Implement FTS5 trigger to keep `images_fts` in sync on insert
2. Implement `search_images(query: String, from_date: Option<String>, to_date: Option<String>)` Tauri command using FTS5 + optional date filter
3. Build React search UI:
   - `<SearchBar>` with debounced input
   - Date range pickers (from/to)
   - Results feed into `<ImageGrid>`
4. Verify: search returns relevant results, date filter works

**Files to create/modify:**
- `src-tauri/src/db.rs` (FTS5 trigger + search query)
- `src-tauri/src/commands.rs` (search_images command)
- `src/components/SearchBar.tsx`
- `src/hooks/useSearch.ts`

---

### Phase 5: Lightbox + Settings + First-Run UX

**Goal:** Full viewing experience and polished onboarding.

**Tasks:**
1. `<Lightbox>` component — full-size image view via `asset://` protocol, prev/next navigation, EXIF metadata panel
2. Settings page:
   - Persist scan root path to `tauri-plugin-store` or plain JSON in AppData
   - Option to clear index and re-scan
   - Show index stats (image count, last scan time)
3. First-run flow: if no root path configured, show welcome screen asking user to select a folder (Tauri `dialog::open`)
4. Re-index on startup if root path is set (background, non-blocking)
5. Verify: end-to-end flow from fresh install through browse + search + view

**Files to create/modify:**
- `src/components/Lightbox.tsx`
- `src/components/Settings.tsx`
- `src/components/Welcome.tsx`
- `src-tauri/src/config.rs` (persist settings)
- `src/App.tsx` (routing/layout)

---

### Phase 6: Packaging + Distribution

**Goal:** Produce portable binaries for Mac and Windows that can be placed on a file share.

**Tasks:**
1. Configure `tauri.conf.json`:
   - `bundle.identifier`: `com.polarkivet.app`
   - Set `bundle.targets` to `["app", "nsis"]` (Mac `.app`, Windows NSIS installer or portable `.exe`)
   - Configure app icon
2. Mac: ad-hoc code sign (no Apple Developer account needed) to reduce Gatekeeper friction
   - `codesign --deep --force --sign - Polarkivet.app`
3. Windows: produce a standalone `.exe` (NSIS installer or Tauri portable target)
4. Write a `build.sh` / `build.ps1` that outputs both binaries
5. Document: place binaries on file share, user downloads and runs
6. Verify: binary runs on a clean Mac and Windows machine with no dependencies installed

**Files to create/modify:**
- `src-tauri/tauri.conf.json`
- `src-tauri/icons/` (app icons)
- `build.sh` / `build.ps1`
- `README.md` (distribution instructions)

---

## Cross-Cutting Concerns (apply throughout)

- **Path normalisation:** use `std::path::Path` everywhere, never string concat paths
- **Error handling:** all Tauri commands return `Result<T, String>` — surface errors to UI
- **DB migrations:** versioned schema in `db.rs`, run on startup
- **No network calls:** app is fully offline by design
- **Thumbnail cache:** stored in OS AppData, never written back to the share
- **Large shares:** scanning is async + chunked, never blocks the UI thread

---

## Verification Strategy (end-to-end)

1. Mount a test SMB share (or use a local folder as proxy)
2. Run app → first-run wizard → select share path
3. Trigger scan → observe progress bar completing
4. Browse grid → verify thumbnails load
5. Search by filename and date → verify results
6. Click image → verify lightbox opens full-size
7. Quit and relaunch → verify index persists, re-index runs in background
8. Copy binary to a second machine with no Rust/Node → verify it runs standalone

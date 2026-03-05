# Polarkivet — Claude Instructions

## Project Overview

A portable Tauri desktop app (Mac + Windows) for cataloguing and searching images stored on a file share.
No server infrastructure. OS-level SMB auth pass-through. Single binary distribution.

## Stack

- **Shell:** Tauri 2 (Rust backend + React/TypeScript frontend via Vite)
- **Storage:** Embedded SQLite via `rusqlite` (bundled feature, FTS5 enabled)
- **Key Rust crates:** `walkdir`, `image`, `kamadak-exif`, `tokio`, `serde`, `chrono`
- **Frontend:** React 18 + TypeScript, TanStack Query, Vite

## Project Structure (target)

```
polarkivet/
  src/                    React frontend
    components/
    hooks/
  src-tauri/
    src/
      main.rs
      db.rs               SQLite schema + migrations
      scanner.rs          Directory walk + image discovery
      thumbs.rs           Thumbnail generation
      commands.rs         Tauri IPC commands
      config.rs           Persisted settings
    Cargo.toml
    tauri.conf.json
  .claude/
    CLAUDE.md             (this file)
    plans/
      architecture.md     Full architecture and phased execution plan
```

## Implementation Phases

See [.claude/plans/architecture.md](.claude/plans/architecture.md) for the full plan.

| Phase | Goal | Status |
|---|---|---|
| 1 | Scaffold + SQLite schema + basic scanner | complete |
| 2 | EXIF metadata + thumbnail generation | complete |
| 3 | React thumbnail grid UI | pending |
| 4 | Full-text search (FTS5) + date filter | pending |
| 5 | Lightbox + settings + first-run UX | pending |
| 6 | Mac/Windows packaging + distribution | pending |

Update the Status column as phases are completed.

## Conventions

- All Tauri commands return `Result<T, String>` — always surface errors to the UI
- Use `std::path::Path` for all path operations, never string concatenation
- DB schema changes go in versioned migrations inside `db.rs`, run on startup
- Thumbnails are cached in OS AppData only — never written back to the file share
- Scanning is always async and non-blocking to the UI thread
- No network calls — the app is fully offline by design

## Key Commands

```bash
# Install prerequisites (once)
cargo install tauri-cli

# Dev mode
cargo tauri dev

# Build release binaries
cargo tauri build
```

# Polarkivet

A portable desktop application for cataloguing and searching images stored on a file share.

## Overview

Polarkivet runs on Mac and Windows with no server infrastructure required. Download the binary, point it at a file share, and it will index your images locally — making them browsable and searchable.

- **No installation required** — single binary, runs from a file share
- **Auth pass-through** — uses your OS credentials for file share access (SMB/NFS)
- **Offline** — all indexing and search happens locally
- **Fast search** — full-text search powered by SQLite FTS5

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Tauri](https://tauri.app) (Rust + WebView) |
| Frontend | React 18 + TypeScript + Vite |
| Database | SQLite (embedded via `rusqlite`) |
| Search | SQLite FTS5 |
| Thumbnails | Cached in OS AppData via `image` crate |

## Distribution

### macOS

Run `./build.sh` from the repo root. This produces `dist-mac/Polarkivet.dmg` — a universal binary (arm64 + x86_64) that is ad-hoc signed to reduce Gatekeeper friction.

Users download the DMG, drag **Polarkivet.app** to Applications (or run directly), and on first launch may need to right-click → **Open** to bypass Gatekeeper.

Place the `.dmg` on the file share so users can download and run it without any installation of Rust or Node.

### Windows

Run `.\build.ps1` from the repo root in PowerShell. This produces an NSIS installer `.exe` in `src-tauri/target/release/bundle/nsis/`.

The installer bundles the WebView2 runtime and produces a standalone binary. No Rust, Node, or other dependencies required on the target machine.

Place the installer `.exe` on the file share.

---

## Development

### Prerequisites

- [Rust](https://rustup.rs) toolchain
- Node.js 18+
- Tauri CLI: `cargo install tauri-cli`
- Platform dependencies: see [Tauri prerequisites](https://tauri.app/start/prerequisites/)

### Run in dev mode

```bash
cargo tauri dev
```

### Build release binary

```bash
# macOS (universal binary + DMG)
./build.sh

# Windows (NSIS installer)
.\build.ps1

# Or build for current platform only
cargo tauri build
```

Output binaries are placed in `src-tauri/target/release/bundle/`.

## Architecture & Roadmap

See [.claude/plans/architecture.md](.claude/plans/architecture.md) for the full architecture design and phased implementation plan.

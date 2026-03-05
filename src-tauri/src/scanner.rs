use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "tiff", "tif", "webp", "heic"];

#[derive(Serialize, Clone)]
struct ScanProgress {
    scanned: u64,
    found: u64,
    current_file: String,
}

#[tauri::command]
pub async fn scan_directory(app: AppHandle, path: String) -> Result<u64, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || do_scan(app, app_dir, path))
        .await
        .map_err(|e| e.to_string())?
}

fn do_scan(app: AppHandle, app_dir: PathBuf, path: String) -> Result<u64, String> {
    let scan_root = Path::new(&path);
    if !scan_root.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;

    let mut scanned: u64 = 0;
    let mut found: u64 = 0;

    for entry in WalkDir::new(scan_root)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let file_path = entry.path();
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        scanned += 1;

        if !IMAGE_EXTENSIONS.contains(&ext.as_str()) {
            continue;
        }

        let path_str = file_path.to_string_lossy().to_string();
        let filename = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let size_bytes = entry.metadata().map(|m| m.len() as i64).unwrap_or(0);
        let indexed_at = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT OR IGNORE INTO images (path, filename, ext, size_bytes, indexed_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![path_str, filename, ext, size_bytes, indexed_at],
        )
        .map_err(|e| e.to_string())?;

        found += 1;

        let _ = app.emit(
            "scan-progress",
            ScanProgress {
                scanned,
                found,
                current_file: filename,
            },
        );
    }

    Ok(found)
}

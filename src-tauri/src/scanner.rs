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
    let thumbs_dir = app_dir.join("thumbs");

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

        // Fill metadata for rows that don't have it yet (new inserts or Phase 1 legacy rows).
        let needs_meta: bool = conn
            .query_row(
                "SELECT width IS NULL FROM images WHERE path = ?1",
                rusqlite::params![path_str],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if needs_meta {
            let _ = fill_metadata(&conn, file_path, &path_str, &thumbs_dir);
        }

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

/// Extract image dimensions, EXIF date, and generate a thumbnail.
/// Updates the DB row in place. Errors are logged but not fatal.
fn fill_metadata(
    conn: &rusqlite::Connection,
    file_path: &Path,
    path_str: &str,
    thumbs_dir: &Path,
) -> Result<(), String> {
    // Open image once for dimensions + thumbnail.
    let img = image::open(file_path).map_err(|e| e.to_string())?;
    let (width, height) = img.dimensions();

    // Generate thumbnail.
    let thumb_path = crate::thumbs::generate_from_image(&img, file_path, thumbs_dir)
        .ok()
        .map(|p| p.to_string_lossy().to_string());

    // Extract EXIF date (best-effort; many formats have no EXIF).
    let taken_at = extract_exif_date(file_path);

    conn.execute(
        "UPDATE images SET width = ?1, height = ?2, taken_at = ?3, thumb_path = ?4
         WHERE path = ?5",
        rusqlite::params![width as i64, height as i64, taken_at, thumb_path, path_str],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

fn extract_exif_date(path: &Path) -> Option<String> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif = exif::Reader::new()
        .read_from_container(&mut reader)
        .ok()?;
    let field = exif.get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)?;
    let raw = field.display_value().to_string();
    // EXIF format: "2023-01-15 14:30:00" or "2023:01:15 14:30:00"
    let normalised = raw.replacen(':', "-", 2); // fix date separator only
    chrono::NaiveDateTime::parse_from_str(&normalised, "%Y-%m-%d %H:%M:%S")
        .ok()
        .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
}

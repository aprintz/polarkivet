use rusqlite::types::ToSql;
use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct Stats {
    pub image_count: i64,
    pub last_indexed_at: Option<String>,
}

#[tauri::command]
pub async fn get_config(app: AppHandle) -> Result<crate::config::Config, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(crate::config::load(&app_dir))
}

#[tauri::command]
pub async fn save_config(app: AppHandle, scan_root: Option<String>) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let mut config = crate::config::load(&app_dir);
    config.scan_root = scan_root;
    crate::config::save(&app_dir, &config)
}

#[tauri::command]
pub async fn clear_index(app: AppHandle) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;
        conn.execute_batch(
            "DELETE FROM images;
             INSERT INTO images_fts(images_fts) VALUES('rebuild');",
        )
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn get_stats(app: AppHandle) -> Result<Stats, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;
        let image_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM images", [], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        let last_indexed_at: Option<String> = conn
            .query_row("SELECT MAX(indexed_at) FROM images", [], |row| row.get(0))
            .unwrap_or(None);
        Ok(Stats {
            image_count,
            last_indexed_at,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[derive(Serialize)]
pub struct ImageRecord {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub taken_at: Option<String>,
    pub thumb_path: Option<String>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub keywords: Option<String>,
    pub description: Option<String>,
}

const IMAGE_SELECT: &str =
    "SELECT id, path, filename, width, height, taken_at, thumb_path,
            camera_make, camera_model, keywords, description
     FROM images";

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ImageRecord> {
    Ok(ImageRecord {
        id: row.get(0)?,
        path: row.get(1)?,
        filename: row.get(2)?,
        width: row.get(3)?,
        height: row.get(4)?,
        taken_at: row.get(5)?,
        thumb_path: row.get(6)?,
        camera_make: row.get(7)?,
        camera_model: row.get(8)?,
        keywords: row.get(9)?,
        description: row.get(10)?,
    })
}

#[tauri::command]
pub async fn list_images(app: AppHandle, offset: i64, limit: i64) -> Result<Vec<ImageRecord>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;

        let sql = format!(
            "{} ORDER BY taken_at DESC NULLS LAST, indexed_at DESC LIMIT ?1 OFFSET ?2",
            IMAGE_SELECT
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![limit, offset], map_row)
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn search_images(
    app: AppHandle,
    query: String,
    from_date: Option<String>,
    to_date: Option<String>,
    offset: i64,
    limit: i64,
) -> Result<Vec<ImageRecord>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;

        let rows: Vec<ImageRecord> = if query.is_empty() {
            // Date-only filter — no FTS
            let sql = format!(
                "{} WHERE (?1 IS NULL OR taken_at >= ?1) AND (?2 IS NULL OR taken_at <= ?2)
                 ORDER BY taken_at DESC NULLS LAST, indexed_at DESC
                 LIMIT ?3 OFFSET ?4",
                IMAGE_SELECT
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let params: &[&dyn ToSql] = &[&from_date, &to_date, &limit, &offset];
            let result: Vec<ImageRecord> = stmt.query_map(params, map_row)
                .map_err(|e| e.to_string())?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|e| e.to_string())?;
            result
        } else {
            // FTS5 search across filename, path, camera_make, camera_model, keywords, description
            let fts_query = format!("{}*", query.trim());
            let sql = format!(
                "SELECT i.id, i.path, i.filename, i.width, i.height, i.taken_at, i.thumb_path,
                        i.camera_make, i.camera_model, i.keywords, i.description
                 FROM images i
                 JOIN images_fts f ON f.rowid = i.id
                 WHERE images_fts MATCH ?1
                   AND (?2 IS NULL OR i.taken_at >= ?2)
                   AND (?3 IS NULL OR i.taken_at <= ?3)
                 ORDER BY rank
                 LIMIT ?4 OFFSET ?5"
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            let params: &[&dyn ToSql] = &[&fts_query, &from_date, &to_date, &limit, &offset];
            let result: Vec<ImageRecord> = stmt.query_map(params, map_row)
                .map_err(|e| e.to_string())?
                .collect::<rusqlite::Result<Vec<_>>>()
                .map_err(|e| e.to_string())?;
            result
        };

        Ok(rows)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Update the keywords for an image both in the DB and in the image file (JPEG XMP only).
#[tauri::command]
pub async fn update_keywords(app: AppHandle, id: i64, keywords: String) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;

        // Update DB
        conn.execute(
            "UPDATE images SET keywords = ?1 WHERE id = ?2",
            rusqlite::params![keywords, id],
        )
        .map_err(|e| e.to_string())?;

        // Get file path to write XMP
        let path: String = conn
            .query_row("SELECT path FROM images WHERE id = ?1", rusqlite::params![id], |r| r.get(0))
            .map_err(|e| e.to_string())?;

        let file_path = std::path::Path::new(&path);
        let ext = file_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if ext == "jpg" || ext == "jpeg" {
            crate::scanner::write_xmp_keywords_to_jpeg(file_path, &keywords)?;
        }
        // For non-JPEG formats we update only the DB (file writing not supported yet).

        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

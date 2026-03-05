use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct ImageRecord {
    pub id: i64,
    pub path: String,
    pub filename: String,
    pub width: Option<i64>,
    pub height: Option<i64>,
    pub taken_at: Option<String>,
    pub thumb_path: Option<String>,
}

#[tauri::command]
pub async fn list_images(app: AppHandle, offset: i64, limit: i64) -> Result<Vec<ImageRecord>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;

    tokio::task::spawn_blocking(move || {
        let conn = crate::db::open(&app_dir).map_err(|e| e.to_string())?;

        let mut stmt = conn
            .prepare(
                "SELECT id, path, filename, width, height, taken_at, thumb_path
                 FROM images
                 ORDER BY taken_at DESC NULLS LAST, indexed_at DESC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![limit, offset], |row| {
                Ok(ImageRecord {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    filename: row.get(2)?,
                    width: row.get(3)?,
                    height: row.get(4)?,
                    taken_at: row.get(5)?,
                    thumb_path: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

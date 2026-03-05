use rusqlite::{Connection, Result};
use std::path::Path;

pub fn init(app_dir: &Path) -> Result<()> {
    let conn = open(app_dir)?;
    migrate(&conn)?;
    Ok(())
}

pub fn open(app_dir: &Path) -> Result<Connection> {
    let db_path = app_dir.join("polarkivet.db");
    Connection::open(db_path)
}

fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "
        PRAGMA journal_mode=WAL;

        CREATE TABLE IF NOT EXISTS images (
            id          INTEGER PRIMARY KEY,
            path        TEXT UNIQUE NOT NULL,
            filename    TEXT NOT NULL,
            ext         TEXT,
            size_bytes  INTEGER,
            width       INTEGER,
            height      INTEGER,
            taken_at    TEXT,
            indexed_at  TEXT NOT NULL,
            thumb_path  TEXT
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS images_fts USING fts5(
            filename, path, content=images, content_rowid=id
        );
        ",
    )
}

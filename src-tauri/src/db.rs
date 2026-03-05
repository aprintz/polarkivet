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
    // Base schema
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
        ",
    )?;

    // Add new metadata columns if they don't exist yet (safe to run on existing DBs)
    for col_sql in &[
        "ALTER TABLE images ADD COLUMN camera_make TEXT",
        "ALTER TABLE images ADD COLUMN camera_model TEXT",
        "ALTER TABLE images ADD COLUMN keywords TEXT",
        "ALTER TABLE images ADD COLUMN description TEXT",
    ] {
        let _ = conn.execute_batch(col_sql); // ignore "duplicate column" errors
    }

    // Recreate FTS table + triggers so they always cover all metadata columns.
    // DROP + CREATE is idempotent because we use content=images (the FTS is just an index).
    conn.execute_batch(
        "
        DROP TABLE IF EXISTS images_fts;
        DROP TRIGGER IF EXISTS images_fts_insert;
        DROP TRIGGER IF EXISTS images_fts_delete;
        DROP TRIGGER IF EXISTS images_fts_update;

        CREATE VIRTUAL TABLE images_fts USING fts5(
            filename, path, camera_make, camera_model, keywords, description,
            content=images, content_rowid=id
        );

        CREATE TRIGGER images_fts_insert AFTER INSERT ON images BEGIN
            INSERT INTO images_fts(rowid, filename, path, camera_make, camera_model, keywords, description)
            VALUES (new.id, new.filename, new.path, new.camera_make, new.camera_model, new.keywords, new.description);
        END;

        CREATE TRIGGER images_fts_delete AFTER DELETE ON images BEGIN
            INSERT INTO images_fts(images_fts, rowid, filename, path, camera_make, camera_model, keywords, description)
            VALUES ('delete', old.id, old.filename, old.path, old.camera_make, old.camera_model, old.keywords, old.description);
        END;

        CREATE TRIGGER images_fts_update AFTER UPDATE ON images BEGIN
            INSERT INTO images_fts(images_fts, rowid, filename, path, camera_make, camera_model, keywords, description)
            VALUES ('delete', old.id, old.filename, old.path, old.camera_make, old.camera_model, old.keywords, old.description);
            INSERT INTO images_fts(rowid, filename, path, camera_make, camera_model, keywords, description)
            VALUES (new.id, new.filename, new.path, new.camera_make, new.camera_model, new.keywords, new.description);
        END;

        INSERT INTO images_fts(images_fts) VALUES('rebuild');
        ",
    )?;

    Ok(())
}

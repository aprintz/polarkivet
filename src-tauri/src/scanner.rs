use image::GenericImageView;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Manager};
use walkdir::WalkDir;

const IMAGE_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "tiff", "tif", "webp", "heic"];

/// Namespace marker used in JPEG APP1 XMP segments
const XMP_MARKER: &[u8] = b"http://ns.adobe.com/xap/1.0/\0";

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

    tauri::async_runtime::spawn_blocking(move || do_scan(app, app_dir, path))
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

        // Fill metadata for rows that don't have it yet
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

/// Extract image dimensions, EXIF metadata (date, camera, description), XMP keywords,
/// and generate a thumbnail. Updates the DB row in place. Errors are non-fatal.
fn fill_metadata(
    conn: &rusqlite::Connection,
    file_path: &Path,
    path_str: &str,
    thumbs_dir: &Path,
) -> Result<(), String> {
    let img = image::open(file_path).map_err(|e| e.to_string())?;
    let (width, height) = img.dimensions();

    let thumb_path = crate::thumbs::generate_from_image(&img, file_path, thumbs_dir)
        .ok()
        .map(|p| p.to_string_lossy().to_string());

    let exif_meta = extract_exif_meta(file_path);
    let xmp_keywords = extract_xmp_keywords(file_path);

    // Merge keywords: prefer XMP keywords if present, otherwise use EXIF UserComment keywords
    let keywords = if !xmp_keywords.is_empty() {
        Some(xmp_keywords)
    } else {
        exif_meta.as_ref().and_then(|m| m.keywords.clone())
    };

    conn.execute(
        "UPDATE images
         SET width = ?1, height = ?2, taken_at = ?3, thumb_path = ?4,
             camera_make = ?5, camera_model = ?6, keywords = ?7, description = ?8
         WHERE path = ?9",
        rusqlite::params![
            width as i64,
            height as i64,
            exif_meta.as_ref().and_then(|m| m.taken_at.as_deref()),
            thumb_path,
            exif_meta.as_ref().and_then(|m| m.camera_make.as_deref()),
            exif_meta.as_ref().and_then(|m| m.camera_model.as_deref()),
            keywords,
            exif_meta.as_ref().and_then(|m| m.description.as_deref()),
            path_str,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

struct ExifMeta {
    taken_at: Option<String>,
    camera_make: Option<String>,
    camera_model: Option<String>,
    description: Option<String>,
    keywords: Option<String>,
}

fn extract_exif_meta(path: &Path) -> Option<ExifMeta> {
    let file = std::fs::File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;

    let taken_at = exif
        .get_field(exif::Tag::DateTimeOriginal, exif::In::PRIMARY)
        .map(|f| {
            let raw = f.display_value().to_string();
            let normalised = raw.replacen(':', "-", 2);
            chrono::NaiveDateTime::parse_from_str(&normalised, "%Y-%m-%d %H:%M:%S")
                .ok()
                .map(|dt| dt.format("%Y-%m-%dT%H:%M:%S").to_string())
        })
        .flatten();

    let camera_make = exif
        .get_field(exif::Tag::Make, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string().trim_matches('"').to_string());

    let camera_model = exif
        .get_field(exif::Tag::Model, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string().trim_matches('"').to_string());

    let description = exif
        .get_field(exif::Tag::ImageDescription, exif::In::PRIMARY)
        .map(|f| f.display_value().to_string().trim_matches('"').to_string());

    Some(ExifMeta {
        taken_at,
        camera_make,
        camera_model,
        description,
        keywords: None, // EXIF doesn't carry keywords; use XMP
    })
}

/// Read XMP keywords from a JPEG file's APP1 XMP segment.
/// Returns a comma-separated string of keywords, or empty string if none found.
pub fn extract_xmp_keywords(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if ext == "jpg" || ext == "jpeg" {
        if let Ok(data) = std::fs::read(path) {
            if let Ok(jpeg) = img_parts::jpeg::Jpeg::from_bytes(data.into()) {
                return parse_xmp_keywords_from_jpeg(&jpeg);
            }
        }
    }
    String::new()
}

fn parse_xmp_keywords_from_jpeg(jpeg: &img_parts::jpeg::Jpeg) -> String {
    // Walk all APP1 segments looking for XMP
    for segment in jpeg.segments() {
        if segment.marker() != img_parts::jpeg::markers::APP1 {
            continue;
        }
        let content = segment.contents();
        if !content.starts_with(XMP_MARKER) {
            continue;
        }
        let xmp_str = std::str::from_utf8(&content[XMP_MARKER.len()..]).unwrap_or("");
        return parse_dc_subject(xmp_str);
    }
    String::new()
}

/// Very lightweight XMP dc:subject parser — no XML crate needed.
/// Finds all <rdf:li>…</rdf:li> inside <dc:subject>…</dc:subject>.
fn parse_dc_subject(xmp: &str) -> String {
    let start_tag = "<dc:subject>";
    let end_tag = "</dc:subject>";
    let subject_start = match xmp.find(start_tag) {
        Some(i) => i + start_tag.len(),
        None => return String::new(),
    };
    let subject_end = match xmp[subject_start..].find(end_tag) {
        Some(i) => subject_start + i,
        None => return String::new(),
    };
    let subject_block = &xmp[subject_start..subject_end];

    let mut keywords = Vec::new();
    let mut search = subject_block;
    while let Some(li_start) = search.find("<rdf:li>") {
        let after_open = li_start + "<rdf:li>".len();
        if let Some(li_end) = search[after_open..].find("</rdf:li>") {
            let kw = search[after_open..after_open + li_end].trim().to_string();
            if !kw.is_empty() {
                keywords.push(kw);
            }
            search = &search[after_open + li_end + "</rdf:li>".len()..];
        } else {
            break;
        }
    }
    keywords.join(", ")
}

/// Write keywords into a JPEG file's XMP APP1 segment.
/// Creates a new XMP segment if none exists; replaces dc:subject if it does.
/// Returns Err for non-JPEG files or on IO errors.
pub fn write_xmp_keywords_to_jpeg(path: &Path, keywords: &str) -> Result<(), String> {
    let data = std::fs::read(path).map_err(|e| e.to_string())?;
    let mut jpeg =
        img_parts::jpeg::Jpeg::from_bytes(data.into()).map_err(|e| e.to_string())?;

    let new_xmp = build_xmp_with_keywords(keywords);
    let mut new_xmp_segment_data = Vec::with_capacity(XMP_MARKER.len() + new_xmp.len());
    new_xmp_segment_data.extend_from_slice(XMP_MARKER);
    new_xmp_segment_data.extend_from_slice(new_xmp.as_bytes());

    // Remove existing XMP APP1 segment(s)
    jpeg.segments_mut().retain(|seg| {
        if seg.marker() != img_parts::jpeg::markers::APP1 {
            return true;
        }
        !seg.contents().starts_with(XMP_MARKER)
    });

    // Insert new XMP segment right after SOI (position 0 in the segment list is fine)
    let new_seg = img_parts::jpeg::JpegSegment::new_with_contents(
        img_parts::jpeg::markers::APP1,
        img_parts::Bytes::from(new_xmp_segment_data),
    );
    jpeg.segments_mut().insert(0, new_seg);

    let mut out = Vec::new();
    jpeg.encoder().write_to(&mut out).map_err(|e| e.to_string())?;
    std::fs::write(path, out).map_err(|e| e.to_string())
}

fn build_xmp_with_keywords(keywords: &str) -> String {
    let li_items: String = keywords
        .split(',')
        .map(|kw| kw.trim())
        .filter(|kw| !kw.is_empty())
        .map(|kw| format!("      <rdf:li>{}</rdf:li>\n", kw))
        .collect();

    format!(
        r#"<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:subject>
        <rdf:Bag>
{}        </rdf:Bag>
      </dc:subject>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"#,
        li_items
    )
}

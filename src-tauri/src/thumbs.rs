use image::DynamicImage;
use std::path::{Path, PathBuf};

const THUMB_SIZE: u32 = 256;

/// Returns a stable hex filename for a given path using FNV-1a hashing.
fn path_hash(path: &Path) -> String {
    let s = path.to_string_lossy();
    let mut hash: u64 = 14695981039346656037;
    for byte in s.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    format!("{:016x}", hash)
}

/// Generate a thumbnail from an already-opened `DynamicImage`.
/// Skips writing if the thumbnail already exists on disk.
pub fn generate_from_image(
    img: &DynamicImage,
    image_path: &Path,
    thumbs_dir: &Path,
) -> Result<PathBuf, String> {
    std::fs::create_dir_all(thumbs_dir).map_err(|e| e.to_string())?;

    let thumb_path = thumbs_dir.join(format!("{}.jpg", path_hash(image_path)));

    if !thumb_path.exists() {
        let thumb = img.thumbnail(THUMB_SIZE, THUMB_SIZE);
        thumb
            .save_with_format(&thumb_path, image::ImageFormat::Jpeg)
            .map_err(|e| e.to_string())?;
    }

    Ok(thumb_path)
}

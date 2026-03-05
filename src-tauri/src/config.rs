use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Default, Serialize, Deserialize, Clone)]
pub struct Config {
    pub scan_root: Option<String>,
}

pub fn load(app_dir: &Path) -> Config {
    let path = app_dir.join("config.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

pub fn save(app_dir: &Path, config: &Config) -> Result<(), String> {
    let path = app_dir.join("config.json");
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}

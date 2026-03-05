import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface Config {
  scan_root: string | null;
}

interface Stats {
  image_count: number;
  last_indexed_at: string | null;
}

interface Props {
  onClose: () => void;
  onScanRootChange: (path: string) => void;
}

export function Settings({ onClose, onScanRootChange }: Props) {
  const [scanRoot, setScanRoot] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [clearing, setClearing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    invoke<Config>("get_config")
      .then((cfg) => setScanRoot(cfg.scan_root ?? ""))
      .catch(console.error);
    invoke<Stats>("get_stats").then(setStats).catch(console.error);
  }, []);

  async function handleBrowse() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setScanRoot(selected);
    }
  }

  async function handleSave() {
    const value = scanRoot.trim() || null;
    await invoke("save_config", { scanRoot: value });
    if (value) onScanRootChange(value);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleClearIndex() {
    if (!confirm("Clear the entire image index? This cannot be undone.")) return;
    setClearing(true);
    try {
      await invoke("clear_index");
      const s = await invoke<Stats>("get_stats");
      setStats(s);
    } finally {
      setClearing(false);
    }
  }

  const lastScan = stats?.last_indexed_at
    ? new Date(stats.last_indexed_at).toLocaleString()
    : "Never";

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: "0.4rem 0.75rem",
    fontSize: "0.82rem",
    borderRadius: "4px",
    border: "1px solid #333",
    background: "#1a1a1a",
    color: "#eee",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.78rem",
    color: "#777",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 900,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "340px",
          background: "#111",
          borderLeft: "1px solid #222",
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.75rem",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: "1rem", color: "#fff" }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "1.2rem",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Scan directory */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <span style={labelStyle}>Scan directory</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              value={scanRoot}
              onChange={(e) => setScanRoot(e.target.value)}
              placeholder="/path/to/images"
              style={inputStyle}
            />
            <button
              onClick={handleBrowse}
              style={{
                padding: "0.4rem 0.75rem",
                fontSize: "0.82rem",
                borderRadius: "4px",
                border: "1px solid #444",
                background: "#1a1a1a",
                color: "#aaa",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Browse
            </button>
          </div>
          <button
            onClick={handleSave}
            style={{
              padding: "0.4rem 1rem",
              fontSize: "0.82rem",
              borderRadius: "4px",
              border: "none",
              background: "#2a6",
              color: "#fff",
              cursor: "pointer",
              alignSelf: "flex-start",
            }}
          >
            {saved ? "Saved!" : "Save"}
          </button>
        </div>

        {/* Index stats */}
        {stats && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={labelStyle}>Index</span>
            <div style={{ fontSize: "0.88rem", color: "#ccc" }}>
              {stats.image_count.toLocaleString()} images
            </div>
            <div style={{ fontSize: "0.78rem", color: "#555" }}>Last scan: {lastScan}</div>
          </div>
        )}

        {/* Danger zone */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <span style={labelStyle}>Danger zone</span>
          <button
            onClick={handleClearIndex}
            disabled={clearing}
            style={{
              padding: "0.4rem 1rem",
              fontSize: "0.82rem",
              borderRadius: "4px",
              border: "1px solid #622",
              background: "transparent",
              color: clearing ? "#555" : "#e55",
              cursor: clearing ? "not-allowed" : "pointer",
              alignSelf: "flex-start",
            }}
          >
            {clearing ? "Clearing…" : "Clear index"}
          </button>
        </div>
      </div>
    </div>
  );
}

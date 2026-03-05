import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface Props {
  onScanRootSet: (path: string) => void;
}

export function Welcome({ onScanRootSet }: Props) {
  const [path, setPath] = useState("");
  const [error, setError] = useState("");

  async function handleBrowse() {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setPath(selected);
      setError("");
    }
  }

  async function handleStart() {
    const trimmed = path.trim();
    if (!trimmed) {
      setError("Please select or enter a directory path.");
      return;
    }
    setError("");
    await invoke("save_config", { scanRoot: trimmed });
    onScanRootSet(trimmed);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: "1.5rem",
        padding: "2rem",
        background: "#0d0d0d",
      }}
    >
      <div style={{ fontSize: "3.5rem", lineHeight: 1 }}>&#128444;</div>
      <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#fff", fontWeight: 700 }}>
        Welcome to Polarkivet
      </h1>
      <p
        style={{
          margin: 0,
          color: "#666",
          fontSize: "0.9rem",
          textAlign: "center",
          maxWidth: "420px",
          lineHeight: 1.6,
        }}
      >
        Select the folder containing your images to get started. Polarkivet indexes them locally
        so you can browse and search quickly.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "500px" }}>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStart()}
          placeholder="/path/to/images"
          style={{
            flex: 1,
            padding: "0.6rem 1rem",
            fontSize: "0.9rem",
            borderRadius: "6px",
            border: "1px solid #333",
            background: "#1a1a1a",
            color: "#eee",
            outline: "none",
          }}
        />
        <button
          onClick={handleBrowse}
          style={{
            padding: "0.6rem 1rem",
            fontSize: "0.9rem",
            borderRadius: "6px",
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

      {error && <p style={{ margin: 0, color: "#f66", fontSize: "0.85rem" }}>{error}</p>}

      <button
        onClick={handleStart}
        disabled={!path.trim()}
        style={{
          padding: "0.65rem 2.5rem",
          fontSize: "0.95rem",
          borderRadius: "6px",
          border: "none",
          background: path.trim() ? "#2a6" : "#1a1a1a",
          color: path.trim() ? "#fff" : "#444",
          cursor: path.trim() ? "pointer" : "not-allowed",
          fontWeight: 600,
        }}
      >
        Get started
      </button>
    </div>
  );
}

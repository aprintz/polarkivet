import { useEffect, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import type { ImageRecord } from "../hooks/useImages";

interface Props {
  images: ImageRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onKeywordsUpdated: (id: number, keywords: string) => void;
}

export function Lightbox({ images, currentIndex, onClose, onNavigate, onKeywordsUpdated }: Props) {
  const image = images[currentIndex];
  const [editingKeywords, setEditingKeywords] = useState(false);
  const [keywordsDraft, setKeywordsDraft] = useState("");
  const [savingKeywords, setSavingKeywords] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Reset keyword editor when the image changes
  useEffect(() => {
    setEditingKeywords(false);
    setKeywordsDraft(image?.keywords ?? "");
    setSaveError(null);
  }, [image?.id, image?.keywords]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (editingKeywords) return; // don't steal keys while typing
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      else if (e.key === "ArrowRight" && currentIndex < images.length - 1)
        onNavigate(currentIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, images.length, onClose, onNavigate, editingKeywords]);

  if (!image) return null;

  const src = convertFileSrc(image.path);
  const dateLabel = image.taken_at
    ? new Date(image.taken_at).toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Unknown date";

  async function saveKeywords() {
    setSavingKeywords(true);
    setSaveError(null);
    try {
      await invoke("update_keywords", { id: image.id, keywords: keywordsDraft });
      onKeywordsUpdated(image.id, keywordsDraft);
      setEditingKeywords(false);
    } catch (e) {
      setSaveError(String(e));
    } finally {
      setSavingKeywords(false);
    }
  }

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    background: "none",
    border: "none",
    color: disabled ? "#2a2a2a" : "#aaa",
    fontSize: "2.5rem",
    cursor: disabled ? "default" : "pointer",
    padding: "0 1.5rem",
    flexShrink: 0,
    lineHeight: 1,
  });

  const metaLabel: React.CSSProperties = { color: "#555", fontSize: "0.75rem" };
  const metaValue: React.CSSProperties = { color: "#ccc" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.96)",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Counter */}
      <div style={{ position: "absolute", top: "1rem", left: "1rem", fontSize: "0.78rem", color: "#555" }}>
        {currentIndex + 1} / {images.length}
      </div>

      {/* Close */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute", top: "0.75rem", right: "1rem",
          background: "none", border: "none", color: "#888",
          fontSize: "1.4rem", cursor: "pointer", padding: "0.25rem 0.5rem",
        }}
      >
        ✕
      </button>

      {/* Prev */}
      <button
        onClick={(e) => { e.stopPropagation(); if (currentIndex > 0) onNavigate(currentIndex - 1); }}
        disabled={currentIndex === 0}
        style={btnStyle(currentIndex === 0)}
      >
        ‹
      </button>

      {/* Center: image + metadata */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          gap: "0.75rem",
          paddingBottom: "0.5rem",
        }}
      >
        <img
          src={src}
          alt={image.filename}
          style={{ maxWidth: "100%", maxHeight: "calc(100vh - 180px)", objectFit: "contain" }}
        />

        {/* Metadata panel */}
        <div
          style={{
            width: "100%",
            maxWidth: "700px",
            padding: "0.75rem 1rem",
            background: "rgba(255,255,255,0.04)",
            borderRadius: "6px",
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "0.3rem 1rem",
            fontSize: "0.82rem",
          }}
        >
          <span style={metaLabel}>File</span>
          <span style={{ ...metaValue, fontWeight: 500 }}>{image.filename}</span>

          <span style={metaLabel}>Date</span>
          <span style={metaValue}>{dateLabel}</span>

          {(image.width && image.height) && (
            <>
              <span style={metaLabel}>Size</span>
              <span style={metaValue}>{image.width} × {image.height}</span>
            </>
          )}

          {(image.camera_make || image.camera_model) && (
            <>
              <span style={metaLabel}>Camera</span>
              <span style={metaValue}>
                {[image.camera_make, image.camera_model].filter(Boolean).join(" ")}
              </span>
            </>
          )}

          {image.description && (
            <>
              <span style={metaLabel}>Description</span>
              <span style={metaValue}>{image.description}</span>
            </>
          )}

          <span style={metaLabel}>Keywords</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {editingKeywords ? (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  autoFocus
                  value={keywordsDraft}
                  onChange={(e) => setKeywordsDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveKeywords();
                    if (e.key === "Escape") setEditingKeywords(false);
                  }}
                  placeholder="keyword1, keyword2, …"
                  style={{
                    flex: 1,
                    padding: "0.3rem 0.6rem",
                    fontSize: "0.82rem",
                    borderRadius: "4px",
                    border: "1px solid #555",
                    background: "#1a1a1a",
                    color: "#eee",
                    outline: "none",
                    minWidth: "200px",
                  }}
                />
                <button
                  onClick={saveKeywords}
                  disabled={savingKeywords}
                  style={{
                    padding: "0.3rem 0.7rem", fontSize: "0.8rem", borderRadius: "4px",
                    border: "none", background: "#2a6", color: "#fff", cursor: "pointer",
                  }}
                >
                  {savingKeywords ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setEditingKeywords(false)}
                  style={{
                    padding: "0.3rem 0.7rem", fontSize: "0.8rem", borderRadius: "4px",
                    border: "1px solid #444", background: "transparent", color: "#888", cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                {saveError && (
                  <span style={{ color: "#f66", fontSize: "0.75rem", width: "100%" }}>{saveError}</span>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                {image.keywords ? (
                  image.keywords.split(",").map((kw) => kw.trim()).filter(Boolean).map((kw) => (
                    <span
                      key={kw}
                      style={{
                        background: "#1e2e1e",
                        border: "1px solid #2a5a2a",
                        borderRadius: "3px",
                        padding: "0.1rem 0.4rem",
                        fontSize: "0.78rem",
                        color: "#6d6",
                      }}
                    >
                      {kw}
                    </span>
                  ))
                ) : (
                  <span style={{ color: "#444", fontStyle: "italic" }}>none</span>
                )}
                <button
                  onClick={() => {
                    setKeywordsDraft(image.keywords ?? "");
                    setEditingKeywords(true);
                  }}
                  style={{
                    marginLeft: "0.25rem", padding: "0.1rem 0.5rem", fontSize: "0.75rem",
                    borderRadius: "3px", border: "1px solid #333", background: "transparent",
                    color: "#666", cursor: "pointer",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          <span style={{ ...metaLabel, gridColumn: "1/-1", marginTop: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={image.path}>
            {image.path}
          </span>
        </div>
      </div>

      {/* Next */}
      <button
        onClick={(e) => { e.stopPropagation(); if (currentIndex < images.length - 1) onNavigate(currentIndex + 1); }}
        disabled={currentIndex === images.length - 1}
        style={btnStyle(currentIndex === images.length - 1)}
      >
        ›
      </button>
    </div>
  );
}

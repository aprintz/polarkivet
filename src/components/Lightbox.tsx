import { useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageRecord } from "../hooks/useImages";

interface Props {
  images: ImageRecord[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function Lightbox({ images, currentIndex, onClose, onNavigate }: Props) {
  const image = images[currentIndex];

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      else if (e.key === "ArrowRight" && currentIndex < images.length - 1)
        onNavigate(currentIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [currentIndex, images.length, onClose, onNavigate]);

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

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.94)",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      {/* Counter */}
      <div
        style={{
          position: "absolute",
          top: "1rem",
          left: "1rem",
          fontSize: "0.78rem",
          color: "#555",
        }}
      >
        {currentIndex + 1} / {images.length}
      </div>

      {/* Close */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "absolute",
          top: "0.75rem",
          right: "1rem",
          background: "none",
          border: "none",
          color: "#888",
          fontSize: "1.4rem",
          cursor: "pointer",
          padding: "0.25rem 0.5rem",
        }}
      >
        ✕
      </button>

      {/* Prev */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (currentIndex > 0) onNavigate(currentIndex - 1);
        }}
        disabled={currentIndex === 0}
        style={btnStyle(currentIndex === 0)}
      >
        ‹
      </button>

      {/* Image + metadata */}
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
        }}
      >
        <img
          src={src}
          alt={image.filename}
          style={{
            maxWidth: "100%",
            maxHeight: "calc(100vh - 110px)",
            objectFit: "contain",
          }}
        />
        <div
          style={{
            fontSize: "0.8rem",
            color: "#888",
            display: "flex",
            gap: "1.5rem",
            flexWrap: "wrap",
            justifyContent: "center",
            padding: "0 1rem",
          }}
        >
          <span style={{ color: "#ddd", fontWeight: 500 }}>{image.filename}</span>
          <span>{dateLabel}</span>
          {image.width && image.height && (
            <span>
              {image.width} &times; {image.height}
            </span>
          )}
          <span
            style={{
              color: "#555",
              fontSize: "0.72rem",
              maxWidth: "500px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={image.path}
          >
            {image.path}
          </span>
        </div>
      </div>

      {/* Next */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (currentIndex < images.length - 1) onNavigate(currentIndex + 1);
        }}
        disabled={currentIndex === images.length - 1}
        style={btnStyle(currentIndex === images.length - 1)}
      >
        ›
      </button>
    </div>
  );
}

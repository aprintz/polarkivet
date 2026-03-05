import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { ImageRecord } from "../hooks/useImages";

interface Props {
  image: ImageRecord;
  onClick?: () => void;
}

export function ImageCard({ image, onClick }: Props) {
  const [imgError, setImgError] = useState(false);

  const thumbSrc =
    !imgError && image.thumb_path ? convertFileSrc(image.thumb_path) : null;

  const dateLabel = image.taken_at
    ? new Date(image.taken_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#1a1a1a",
        border: "1px solid #2a2a2a",
        borderRadius: "6px",
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "#555")
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLDivElement).style.borderColor = "#2a2a2a")
      }
    >
      <div
        style={{
          width: "100%",
          paddingBottom: "100%",
          position: "relative",
          background: "#111",
        }}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={image.filename}
            onError={() => setImgError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#444",
              fontSize: "2rem",
            }}
          >
            &#128444;
          </div>
        )}
      </div>
      <div style={{ padding: "0.4rem 0.5rem" }}>
        <div
          style={{
            fontSize: "0.72rem",
            color: "#ccc",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={image.filename}
        >
          {image.filename}
        </div>
        {dateLabel && (
          <div style={{ fontSize: "0.65rem", color: "#666", marginTop: "0.1rem" }}>
            {dateLabel}
          </div>
        )}
      </div>
    </div>
  );
}

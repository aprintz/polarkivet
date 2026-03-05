import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

interface ScanProgress {
  scanned: number;
  found: number;
  current_file: string;
}

interface Props {
  scanning: boolean;
}

export function ScanProgress({ scanning }: Props) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    if (!scanning) {
      setProgress(null);
      return;
    }

    let unlisten: (() => void) | undefined;
    listen<ScanProgress>("scan-progress", (event) => {
      setProgress(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [scanning]);

  if (!scanning || !progress) return null;

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        background: "#1a1a2e",
        border: "1px solid #333",
        borderRadius: "4px",
        marginBottom: "1rem",
        fontSize: "0.85rem",
        color: "#aaa",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span>
          <span style={{ color: "#0f0" }}>{progress.found}</span> images found
        </span>
        <span>{progress.scanned} files scanned</span>
      </div>
      <div
        style={{
          height: "3px",
          background: "#333",
          borderRadius: "2px",
          marginBottom: "0.4rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: "100%",
            background: "linear-gradient(90deg, #0f0, #0a0)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
      <div
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: "#666",
          fontSize: "0.75rem",
        }}
      >
        {progress.current_file}
      </div>
    </div>
  );
}

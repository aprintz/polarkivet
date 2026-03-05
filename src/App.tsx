import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface ScanProgress {
  scanned: number;
  found: number;
  current_file: string;
}

function App() {
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [log, setLog] = useState<string[]>(["Ready. Enter a directory path and click Scan."]);

  async function startScan() {
    if (!path) return;
    setScanning(true);
    setLog(["Starting scan..."]);

    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      const p = event.payload;
      setLog((prev) => [
        ...prev.slice(-100),
        `[${p.scanned} scanned | ${p.found} found] ${p.current_file}`,
      ]);
    });

    try {
      const count = await invoke<number>("scan_directory", { path });
      setLog((prev) => [...prev, ``, `Done. ${count} images indexed.`]);
    } catch (e) {
      setLog((prev) => [...prev, `Error: ${e}`]);
    } finally {
      unlisten();
      setScanning(false);
    }
  }

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.25rem" }}>Polarkivet</h1>
      <p style={{ color: "#888", marginTop: 0, marginBottom: "1.5rem" }}>
        Image catalogue for file shares
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && startScan()}
          placeholder="/path/to/images"
          style={{ flex: 1, padding: "0.5rem 0.75rem", fontSize: "1rem", borderRadius: "4px", border: "1px solid #555", background: "#1a1a1a", color: "#eee" }}
          disabled={scanning}
        />
        <button
          onClick={startScan}
          disabled={scanning || !path}
          style={{ padding: "0.5rem 1.25rem", fontSize: "1rem", borderRadius: "4px", cursor: scanning || !path ? "not-allowed" : "pointer" }}
        >
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </div>
      <pre
        style={{
          background: "#0d0d0d",
          color: "#0f0",
          padding: "1rem",
          height: "500px",
          overflow: "auto",
          fontSize: "0.8rem",
          borderRadius: "4px",
          border: "1px solid #333",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}

export default App;

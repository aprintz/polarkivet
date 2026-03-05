import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScanProgress } from "./components/ScanProgress";
import { ImageGrid } from "./components/ImageGrid";
import { SearchBar } from "./components/SearchBar";
import { useInvalidateImages } from "./hooks/useImages";

function App() {
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const invalidateImages = useInvalidateImages();

  async function startScan() {
    if (!path || scanning) return;
    setScanning(true);
    setScanResult(null);

    try {
      const count = await invoke<number>("scan_directory", { path });
      setScanResult(`Done. ${count} images indexed.`);
      await invalidateImages();
      setScanKey((k) => k + 1);
    } catch (e) {
      setScanResult(`Error: ${e}`);
    } finally {
      setScanning(false);
    }
  }

  const handleSearch = useCallback(
    (query: string, from: string, to: string) => {
      setSearchQuery(query);
      setFromDate(from);
      setToDate(to);
    },
    [],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#0d0d0d",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1.25rem",
          borderBottom: "1px solid #222",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#fff" }}>
          Polarkivet
        </h1>

        {/* Scan controls */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && startScan()}
            placeholder="/path/to/images"
            disabled={scanning}
            style={{
              width: "220px",
              padding: "0.4rem 0.75rem",
              fontSize: "0.85rem",
              borderRadius: "4px",
              border: "1px solid #444",
              background: "#111",
              color: "#eee",
              outline: "none",
            }}
          />
          <button
            onClick={startScan}
            disabled={scanning || !path}
            style={{
              padding: "0.4rem 1rem",
              fontSize: "0.85rem",
              borderRadius: "4px",
              border: "none",
              background: scanning || !path ? "#333" : "#2a6",
              color: scanning || !path ? "#666" : "#fff",
              cursor: scanning || !path ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {/* Search controls */}
        <SearchBar onSearch={handleSearch} />

        {scanResult && (
          <span style={{ fontSize: "0.8rem", color: scanResult.startsWith("Error") ? "#f66" : "#6a6" }}>
            {scanResult}
          </span>
        )}
      </div>

      {/* Scan progress */}
      <div style={{ padding: "0 1.25rem", paddingTop: scanning ? "0.75rem" : 0, flexShrink: 0 }}>
        <ScanProgress scanning={scanning} />
      </div>

      {/* Image grid */}
      <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 1.25rem" }}>
        <ImageGrid
          scanKey={scanKey}
          query={searchQuery}
          fromDate={fromDate}
          toDate={toDate}
        />
      </div>
    </div>
  );
}

export default App;

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ScanProgress } from "./components/ScanProgress";
import { ImageGrid } from "./components/ImageGrid";
import { SearchBar } from "./components/SearchBar";
import { Lightbox } from "./components/Lightbox";
import { Settings } from "./components/Settings";
import { Welcome } from "./components/Welcome";
import { useInvalidateImages } from "./hooks/useImages";
import type { ImageRecord } from "./hooks/useImages";

interface Config {
  scan_root: string | null;
}

function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [path, setPath] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<ImageRecord[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const invalidateImages = useInvalidateImages();

  async function runScan(scanPath: string) {
    setScanning(true);
    setScanResult(null);
    try {
      const count = await invoke<number>("scan_directory", { path: scanPath });
      setScanResult(`Done. ${count} images indexed.`);
      await invoke("save_config", { scanRoot: scanPath });
      setConfig((c) => ({ ...(c ?? {}), scan_root: scanPath }));
      await invalidateImages();
      setScanKey((k) => k + 1);
    } catch (e) {
      setScanResult(`Error: ${e}`);
    } finally {
      setScanning(false);
    }
  }

  // Load config on startup; auto re-index if scan_root is already set
  useEffect(() => {
    invoke<Config>("get_config")
      .then((cfg) => {
        setConfig(cfg);
        if (cfg.scan_root) {
          setPath(cfg.scan_root);
          runScan(cfg.scan_root);
        }
      })
      .catch(console.error);
  // runScan is stable for the initial mount; exhaustive-deps would cause a loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScanRootChange(newPath: string) {
    setPath(newPath);
    setConfig((c) => ({ ...(c ?? {}), scan_root: newPath }));
  }

  function handleWelcomeDone(scanRoot: string) {
    setConfig({ scan_root: scanRoot });
    setPath(scanRoot);
    runScan(scanRoot);
  }

  const handleSearch = useCallback((query: string, from: string, to: string) => {
    setSearchQuery(query);
    setFromDate(from);
    setToDate(to);
  }, []);

  const handleImageClick = useCallback((images: ImageRecord[], index: number) => {
    setLightboxImages(images);
    setLightboxIndex(index);
  }, []);

  const showWelcome = config !== null && !config.scan_root;

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
      {showWelcome ? (
        <Welcome onScanRootSet={handleWelcomeDone} />
      ) : (
        <>
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
                onKeyDown={(e) => e.key === "Enter" && runScan(path)}
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
                onClick={() => runScan(path)}
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
              <span
                style={{
                  fontSize: "0.8rem",
                  color: scanResult.startsWith("Error") ? "#f66" : "#6a6",
                }}
              >
                {scanResult}
              </span>
            )}

            {/* Settings button */}
            <button
              onClick={() => setShowSettings(true)}
              style={{
                marginLeft: "auto",
                padding: "0.4rem 0.75rem",
                fontSize: "0.82rem",
                borderRadius: "4px",
                border: "1px solid #333",
                background: "transparent",
                color: "#777",
                cursor: "pointer",
              }}
            >
              Settings
            </button>
          </div>

          {/* Scan progress */}
          <div
            style={{ padding: "0 1.25rem", paddingTop: scanning ? "0.75rem" : 0, flexShrink: 0 }}
          >
            <ScanProgress scanning={scanning} />
          </div>

          {/* Image grid */}
          <div style={{ flex: 1, overflow: "auto", padding: "0.75rem 1.25rem" }}>
            <ImageGrid
              scanKey={scanKey}
              query={searchQuery}
              fromDate={fromDate}
              toDate={toDate}
              onImageClick={handleImageClick}
            />
          </div>
        </>
      )}

      {/* Settings panel */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onScanRootChange={handleScanRootChange}
        />
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

export default App;

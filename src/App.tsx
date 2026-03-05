import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import headerBg from "./assets/header-bg.png";
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

  // When keywords are updated in Lightbox, patch the local copy so the UI stays in sync
  const handleKeywordsUpdated = useCallback((id: number, keywords: string) => {
    setLightboxImages((imgs) =>
      imgs.map((img) => (img.id === id ? { ...img, keywords } : img))
    );
    // Invalidate queries so grid/search results reflect the new keywords
    invalidateImages();
  }, [invalidateImages]);

  const showWelcome = config !== null && !config.scan_root;
  const hasPath = Boolean(path);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#1a1a1a",
        color: "#eee",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {showWelcome ? (
        <Welcome onScanRootSet={handleWelcomeDone} />
      ) : (
        <>
          {/* Hero header — image banner with title */}
          <div
            style={{
              position: "relative",
              height: "72px",
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            <img
              src={headerBg}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center 40%",
              }}
            />
            {/* semi-transparent dark overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(15, 18, 20, 0.62)",
              }}
            />
            <h1
              style={{
                position: "relative",
                margin: 0,
                padding: "0 1.25rem",
                height: "100%",
                display: "flex",
                alignItems: "center",
                fontSize: "1.35rem",
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "#fff",
                textShadow: "0 1px 6px rgba(0,0,0,0.7)",
              }}
            >
              Polarkivet
            </h1>
          </div>

          {/* Toolbar */}
          <div
            style={{
              padding: "0.6rem 1.25rem",
              borderBottom: "1px solid #252525",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexShrink: 0,
              flexWrap: "wrap",
              background: "#1a1a1a",
            }}
          >
            {/* Folder path + Rescan button */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && hasPath && runScan(path)}
                placeholder="/path/to/images"
                disabled={scanning}
                style={{
                  width: "260px",
                  padding: "0.4rem 0.75rem",
                  fontSize: "0.85rem",
                  borderRadius: "4px",
                  border: "1px solid #383838",
                  background: "#121212",
                  color: "#eee",
                  outline: "none",
                }}
              />
              <button
                onClick={() => runScan(path)}
                disabled={scanning || !hasPath}
                title="Scan or rescan the folder for images"
                style={{
                  padding: "0.4rem 1rem",
                  fontSize: "0.85rem",
                  borderRadius: "4px",
                  border: "none",
                  background: scanning || !hasPath ? "#282828" : "#2a6",
                  color: scanning || !hasPath ? "#555" : "#fff",
                  cursor: scanning || !hasPath ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {scanning ? "Scanning…" : config?.scan_root ? "Rescan" : "Scan"}
              </button>
            </div>

            {/* Search controls */}
            <SearchBar onSearch={handleSearch} />

            {scanResult && (
              <span style={{ fontSize: "0.8rem", color: scanResult.startsWith("Error") ? "#f66" : "#6a6" }}>
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
          onKeywordsUpdated={handleKeywordsUpdated}
        />
      )}
    </div>
  );
}

export default App;

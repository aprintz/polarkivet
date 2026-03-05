import { useEffect, useState } from "react";
import { useImages } from "../hooks/useImages";
import { useSearch } from "../hooks/useSearch";
import { ImageCard } from "./ImageCard";
import type { ImageRecord } from "../hooks/useImages";

const PAGE_SIZE = 200;

interface Props {
  scanKey: number;
  query: string;
  fromDate: string;
  toDate: string;
  onImageClick?: (images: ImageRecord[], index: number) => void;
}

export function ImageGrid({ scanKey, query, fromDate, toDate, onImageClick }: Props) {
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  // Reset to page 0 whenever search params or scan key change
  useEffect(() => {
    setPage(0);
  }, [query, fromDate, toDate, scanKey]);

  const searchActive = !!(query || fromDate || toDate);
  const listResult = useImages(offset, PAGE_SIZE, !searchActive);
  const searchResult = useSearch(query, fromDate, toDate, offset, PAGE_SIZE, searchActive);
  const { data, isFetching, error } = searchActive ? searchResult : listResult;

  if (error) {
    return (
      <div style={{ color: "#f66", padding: "1rem", fontSize: "0.85rem" }}>
        Failed to load images: {String(error)}
      </div>
    );
  }

  if (!data && isFetching) {
    return (
      <div style={{ color: "#666", padding: "2rem", textAlign: "center", fontSize: "0.85rem" }}>
        Loading…
      </div>
    );
  }

  const images = data ?? [];

  if (images.length === 0 && page === 0) {
    return (
      <div
        style={{
          color: "#555",
          padding: "4rem 2rem",
          textAlign: "center",
          fontSize: "0.9rem",
          lineHeight: 1.6,
        }}
      >
        {searchActive ? (
          "No images match your search."
        ) : (
          <>
            No images indexed yet.
            <br />
            Enter a directory path above and click <strong>Scan</strong>.
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: "0.5rem",
        }}
      >
        {images.map((img, idx) => (
          <ImageCard
            key={img.id}
            image={img}
            onClick={onImageClick ? () => onImageClick(images, idx) : undefined}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "1rem",
          fontSize: "0.8rem",
          color: "#666",
        }}
      >
        <span>
          Showing {offset + 1}–{offset + images.length}
          {images.length === PAGE_SIZE ? "+" : ""}
        </span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {page > 0 && (
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={isFetching}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Previous
            </button>
          )}
          {images.length === PAGE_SIZE && (
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={isFetching}
              style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem", cursor: "pointer" }}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

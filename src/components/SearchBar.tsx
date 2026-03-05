import { useEffect, useRef, useState } from "react";

interface Props {
  onSearch: (query: string, fromDate: string, toDate: string) => void;
}

export function SearchBar({ onSearch }: Props) {
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(query, fromDate, toDate);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fromDate, toDate, onSearch]);

  const inputStyle: React.CSSProperties = {
    padding: "0.4rem 0.75rem",
    fontSize: "0.85rem",
    borderRadius: "4px",
    border: "1px solid #444",
    background: "#111",
    color: "#eee",
    outline: "none",
  };

  return (
    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flex: 1 }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search filenames, keywords, camera…"
        style={{ ...inputStyle, minWidth: "180px" }}
      />
      <input
        type="date"
        value={fromDate}
        onChange={(e) => setFromDate(e.target.value)}
        title="From date"
        style={{ ...inputStyle, colorScheme: "dark" }}
      />
      <span style={{ color: "#555", fontSize: "0.8rem" }}>–</span>
      <input
        type="date"
        value={toDate}
        onChange={(e) => setToDate(e.target.value)}
        title="To date"
        style={{ ...inputStyle, colorScheme: "dark" }}
      />
      {(query || fromDate || toDate) && (
        <button
          onClick={() => {
            setQuery("");
            setFromDate("");
            setToDate("");
          }}
          title="Clear search"
          style={{
            padding: "0.4rem 0.6rem",
            fontSize: "0.8rem",
            borderRadius: "4px",
            border: "1px solid #444",
            background: "#1a1a1a",
            color: "#888",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

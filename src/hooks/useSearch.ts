import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { ImageRecord } from "./useImages";

export function useSearch(
  query: string,
  fromDate: string,
  toDate: string,
  offset: number,
  limit: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["search", query, fromDate, toDate, offset, limit],
    queryFn: () =>
      invoke<ImageRecord[]>("search_images", {
        query,
        fromDate: fromDate || null,
        toDate: toDate || null,
        offset,
        limit,
      }),
    enabled,
  });
}

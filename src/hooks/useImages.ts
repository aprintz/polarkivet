import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

export interface ImageRecord {
  id: number;
  path: string;
  filename: string;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  thumb_path: string | null;
}

export function useImages(offset: number, limit: number) {
  return useQuery({
    queryKey: ["images", offset, limit],
    queryFn: () => invoke<ImageRecord[]>("list_images", { offset, limit }),
  });
}

export function useInvalidateImages() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["images"] });
}

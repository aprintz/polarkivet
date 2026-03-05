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
  camera_make: string | null;
  camera_model: string | null;
  keywords: string | null;
  description: string | null;
}

export function useImages(offset: number, limit: number, enabled = true) {
  return useQuery({
    queryKey: ["images", offset, limit],
    queryFn: () => invoke<ImageRecord[]>("list_images", { offset, limit }),
    enabled,
  });
}

export function useInvalidateImages() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ["images"] });
}

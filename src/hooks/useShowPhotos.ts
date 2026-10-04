import { useLocalToggle } from "./useLocalToggle";

const SHOW_PHOTOS_STORAGE_KEY = "mealprep:recipes:showPhotos";

/** Shared recipe-photo visibility preference (card grid + detail view). */
export function useShowPhotos() {
  const [showPhotos, toggleShowPhotos] = useLocalToggle(SHOW_PHOTOS_STORAGE_KEY, true);
  return { showPhotos, toggleShowPhotos };
}

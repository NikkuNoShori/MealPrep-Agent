import { useLocalToggle } from "./useLocalToggle";

const SHOW_TAGS_STORAGE_KEY = "mealprep:recipes:showTags";

/** Shared recipe-tag visibility preference (card grid + list view). Does not affect the allergy badge. */
export function useShowTags() {
  const [showTags, toggleShowTags] = useLocalToggle(SHOW_TAGS_STORAGE_KEY, true);
  return { showTags, toggleShowTags };
}

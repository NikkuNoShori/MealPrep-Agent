import { useLocalToggle } from "./useLocalToggle";

const SHOW_DESCRIPTIONS_STORAGE_KEY = "mealprep:recipes:showDescriptions";

/** Shared recipe-description visibility preference (card grid + list view). */
export function useShowDescriptions() {
  const [showDescriptions, toggleShowDescriptions] = useLocalToggle(SHOW_DESCRIPTIONS_STORAGE_KEY, true);
  return { showDescriptions, toggleShowDescriptions };
}

/**
 * Allergy checker — checks recipe ingredients against household member allergy profiles.
 * Called from the recipe-pipeline load stage before INSERT.
 * Returns additional tags to merge into the recipe's tag array.
 *
 * Safety policy: false positives are acceptable; false negatives are not.
 * ALLERGY WARNING tag is the canonical exclusion signal for the randomizer.
 */

// FDA Big-9 allergen synonym map (lowercase)
// Key = allergen category, Value = array of ingredient substrings that indicate it
export const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  milk: ["milk","cheese","butter","cream","yogurt","whey","casein","ghee","lactose","parmesan","mozzarella","cheddar","brie","ricotta","mascarpone","crème","custard","dairy","paneer","kefir"],
  eggs: ["egg","eggs","mayonnaise","mayo","meringue","aioli","hollandaise"],
  fish: ["salmon","tuna","cod","halibut","tilapia","anchovies","anchovy","fish sauce","worcestershire","sardine","herring","mackerel","bass","snapper"],
  shellfish: ["shrimp","crab","lobster","crawfish","prawn","scallop","clam","oyster","mussel","squid","octopus"],
  tree_nuts: ["almond","walnut","pecan","cashew","pistachio","pine nut","macadamia","hazelnut","brazil nut","chestnut","nut"],
  peanuts: ["peanut","peanut butter","groundnut","monkey nut"],
  wheat: ["flour","bread","breadcrumb","pasta","couscous","semolina","spelt","noodle","ramen","udon","soba","pita","tortilla","crouton","wheat"],
  soy: ["soy","tofu","tempeh","edamame","miso","tamari","soybean","soy sauce"],
  sesame: ["sesame","tahini","halvah"],
  gluten: ["barley","rye","oat","oats","gluten"],
};

export interface AllergyProfile {
  memberName: string;
  allergies: string[];  // member's own allergy list (free-text + taxonomy terms)
}

export interface AllergyCheckResult {
  tags: string[];           // e.g. ["Emma Allergy", "ALLERGY WARNING"]
  matchedMembers: string[]; // member names that triggered a warning
}

/**
 * Check recipe ingredients against household member allergy profiles.
 * @param ingredients  - array of { name: string; notes?: string }
 * @param profiles     - household member allergy profiles
 */
export function checkAllergies(
  ingredients: Array<{ name: string; unit?: string; notes?: string }>,
  profiles: AllergyProfile[]
): AllergyCheckResult {
  if (!profiles.length || !ingredients.length) {
    return { tags: [], matchedMembers: [] };
  }

  // Flatten all ingredient text for matching
  const ingredientText = ingredients
    .map(i => `${i.name} ${i.notes || ""}`.toLowerCase())
    .join(" | ");

  const matchedMembers: string[] = [];
  const tags: string[] = [];

  for (const profile of profiles) {
    if (!profile.allergies?.length) continue;

    let memberMatched = false;

    for (const allergy of profile.allergies) {
      const allergyLower = allergy.toLowerCase().trim();

      // Direct substring match in ingredient text
      if (ingredientText.includes(allergyLower)) {
        memberMatched = true;
        break;
      }

      // Check synonym map — find if this allergy maps to a known category
      for (const [_category, synonyms] of Object.entries(ALLERGEN_SYNONYMS)) {
        if (synonyms.includes(allergyLower)) {
          // The profile allergy is a known synonym category key itself — check all synonyms
          const matched = synonyms.some(syn => ingredientText.includes(syn));
          if (matched) { memberMatched = true; break; }
        }
        // Or check if the allergy label matches the category key
        if (_category === allergyLower || allergyLower.includes(_category)) {
          const matched = synonyms.some(syn => ingredientText.includes(syn));
          if (matched) { memberMatched = true; break; }
        }
      }

      if (memberMatched) break;
    }

    if (memberMatched) {
      matchedMembers.push(profile.memberName);
      tags.push(`${profile.memberName} Allergy`);
    }
  }

  if (matchedMembers.length > 0) {
    tags.push("ALLERGY WARNING");
  }

  // Deduplicate
  return {
    tags: [...new Set(tags)],
    matchedMembers: [...new Set(matchedMembers)],
  };
}

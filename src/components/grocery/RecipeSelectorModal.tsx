import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRecipes } from '@/services/api';
import type { SelectedRecipeInfo } from '@/components/meal-planning/recipeTypes';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface RecipeItem {
  id: string;
  name: string;
  time: string;
  serves: number;
  cat: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  image: string;
}

interface RecipeSelectorModalProps {
  open: boolean;
  onClose: () => void;
  /** External recipe list — if omitted the modal fetches from the API. */
  recipes?: RecipeItem[];
  /** Grocery-list flow: called with a prompt string listing selected recipes. */
  sendPrompt?: (message: string) => void;
  /** Meal-planner flow: called with structured recipe info for each selected recipe. */
  onConfirm?: (recipes: SelectedRecipeInfo[]) => void;
  /** CTA label prefix when items are selected.  Defaults to "Add". */
  ctaVerb?: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

type Category = 'all' | RecipeItem['cat'];

const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
];

const CAT_COLORS: Record<RecipeItem['cat'], { bg: string; fg: string }> = {
  breakfast: { bg: '#D1FAE5', fg: '#065F46' },
  lunch:     { bg: '#FEE2E2', fg: '#7F1D1D' },
  dinner:    { bg: '#FDE8CC', fg: '#7A4210' },
  snack:     { bg: '#EDE9FE', fg: '#4C1D95' },
};

/** Map a tag list / title to a meal category — best-effort heuristic. */
function guessCategory(recipe: any): RecipeItem['cat'] {
  const tags: string[] = (recipe.tags || []).map((t: string) => t.toLowerCase());
  const title = (recipe.title || '').toLowerCase();
  const all = [...tags, title].join(' ');
  if (all.includes('breakfast') || all.includes('brunch')) return 'breakfast';
  if (all.includes('lunch') || all.includes('sandwich') || all.includes('salad')) return 'lunch';
  if (all.includes('snack') || all.includes('appetizer') || all.includes('dessert')) return 'snack';
  return 'dinner';
}

function formatTime(recipe: any): string {
  const prep = parseInt(recipe.prepTime) || 0;
  const cook = parseInt(recipe.cookTime) || 0;
  const total = prep + cook;
  if (total === 0) return 'No time set';
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/* ------------------------------------------------------------------ */
/*  Icons (inline SVG to avoid extra deps)                             */
/* ------------------------------------------------------------------ */

const GridIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="1" width="6" height="6" rx="1.2" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
    <rect x="9" y="1" width="6" height="6" rx="1.2" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
    <rect x="1" y="9" width="6" height="6" rx="1.2" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
    <rect x="9" y="9" width="6" height="6" rx="1.2" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
  </svg>
);

const ListIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1" y="2" width="14" height="2.5" rx="1" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
    <rect x="1" y="6.75" width="14" height="2.5" rx="1" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
    <rect x="1" y="11.5" width="14" height="2.5" rx="1" fill={active ? 'var(--rs-toggle-active-fg)' : 'var(--rs-text-tertiary)'} />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="7" cy="7" r="5" stroke="var(--rs-text-tertiary)" strokeWidth="1.6" />
    <line x1="10.8" y1="10.8" x2="14" y2="14" stroke="var(--rs-text-tertiary)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const CheckBadge = () => (
  <div style={{
    position: 'absolute', top: 8, right: 8, width: 24, height: 24,
    borderRadius: '50%', background: 'var(--rs-accent)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(29, 158, 117, 0.4)',
  }}>
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <polyline points="3,7.5 5.8,10.2 11,4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const LoadingSpinner = () => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '48px 16px',
  }}>
    <svg width="28" height="28" viewBox="0 0 28 28" style={{ animation: 'rsSpin 0.8s linear infinite' }}>
      <circle cx="14" cy="14" r="11" stroke="var(--rs-border)" strokeWidth="3" fill="none" />
      <path d="M14 3a11 11 0 0 1 11 11" stroke="var(--rs-accent)" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Subcomponents                                                      */
/* ------------------------------------------------------------------ */

const CategoryPill = ({ cat }: { cat: RecipeItem['cat'] }) => {
  const c = CAT_COLORS[cat];
  return (
    <span style={{
      display: 'inline-block', fontSize: 11, fontWeight: 600,
      fontFamily: "'DM Sans', sans-serif", lineHeight: 1,
      padding: '3px 8px', borderRadius: 999,
      background: c.bg, color: c.fg, textTransform: 'capitalize',
    }}>
      {cat}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/*  Fallback placeholder for missing images                            */
/* ------------------------------------------------------------------ */

const FallbackImage = ({ name }: { name: string }) => (
  <div style={{
    width: '100%', height: '100%',
    background: 'linear-gradient(135deg, var(--rs-bg-elevated), var(--rs-border-subtle))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--rs-text-tertiary)" strokeWidth="1.5">
      <path d="M12 6.5c-1.5-2-4-2.5-6-.5s-2.5 5 .5 8L12 20l5.5-6c3-3 2.5-6 .5-8s-4.5-1.5-6 .5z" />
    </svg>
    <span className="sr-only">{name}</span>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const RecipeSelectorModal = ({
  open, onClose, recipes: externalRecipes, sendPrompt, onConfirm, ctaVerb = 'Add',
}: RecipeSelectorModalProps) => {
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState<Category>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Track raw API recipes so we can build SelectedRecipeInfo from them
  const [rawRecipeMap, setRawRecipeMap] = useState<Map<string, any>>(new Map());
  const overlayRef = useRef<HTMLDivElement>(null);

  // Fetch from API when no external recipes are provided
  const { data: recipesData, isLoading } = useRecipes({ limit: 200 });

  // Map API data → RecipeItem[] display format
  const displayRecipes: RecipeItem[] = useMemo(() => {
    if (externalRecipes) return externalRecipes;
    const list = (recipesData as any)?.recipes || recipesData || [];
    // Build raw map for later lookup
    const map = new Map<string, any>();
    const items: RecipeItem[] = list.map((r: any) => {
      map.set(r.id, r);
      return {
        id: r.id,
        name: r.title || 'Untitled',
        time: formatTime(r),
        serves: r.servings || 4,
        cat: guessCategory(r),
        image: r.imageUrl || '',
      };
    });
    // We set rawRecipeMap inside useMemo via a ref-like update,
    // but to avoid stale closures we'll store it via effect below.
    return items;
  }, [externalRecipes, recipesData]);

  // Keep rawRecipeMap in sync
  useEffect(() => {
    if (externalRecipes) return; // external mode — not needed
    const list = (recipesData as any)?.recipes || recipesData || [];
    const map = new Map<string, any>();
    for (const r of list) map.set(r.id, r);
    setRawRecipeMap(map);
  }, [recipesData, externalRecipes]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveCat('all');
      setSelected(new Set());
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Filter
  const filtered = useMemo(() => {
    let list = displayRecipes;
    if (activeCat !== 'all') list = list.filter((r) => r.cat === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [displayRecipes, activeCat, search]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setSelected(new Set()), []);

  const handleCTA = useCallback(() => {
    if (selected.size === 0) return;

    // Meal-planner flow → return SelectedRecipeInfo[]
    if (onConfirm) {
      const results: SelectedRecipeInfo[] = [];
      for (const id of selected) {
        const raw = rawRecipeMap.get(id);
        const display = displayRecipes.find((r) => r.id === id);
        if (raw) {
          results.push({
            recipeId: raw.id,
            recipeName: raw.title || display?.name || 'Untitled',
            recipeImage: raw.imageUrl,
            servings: raw.servings || 4,
            prepTime: raw.prepTime ? parseInt(raw.prepTime) : undefined,
            cookTime: raw.cookTime ? parseInt(raw.cookTime) : undefined,
          });
        } else if (display) {
          // External recipes mode — build from display data
          results.push({
            recipeId: display.id,
            recipeName: display.name,
            recipeImage: display.image,
            servings: display.serves,
          });
        }
      }
      onConfirm(results);
      onClose();
      return;
    }

    // Grocery-list flow → sendPrompt
    if (sendPrompt) {
      const names = displayRecipes.filter((r) => selected.has(r.id)).map((r) => r.name);
      const list = names.map((n) => `- ${n}`).join('\n');
      sendPrompt(
        `Generate a combined grocery list for these recipes:\n${list}\n\nPlease group ingredients by category (produce, dairy, protein, pantry, etc.) and combine duplicates with adjusted quantities.`
      );
      onClose();
    }
  }, [selected, displayRecipes, rawRecipeMap, onConfirm, sendPrompt, onClose]);

  if (!open) return null;

  const count = selected.size;
  const ctaLabel = count === 0
    ? `${ctaVerb} recipes`
    : `${ctaVerb} ${count} recipe${count === 1 ? '' : 's'}`;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--rs-overlay)', backdropFilter: 'blur(4px)',
        animation: 'rsFadeIn 0.2s ease',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '85vh', margin: '0 16px',
        background: 'var(--rs-bg)', borderRadius: 20,
        border: `1px solid var(--rs-border)`,
        boxShadow: '0 24px 48px rgba(0,0,0,0.12), 0 8px 16px rgba(0,0,0,0.06)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: 'rsSlideUp 0.25s ease',
      }}>
        {/* ── Header ── */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div>
              <h2 style={{
                margin: 0, fontSize: 22, fontWeight: 700,
                fontFamily: "'Fraunces', serif",
                color: 'var(--rs-text-primary)',
              }}>
                My recipes
              </h2>
              <p style={{
                margin: '2px 0 0', fontSize: 13,
                color: 'var(--rs-text-secondary)',
              }}>
                {count === 0 ? 'Select recipes to add' : `${count} selected`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* View toggle */}
              <div style={{
                display: 'flex', borderRadius: 10, overflow: 'hidden',
                border: `1px solid var(--rs-border)`,
              }}>
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    style={{
                      border: 'none', cursor: 'pointer',
                      width: 36, height: 32,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: view === v ? 'var(--rs-toggle-active-bg)' : 'var(--rs-toggle-bg)',
                      transition: 'background 0.15s, transform 0.1s',
                    }}
                  >
                    {v === 'grid'
                      ? <GridIcon active={view === 'grid'} />
                      : <ListIcon active={view === 'list'} />
                    }
                  </button>
                ))}
              </div>

              {/* Close button */}
              <button
                onClick={onClose}
                style={{
                  border: 'none', cursor: 'pointer',
                  width: 32, height: 32, borderRadius: 10,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--rs-toggle-bg)',
                  color: 'var(--rs-text-tertiary)',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-primary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--rs-bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-tertiary)';
                  (e.currentTarget as HTMLElement).style.background = 'var(--rs-toggle-bg)';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--rs-search-bg)', borderRadius: 12,
            border: `1px solid var(--rs-border-subtle)`,
            padding: '8px 12px', marginTop: 14,
            transition: 'border-color 0.15s',
          }}>
            <SearchIcon />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipes..."
              style={{
                border: 'none', outline: 'none', flex: 1,
                background: 'transparent', fontSize: 14,
                fontFamily: "'DM Sans', sans-serif",
                color: 'var(--rs-text-primary)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  color: 'var(--rs-text-tertiary)', fontSize: 16, lineHeight: 1,
                  padding: 0,
                }}
              >
                &times;
              </button>
            )}
          </div>

          {/* Category pills */}
          <div style={{
            display: 'flex', gap: 6, marginTop: 12, paddingBottom: 16,
            overflowX: 'auto',
          }}>
            {CATEGORIES.map((c) => {
              const isActive = activeCat === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setActiveCat(c.key)}
                  style={{
                    border: 'none', cursor: 'pointer',
                    padding: '6px 14px', borderRadius: 999,
                    fontSize: 13, fontWeight: 500,
                    fontFamily: "'DM Sans', sans-serif",
                    whiteSpace: 'nowrap',
                    background: isActive ? 'var(--rs-text-primary)' : 'var(--rs-toggle-bg)',
                    color: isActive ? 'var(--rs-bg)' : 'var(--rs-text-secondary)',
                    transition: 'all 0.15s',
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Scrollable recipe area ── */}
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '0 20px 12px',
        }}>
          {isLoading && !externalRecipes ? (
            <LoadingSpinner />
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '48px 16px',
              color: 'var(--rs-text-tertiary)', fontSize: 14,
            }}>
              No recipes found
            </div>
          ) : view === 'grid' ? (
            /* ── Grid View ── */
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              {filtered.map((recipe) => {
                const isSelected = selected.has(recipe.id);
                return (
                  <button
                    key={recipe.id}
                    onClick={() => toggle(recipe.id)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      borderRadius: 14, overflow: 'hidden',
                      border: `2px solid ${isSelected ? 'var(--rs-accent)' : 'var(--rs-border-subtle)'}`,
                      background: isSelected ? 'var(--rs-selected-bg)' : 'var(--rs-bg)',
                      boxShadow: 'var(--rs-card-shadow)',
                      transition: 'all 0.2s ease',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'var(--rs-card-shadow-hover)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.boxShadow = 'var(--rs-card-shadow)';
                      (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                    }}
                  >
                    {/* Photo area */}
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', overflow: 'hidden' }}>
                      {recipe.image ? (
                        <RecipePhoto src={recipe.image} name={recipe.name} />
                      ) : (
                        <FallbackImage name={recipe.name} />
                      )}
                      {isSelected && <CheckBadge />}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <p style={{
                        margin: 0, fontSize: 15, fontWeight: 600,
                        fontFamily: "'Fraunces', serif",
                        color: 'var(--rs-text-primary)',
                        lineHeight: 1.3,
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        textAlign: 'left',
                      }}>
                        {recipe.name}
                      </p>
                      <p style={{
                        margin: '4px 0 8px', fontSize: 12,
                        color: 'var(--rs-text-tertiary)',
                        textAlign: 'left',
                      }}>
                        {recipe.time} &middot; Serves {recipe.serves}
                      </p>
                      <CategoryPill cat={recipe.cat} />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* ── List View ── */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.map((recipe) => {
                const isSelected = selected.has(recipe.id);
                return (
                  <button
                    key={recipe.id}
                    onClick={() => toggle(recipe.id)}
                    style={{
                      all: 'unset', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 12,
                      background: isSelected ? 'var(--rs-selected-bg)' : 'transparent',
                      transition: 'background 0.15s',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'var(--rs-bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                      border: `2px solid ${isSelected ? 'var(--rs-accent)' : 'var(--rs-border)'}`,
                      background: isSelected ? 'var(--rs-accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <polyline points="2.5,6.5 5,9 9.5,3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>

                    {/* Name + subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0, fontSize: 15, fontWeight: 500,
                        fontFamily: "'Fraunces', serif",
                        color: 'var(--rs-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textAlign: 'left',
                      }}>
                        {recipe.name}
                      </p>
                      <p style={{
                        margin: '1px 0 0', fontSize: 12,
                        color: 'var(--rs-text-tertiary)',
                        textAlign: 'left',
                      }}>
                        {recipe.time} &middot; Serves {recipe.serves}
                      </p>
                    </div>

                    {/* Category pill */}
                    <CategoryPill cat={recipe.cat} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Sticky footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', flexShrink: 0,
          borderTop: `1px solid var(--rs-border)`,
          background: 'var(--rs-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button
              onClick={onClose}
              style={{
                border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                color: 'var(--rs-text-secondary)',
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-secondary)'; }}
            >
              Cancel
            </button>
            {count > 0 && (
              <button
                onClick={clearAll}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500,
                  fontFamily: "'DM Sans', sans-serif",
                  color: 'var(--rs-text-tertiary)',
                  padding: '4px 0',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-secondary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--rs-text-tertiary)'; }}
              >
                Clear all
              </button>
            )}
          </div>

          <button
            onClick={handleCTA}
            disabled={count === 0}
            style={{
              border: 'none', cursor: count > 0 ? 'pointer' : 'default',
              padding: '10px 20px', borderRadius: 12,
              fontSize: 14, fontWeight: 600,
              fontFamily: "'DM Sans', sans-serif",
              background: count > 0 ? 'var(--rs-accent)' : 'var(--rs-toggle-bg)',
              color: count > 0 ? '#ffffff' : 'var(--rs-text-tertiary)',
              boxShadow: count > 0 ? '0 4px 12px rgba(29, 158, 117, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => {
              if (count > 0) {
                (e.currentTarget as HTMLElement).style.background = 'var(--rs-accent-hover)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(29, 158, 117, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              if (count > 0) {
                (e.currentTarget as HTMLElement).style.background = 'var(--rs-accent)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(29, 158, 117, 0.25)';
              }
            }}
          >
            {ctaLabel}
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes rsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes rsSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes rsSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/* ── Image with error fallback ── */
const RecipePhoto = ({ src, name }: { src: string; name: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <FallbackImage name={name} />;
  return (
    <img
      src={src}
      alt={name}
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};

export default RecipeSelectorModal;

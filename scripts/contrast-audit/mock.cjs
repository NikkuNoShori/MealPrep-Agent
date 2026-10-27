// Fake Supabase backend for the contrast audit (scripts/contrast-audit).
// Row shapes mirror src/types/database.ts + the RPC payloads api.ts expects; extend as new screens/tables appear. Intercepts every request to
// *.supabase.co at the network layer so the real app code runs unmodified.
const REF = 'tiibvcgnxnpgvygmqzvu';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_ID = '33333333-3333-4333-8333-333333333333';
const PLAN_ID = '44444444-4444-4444-8444-444444444444';

const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const monday = new Date(now);
monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
const day = (n) => { const d = new Date(monday); d.setDate(monday.getDate() + n); return iso(d); };
const NOW = now.toISOString();

function svg(bg, fg, label) {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='480'><rect width='640' height='480' fill='${bg}'/><circle cx='320' cy='240' r='140' fill='${fg}' opacity='.55'/><text x='20' y='460' fill='${fg}' font-size='24'>${label}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(s);
}
const IMG_BRIGHT = svg('#f4efe6', '#e2d5b8', 'bright photo');
const IMG_DARK = svg('#1b1a17', '#4a4036', 'dark photo');
const IMG_MID = svg('#8a9a7b', '#d8e0c8', 'mid photo');

const ING = (name, amount, unit, category = 'pantry') => ({ name, amount, unit, category });
const recipe = (i, o) => ({
  id: `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`,
  user_id: USER_ID, slug: `recipe-${i}`, title: 'Recipe ' + i, description: 'A reliably delicious weeknight dinner the whole family enjoys.',
  ingredients: [ING('Olive oil', 2, 'tbsp'), ING('Garlic', 3, 'clove', 'produce'), ING('Chicken thighs', 1.5, 'lb', 'meat'), ING('Parmesan', 0.5, 'cup', 'dairy'), ING('Smoked paprika', 1, 'tsp', 'spices')],
  instructions: ['Heat the oil in a large skillet over medium heat.', 'Add the garlic and cook until fragrant, about 30 seconds.', 'Add the chicken and cook through, about 12 minutes.'],
  servings: 4, prep_time: 15, cook_time: 30, total_time: 45, difficulty: 'medium', tags: ['dinner', 'family', 'quick'],
  cuisine: 'American', dietary_tags: [], image_url: null, is_favorite: false, rating: null, visibility: 'private',
  source_name: null, source_url: null, nutrition_info: { calories: 520, protein: 38, carbs: 30, fat: 22, fiber: 4, sugar: 6 },
  created_at: NOW, updated_at: NOW, needs_reembed: false,
  profiles: { display_name: 'Nick', username: 'nikkunoshori', avatar_url: null },
  ...o,
});
const RECIPES = [
  recipe(1, { title: "King's Hawaiian Rolls with Garlic and Herb Butter", image_url: IMG_BRIGHT, visibility: 'public', difficulty: 'easy', is_favorite: true, rating: 5 }),
  recipe(2, { title: 'Elote Pasta Salad', image_url: IMG_DARK, visibility: 'household', difficulty: 'easy', tags: ['salad', 'summer', 'side', 'vegetarian'] }),
  recipe(3, { title: 'Lemon Orzo Pasta with Shrimp and a Very Long Recipe Title That Should Truncate Nicely', image_url: IMG_MID, visibility: 'public', difficulty: 'hard', total_time: 20 }),
  recipe(4, { title: 'Black Bean Chili', visibility: 'private', difficulty: 'medium', tags: [] }),
  recipe(5, { title: 'Tater Taco Casserole', image_url: IMG_BRIGHT, visibility: 'public', difficulty: 'easy', description: null }),
  recipe(6, { title: 'Yogurt Parfait', image_url: IMG_DARK, visibility: 'private', difficulty: 'easy', tags: ['breakfast'] }),
  recipe(7, { title: 'Greek Chicken and Potatoes', visibility: 'household', difficulty: 'medium', source_name: 'seriouseats.com', source_url: 'https://example.com/x' }),
  recipe(8, { title: 'Honey Garlic Butter Shrimp and Broccoli', image_url: IMG_MID, visibility: 'public', difficulty: 'medium', user_id: OTHER_ID, profiles: { display_name: 'Casey Cook', username: 'caseycooks', avatar_url: null } }),
];

const COLLECTIONS = [
  { id: 'c0000000-0000-4000-8000-000000000001', user_id: USER_ID, name: 'Casseroles', description: null, icon: 'book', visibility: 'private', sort_order: 1, created_at: NOW, updated_at: NOW, recipe_count: 3 },
  { id: 'c0000000-0000-4000-8000-000000000002', user_id: USER_ID, name: 'Favorites', description: null, icon: 'heart', visibility: 'private', sort_order: 0, created_at: NOW, updated_at: NOW, recipe_count: 2 },
  { id: 'c0000000-0000-4000-8000-000000000003', user_id: USER_ID, name: 'Shared Weeknights', description: null, icon: 'book', visibility: 'public', sort_order: 2, created_at: NOW, updated_at: NOW, recipe_count: 5 },
];

const entry = (n, date, slot, r, pos = 0) => ({
  id: `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, meal_plan_id: PLAN_ID, date, slot, list_key: null, position: pos,
  recipe_id: r.id, recipe_name: r.title, recipe_image: r.image_url, servings: 4, prep_time: r.prep_time, cook_time: r.cook_time, notes: null, created_at: NOW,
});
const ENTRIES = [
  entry(1, day(0), 'dinner', RECIPES[0]), entry(2, day(1), 'dinner', RECIPES[1]), entry(3, day(2), 'lunch', RECIPES[3]),
  entry(4, day(2), 'dinner', RECIPES[2]), entry(5, day(3), 'breakfast', RECIPES[5]), entry(6, day(4), 'dinner', RECIPES[6]),
  entry(7, day(5), 'snacks', RECIPES[4]),
];
const GROCERY = [
  ['Chicken thighs', 3, 'lb', 'meat', false], ['Garlic', 8, 'clove', 'produce', true], ['Parmesan', 1, 'cup', 'dairy', false],
  ['Smoked paprika', 2, 'tsp', 'spices', false], ['Olive oil', 4, 'tbsp', 'pantry', true], ['Frozen corn', 2, 'cup', 'frozen', false],
  ['Sparkling water', 6, 'can', 'beverages', false], ['Paper towels', 1, 'roll', 'other', false],
].map((g, i) => ({
  id: `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, meal_plan_id: PLAN_ID, name: g[0], amount: g[1], unit: g[2], category: g[3],
  source_recipes: ['Recipe 1'], is_manual: i === 7, is_checked: g[4], is_removed: false, notes: i === 0 ? 'bone-in, skin on' : null, position: i,
  last_generated: NOW, raw_amount: null,
}));
const PLAN = { id: PLAN_ID, user_id: USER_ID, title: 'This week', start_date: day(0), end_date: day(6), status: 'active', notes: null, created_by: USER_ID, last_edited_by: USER_ID, copied_from: null, total_cost: null, created_at: NOW, updated_at: NOW };
const OLD_PLAN = { ...PLAN, id: '44444444-4444-4444-8444-444444444445', title: 'Last week', start_date: day(-7), end_date: day(-1), status: 'completed' };

const PROFILE = {
  id: USER_ID, email: 'nick@example.com', display_name: 'Nick Neal', first_name: 'Nick', last_name: 'Neal', username: 'nikkunoshori', avatar_url: null,
  setup_completed: true, allergies: ['peanuts'], dietary_restrictions: [], household_size: 3, timezone: 'America/New_York',
  plan_period_config: { duration: 7, startDay: 1 }, randomizer_config: null, created_at: NOW, updated_at: NOW,
};
const OTHER_PROFILE = { ...PROFILE, id: OTHER_ID, email: 'casey@example.com', display_name: 'Casey Cook', first_name: 'Casey', username: 'caseycooks' };

const HOUSEHOLD = { id: HOUSEHOLD_ID, name: 'The Neal Household', created_by: USER_ID, allow_member_edits: true, allow_member_child_edits: false, created_at: NOW, updated_at: NOW };
const MEMBERS = [
  { id: 'm1', household_id: HOUSEHOLD_ID, user_id: USER_ID, role: 'owner', joined_at: NOW, households: { name: HOUSEHOLD.name }, profiles: { display_name: 'Nick Neal', username: 'nikkunoshori', avatar_url: null, email: 'nick@example.com' } },
  { id: 'm2', household_id: HOUSEHOLD_ID, user_id: OTHER_ID, role: 'member', joined_at: NOW, households: { name: HOUSEHOLD.name }, profiles: { display_name: 'Casey Cook', username: 'caseycooks', avatar_url: null, email: 'casey@example.com' } },
];
const FAMILY = [
  { id: 'fm1', household_id: HOUSEHOLD_ID, name: 'Riley', age: 7, relationship: 'child', allergies: ['tree nuts'], dietary_restrictions: ['dairy-free'], dietary_flags: ['dairy-free'], dislikes: ['mushrooms'], preferences: {}, is_active: true, managed_by: USER_ID, created_at: NOW, updated_at: NOW },
];

const DASH = {
  recipe_counts: { own_count: 55, household_count: 2, public_visible_count: 1, collection_shared_count: 0 },
  this_week: { plan_id: PLAN_ID, today_meals: { dinner: [{ id: 'x', recipe_id: RECIPES[0].id, recipe_name: RECIPES[0].title, recipe_image: RECIPES[0].image_url, servings: 4 }], lunch: [{ id: 'y', recipe_id: RECIPES[3].id, recipe_name: RECIPES[3].title, servings: 4 }] } },
  active_plan_count: 1,
  grocery_progress: { plan_id: PLAN_ID, checked: 2, total: 8, categories: [{ category: 'meat', checked: 0, total: 1 }, { category: 'produce', checked: 1, total: 1 }, { category: 'dairy', checked: 0, total: 1 }] },
  reactions_given: 7,
  most_cooked_this_month: [{ recipe_id: RECIPES[0].id, title: RECIPES[0].title, count: 4 }, { recipe_id: RECIPES[1].id, title: RECIPES[1].title, count: 2 }],
  top_cuisines: [{ cuisine: 'American', count: 4 }, { cuisine: 'Indian', count: 1 }, { cuisine: 'Global', count: 1 }],
};

const CHAT_RECIPE = {
  title: 'Garlic Herb Roasted Chicken Thighs', description: 'Crispy-skinned chicken with a bright garlic-herb finish.', prep_time: 10, cook_time: 40, servings: 4, difficulty: 'easy',
  tags: ['dinner', 'high-protein'], cuisine: 'American',
  ingredients: [{ name: 'Chicken thighs', amount: 2, unit: 'lb', category: 'meat' }, { name: 'Garlic', amount: 4, unit: 'clove', category: 'produce' }, { name: 'Thyme', amount: 1, unit: 'tbsp', category: 'spices', notes: 'fresh' }],
  instructions: ['Preheat the oven to 425F.', 'Toss the chicken with oil, garlic and thyme.', 'Roast 35-40 minutes until the skin is crisp.'],
};
const CONVERSATIONS = [{ id: 'conv-1', title: 'Weeknight chicken ideas', session_id: 'sess-1', last_message_at: NOW, created_at: NOW, selected_intent: null }];
const CHAT_MESSAGES = [
  { id: 'm-1', sender: 'user', content: 'Give me an easy chicken dinner idea', timestamp: NOW, metadata: {} },
  { id: 'm-2', sender: 'ai', content: "Here's a simple one the whole family will like. **Garlic Herb Roasted Chicken Thighs** is mostly hands-off.\n\n- 10 min prep\n- 40 min cook\n\nWant me to add it to this week's plan?", timestamp: NOW, metadata: { recipe: CHAT_RECIPE } },
  { id: 'm-3', sender: 'user', content: 'Add it to Thursday dinner', timestamp: NOW, metadata: {} },
  { id: 'm-4', sender: 'ai', content: 'Done. It is on **Thursday** dinner now. I also noticed `Garlic` is already on your grocery list.', timestamp: NOW, metadata: {} },
];

const TABLES = {
  recipes: RECIPES, recipe_collections: COLLECTIONS, collection_recipes: COLLECTIONS.flatMap((c, ci) => RECIPES.slice(0, 3).map((r, i) => ({ collection_id: c.id, recipe_id: r.id, sort_order: i, added_at: NOW }))),
  meal_plans: [PLAN, OLD_PLAN], meal_plan_entries: ENTRIES, grocery_list_items: GROCERY,
  profiles: [PROFILE, OTHER_PROFILE], households: [HOUSEHOLD], household_members: MEMBERS, family_members: FAMILY,
  user_preferences: [{ id: 'up1', user_id: USER_ID, measurement_system: 'imperial', created_at: NOW, updated_at: NOW }],
  user_roles: [{ id: 'ur1', user_id: USER_ID, role_id: 'r1', roles: { name: 'admin' } }],
};

const RPCS = {
  get_my_household: () => ({ household: HOUSEHOLD, my_role: 'owner', members: MEMBERS, pending_invites: [{ id: 'inv1', invited_email: 'grandma@example.com', created_at: NOW, status: 'pending' }], dependents: FAMILY }),
  get_dashboard_stats: () => DASH,
  get_my_pending_invites: () => [],
  get_household_recipes: () => ({ recipes: RECIPES.filter((r) => r.visibility !== 'private'), total: 5 }),
  get_shared_with_me: () => [{ share_id: 's1', recipe_id: RECIPES[7].id, title: RECIPES[7].title, description: 'Shared with you', image_url: IMG_MID, tags: ['seafood'], visibility: 'private', shared_at: NOW, seen_at: null, shared_by_user_id: OTHER_ID, sharer_display_name: 'Casey Cook', sharer_username: 'caseycooks', sharer_avatar_url: null }],
  get_unseen_share_count: () => 1,
  get_recipe_recommendations: () => RECIPES.slice(0, 7).map((r, i) => ({ ...r, recipe_id: r.id, recommendation_score: 0.9 - i * 0.04 })),
  get_recipe_reactions: () => [], toggle_recipe_reaction: () => ({}),
  search_recipes_text: () => RECIPES.slice(0, 3), find_similar_recipes: () => RECIPES.slice(1, 4).map((r, i) => ({ id: r.id, title: r.title, image_url: r.image_url, similarity: 0.85 - i * 0.05, tags: r.tags })),
};

function fakeJwt() {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({ alg: 'HS256', typ: 'JWT' })}.${b({ sub: USER_ID, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 86400 * 365, aud: 'authenticated' })}.sig`;
}
const AUTH_USER = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'nick@example.com', email_confirmed_at: NOW, app_metadata: { provider: 'email', providers: ['email', 'google'] },
  user_metadata: { full_name: 'Nick Neal', first_name: 'Nick', picture: null }, identities: [{ id: 'i1', provider: 'email', created_at: NOW }, { id: 'i2', provider: 'google', created_at: NOW }], created_at: NOW,
};
function sessionJson() {
  return { access_token: fakeJwt(), token_type: 'bearer', expires_in: 86400 * 365, expires_at: Math.floor(Date.now() / 1000) + 86400 * 365, refresh_token: 'fake-refresh', user: AUTH_USER };
}

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
const json = (route, body, status = 200, extra = {}) => route.fulfill({ status, contentType: 'application/json', headers: { ...CORS, ...extra }, body: JSON.stringify(body) });

function applyFilters(rows, params) {
  let out = rows;
  for (const [k, v] of params.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    if (v.startsWith('eq.')) { const val = v.slice(3); out = out.filter((r) => String(r[k]) === val); }
    else if (v.startsWith('in.(')) { const set = v.slice(4, -1).split(',').map((s) => s.replace(/^"|"$/g, '')); out = out.filter((r) => set.includes(String(r[k]))); }
  }
  return out;
}

async function installMocks(context, { authed = true } = {}) {
  await context.addInitScript(({ ref, session, authed }) => {
    try { if (authed) localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify(session)); else localStorage.removeItem(`sb-${ref}-auth-token`); } catch (e) {}
  }, { ref: REF, session: sessionJson(), authed });

  await context.route(/sentry\.io|googletagmanager|google-analytics/, (r) => r.abort());
  await context.route(/supabase\.co/, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    if (p.startsWith('/auth/v1/user')) return json(route, AUTH_USER);
    if (p.startsWith('/auth/v1/token')) return json(route, sessionJson());
    if (p.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, headers: CORS });
    if (p.startsWith('/auth/v1/')) return json(route, {});

    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.split('/').pop();
      const h = RPCS[fn];
      return json(route, h ? h() : null);
    }
    if (p.startsWith('/rest/v1/')) {
      const table = p.split('/')[3];
      const method = req.method();
      const all = TABLES[table] || [];
      if (method === 'GET' || method === 'HEAD') {
        const rows = applyFilters(all, url.searchParams);
        const accept = req.headers()['accept'] || '';
        const range = { 'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}` };
        if (accept.includes('vnd.pgrst.object')) {
          if (!rows.length) return json(route, { code: 'PGRST116', message: 'no rows', details: '', hint: '' }, 406);
          return json(route, rows[0], 200, range);
        }
        return json(route, rows, 200, range);
      }
      if (method === 'POST') {
        let body = {}; try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
        const row = Array.isArray(body) ? body[0] : body;
        const out = { id: 'new-id', created_at: NOW, ...row };
        const accept = req.headers()['accept'] || '';
        return json(route, accept.includes('vnd.pgrst.object') ? out : [out], 201);
      }
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (p.startsWith('/functions/v1/chat-api/history')) {
      if (url.searchParams.get('conversationId')) return json(route, { messages: CHAT_MESSAGES });
      return json(route, { conversations: CONVERSATIONS });
    }
    if (p.startsWith('/functions/v1/admin-api/users')) return json(route, [{ id: USER_ID, email: 'nick@example.com', display_name: 'Nick Neal', username: 'nikkunoshori', role: 'admin', created_at: NOW, last_sign_in_at: NOW }, { id: OTHER_ID, email: 'casey@example.com', display_name: 'Casey Cook', username: 'caseycooks', role: 'user', created_at: NOW, last_sign_in_at: NOW }]);
    if (p.startsWith('/functions/v1/admin-api/invites')) return json(route, [{ id: 'inv1', invited_email: 'grandma@example.com', status: 'pending', created_at: NOW, household_name: HOUSEHOLD.name }]);
    if (p.startsWith('/functions/v1/admin-api/households')) return json(route, [{ id: HOUSEHOLD_ID, name: HOUSEHOLD.name, member_count: 2, created_at: NOW }]);
    if (p.startsWith('/functions/v1/household-invite/details')) return json(route, { household_name: HOUSEHOLD.name, invited_email: 'nick@example.com', invited_by: 'Casey Cook', status: 'pending' });
    if (p.startsWith('/functions/v1/')) return json(route, {});
    return json(route, {});
  });
}

module.exports = { installMocks, USER_ID, REF, RECIPES, CHAT_RECIPE };

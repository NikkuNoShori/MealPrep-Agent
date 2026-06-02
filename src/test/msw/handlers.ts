import {
  http,
  HttpResponse,
  type DefaultBodyType,
  type HttpHandler,
  type HttpResponseResolver,
} from 'msw';

// Must match VITE_SUPABASE_URL set in .env.test.
export const SUPABASE_URL = 'http://localhost:54321';

// Internal helper that runs the conditional inside each verb-specific
// function. Verb-specific overloads are declared at module scope (not via
// a closure-returned factory) so TypeScript preserves them at the export
// boundary — overload signatures are lost when a function is returned from
// another function.
const buildHandler = (
  method: 'get' | 'post' | 'patch' | 'delete',
  url: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status: number,
  emptyBody = false
): HttpHandler => {
  if (typeof bodyOrResolver === 'function') {
    return http[method](url, bodyOrResolver as HttpResponseResolver);
  }
  if (emptyBody) {
    return http[method](url, () => new HttpResponse(null, { status }));
  }
  return http[method](url, () =>
    HttpResponse.json(bodyOrResolver as DefaultBodyType, { status })
  );
};

/**
 * Handler factory for `supabase.rpc('<fn_name>', ...)` calls.
 * Supabase JS v2 issues `POST {url}/rest/v1/rpc/{fn}` with args as JSON body.
 */
export function supabaseRpc(
  functionName: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseRpc(
  functionName: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseRpc(
  functionName: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 200
): HttpHandler {
  return buildHandler(
    'post',
    `${SUPABASE_URL}/rest/v1/rpc/${functionName}`,
    bodyOrResolver,
    status
  );
}

/**
 * Handler factory for `supabase.from('<table>').select(...)` calls.
 * Supabase JS v2 issues `GET {url}/rest/v1/{table}` with filters as query string.
 */
export function supabaseSelect(
  table: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseSelect(
  table: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseSelect(
  table: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 200
): HttpHandler {
  return buildHandler(
    'get',
    `${SUPABASE_URL}/rest/v1/${table}`,
    bodyOrResolver,
    status
  );
}

/**
 * Handler factory for `supabase.from('<table>').update(...)` calls.
 * Supabase JS v2 issues `PATCH {url}/rest/v1/{table}` with filters as query string.
 */
export function supabasePatch(
  table: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabasePatch(
  table: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabasePatch(
  table: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 200
): HttpHandler {
  return buildHandler(
    'patch',
    `${SUPABASE_URL}/rest/v1/${table}`,
    bodyOrResolver,
    status
  );
}

/**
 * Handler factory for `supabase.from('<table>').delete()` calls.
 * Supabase JS v2 issues `DELETE {url}/rest/v1/{table}` with filters as query string.
 * With no `select()` chained, PostgREST returns 204 (no content).
 */
export function supabaseDelete(table: string): HttpHandler;
export function supabaseDelete(
  table: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseDelete(
  table: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseDelete(
  table: string,
  bodyOrResolver?: unknown | HttpResponseResolver,
  status = 204
): HttpHandler {
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  return buildHandler(
    'delete',
    url,
    bodyOrResolver,
    status,
    bodyOrResolver === undefined
  );
}

/**
 * Handler factory for `supabase.from('<table>').insert(...)` calls.
 * Supabase JS v2 issues `POST {url}/rest/v1/{table}` with row(s) as JSON body.
 * Without `.select()`, PostgREST returns 201 with no body (handlers may
 * still return JSON when `.select()` is chained).
 */
export function supabaseInsert(
  table: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseInsert(
  table: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseInsert(
  table: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 201
): HttpHandler {
  return buildHandler(
    'post',
    `${SUPABASE_URL}/rest/v1/${table}`,
    bodyOrResolver,
    status
  );
}

/**
 * Handler factory for Supabase Edge Function POST calls
 * (`{url}/functions/v1/{path}`).
 */
export function supabaseEdgePost(
  path: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseEdgePost(
  path: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseEdgePost(
  path: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 200
): HttpHandler {
  return buildHandler(
    'post',
    `${SUPABASE_URL}/functions/v1/${path}`,
    bodyOrResolver,
    status
  );
}

/**
 * Handler factory for Supabase Edge Function GET calls
 * (`{url}/functions/v1/{path}`).
 *
 * Note: `path` here is the literal route prefix — query strings are matched
 * by MSW's pathname matcher and don't need to be included.
 */
export function supabaseEdgeGet(
  path: string,
  resolver: HttpResponseResolver
): HttpHandler;
export function supabaseEdgeGet(
  path: string,
  body: unknown,
  status?: number
): HttpHandler;
export function supabaseEdgeGet(
  path: string,
  bodyOrResolver: unknown | HttpResponseResolver,
  status = 200
): HttpHandler {
  return buildHandler(
    'get',
    `${SUPABASE_URL}/functions/v1/${path}`,
    bodyOrResolver,
    status
  );
}

/**
 * Catch-all for the auth endpoints supabase-js may call at module-load time.
 * Returns a "no session" response so test files can import api.ts without
 * tripping unhandled-request errors.
 */
export const supabaseAuthDefaults = [
  http.get(`${SUPABASE_URL}/auth/v1/user`, () =>
    HttpResponse.json({ message: 'no session' }, { status: 401 })
  ),
  http.post(`${SUPABASE_URL}/auth/v1/token`, () =>
    HttpResponse.json({ message: 'no session' }, { status: 401 })
  ),
];

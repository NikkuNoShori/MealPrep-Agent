/**
 * Admin API Edge Function
 *
 * Uses service role to access auth.users and perform admin operations.
 * All routes verify the caller has the 'admin' role.
 *
 * Routes:
 *   GET  /users       — List all auth.users with profile data
 *   DELETE /users      — Delete a user by ID
 *   PATCH  /users      — Update a user's profile
 *   GET  /invites      — List all household invites
 *   DELETE /invites     — Delete an invite by ID
 *   GET  /households   — List all households with members
 *   DELETE /households  — Delete a household by ID
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, corsError } from "../_shared/cors.ts";
import {
  getUserFromToken,
  createServiceClient,
} from "../_shared/supabase-client.ts";

// Verify caller is admin
async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("Missing authorization");

  const token = authHeader.replace("Bearer ", "");
  const auth = await getUserFromToken(token);
  if (!auth) throw new Error("Invalid token");

  const admin = createServiceClient();
  const { data: userRole } = await admin
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", auth.user.id)
    .eq("roles.name", "admin")
    .maybeSingle();

  if (!userRole?.roles) throw new Error("Forbidden: admin role required");

  return { auth, admin };
}

// ── GET /users ──
async function handleGetUsers(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);

  // Get all auth users
  const { data: authData, error: authError } =
    await admin.auth.admin.listUsers({ perPage: 1000 });

  if (authError) {
    console.error("listUsers error:", authError);
    return corsError("Failed to list users", 500);
  }

  // Get all profiles for supplementary data
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, display_name, username, avatar_url, setup_completed");

  const profileMap = new Map(
    (profiles || []).map((p: any) => [p.id, p])
  );

  const users = (authData?.users || []).map((u: any) => {
    const profile = profileMap.get(u.id) || {};
    return {
      id: u.id,
      email: u.email,
      display_name: (profile as any).display_name || u.user_metadata?.display_name || u.user_metadata?.full_name || null,
      username: (profile as any).username || null,
      avatar_url: (profile as any).avatar_url || u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
      setup_completed: (profile as any).setup_completed ?? true,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      email_confirmed_at: u.email_confirmed_at,
      invited_at: u.invited_at,
      provider: u.app_metadata?.provider || 'email',
      has_profile: profileMap.has(u.id),
    };
  });

  return corsResponse(users);
}

// ── DELETE /users ──
async function handleDeleteUser(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);
  const { userId } = await req.json();
  if (!userId) return corsError("userId is required", 400);

  // Delete from auth (cascades to profiles via FK)
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("deleteUser error:", error);
    return corsError(error.message || "Failed to delete user", 500);
  }

  return corsResponse({ success: true });
}

// ── PATCH /users ──
async function handleUpdateUser(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);
  const { userId, updates } = await req.json();
  if (!userId) return corsError("userId is required", 400);

  const { error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    console.error("updateUser error:", error);
    return corsError(error.message || "Failed to update user", 500);
  }

  return corsResponse({ success: true });
}

// ── GET /invites ──
async function handleGetInvites(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);

  const { data, error } = await admin
    .from("household_invites")
    .select("id, household_id, invited_by, invited_email, inviter_name, status, expires_at, created_at, households(name)")
    .order("created_at", { ascending: false });

  if (error) return corsError(error.message, 500);
  return corsResponse(data || []);
}

// ── DELETE /invites ──
async function handleDeleteInvite(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);
  const { inviteId } = await req.json();
  if (!inviteId) return corsError("inviteId is required", 400);

  const { error } = await admin
    .from("household_invites")
    .delete()
    .eq("id", inviteId);

  if (error) return corsError(error.message, 500);
  return corsResponse({ success: true });
}

// ── GET /households ──
async function handleGetHouseholds(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);

  const { data, error } = await admin
    .from("households")
    .select("id, name, created_by, created_at, household_members(id, user_id, role, profiles(display_name, email))")
    .order("created_at", { ascending: false });

  if (error) return corsError(error.message, 500);
  return corsResponse(data || []);
}

// ── DELETE /households ──
async function handleDeleteHousehold(req: Request): Promise<Response> {
  const { admin } = await requireAdmin(req);
  const { householdId } = await req.json();
  if (!householdId) return corsError("householdId is required", 400);

  // Delete members first, then household
  await admin.from("household_members").delete().eq("household_id", householdId);
  const { error } = await admin.from("households").delete().eq("id", householdId);

  if (error) return corsError(error.message, 500);
  return corsResponse({ success: true });
}

// ── ROUTER ──
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    switch (path) {
      case "users":
        if (req.method === "GET") return await handleGetUsers(req);
        if (req.method === "DELETE") return await handleDeleteUser(req);
        if (req.method === "PATCH") return await handleUpdateUser(req);
        return corsError("Method not allowed", 405);

      case "invites":
        if (req.method === "GET") return await handleGetInvites(req);
        if (req.method === "DELETE") return await handleDeleteInvite(req);
        return corsError("Method not allowed", 405);

      case "households":
        if (req.method === "GET") return await handleGetHouseholds(req);
        if (req.method === "DELETE") return await handleDeleteHousehold(req);
        return corsError("Method not allowed", 405);

      default:
        return corsError(`Unknown route: ${path}`, 404);
    }
  } catch (error) {
    if (error.message === "Forbidden: admin role required") {
      return corsError(error.message, 403);
    }
    if (error.message === "Missing authorization" || error.message === "Invalid token") {
      return corsError(error.message, 401);
    }
    console.error("Unhandled error:", error);
    return corsError(error.message || "Internal server error", 500);
  }
});

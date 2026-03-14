/**
 * Household Invite Edge Function
 *
 * Uses Supabase Auth's built-in inviteUserByEmail() for email delivery.
 *
 * Routes:
 *   POST /send     — Create invite record + send Supabase invite email
 *   GET  /details  — Public: get invite metadata by ID (for accept page)
 *   POST /accept   — Authenticated: validate invite, join household
 *   POST /resend   — Authenticated (owner/admin): resend invite email
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, corsResponse, corsError } from "../_shared/cors.ts";
import {
  getUserFromToken,
  createServiceClient,
} from "../_shared/supabase-client.ts";

// ═══════════════════════════════════════════════════════════════════
// ROUTE: POST /send
// ═══════════════════════════════════════════════════════════════════

async function handleSend(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return corsError("Missing authorization", 401);

  const token = authHeader.replace("Bearer ", "");
  const auth = await getUserFromToken(token);
  if (!auth) return corsError("Invalid token", 401);

  const { householdId, email, origin } = await req.json();
  if (!householdId || !email) return corsError("householdId and email are required", 400);

  const normalizedEmail = email.trim().toLowerCase();

  // Verify inviter is owner/admin of the household
  const { data: membership } = await auth.supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", auth.user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return corsError("Only owners and admins can send invites", 403);
  }

  // Check for existing pending invite to same email in same household
  const admin = createServiceClient();
  const { data: existing } = await admin
    .from("household_invites")
    .select("id")
    .eq("household_id", householdId)
    .eq("invited_email", normalizedEmail)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return corsError("An invite is already pending for this email", 409);
  }

  // Can't invite yourself
  if (auth.user.email?.toLowerCase() === normalizedEmail) {
    return corsError("You can't invite yourself", 400);
  }

  // Check if user is already a member
  const { data: existingMember } = await admin
    .from("household_members")
    .select("id, profiles(email)")
    .eq("household_id", householdId);

  const alreadyMember = (existingMember || []).some(
    (m: any) => m.profiles?.email?.toLowerCase() === normalizedEmail
  );
  if (alreadyMember) {
    return corsError("This person is already a member of your household", 409);
  }

  // Get inviter name and household name
  const { data: inviterProfile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", auth.user.id)
    .single();

  const { data: household } = await admin
    .from("households")
    .select("name")
    .eq("id", householdId)
    .single();

  const inviterName = inviterProfile?.display_name || auth.user.email?.split("@")[0] || "Someone";
  const householdName = household?.name || "a household";

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Create invite row
  const { data: invite, error: insertError } = await admin
    .from("household_invites")
    .insert({
      household_id: householdId,
      invited_by: auth.user.id,
      invited_email: normalizedEmail,
      inviter_name: inviterName,
      status: "pending",
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (insertError) {
    console.error("Insert error:", insertError);
    return corsError("Failed to create invite", 500);
  }

  // Send invite via Supabase Auth — use caller's origin so dev invites redirect to localhost
  const appUrl = origin || Deno.env.get("APP_URL") || "http://localhost:5173";
  const redirectTo = `${appUrl}/invite/accept?id=${invite.id}`;

  try {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      normalizedEmail,
      {
        redirectTo,
        data: {
          household_name: householdName,
          inviter_name: inviterName,
        },
      }
    );

    if (inviteError) {
      // User may already exist — invite record is still created
      // Existing users will see the invite in-app
      console.warn("Supabase invite email note:", inviteError.message);
    }
  } catch (emailError) {
    console.warn("Supabase invite call failed:", emailError);
    // Invite record still exists — user can accept in-app
  }

  return corsResponse({
    success: true,
    invite: { id: invite.id, email: normalizedEmail, expiresAt },
  });
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE: GET /details?id=xxx
// ═══════════════════════════════════════════════════════════════════

async function handleDetails(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const inviteId = url.searchParams.get("id");
  if (!inviteId) return corsError("Invite ID is required", 400);

  const admin = createServiceClient();

  const { data: invite } = await admin
    .from("household_invites")
    .select("id, status, expires_at, inviter_name, invited_email, households(id, name)")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return corsError("Invalid invite link", 404);

  if (invite.status !== "pending") {
    return corsResponse({
      valid: false,
      reason: invite.status === "accepted" ? "already_accepted" : invite.status === "declined" ? "declined" : "expired",
      householdName: (invite as any).households?.name,
    });
  }

  if (new Date(invite.expires_at) < new Date()) {
    // Mark as expired
    await admin.from("household_invites").update({ status: "expired" }).eq("id", invite.id);
    return corsResponse({
      valid: false,
      reason: "expired",
      householdName: (invite as any).households?.name,
    });
  }

  return corsResponse({
    valid: true,
    inviterName: invite.inviter_name,
    householdName: (invite as any).households?.name,
    invitedEmail: invite.invited_email,
    expiresAt: invite.expires_at,
  });
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE: POST /accept
// ═══════════════════════════════════════════════════════════════════

async function handleAccept(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return corsError("Must be signed in to accept an invite", 401);

  const userToken = authHeader.replace("Bearer ", "");
  const auth = await getUserFromToken(userToken);
  if (!auth) return corsError("Invalid session", 401);

  const { inviteId } = await req.json();
  if (!inviteId) return corsError("inviteId is required", 400);

  const admin = createServiceClient();

  const { data: invite } = await admin
    .from("household_invites")
    .select("id, household_id, status, expires_at, invited_email, households(name)")
    .eq("id", inviteId)
    .maybeSingle();

  if (!invite) return corsError("Invalid invite link", 404);

  if (invite.status !== "pending") {
    // If already accepted (e.g. by handle_new_user trigger), treat as success
    if (invite.status === "accepted") {
      return corsResponse({
        success: true,
        householdName: (invite as any).households?.name,
        message: `Welcome to ${(invite as any).households?.name || "the household"}!`,
      });
    }
    return corsError("This invite is no longer valid", 410);
  }

  if (new Date(invite.expires_at) < new Date()) {
    await admin.from("household_invites").update({ status: "expired" }).eq("id", invite.id);
    return corsError("This invite has expired", 410);
  }

  // Verify email match (case-insensitive)
  const userEmail = auth.user.email?.toLowerCase();
  const invitedEmail = invite.invited_email?.toLowerCase();

  if (userEmail !== invitedEmail) {
    return corsError(
      `This invite was sent to ${invite.invited_email}. You're signed in as ${auth.user.email}. Please sign in with the correct account.`,
      403
    );
  }

  // Check if already a member
  const { data: existingMembership } = await admin
    .from("household_members")
    .select("id")
    .eq("household_id", invite.household_id)
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (existingMembership) {
    // Already a member — mark invite accepted and return success
    await admin.from("household_invites").update({ status: "accepted" }).eq("id", invite.id);
    return corsResponse({
      success: true,
      householdName: (invite as any).households?.name,
      message: "You're already a member of this household",
    });
  }

  // Accept: upsert membership + update invite status
  const { error: joinError } = await admin
    .from("household_members")
    .upsert(
      {
        household_id: invite.household_id,
        user_id: auth.user.id,
        role: "member",
      },
      { onConflict: "household_id,user_id", ignoreDuplicates: true }
    );

  if (joinError) {
    console.error("Join error:", joinError);
    return corsError(`Failed to join household: ${joinError.message}`, 500);
  }

  await admin.from("household_invites").update({ status: "accepted" }).eq("id", invite.id);

  return corsResponse({
    success: true,
    householdName: (invite as any).households?.name,
    message: `Welcome to ${(invite as any).households?.name}!`,
  });
}

// ═══════════════════════════════════════════════════════════════════
// ROUTE: POST /resend
// ═══════════════════════════════════════════════════════════════════

async function handleResend(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return corsError("Missing authorization", 401);

  const userToken = authHeader.replace("Bearer ", "");
  const auth = await getUserFromToken(userToken);
  if (!auth) return corsError("Invalid token", 401);

  const { inviteId, origin } = await req.json();
  if (!inviteId) return corsError("inviteId is required", 400);

  const admin = createServiceClient();

  // Get invite
  const { data: invite } = await admin
    .from("household_invites")
    .select("id, household_id, invited_email, status, inviter_name, households(name)")
    .eq("id", inviteId)
    .single();

  if (!invite) return corsError("Invite not found", 404);
  if (invite.status !== "pending") return corsError("Invite is no longer pending", 410);

  // Verify caller is owner/admin
  const { data: membership } = await auth.supabase
    .from("household_members")
    .select("role")
    .eq("household_id", invite.household_id)
    .eq("user_id", auth.user.id)
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return corsError("Only owners and admins can resend invites", 403);
  }

  // Update expiry
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await admin
    .from("household_invites")
    .update({ expires_at: expiresAt })
    .eq("id", invite.id);

  // Resend via Supabase Auth — use caller's origin so dev invites redirect to localhost
  const appUrl = origin || Deno.env.get("APP_URL") || "http://localhost:5173";
  const redirectTo = `${appUrl}/invite/accept?id=${invite.id}`;

  const inviterName = invite.inviter_name || "Someone";
  const householdName = (invite as any).households?.name || "a household";

  try {
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      invite.invited_email,
      {
        redirectTo,
        data: {
          household_name: householdName,
          inviter_name: inviterName,
        },
      }
    );

    if (inviteError) {
      console.warn("Supabase resend note:", inviteError.message);
      return corsError("Could not resend invite email. The user may already have an account — they can accept the invite from their dashboard.", 422);
    }
  } catch (emailError) {
    console.error("Resend failed:", emailError);
    return corsError("Failed to resend invite email", 500);
  }

  return corsResponse({ success: true, expiresAt });
}

// ═══════════════════════════════════════════════════════════════════
// MAIN ROUTER
// ═══════════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop() || "";

    switch (path) {
      case "send":
        if (req.method !== "POST") return corsError("Method not allowed", 405);
        return await handleSend(req);

      case "details":
        if (req.method !== "GET") return corsError("Method not allowed", 405);
        return await handleDetails(req);

      case "accept":
        if (req.method !== "POST") return corsError("Method not allowed", 405);
        return await handleAccept(req);

      case "resend":
        if (req.method !== "POST") return corsError("Method not allowed", 405);
        return await handleResend(req);

      default:
        return corsError(`Unknown route: ${path}`, 404);
    }
  } catch (error) {
    console.error("Unhandled error:", error);
    return corsError(error.message || "Internal server error", 500);
  }
});

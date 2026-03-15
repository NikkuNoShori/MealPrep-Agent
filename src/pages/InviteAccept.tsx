import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/services/supabase';
import { apiClient, useAcceptInviteById } from '@/services/api';
import { Loader2, CheckCircle, XCircle, Home, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InviteState =
  | { status: 'loading' }
  | { status: 'details'; inviterName: string; householdName: string; invitedEmail: string; expiresAt: string }
  | { status: 'accepting' }
  | { status: 'accepted'; householdName: string; message: string }
  | { status: 'error'; reason: string; householdName?: string };

const InviteAccept: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, refreshUser } = useAuthStore();
  const inviteId = searchParams.get('id');
  const [state, setState] = useState<InviteState>({ status: 'loading' });
  const acceptMutation = useAcceptInviteById();
  const hasAttemptedAccept = useRef(false);

  // Listen for auth state changes (handles invite email redirect with tokens in URL hash)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await refreshUser();
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUser]);

  // Fetch invite details on mount
  useEffect(() => {
    if (!inviteId) {
      // Check sessionStorage for invite ID (redirect flow from signin/signup)
      const storedId = sessionStorage.getItem('pendingInviteId');
      if (storedId) {
        sessionStorage.removeItem('pendingInviteId');
        navigate(`/invite/accept?id=${encodeURIComponent(storedId)}`, { replace: true });
        return;
      }
      setState({ status: 'error', reason: 'No invite ID provided.' });
      return;
    }

    apiClient.getInviteDetails(inviteId).then((data: any) => {
      if (!data.valid) {
        const reasons: Record<string, string> = {
          already_accepted: 'This invite has already been accepted.',
          declined: 'This invite has been declined.',
          expired: 'This invite has expired. Ask the household owner to send a new one.',
        };
        setState({
          status: 'error',
          reason: reasons[data.reason] || 'This invite is no longer valid.',
          householdName: data.householdName,
        });
        return;
      }
      setState({
        status: 'details',
        inviterName: data.inviterName,
        householdName: data.householdName,
        invitedEmail: data.invitedEmail,
        expiresAt: data.expiresAt,
      });
    }).catch((err: any) => {
      setState({ status: 'error', reason: err.message || 'Failed to load invite details.' });
    });
  }, [inviteId, navigate]);

  // Auto-accept when user is authenticated and details are loaded
  useEffect(() => {
    if (authLoading || !user || !inviteId) return;
    if (state.status !== 'details') return;
    if (hasAttemptedAccept.current) return;

    // If user hasn't completed setup, redirect there first (they need a profile before joining)
    if (user.setup_completed === false) {
      sessionStorage.setItem('pendingInviteId', inviteId);
      navigate('/complete-setup', { replace: true });
      return;
    }

    hasAttemptedAccept.current = true;
    setState({ status: 'accepting' });

    acceptMutation.mutate(inviteId, {
      onSuccess: async (data: any) => {
        // Refresh user state (reloads profile, household, role)
        await refreshUser();

        setState({
          status: 'accepted',
          householdName: data.householdName || 'the household',
          message: data.message || 'Welcome!',
        });
      },
      onError: (err: any) => {
        setState({
          status: 'error',
          reason: err.message || 'Failed to accept invite.',
        });
      },
    });
  }, [authLoading, user, inviteId, state.status, acceptMutation, refreshUser, navigate]);

  const handleSignIn = () => {
    if (inviteId) sessionStorage.setItem('pendingInviteId', inviteId);
    if (state.status === 'details') {
      sessionStorage.setItem('inviteEmail', state.invitedEmail);
    }
    navigate('/signin');
  };

  const handleSignUp = () => {
    if (inviteId) sessionStorage.setItem('pendingInviteId', inviteId);
    if (state.status === 'details') {
      sessionStorage.setItem('inviteEmail', state.invitedEmail);
    }
    navigate('/signup');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-secondary-500 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-stone-900 dark:text-white tracking-tight">
              MealPrep <span className="text-primary-500">Agent</span>
            </span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/[0.06] dark:shadow-black/30 border border-gray-200/60 dark:border-white/[0.06] overflow-hidden">
          {/* Loading */}
          {(state.status === 'loading' || state.status === 'accepting') && (
            <div className="px-8 py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary-500" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {state.status === 'loading' ? 'Loading invite details...' : 'Joining household...'}
              </p>
            </div>
          )}

          {/* Invite Details (not logged in) */}
          {state.status === 'details' && !user && !authLoading && (
            <div className="px-8 py-10">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Home className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
                You're invited!
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-center text-sm leading-relaxed mb-8">
                <span className="font-semibold text-gray-700 dark:text-gray-200">{state.inviterName}</span> has invited you to join{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200">{state.householdName}</span>{' '}
                on MealPrep Agent.
              </p>

              <div className="bg-gray-50 dark:bg-white/[0.03] rounded-xl p-4 mb-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Invited email</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{state.invitedEmail}</p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleSignIn}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-11"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In to Join
                </Button>
                <Button
                  onClick={handleSignUp}
                  variant="outline"
                  className="w-full rounded-xl h-11 border-gray-200 dark:border-white/10"
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </Button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-6">
                Expires {new Date(state.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}

          {/* Details loaded but user is authenticated — accepting happens via useEffect */}
          {state.status === 'details' && user && (
            <div className="px-8 py-16 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary-500" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Joining household...</p>
            </div>
          )}

          {/* Accepted */}
          {state.status === 'accepted' && (
            <div className="px-8 py-10 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-100 to-green-100 dark:from-emerald-900/30 dark:to-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Welcome!
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                {state.message}
              </p>
              <Button
                onClick={() => navigate('/household', { replace: true })}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-11 px-8"
              >
                <Home className="w-4 h-4 mr-2" />
                Go to Household
              </Button>
            </div>
          )}

          {/* Error */}
          {state.status === 'error' && (
            <div className="px-8 py-10 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/30 dark:to-red-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Invite Error
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
                {state.reason}
              </p>
              <Button
                onClick={() => navigate(user ? '/household' : '/', { replace: true })}
                variant="outline"
                className="rounded-xl h-11 px-8 border-gray-200 dark:border-white/10"
              >
                {user ? 'Go to Household' : 'Go Home'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InviteAccept;

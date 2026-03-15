import React, { useEffect, useState } from 'react';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuthStore } from '../stores/authStore';
import { useMeasurementSystem } from "../contexts/MeasurementSystemContext";
import {
  useMyProfile,
  useUpdateUsername,
} from '../services/api';
import {
  Moon,
  Sun,
  Monitor,
  Link as LinkIcon,
  Unlink,
  Loader2,
  Save,
  X,
  Check,
  Pencil,
} from "lucide-react";
import toast from 'react-hot-toast';

const Settings = () => {
  const { theme, setTheme, colorScheme, availableColorSchemes, setColorScheme } = useTheme();
  const { user, linkedAccounts, linkGoogleAccount, unlinkGoogleAccount, loadLinkedAccounts, requestPasswordReset } = useAuthStore();
  const {
    system,
    setSystem,
    isLoading: isLoadingMeasurement,
  } = useMeasurementSystem();

  // Staged changes (not yet saved)
  const [stagedTheme, setStagedTheme] = useState<typeof theme>(theme);
  const [stagedColorScheme, setStagedColorScheme] = useState<string>(colorScheme.name);
  const [stagedMeasurementSystem, setStagedMeasurementSystem] = useState<typeof system>(system);

  // Profile state
  const { data: profile } = useMyProfile();
  const updateUsername = useUpdateUsername();
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');

  // Check if there are unsaved changes
  const hasUnsavedChanges =
    stagedTheme !== theme ||
    stagedColorScheme !== colorScheme.name ||
    stagedMeasurementSystem !== system;

  // Reset staged values when theme/colorScheme/system changes externally
  useEffect(() => {
    setStagedTheme(theme);
    setStagedColorScheme(colorScheme.name);
    setStagedMeasurementSystem(system);
  }, [theme, colorScheme.name, system]);

  // Get the staged color scheme for preview
  const previewColorScheme = availableColorSchemes[stagedColorScheme] || colorScheme;

  useEffect(() => {
    if (user) {
      loadLinkedAccounts();
    }
  }, [user, loadLinkedAccounts]);

  const hasGoogleLinked = linkedAccounts.some(account => account.provider === 'google');
  const hasEmailPassword = linkedAccounts.some(account => account.provider === 'email');

  const handleLinkGoogle = async () => {
    try {
      await linkGoogleAccount(`${window.location.origin}/auth/callback`);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to link Google account');
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!hasEmailPassword) {
      // No password set — send a password reset email so they can create one
      try {
        await requestPasswordReset(user?.email || '');
        toast.success('Password setup email sent. Set a password, then unlink Google.');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to send password setup email');
      }
      return;
    }

    if (!confirm('Are you sure you want to unlink your Google account? You will need to use email/password to sign in.')) {
      return;
    }

    try {
      await unlinkGoogleAccount();
      toast.success('Google account unlinked successfully');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to unlink Google account');
    }
  };

  const handleSave = () => {
    if (stagedTheme !== theme) {
      setTheme(stagedTheme);
    }
    if (stagedColorScheme !== colorScheme.name) {
      setColorScheme(stagedColorScheme);
    }
    if (stagedMeasurementSystem !== system) {
      setSystem(stagedMeasurementSystem);
    }
    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    setStagedTheme(theme);
    setStagedColorScheme(colorScheme.name);
    setStagedMeasurementSystem(system);
    toast('Changes reset');
  };

  const handleSaveUsername = () => {
    const trimmed = editedUsername.trim().toLowerCase();
    if (!trimmed) return;
    updateUsername.mutate(trimmed, {
      onSuccess: () => {
        toast.success('Username updated');
        setIsEditingUsername(false);
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to update username');
      },
    });
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">Settings</h1>
        {hasUnsavedChanges && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
            >
              Reset
            </button>
            <Button onClick={handleSave} size="sm" className="bg-primary-500 hover:bg-primary-600 text-white rounded-lg">
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-10">
        {/* ── Account ── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Account</h2>
          <div className="space-y-5">
            {/* Email */}
            <div className="flex items-center justify-between">
              <Label className="text-sm text-stone-600 dark:text-stone-300">Email</Label>
              <span className="text-sm text-stone-500 dark:text-stone-400">{user?.email || "Not available"}</span>
            </div>

            {/* Username */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm text-stone-600 dark:text-stone-300">Username</Label>
                {!isEditingUsername && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-stone-500 dark:text-stone-400">@{profile?.username || '...'}</span>
                    <button
                      className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      onClick={() => {
                        setEditedUsername(profile?.username || '');
                        setIsEditingUsername(true);
                      }}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              {isEditingUsername && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                    <Input
                      value={editedUsername}
                      onChange={(e) => setEditedUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="username"
                      className="pl-7 h-9"
                      maxLength={30}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveUsername();
                        if (e.key === 'Escape') setIsEditingUsername(false);
                      }}
                      autoFocus
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleSaveUsername}
                    disabled={updateUsername.isPending || editedUsername.trim().length < 3}
                    className="h-9"
                  >
                    {updateUsername.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingUsername(false)}
                    className="h-9"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-stone-200/60 dark:border-white/[0.06]" />

            {/* Connected Accounts */}
            <div>
              <Label className="text-sm text-stone-600 dark:text-stone-300 mb-3 block">Connected Accounts</Label>
              <div className="space-y-2">
                {hasEmailPassword && (
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center">
                        <span className="text-stone-500 dark:text-stone-400 text-sm font-medium">@</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Email & Password</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">Always available</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-stone-100 dark:bg-white/[0.06] flex items-center justify-center">
                      <svg className="w-4 h-4 text-stone-500 dark:text-stone-400" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Google</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500">
                        {hasGoogleLinked ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {hasGoogleLinked ? (
                    <button
                      onClick={handleUnlinkGoogle}
                      className="text-xs text-stone-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                      title={!hasEmailPassword ? "Sends a password setup email first" : "Unlink Google account"}
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={handleLinkGoogle}
                      className="text-xs text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                      title="Link Google account"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Appearance</h2>
          <div className="space-y-5">
            {/* Theme */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm text-stone-600 dark:text-stone-300">Theme</Label>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Light, dark, or match your system</p>
              </div>
              <Select
                value={stagedTheme}
                onValueChange={(value) => setStagedTheme(value as typeof theme)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Color Scheme */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm text-stone-600 dark:text-stone-300">Color Scheme</Label>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">App accent palette</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div
                    className="w-5 h-5 rounded-full border border-stone-200 dark:border-white/10"
                    style={{ backgroundColor: previewColorScheme.primary[500] }}
                    title="Primary"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-stone-200 dark:border-white/10"
                    style={{ backgroundColor: previewColorScheme.secondary[500] }}
                    title="Secondary"
                  />
                  <div
                    className="w-5 h-5 rounded-full border border-stone-200 dark:border-white/10"
                    style={{ backgroundColor: previewColorScheme.neutral[500] }}
                    title="Neutral"
                  />
                </div>
                <Select
                  value={stagedColorScheme}
                  onValueChange={setStagedColorScheme}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(availableColorSchemes).map((schemeName) => (
                      <SelectItem key={schemeName} value={schemeName}>
                        {schemeName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </section>

        {/* ── Preferences ── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-4">Preferences</h2>
          <div className="space-y-5">
            {/* Measurement System */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm text-stone-600 dark:text-stone-300">Unit System</Label>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">Converts recipe measurements automatically</p>
              </div>
              <Select
                value={stagedMeasurementSystem}
                onValueChange={(value: "metric" | "imperial") =>
                  setStagedMeasurementSystem(value)
                }
                disabled={isLoadingMeasurement}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric</SelectItem>
                  <SelectItem value="imperial">Imperial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;

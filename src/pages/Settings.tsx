import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useTheme } from '../providers/ThemeProvider';
import { useAuthStore } from '../stores/authStore';
import { useMeasurementSystem } from "../contexts/MeasurementSystemContext";
import {
  useMyHousehold,
  useUpdateHousehold,
  useCreateHouseholdInvite,
  useMyPendingInvites,
  useRespondToInvite,
} from '../services/api';
import {
  Moon,
  Sun,
  Monitor,
  Link as LinkIcon,
  Unlink,
  Loader2,
  Ruler,
  Save,
  X,
  Home,
  UserPlus,
  Crown,
  Shield,
  User,
  Mail,
  Check,
  XCircle,
  Pencil,
} from "lucide-react";
import toast from 'react-hot-toast';

const roleIcons: Record<string, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

const Settings = () => {
  const { theme, setTheme, colorScheme, availableColorSchemes, setColorScheme } = useTheme();
  const { user, linkedAccounts, linkGoogleAccount, unlinkGoogleAccount, loadLinkedAccounts } = useAuthStore();
  const {
    system,
    setSystem,
    isLoading: isLoadingMeasurement,
  } = useMeasurementSystem();

  // Staged changes (not yet saved)
  const [stagedTheme, setStagedTheme] = useState<typeof theme>(theme);
  const [stagedColorScheme, setStagedColorScheme] = useState<string>(colorScheme.name);
  const [stagedMeasurementSystem, setStagedMeasurementSystem] = useState<typeof system>(system);

  // Household state
  const [inviteEmail, setInviteEmail] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Household queries
  const { data: householdData, isLoading: householdLoading } = useMyHousehold();
  const updateHousehold = useUpdateHousehold();
  const createInvite = useCreateHouseholdInvite();
  const { data: pendingInvites } = useMyPendingInvites();
  const respondToInvite = useRespondToInvite();

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

  const handleSendInvite = () => {
    if (!inviteEmail.trim() || !householdData?.household?.id) return;
    createInvite.mutate(
      { householdId: householdData.household.id, email: inviteEmail.trim() },
      {
        onSuccess: () => {
          toast.success(`Invite sent to ${inviteEmail.trim()}`);
          setInviteEmail('');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to send invite');
        },
      }
    );
  };

  const handleSaveHouseholdName = () => {
    if (!editedName.trim() || !householdData?.household?.id) return;
    updateHousehold.mutate(
      { householdId: householdData.household.id, name: editedName.trim() },
      {
        onSuccess: () => {
          toast.success('Household name updated');
          setIsEditingName(false);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update name');
        },
      }
    );
  };

  const handleRespondInvite = (inviteId: string, accept: boolean) => {
    respondToInvite.mutate(
      { inviteId, accept },
      {
        onSuccess: () => {
          toast.success(accept ? 'Joined household!' : 'Invite declined');
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to respond to invite');
        },
      }
    );
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  const myRole = householdData?.myRole;
  const canInvite = myRole === 'owner' || myRole === 'admin';

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Customize your app appearance and preferences.
            </p>
          </div>
          {hasUnsavedChanges && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Reset
              </Button>
              <Button onClick={handleSave} size="sm" className="gap-2">
                <Save className="h-4 w-4" />
                Save Changes
              </Button>
            </div>
          )}
        </div>

        {/* ── Pending Invites Banner ── */}
        {pendingInvites && pendingInvites.length > 0 && (
          <div className="space-y-3">
            {pendingInvites.map((invite: any) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-xl border border-primary/30 bg-primary/5 dark:bg-primary/10"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      You've been invited to join <span className="text-primary">{invite.households?.name || 'a household'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Respond to this invite to join the household
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespondInvite(invite.id, false)}
                    disabled={respondToInvite.isPending}
                    className="gap-1.5"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleRespondInvite(invite.id, true)}
                    disabled={respondToInvite.isPending}
                    className="gap-1.5"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Household Settings ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Household
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {householdLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !householdData ? (
              <p className="text-sm text-muted-foreground">
                No household found. One should have been created when you signed up.
              </p>
            ) : (
              <>
                {/* Household Name */}
                <div className="space-y-2">
                  <Label>Household Name</Label>
                  {isEditingName ? (
                    <div className="flex gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        placeholder="Enter household name"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveHouseholdName();
                          if (e.key === 'Escape') setIsEditingName(false);
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        onClick={handleSaveHouseholdName}
                        disabled={updateHousehold.isPending || !editedName.trim()}
                      >
                        {updateHousehold.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingName(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {householdData.household?.name || 'My Household'}
                      </p>
                      {myRole === 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditedName(householdData.household?.name || '');
                            setIsEditingName(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your role: <span className="font-medium capitalize">{myRole || 'member'}</span>
                  </p>
                </div>

                {/* Members List */}
                <div className="space-y-3">
                  <Label>Members</Label>
                  <div className="space-y-2">
                    {(householdData.members || []).map((member: any) => {
                      const RoleIcon = roleIcons[member.role] || User;
                      const isCurrentUser = member.userId === user?.id;
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors duration-150 ${
                            isCurrentUser ? 'border-primary/30 bg-primary/5 dark:bg-primary/10' : 'border-border/60 hover:bg-accent/30'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                              isCurrentUser
                                ? 'bg-primary/20 text-primary'
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {member.profiles?.displayName?.charAt(0)?.toUpperCase() ||
                               member.profiles?.email?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {member.profiles?.displayName || member.profiles?.email || 'Unknown'}
                                {isCurrentUser && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                              </p>
                              {member.profiles?.displayName && member.profiles?.email && (
                                <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="secondary"
                            className="gap-1 text-xs"
                          >
                            <RoleIcon className="h-3 w-3" />
                            {roleLabels[member.role] || member.role}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Invite Member */}
                {canInvite && (
                  <div className="space-y-2">
                    <Label>Invite Member</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter email address"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendInvite();
                        }}
                      />
                      <Button
                        onClick={handleSendInvite}
                        disabled={createInvite.isPending || !inviteEmail.trim()}
                        className="gap-1.5 shrink-0"
                      >
                        {createInvite.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        Invite
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Send an invite to add someone to your household. They'll be able to see your household-shared recipes.
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Theme Mode */}
            <div className="space-y-2">
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={stagedTheme}
                onValueChange={(value) => setStagedTheme(value as typeof theme)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose your preferred theme. System will automatically match
                your device settings.
              </p>
            </div>

            {/* Color Scheme */}
            <div className="space-y-2">
              <Label htmlFor="colorScheme">Color Scheme</Label>
              <Select
                value={stagedColorScheme}
                onValueChange={setStagedColorScheme}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select color scheme" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(availableColorSchemes).map((schemeName) => (
                    <SelectItem key={schemeName} value={schemeName}>
                      {schemeName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color palette for the app.
              </p>
            </div>

            {/* Color Preview */}
            <div className="space-y-2">
              <Label>
                Preview{" "}
                {hasUnsavedChanges &&
                  stagedColorScheme !== colorScheme.name && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      (Unsaved)
                    </span>
                  )}
              </Label>
              <div className="flex gap-2">
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: previewColorScheme.primary[500] }}
                  title="Primary"
                />
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: previewColorScheme.secondary[500] }}
                  title="Secondary"
                />
                <div
                  className="w-8 h-8 rounded-full border"
                  style={{ backgroundColor: previewColorScheme.neutral[500] }}
                  title="Neutral"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Email</Label>
              <p className="text-sm text-muted-foreground">
                {user?.email || "Not available"}
              </p>
            </div>

            <div className="space-y-4">
              <Label>Connected Accounts</Label>
              <div className="space-y-3">
                {/* Email/Password Account */}
                {hasEmailPassword && (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-semibold">@</span>
                      </div>
                      <div>
                        <p className="font-medium">Email & Password</p>
                        <p className="text-sm text-muted-foreground">
                          Always available
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Google Account */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-primary-600 dark:text-primary-400"
                        viewBox="0 0 24 24"
                      >
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Google</p>
                      <p className="text-sm text-muted-foreground">
                        {hasGoogleLinked ? "Connected" : "Not connected"}
                      </p>
                    </div>
                  </div>
                  {hasGoogleLinked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleUnlinkGoogle}
                      disabled={!hasEmailPassword}
                      title={
                        !hasEmailPassword
                          ? "Cannot unlink: Email/password account required"
                          : ""
                      }
                    >
                      <Unlink className="w-4 h-4 mr-2" />
                      Unlink
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLinkGoogle}
                    >
                      <LinkIcon className="w-4 h-4 mr-2" />
                      Link
                    </Button>
                  )}
                </div>
              </div>
              {!hasEmailPassword && hasGoogleLinked && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  You must have an email/password account to unlink Google.
                  Please set a password first.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Measurement System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Measurement System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="measurement-system">Unit System</Label>
              <Select
                value={stagedMeasurementSystem}
                onValueChange={(value: "metric" | "imperial") =>
                  setStagedMeasurementSystem(value)
                }
                disabled={isLoadingMeasurement}
              >
                <SelectTrigger id="measurement-system">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">
                    Metric (g, kg, ml, l, °C)
                  </SelectItem>
                  <SelectItem value="imperial">
                    Imperial (oz, lb, fl oz, cup, °F)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground mt-2">
                Recipe measurements will be automatically converted to your
                preferred system.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;

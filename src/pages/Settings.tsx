import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { useTheme } from '../providers/ThemeProvider';
import { useAuthStore } from '../stores/authStore';
import { useMeasurementSystem } from "../contexts/MeasurementSystemContext";
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
} from "lucide-react";
import toast from 'react-hot-toast';

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
    // Apply staged theme
    if (stagedTheme !== theme) {
      setTheme(stagedTheme);
    }

    // Apply staged color scheme
    if (stagedColorScheme !== colorScheme.name) {
      setColorScheme(stagedColorScheme);
    }

    // Apply staged measurement system
    if (stagedMeasurementSystem !== system) {
      setSystem(stagedMeasurementSystem);
    }

    toast.success('Settings saved successfully');
  };

  const handleReset = () => {
    setStagedTheme(theme);
    setStagedColorScheme(colorScheme.name);
    setStagedMeasurementSystem(system);
    toast.info('Changes reset');
  };

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

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
                  ⚠️ You must have an email/password account to unlink Google.
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

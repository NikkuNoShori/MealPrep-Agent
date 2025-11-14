import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { useTheme } from '../providers/ThemeProvider';
import { useAuthStore } from '../stores/authStore';
import { authService } from '../services/authService';
import { apiClient } from '../services/api';
import { ToastService } from '../services/toast';
import { Logger } from '../services/logger';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Moon, Sun, Monitor, User, Mail, Lock, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const Settings = () => {
  const { theme, setTheme, colorScheme, availableColorSchemes, setColorScheme } = useTheme();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('account');
  
  // Fetch profile from database
  const { data: profileData, isLoading: isLoadingProfile, error: profileError } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await apiClient.getProfile();
      return response.profile;
    },
    enabled: !!user, // Only fetch if user is authenticated
    retry: 1,
  });
  
  // Account settings state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Update form fields when profile data loads
  useEffect(() => {
    if (profileData) {
      setFirstName(profileData.firstName || '');
      setLastName(profileData.lastName || '');
      setEmail(profileData.email || '');
      // Email verification status comes from Supabase Auth user, not database
      setIsEmailVerified(user?.emailVerified || user?.primaryEmailVerified || false);
    }
  }, [profileData, user]);

  const themeOptions = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName?: string }) => {
      return await apiClient.updateProfile(data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      ToastService.success('Name updated successfully');
      Logger.info('✅ Settings: Profile updated successfully', data);
    },
    onError: (error: any) => {
      Logger.error('🔴 Settings: Failed to update profile', error);
      ToastService.error(error?.message || 'Failed to update name');
    },
  });

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!firstName.trim()) {
      ToastService.error('First name cannot be empty');
      return;
    }

    if (firstName === profileData?.firstName && 
        lastName === profileData?.lastName) {
      ToastService.info('Name unchanged');
      return;
    }

    setIsUpdatingName(true);
    try {
      await updateProfileMutation.mutateAsync({ firstName, lastName });
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    try {
      await authService.resendVerificationEmail();
      ToastService.success('Verification email sent! Please check your inbox.');
    } catch (error: any) {
      Logger.error('🔴 Settings: Failed to resend verification email', error);
      ToastService.error(error?.message || 'Failed to resend verification email');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      ToastService.error('Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      ToastService.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      ToastService.error('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      ToastService.success('Password changed successfully');
    } catch (error: any) {
      Logger.error('🔴 Settings: Failed to change password', error);
      ToastService.error(error?.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Preferences
            </TabsTrigger>
          </TabsList>

          {/* Account Settings Tab */}
          <TabsContent value="account" className="space-y-6 mt-6">
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your name and email address. This information is stored in the database.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoadingProfile ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground">Loading profile...</span>
                  </div>
                ) : profileError ? (
                  <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                    <p className="font-medium">Failed to load profile</p>
                    <p className="mt-1">{(profileError as any)?.message || 'Unable to load profile information. Please try refreshing the page.'}</p>
                  </div>
                ) : (
                  <>
                {/* Name */}
                <form onSubmit={handleUpdateName} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter your first name"
                      disabled={isUpdatingName || isLoadingProfile}
                      required
                    />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter your last name"
                      disabled={isUpdatingName || isLoadingProfile}
                    />
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This is how your name will appear in the app.
                  </p>
                  <Button 
                    type="submit" 
                    disabled={isUpdatingName || isLoadingProfile || !firstName.trim() || 
                      (firstName === profileData?.firstName && 
                       lastName === profileData?.lastName)}
                  >
                    {isUpdatingName ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      'Update Name'
                    )}
                  </Button>
                </form>

                {/* Email Address */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="flex-1"
                      placeholder={isLoadingProfile ? "Loading..." : "Email address"}
                    />
                    {isEmailVerified ? (
                      <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Unverified</span>
                      </div>
                    )}
                  </div>
                  {!isEmailVerified && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Your email address is not verified. Please check your inbox for a verification email.
                      </p>
                      <Button
                        variant="outline"
                        onClick={handleResendVerification}
                        disabled={isResendingVerification}
                        className="w-full sm:w-auto"
                      >
                        {isResendingVerification ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            Resend Verification Email
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Password Change */}
            <Card>
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
                <CardDescription>
                  Update your password to keep your account secure.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      disabled={isChangingPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      disabled={isChangingPassword}
                    />
                    <p className="text-sm text-muted-foreground">
                      Password must be at least 8 characters long.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      disabled={isChangingPassword}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Changing...
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 mr-2" />
                        Change Password
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Appearance Settings Tab */}
          <TabsContent value="appearance" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize your app appearance and theme preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Theme Mode */}
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select value={theme} onValueChange={setTheme}>
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
                    Choose your preferred theme. System will automatically match your device settings.
                  </p>
                </div>

                {/* Color Scheme */}
                <div className="space-y-2">
                  <Label htmlFor="colorScheme">Color Scheme</Label>
                  <Select value={colorScheme.name} onValueChange={setColorScheme}>
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
                  <Label>Preview</Label>
                  <div className="flex gap-2">
                    <div 
                      className="w-8 h-8 rounded-full border"
                      style={{ backgroundColor: colorScheme.primary[500] }}
                      title="Primary"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border"
                      style={{ backgroundColor: colorScheme.secondary[500] }}
                      title="Secondary"
                    />
                    <div 
                      className="w-8 h-8 rounded-full border"
                      style={{ backgroundColor: colorScheme.neutral[500] }}
                      title="Neutral"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>
                  Additional settings and preferences.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  More preferences will be available here in the future.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Settings;

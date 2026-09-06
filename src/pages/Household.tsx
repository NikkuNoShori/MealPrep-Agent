import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useAuthStore } from '../stores/authStore';
import {
  useMyHousehold,
  useUpdateHousehold,
  useUpdateHouseholdPermissions,
  useCreateHouseholdInvite,
  useMyPendingInvites,
  useRespondToInvite,
  useCreateFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
  useUpdateMemberRole,
  useRemoveHouseholdMember,
  useTransferOwnership,
  useMyDietaryProfile,
  useSetMyDietaryProfile,
} from '../services/api';
import {
  Loader2,
  Home,
  UserPlus,
  Crown,
  Shield,
  User,
  Mail,
  Check,
  XCircle,
  X,
  Pencil,
  Plus,
  Trash2,
  Users,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Clock,
  ChevronDown,
  ChevronRight,
  LogOut,
  ArrowRightLeft,
  Lock,
} from 'lucide-react';
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

const RELATIONSHIPS = [
  'Spouse/Partner',
  'Child',
  'Parent',
  'Sibling',
  'Grandparent',
  'Other',
];

const DIETARY_RESTRICTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
  'Keto', 'Paleo', 'Low-Carb', 'Low-Sodium', 'Halal', 'Kosher',
];

const COMMON_ALLERGIES = [
  'Peanuts', 'Tree Nuts', 'Milk', 'Eggs',
  'Soy', 'Wheat', 'Fish', 'Shellfish', 'Sesame',
];

const Household = () => {
  const { user } = useAuthStore();

  // Household state
  const [inviteEmail, setInviteEmail] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  // Dependent form state
  const [isAddingDependent, setIsAddingDependent] = useState(false);
  const [editingDependentId, setEditingDependentId] = useState<string | null>(null);
  const [depForm, setDepForm] = useState({
    name: '',
    relationship: '',
    age: '',
    dietaryRestrictions: [] as string[],
    allergies: [] as string[],
    likedFoods: '',
    dislikedFoods: '',
  });

  // Queries & mutations
  const { data: householdData, isLoading: householdLoading } = useMyHousehold();
  const updateHousehold = useUpdateHousehold();
  const createInvite = useCreateHouseholdInvite();
  const { data: pendingInvites } = useMyPendingInvites();
  const respondToInvite = useRespondToInvite();
  const createFamilyMember = useCreateFamilyMember();
  const updateFamilyMember = useUpdateFamilyMember();
  const deleteFamilyMember = useDeleteFamilyMember();
  const updateMemberRole = useUpdateMemberRole();
  const removeMember = useRemoveHouseholdMember();
  const transferOwnership = useTransferOwnership();

  // My dietary profile (MOP-0025 / ADR-0005)
  const { data: myDietaryProfile } = useMyDietaryProfile();
  const setMyDietaryProfile = useSetMyDietaryProfile();
  const updateHouseholdPermissions = useUpdateHouseholdPermissions();

  // Dietary profile UI state
  // profileForm: null = picker closed; 'self' = editing own; string = editing dependent id; 'new' = adding new free-text
  const [profileForm, setProfileForm] = useState<null | 'self' | 'new' | string>(null);
  const [profilePickerValue, setProfilePickerValue] = useState('');
  const [profileFormData, setProfileFormData] = useState({
    name: '',
    relationship: '',
    dietaryRestrictions: [] as string[],
    allergies: [] as string[],
    likedFoods: '',
    dislikedFoods: '',
  });
  // Which accordion sections are open per profile entry (key = 'self' | dep.id)
  const [openSections, setOpenSections] = useState<Record<string, Record<string, boolean>>>({});
  const [profileSaving, setProfileSaving] = useState(false);

  const toggleSection = (profileKey: string, section: string) =>
    setOpenSections(prev => ({
      ...prev,
      [profileKey]: { ...(prev[profileKey] ?? {}), [section]: !(prev[profileKey]?.[section]) },
    }));

  const openProfileForm = (target: 'self' | 'new' | string) => {
    setProfileForm(target);
    if (target === 'self') {
      setProfileFormData({
        name: user?.email ?? '',
        relationship: '',
        dietaryRestrictions: myDietaryProfile?.dietaryRestrictions ?? [],
        allergies: myDietaryProfile?.allergies ?? [],
        likedFoods: '',
        dislikedFoods: '',
      });
    } else if (target === 'new') {
      setProfileFormData({ name: '', relationship: '', dietaryRestrictions: [], allergies: [], likedFoods: '', dislikedFoods: '' });
    } else {
      // editing existing dependent
      const dep = (householdData?.dependents ?? []).find((d: any) => d.id === target);
      if (dep) {
        setProfileFormData({
          name: dep.name,
          relationship: dep.relationship ?? '',
          dietaryRestrictions: dep.dietaryRestrictions ?? [],
          allergies: dep.allergies ?? [],
          likedFoods: (dep.preferences?.likedFoods ?? []).join(', '),
          dislikedFoods: (dep.preferences?.dislikedFoods ?? []).join(', '),
        });
      }
    }
    setProfilePickerValue('');
  };

  const closeProfileForm = () => { setProfileForm(null); setProfilePickerValue(''); };

  const handleSaveProfile = async () => {
    if (!profileForm) return;
    setProfileSaving(true);
    try {
      if (profileForm === 'self') {
        await setMyDietaryProfile.mutateAsync({
          dietaryRestrictions: profileFormData.dietaryRestrictions,
          allergies: profileFormData.allergies,
        });
      } else if (profileForm === 'new') {
        if (!householdData?.household?.id) throw new Error('No household');
        const prefs: any = {};
        if (profileFormData.likedFoods.trim()) prefs.likedFoods = profileFormData.likedFoods.split(',').map(s => s.trim()).filter(Boolean);
        if (profileFormData.dislikedFoods.trim()) prefs.dislikedFoods = profileFormData.dislikedFoods.split(',').map(s => s.trim()).filter(Boolean);
        await createFamilyMember.mutateAsync({
          householdId: householdData.household.id,
          name: profileFormData.name.trim(),
          relationship: profileFormData.relationship || 'Other',
          dietaryRestrictions: profileFormData.dietaryRestrictions,
          allergies: profileFormData.allergies,
          preferences: prefs,
        });
      } else {
        // updating existing dependent
        const prefs: any = {};
        if (profileFormData.likedFoods.trim()) prefs.likedFoods = profileFormData.likedFoods.split(',').map(s => s.trim()).filter(Boolean);
        if (profileFormData.dislikedFoods.trim()) prefs.dislikedFoods = profileFormData.dislikedFoods.split(',').map(s => s.trim()).filter(Boolean);
        await updateFamilyMember.mutateAsync({
          memberId: profileForm,
          updates: {
            name: profileFormData.name.trim(),
            relationship: profileFormData.relationship || undefined,
            dietaryRestrictions: profileFormData.dietaryRestrictions,
            allergies: profileFormData.allergies,
            preferences: prefs,
          },
        });
      }
      toast.success('Dietary profile saved');
      closeProfileForm();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Member management state
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'remove' | 'transfer'; memberId: string; memberName: string } | null>(null);

  const myRole = householdData?.myRole;
  const canInvite = myRole === 'owner' || myRole === 'admin';
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  // ADR-0005: RBAC — what can this member do to dietary profiles?
  const allowMemberEdits = householdData?.household?.allowMemberEdits ?? false;
  const allowMemberChildEdits = householdData?.household?.allowMemberChildEdits ?? false;
  const canEditOtherMemberProfiles = isOwnerOrAdmin || allowMemberEdits;
  const canEditChildProfiles = isOwnerOrAdmin || allowMemberChildEdits;

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

  const handleChangeRole = (memberId: string, newRole: 'admin' | 'member', memberName: string) => {
    updateMemberRole.mutate(
      { memberId, role: newRole },
      {
        onSuccess: () => {
          toast.success(`${memberName} is now ${newRole === 'admin' ? 'an admin' : 'a member'}`);
          setMemberMenuOpen(null);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update role');
        },
      }
    );
  };

  const handleRemoveMember = (memberId: string) => {
    removeMember.mutate(memberId, {
      onSuccess: () => {
        toast.success(`${confirmAction?.memberName || 'Member'} removed from household`);
        setConfirmAction(null);
        setMemberMenuOpen(null);
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to remove member');
        setConfirmAction(null);
      },
    });
  };

  const handleTransferOwnership = (memberId: string) => {
    if (!householdData?.household?.id) return;
    transferOwnership.mutate(
      { memberId, householdId: householdData.household.id },
      {
        onSuccess: () => {
          toast.success(`Ownership transferred to ${confirmAction?.memberName || 'member'}`);
          setConfirmAction(null);
          setMemberMenuOpen(null);
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to transfer ownership');
          setConfirmAction(null);
        },
      }
    );
  };

  const resetDepForm = () => {
    setDepForm({ name: '', relationship: '', age: '', dietaryRestrictions: [], allergies: [], likedFoods: '', dislikedFoods: '' });
    setIsAddingDependent(false);
    setEditingDependentId(null);
  };

  const handleAddDependent = () => {
    if (!depForm.name.trim() || !depForm.relationship || !householdData?.household?.id) return;
    const prefs: Record<string, any> = {};
    if (depForm.likedFoods.trim()) prefs.likedFoods = depForm.likedFoods.split(',').map((s) => s.trim()).filter(Boolean);
    if (depForm.dislikedFoods.trim()) prefs.dislikedFoods = depForm.dislikedFoods.split(',').map((s) => s.trim()).filter(Boolean);
    createFamilyMember.mutate(
      {
        householdId: householdData.household.id,
        name: depForm.name.trim(),
        relationship: depForm.relationship,
        age: depForm.age ? parseInt(depForm.age) : undefined,
        dietaryRestrictions: depForm.dietaryRestrictions,
        allergies: depForm.allergies,
        preferences: prefs,
      },
      {
        onSuccess: () => {
          toast.success('Family member added');
          resetDepForm();
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to add family member');
        },
      }
    );
  };

  const handleUpdateDependent = () => {
    if (!editingDependentId || !depForm.name.trim() || !depForm.relationship) return;
    const updatePrefs: Record<string, any> = {};
    if (depForm.likedFoods.trim()) updatePrefs.likedFoods = depForm.likedFoods.split(',').map((s) => s.trim()).filter(Boolean);
    else updatePrefs.likedFoods = [];
    if (depForm.dislikedFoods.trim()) updatePrefs.dislikedFoods = depForm.dislikedFoods.split(',').map((s) => s.trim()).filter(Boolean);
    else updatePrefs.dislikedFoods = [];
    updateFamilyMember.mutate(
      {
        memberId: editingDependentId,
        updates: {
          name: depForm.name.trim(),
          relationship: depForm.relationship,
          age: depForm.age ? parseInt(depForm.age) : null,
          dietaryRestrictions: depForm.dietaryRestrictions,
          allergies: depForm.allergies,
          preferences: updatePrefs,
        },
      },
      {
        onSuccess: () => {
          toast.success('Family member updated');
          resetDepForm();
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Failed to update family member');
        },
      }
    );
  };

  const handleDeleteDependent = (memberId: string, name: string) => {
    if (!confirm(`Remove ${name} from your household?`)) return;
    deleteFamilyMember.mutate(memberId, {
      onSuccess: () => toast.success(`${name} removed`),
      onError: (err: any) => toast.error(err?.message || 'Failed to remove'),
    });
  };

  const startEditingDependent = (dep: any) => {
    setEditingDependentId(dep.id);
    setIsAddingDependent(true);
    setDepForm({
      name: dep.name,
      relationship: dep.relationship || '',
      age: dep.age?.toString() || '',
      dietaryRestrictions: dep.dietaryRestrictions || [],
      allergies: dep.allergies || [],
      likedFoods: (dep.preferences?.likedFoods || []).join(', '),
      dislikedFoods: (dep.preferences?.dislikedFoods || []).join(', '),
    });
  };

  const toggleRestriction = (r: string) => {
    setDepForm((prev) => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.includes(r)
        ? prev.dietaryRestrictions.filter((x) => x !== r)
        : [...prev.dietaryRestrictions, r],
    }));
  };

  const toggleAllergy = (a: string) => {
    setDepForm((prev) => ({
      ...prev,
      allergies: prev.allergies.includes(a)
        ? prev.allergies.filter((x) => x !== a)
        : [...prev.allergies, a],
    }));
  };

  if (householdLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-8 bg-primary-500 rounded-full" />
            <h1 className="text-3xl font-bold">Household</h1>
          </div>
          <p className="text-muted-foreground">
            Manage your household members, invites, and family profiles.
          </p>
        </div>

        {/* Pending Invites Banner */}
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
                      You've been invited to join{' '}
                      <span className="text-primary">{invite.households?.name || 'a household'}</span>
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

        {!householdData ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Home className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No household found. One should have been created when you signed up.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Top Row: Household Info + Members */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Household Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Household Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Name */}
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
                          {updateHousehold.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditingName(false)}>
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

                  {/* Invite */}
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
                        Send an invite to add someone to your household.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Members */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Members
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(householdData.members || []).map((member: any) => {
                      const RoleIcon = roleIcons[member.role] || User;
                      const isCurrentUser = member.userId === user?.id;
                      const memberName = member.profiles?.displayName || member.profiles?.email || 'Unknown';
                      const canManage = isOwner && !isCurrentUser && member.role !== 'owner';
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors duration-150 ${
                            isCurrentUser
                              ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                              : 'border-border/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                                isCurrentUser
                                  ? 'bg-primary/20 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {member.profiles?.displayName?.charAt(0)?.toUpperCase() ||
                                member.profiles?.email?.charAt(0)?.toUpperCase() ||
                                '?'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {memberName}
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground ml-1.5">(you)</span>
                                )}
                              </p>
                              {member.profiles?.displayName && member.profiles?.email && (
                                <p className="text-xs text-muted-foreground">
                                  {member.profiles.email}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1 text-xs">
                              <RoleIcon className="h-3 w-3" />
                              {roleLabels[member.role] || member.role}
                            </Badge>
                            {canManage && (
                              <div className="relative">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setMemberMenuOpen(memberMenuOpen === member.id ? null : member.id)}
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                {memberMenuOpen === member.id && (
                                  <div className="absolute right-0 top-8 z-50 min-w-[180px] rounded-lg border border-stone-200/50 dark:border-white/[0.08] bg-white/95 dark:bg-[#1e1f26]/95 backdrop-blur-xl p-1 shadow-lg shadow-black/10 dark:shadow-black/30">
                                    {member.role === 'member' ? (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                        onClick={() => handleChangeRole(member.id, 'admin', memberName)}
                                      >
                                        <Shield className="h-3.5 w-3.5" />
                                        Promote to Admin
                                      </button>
                                    ) : (
                                      <button
                                        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                        onClick={() => handleChangeRole(member.id, 'member', memberName)}
                                      >
                                        <User className="h-3.5 w-3.5" />
                                        Demote to Member
                                      </button>
                                    )}
                                    <button
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white transition-colors"
                                      onClick={() => {
                                        setConfirmAction({ type: 'transfer', memberId: member.id, memberName });
                                        setMemberMenuOpen(null);
                                      }}
                                    >
                                      <ArrowRightLeft className="h-3.5 w-3.5" />
                                      Transfer Ownership
                                    </button>
                                    <div className="my-1 border-t border-stone-100/60 dark:border-white/[0.06]" />
                                    <button
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-stone-400 dark:text-stone-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors"
                                      onClick={() => {
                                        setConfirmAction({ type: 'remove', memberId: member.id, memberName });
                                        setMemberMenuOpen(null);
                                      }}
                                    >
                                      <LogOut className="h-3.5 w-3.5" />
                                      Remove from Household
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {/* Pending invites */}
                    {(householdData.pendingInvites || []).map((invite: any) => (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-dashed border-amber-300/50 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {invite.invitedEmail}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              Invited {new Date(invite.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="gap-1 text-xs border-amber-300 dark:border-amber-500/30 text-amber-600 dark:text-amber-400">
                          <Clock className="h-3 w-3" />
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Confirmation Dialog */}
            {confirmAction && (
              <Card className="border-destructive/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-destructive/10 p-2">
                      {confirmAction.type === 'remove' ? (
                        <LogOut className="h-4 w-4 text-destructive" />
                      ) : (
                        <ArrowRightLeft className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {confirmAction.type === 'remove'
                          ? `Remove ${confirmAction.memberName}?`
                          : `Transfer ownership to ${confirmAction.memberName}?`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {confirmAction.type === 'remove'
                          ? 'They will lose access to household recipes and data. This can be undone by re-inviting them.'
                          : 'You will become an admin. Only the new owner can transfer ownership back.'}
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            confirmAction.type === 'remove'
                              ? handleRemoveMember(confirmAction.memberId)
                              : handleTransferOwnership(confirmAction.memberId)
                          }
                          disabled={removeMember.isPending || transferOwnership.isPending}
                        >
                          {(removeMember.isPending || transferOwnership.isPending) && (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          )}
                          {confirmAction.type === 'remove' ? 'Remove' : 'Transfer'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmAction(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dietary Profiles — ADR-0005 unified UX */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Dietary Profiles
                  </CardTitle>
                  {profileForm === null && (
                    <Button size="sm" className="gap-1.5" onClick={() => setProfileForm('picker')}>
                      <Plus className="h-4 w-4" />
                      Add Dietary Profile
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Restrictions, allergies, and preferences for each person in your household. Only add profiles that are relevant.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* ── Picker: choose who to add a profile for ── */}
                {profileForm === 'picker' && (() => {
                  const memberOptions = [
                    { value: 'self', label: `${user?.email ?? 'Me'} (you)` },
                    ...((householdData?.members ?? [])
                      .filter((m: any) => m.userId !== user?.id)
                      .map((m: any) => ({ value: `member:${m.userId}`, label: m.email ?? m.userId }))),
                    { value: 'new', label: '+ Add new person (not in household)' },
                  ];
                  return (
                    <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-accent/20">
                      <p className="text-sm font-medium">Who is this profile for?</p>
                      <Select value={profilePickerValue} onValueChange={setProfilePickerValue}>
                        <SelectTrigger><SelectValue placeholder="Select a person..." /></SelectTrigger>
                        <SelectContent>
                          {memberOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" disabled={!profilePickerValue} onClick={() => {
                          if (profilePickerValue === 'self') openProfileForm('self');
                          else openProfileForm('new');
                        }}>Continue</Button>
                        <Button size="sm" variant="outline" onClick={closeProfileForm}>Cancel</Button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Inline form: editing self or adding/editing a dep ── */}
                {profileForm && profileForm !== 'picker' && profileForm !== null && (() => {
                  const isSelf = profileForm === 'self';
                  const formKey = profileForm;
                  const sections = [
                    { key: 'restrictions', label: 'Dietary Restrictions' },
                    { key: 'allergies', label: 'Allergies' },
                    { key: 'preferences', label: 'Preferences' },
                  ];
                  return (
                    <div className="rounded-xl border border-border/60 p-4 space-y-3 bg-accent/20">
                      {!isSelf ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Name *</Label>
                            <Input value={profileFormData.name} onChange={e => setProfileFormData(p => ({ ...p, name: e.target.value }))} placeholder="Name" autoFocus />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Relationship</Label>
                            <Select value={profileFormData.relationship} onValueChange={v => setProfileFormData(p => ({ ...p, relationship: v }))}>
                              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                              <SelectContent>{RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm font-medium flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-primary-500" />
                          {user?.email}
                          <Badge variant="secondary" className="text-[10px]">You</Badge>
                        </p>
                      )}

                      {sections.map(sec => {
                        const isOpen = openSections[formKey]?.[sec.key];
                        return (
                          <div key={sec.key} className="border border-border/40 rounded-lg overflow-hidden">
                            <button
                              type="button"
                              className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-accent/40 transition-colors"
                              onClick={() => toggleSection(formKey, sec.key)}
                            >
                              <span>{sec.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  {sec.key === 'restrictions' && (profileFormData.dietaryRestrictions.length > 0 ? profileFormData.dietaryRestrictions.join(', ') : 'None set')}
                                  {sec.key === 'allergies' && (profileFormData.allergies.length > 0 ? profileFormData.allergies.join(', ') : 'None set')}
                                  {sec.key === 'preferences' && ([profileFormData.likedFoods, profileFormData.dislikedFoods].filter(Boolean).join(' · ') || 'None set')}
                                </span>
                                {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                              </span>
                            </button>
                            {isOpen && (
                              <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border/40">
                                {sec.key === 'restrictions' && (
                                  <>
                                    <div className="flex justify-end gap-1">
                                      <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded" onClick={() => setProfileFormData(p => ({ ...p, dietaryRestrictions: [...DIETARY_RESTRICTIONS] }))}>Select All</button>
                                      <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded" onClick={() => setProfileFormData(p => ({ ...p, dietaryRestrictions: [] }))}>Clear</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {DIETARY_RESTRICTIONS.map(r => { const sel = profileFormData.dietaryRestrictions.includes(r); return <Badge key={r} variant={sel ? 'default' : 'outline'} className={`cursor-pointer transition-all duration-150 ${sel ? 'shadow-sm' : 'opacity-70 hover:opacity-100 hover:border-primary/40'}`} onClick={() => setProfileFormData(p => ({ ...p, dietaryRestrictions: sel ? p.dietaryRestrictions.filter(x => x !== r) : [...p.dietaryRestrictions, r] }))}>{sel && <Check className="h-2.5 w-2.5 mr-0.5" />}{r}</Badge>; })}
                                    </div>
                                  </>
                                )}
                                {sec.key === 'allergies' && (
                                  <>
                                    <div className="flex justify-end gap-1">
                                      <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded" onClick={() => setProfileFormData(p => ({ ...p, allergies: [...COMMON_ALLERGIES] }))}>Select All</button>
                                      <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded" onClick={() => setProfileFormData(p => ({ ...p, allergies: [] }))}>Clear</button>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {COMMON_ALLERGIES.map(a => { const sel = profileFormData.allergies.includes(a); return <Badge key={a} variant={sel ? 'destructive' : 'outline'} className={`cursor-pointer transition-all duration-150 ${sel ? 'shadow-sm' : 'opacity-70 hover:opacity-100 hover:border-destructive/40'}`} onClick={() => setProfileFormData(p => ({ ...p, allergies: sel ? p.allergies.filter(x => x !== a) : [...p.allergies, a] }))}>{sel && <Check className="h-2.5 w-2.5 mr-0.5" />}{a}</Badge>; })}
                                    </div>
                                  </>
                                )}
                                {sec.key === 'preferences' && (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                      <Label className="flex items-center gap-1.5 text-xs"><ThumbsUp className="h-3 w-3 text-green-500" />Liked Foods</Label>
                                      <Input value={profileFormData.likedFoods} onChange={e => setProfileFormData(p => ({ ...p, likedFoods: e.target.value }))} placeholder="pasta, chicken… (comma-separated)" />
                                    </div>
                                    <div className="space-y-1.5">
                                      <Label className="flex items-center gap-1.5 text-xs"><ThumbsDown className="h-3 w-3 text-red-500" />Disliked Foods</Label>
                                      <Input value={profileFormData.dislikedFoods} onChange={e => setProfileFormData(p => ({ ...p, dislikedFoods: e.target.value }))} placeholder="mushrooms, olives… (comma-separated)" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="flex gap-2 pt-1">
                        <Button size="sm" className="gap-1.5" onClick={handleSaveProfile} disabled={profileSaving || (!isSelf && !profileFormData.name.trim())}>
                          {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={closeProfileForm}>Cancel</Button>
                      </div>
                    </div>
                  );
                })()}

                {/* ── Existing profiles list ── */}
                <div className="space-y-px">
                  {/* Self — only shown if they've set something */}
                  {((myDietaryProfile?.dietaryRestrictions?.length ?? 0) > 0 || (myDietaryProfile?.allergies?.length ?? 0) > 0) && profileForm !== 'self' && (
                    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{user?.email}</p>
                          <Badge variant="secondary" className="text-xs">You</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(myDietaryProfile?.dietaryRestrictions ?? []).map(r => <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">{r}</Badge>)}
                          {(myDietaryProfile?.allergies ?? []).map(a => <Badge key={a} variant="destructive" className="text-[10px] px-1.5 py-0">{a}</Badge>)}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0 ml-2" onClick={() => openProfileForm('self')}>
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  )}

                  {/* Dependents */}
                  {(householdData?.dependents ?? []).filter((d: any) => profileForm !== d.id).map((dep: any) => (
                    <div key={dep.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-accent/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{dep.name}</p>
                          {dep.relationship && <Badge variant="outline" className="text-xs">{dep.relationship}</Badge>}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(dep.dietaryRestrictions ?? []).map((r: string) => <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">{r}</Badge>)}
                          {(dep.allergies ?? []).map((a: string) => <Badge key={a} variant="destructive" className="text-[10px] px-1.5 py-0">{a}</Badge>)}
                          {!(dep.dietaryRestrictions?.length) && !(dep.allergies?.length) && <span className="text-[10px] text-muted-foreground">No restrictions set</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        {canEditChildProfiles ? (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openProfileForm(dep.id)}>
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        ) : (
                          <span title="Only owner/admin can edit" className="self-center mr-1"><Lock className="h-3.5 w-3.5 text-muted-foreground/40" /></span>
                        )}
                        {isOwnerOrAdmin && (
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteDependent(dep.id, dep.name)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Empty state */}
                  {profileForm === null &&
                    (myDietaryProfile?.dietaryRestrictions?.length ?? 0) === 0 &&
                    (myDietaryProfile?.allergies?.length ?? 0) === 0 &&
                    (householdData?.dependents ?? []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No dietary profiles yet. Add one for anyone in your household who has restrictions or allergies.
                    </p>
                  )}
                </div>

                {/* ── Owner: member permissions ── */}
                {isOwner && householdData?.household?.id && (
                  <div className="mt-2 pt-4 border-t border-border/40 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Member Permissions</p>
                    {([
                      { key: 'allowMemberEdits', label: "Members can edit each other's dietary profiles", current: allowMemberEdits },
                      { key: 'allowMemberChildEdits', label: 'Members can create and edit child/dependent profiles', current: allowMemberChildEdits },
                    ] as const).map(flag => (
                      <div key={flag.key} className="flex items-center justify-between gap-3 py-1">
                        <span className="text-sm text-muted-foreground">{flag.label}</span>
                        <button
                          type="button"
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${flag.current ? 'bg-primary-500' : 'bg-muted'}`}
                          onClick={() => {
                            const update = flag.key === 'allowMemberEdits'
                              ? { allowMemberEdits: !flag.current }
                              : { allowMemberChildEdits: !flag.current };
                            updateHouseholdPermissions.mutate(
                              { householdId: householdData.household.id, ...update },
                              { onSuccess: () => toast.success('Permission updated'), onError: () => toast.error('Failed to update permission') }
                            );
                          }}
                          disabled={updateHouseholdPermissions.isPending}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${flag.current ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Household;

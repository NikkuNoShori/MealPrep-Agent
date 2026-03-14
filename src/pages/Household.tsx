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
  useCreateHouseholdInvite,
  useMyPendingInvites,
  useRespondToInvite,
  useCreateFamilyMember,
  useUpdateFamilyMember,
  useDeleteFamilyMember,
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

  const myRole = householdData?.myRole;
  const canInvite = myRole === 'owner' || myRole === 'admin';

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

  const resetDepForm = () => {
    setDepForm({ name: '', relationship: '', age: '', dietaryRestrictions: [], allergies: [] });
    setIsAddingDependent(false);
    setEditingDependentId(null);
  };

  const handleAddDependent = () => {
    if (!depForm.name.trim() || !depForm.relationship || !householdData?.household?.id) return;
    createFamilyMember.mutate(
      {
        householdId: householdData.household.id,
        name: depForm.name.trim(),
        relationship: depForm.relationship,
        age: depForm.age ? parseInt(depForm.age) : undefined,
        dietaryRestrictions: depForm.dietaryRestrictions,
        allergies: depForm.allergies,
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
    updateFamilyMember.mutate(
      {
        memberId: editingDependentId,
        updates: {
          name: depForm.name.trim(),
          relationship: depForm.relationship,
          age: depForm.age ? parseInt(depForm.age) : null,
          dietaryRestrictions: depForm.dietaryRestrictions,
          allergies: depForm.allergies,
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
            <div className="w-2 h-8 bg-gradient-to-b from-primary-600 to-secondary-600 rounded-full" />
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
                      return (
                        <div
                          key={member.id}
                          className={`flex items-center justify-between p-3 rounded-xl border transition-colors duration-150 ${
                            isCurrentUser
                              ? 'border-primary/30 bg-primary/5 dark:bg-primary/10'
                              : 'border-border/60 hover:bg-accent/30'
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
                                {member.profiles?.displayName ||
                                  member.profiles?.email ||
                                  'Unknown'}
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
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <RoleIcon className="h-3 w-3" />
                            {roleLabels[member.role] || member.role}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Family Members / Dependents */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Family Members
                  </CardTitle>
                  {!isAddingDependent && (
                    <Button
                      size="sm"
                      onClick={() => {
                        resetDepForm();
                        setIsAddingDependent(true);
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Add Member
                    </Button>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Non-account family members (children, dependents). Their dietary needs are
                  considered in meal planning.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add/Edit Form */}
                {isAddingDependent && (
                  <div className="rounded-xl border border-border/60 p-4 space-y-4 bg-accent/20">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="dep-name">Name *</Label>
                        <Input
                          id="dep-name"
                          value={depForm.name}
                          onChange={(e) => setDepForm((p) => ({ ...p, name: e.target.value }))}
                          placeholder="Name"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dep-relationship">Relationship *</Label>
                        <Select
                          value={depForm.relationship}
                          onValueChange={(v) => setDepForm((p) => ({ ...p, relationship: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIPS.map((r) => (
                              <SelectItem key={r} value={r}>
                                {r}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="dep-age">Age</Label>
                        <Input
                          id="dep-age"
                          type="number"
                          value={depForm.age}
                          onChange={(e) => setDepForm((p) => ({ ...p, age: e.target.value }))}
                          placeholder="Age"
                          min="0"
                          max="120"
                        />
                      </div>
                    </div>

                    {/* Dietary Restrictions */}
                    <div className="space-y-1.5">
                      <Label>Dietary Restrictions</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {DIETARY_RESTRICTIONS.map((r) => (
                          <Badge
                            key={r}
                            variant={depForm.dietaryRestrictions.includes(r) ? 'default' : 'outline'}
                            className="cursor-pointer transition-colors"
                            onClick={() => toggleRestriction(r)}
                          >
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Allergies */}
                    <div className="space-y-1.5">
                      <Label>Allergies</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {COMMON_ALLERGIES.map((a) => (
                          <Badge
                            key={a}
                            variant={depForm.allergies.includes(a) ? 'destructive' : 'outline'}
                            className="cursor-pointer transition-colors"
                            onClick={() => toggleAllergy(a)}
                          >
                            {a}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={editingDependentId ? handleUpdateDependent : handleAddDependent}
                        disabled={
                          !depForm.name.trim() ||
                          !depForm.relationship ||
                          createFamilyMember.isPending ||
                          updateFamilyMember.isPending
                        }
                        className="gap-1.5"
                      >
                        {(createFamilyMember.isPending || updateFamilyMember.isPending) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        {editingDependentId ? 'Update' : 'Add'}
                      </Button>
                      <Button variant="outline" onClick={resetDepForm}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Dependents List */}
                {(householdData.dependents || []).length === 0 && !isAddingDependent ? (
                  <div className="text-center py-8">
                    <Users className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-3">
                      No family members added yet. Add children or dependents to personalize meal
                      planning.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetDepForm();
                        setIsAddingDependent(true);
                      }}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Add First Member
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(householdData.dependents || []).map((dep: any) => (
                      <div
                        key={dep.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border/60 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">{dep.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {dep.relationship}
                            </Badge>
                            {dep.age && (
                              <Badge variant="secondary" className="text-xs">
                                {dep.age} yrs
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(dep.dietaryRestrictions || []).map((r: string) => (
                              <Badge key={r} variant="outline" className="text-[10px] px-1.5 py-0">
                                {r}
                              </Badge>
                            ))}
                            {(dep.allergies || []).map((a: string) => (
                              <Badge
                                key={a}
                                variant="destructive"
                                className="text-[10px] px-1.5 py-0"
                              >
                                {a}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => startEditingDependent(dep)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteDependent(dep.id, dep.name)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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

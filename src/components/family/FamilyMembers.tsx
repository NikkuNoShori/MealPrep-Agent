import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { X, Plus, User, Edit, Trash2 } from 'lucide-react';

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  age?: number;
  dietaryRestrictions: string[];
  allergies: string[];
  preferences: Record<string, any>;
}

interface FamilyMembersProps {
  members: FamilyMember[];
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void;
  onUpdateMember: (id: string, updates: Partial<FamilyMember>) => void;
  onDeleteMember: (id: string) => void;
}

const RELATIONSHIPS = [
  'Spouse/Partner',
  'Child',
  'Parent',
  'Sibling',
  'Grandparent',
  'Other'
];

const DIETARY_RESTRICTIONS = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Low-Sodium',
  'Halal',
  'Kosher'
];

const COMMON_ALLERGIES = [
  'Peanuts',
  'Tree Nuts',
  'Milk',
  'Eggs',
  'Soy',
  'Wheat',
  'Fish',
  'Shellfish',
  'Sesame'
];

export const FamilyMembers: React.FC<FamilyMembersProps> = ({
  members,
  onAddMember,
  onUpdateMember,
  onDeleteMember
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: '',
    age: '',
    dietaryRestrictions: [] as string[],
    allergies: [] as string[],
    customAllergy: '',
    customRestriction: ''
  });

  const handleAddMember = () => {
    if (!formData.name || !formData.relationship) return;

    onAddMember({
      name: formData.name,
      relationship: formData.relationship,
      age: formData.age ? parseInt(formData.age) : undefined,
      dietaryRestrictions: formData.dietaryRestrictions,
      allergies: formData.allergies,
      preferences: {}
    });

    setFormData({
      name: '',
      relationship: '',
      age: '',
      dietaryRestrictions: [],
      allergies: [],
      customAllergy: '',
      customRestriction: ''
    });
    setIsAdding(false);
  };

  const handleUpdateMember = () => {
    if (!editingId || !formData.name || !formData.relationship) return;

    onUpdateMember(editingId, {
      name: formData.name,
      relationship: formData.relationship,
      age: formData.age ? parseInt(formData.age) : undefined,
      dietaryRestrictions: formData.dietaryRestrictions,
      allergies: formData.allergies
    });

    setFormData({
      name: '',
      relationship: '',
      age: '',
      dietaryRestrictions: [],
      allergies: [],
      customAllergy: '',
      customRestriction: ''
    });
    setEditingId(null);
  };

  const startEditing = (member: FamilyMember) => {
    setEditingId(member.id);
    setFormData({
      name: member.name,
      relationship: member.relationship,
      age: member.age?.toString() || '',
      dietaryRestrictions: member.dietaryRestrictions,
      allergies: member.allergies,
      customAllergy: '',
      customRestriction: ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({
      name: '',
      relationship: '',
      age: '',
      dietaryRestrictions: [],
      allergies: [],
      customAllergy: '',
      customRestriction: ''
    });
  };

  const addCustomAllergy = () => {
    if (formData.customAllergy && !formData.allergies.includes(formData.customAllergy)) {
      setFormData(prev => ({
        ...prev,
        allergies: [...prev.allergies, formData.customAllergy],
        customAllergy: ''
      }));
    }
  };

  const addCustomRestriction = () => {
    if (formData.customRestriction && !formData.dietaryRestrictions.includes(formData.customRestriction)) {
      setFormData(prev => ({
        ...prev,
        dietaryRestrictions: [...prev.dietaryRestrictions, formData.customRestriction],
        customRestriction: ''
      }));
    }
  };

  const removeAllergy = (allergy: string) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies.filter(a => a !== allergy)
    }));
  };

  const removeRestriction = (restriction: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryRestrictions: prev.dietaryRestrictions.filter(r => r !== restriction)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Family Members
        </h2>
        <Button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {editingId ? 'Edit Family Member' : 'Add Family Member'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter name"
                />
              </div>
              <div>
                <Label htmlFor="relationship">Relationship *</Label>
                <Select
                  value={formData.relationship}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, relationship: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select relationship" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map(rel => (
                      <SelectItem key={rel} value={rel}>{rel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  placeholder="Enter age"
                  min="0"
                  max="120"
                />
              </div>
            </div>

            {/* Dietary Restrictions */}
            <div>
              <Label>Dietary Restrictions</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {DIETARY_RESTRICTIONS.map(restriction => (
                  <Badge
                    key={restriction}
                    variant={formData.dietaryRestrictions.includes(restriction) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (formData.dietaryRestrictions.includes(restriction)) {
                        removeRestriction(restriction);
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          dietaryRestrictions: [...prev.dietaryRestrictions, restriction]
                        }));
                      }
                    }}
                  >
                    {restriction}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={formData.customRestriction}
                  onChange={(e) => setFormData(prev => ({ ...prev, customRestriction: e.target.value }))}
                  placeholder="Add custom restriction"
                />
                <Button onClick={addCustomRestriction} size="sm">Add</Button>
              </div>
            </div>

            {/* Allergies */}
            <div>
              <Label>Allergies</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {COMMON_ALLERGIES.map(allergy => (
                  <Badge
                    key={allergy}
                    variant={formData.allergies.includes(allergy) ? "destructive" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (formData.allergies.includes(allergy)) {
                        removeAllergy(allergy);
                      } else {
                        setFormData(prev => ({
                          ...prev,
                          allergies: [...prev.allergies, allergy]
                        }));
                      }
                    }}
                  >
                    {allergy}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={formData.customAllergy}
                  onChange={(e) => setFormData(prev => ({ ...prev, customAllergy: e.target.value }))}
                  placeholder="Add custom allergy"
                />
                <Button onClick={addCustomAllergy} size="sm">Add</Button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={editingId ? handleUpdateMember : handleAddMember}
                disabled={!formData.name || !formData.relationship}
              >
                {editingId ? 'Update Member' : 'Add Member'}
              </Button>
              <Button
                variant="outline"
                onClick={editingId ? cancelEdit : () => setIsAdding(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Members List */}
      <div className="grid gap-4">
        {members.map(member => (
          <Card key={member.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-gray-500" />
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    <Badge variant="outline">{member.relationship}</Badge>
                    {member.age && <Badge variant="secondary">{member.age} years</Badge>}
                  </div>
                  
                  {member.dietaryRestrictions.length > 0 && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Dietary: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.dietaryRestrictions.map(restriction => (
                          <Badge key={restriction} variant="outline" className="text-xs">
                            {restriction}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {member.allergies.length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Allergies: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.allergies.map(allergy => (
                          <Badge key={allergy} variant="destructive" className="text-xs">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEditing(member)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDeleteMember(member.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && !isAdding && (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Family Members Added
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add family members to personalize meal planning and recipe recommendations.
            </p>
            <Button onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Member
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

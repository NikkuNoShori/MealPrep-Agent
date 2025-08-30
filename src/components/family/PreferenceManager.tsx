import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Heart, HeartOff, ThumbsUp, ThumbsDown, Minus, Plus, Search, X } from 'lucide-react';

interface FoodPreference {
  id: string;
  name: string;
  category: string;
  preference: 'love' | 'like' | 'neutral' | 'dislike' | 'hate';
  notes?: string;
}

interface PreferenceManagerProps {
  preferences: FoodPreference[];
  onUpdatePreference: (id: string, preference: FoodPreference['preference'], notes?: string) => void;
  onAddPreference: (name: string, category: string, preference: FoodPreference['preference'], notes?: string) => void;
  onRemovePreference: (id: string) => void;
}

const FOOD_CATEGORIES = [
  'Vegetables',
  'Fruits',
  'Proteins',
  'Grains',
  'Dairy',
  'Herbs & Spices',
  'Condiments',
  'Beverages',
  'Snacks',
  'Desserts'
];

const COMMON_INGREDIENTS = {
  'Vegetables': ['Broccoli', 'Carrots', 'Spinach', 'Bell Peppers', 'Onions', 'Garlic', 'Tomatoes', 'Cucumber', 'Lettuce', 'Mushrooms'],
  'Fruits': ['Apples', 'Bananas', 'Oranges', 'Berries', 'Grapes', 'Pineapple', 'Mango', 'Avocado', 'Lemons', 'Limes'],
  'Proteins': ['Chicken', 'Beef', 'Pork', 'Fish', 'Shrimp', 'Tofu', 'Eggs', 'Beans', 'Lentils', 'Turkey'],
  'Grains': ['Rice', 'Pasta', 'Bread', 'Quinoa', 'Oats', 'Barley', 'Corn', 'Wheat', 'Rye', 'Buckwheat'],
  'Dairy': ['Milk', 'Cheese', 'Yogurt', 'Butter', 'Cream', 'Sour Cream', 'Cottage Cheese', 'Ice Cream', 'Whipping Cream', 'Buttermilk'],
  'Herbs & Spices': ['Basil', 'Oregano', 'Thyme', 'Rosemary', 'Cinnamon', 'Cumin', 'Paprika', 'Ginger', 'Turmeric', 'Black Pepper'],
  'Condiments': ['Ketchup', 'Mustard', 'Mayonnaise', 'Hot Sauce', 'Soy Sauce', 'Vinegar', 'Olive Oil', 'Honey', 'Maple Syrup', 'Jam'],
  'Beverages': ['Coffee', 'Tea', 'Water', 'Juice', 'Soda', 'Milk', 'Smoothies', 'Hot Chocolate', 'Lemonade', 'Iced Tea'],
  'Snacks': ['Chips', 'Nuts', 'Popcorn', 'Crackers', 'Pretzels', 'Trail Mix', 'Granola Bars', 'Dried Fruits', 'Seeds', 'Jerky'],
  'Desserts': ['Chocolate', 'Vanilla', 'Strawberry', 'Caramel', 'Mint', 'Lemon', 'Coconut', 'Peanut Butter', 'Almond', 'Coffee']
};

const PREFERENCE_ICONS = {
  love: Heart,
  like: ThumbsUp,
  neutral: Minus,
  dislike: ThumbsDown,
  hate: HeartOff
};

const PREFERENCE_COLORS = {
  love: 'bg-red-100 text-red-800 border-red-200',
  like: 'bg-green-100 text-green-800 border-green-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
  dislike: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  hate: 'bg-red-100 text-red-800 border-red-200'
};

export const PreferenceManager: React.FC<PreferenceManagerProps> = ({
  preferences,
  onUpdatePreference,
  onAddPreference,
  onRemovePreference
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('Vegetables');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newPreference, setNewPreference] = useState({
    name: '',
    category: 'Vegetables',
    preference: 'neutral' as FoodPreference['preference'],
    notes: ''
  });

  const filteredPreferences = preferences.filter(pref => {
    const matchesCategory = selectedCategory === 'All' || pref.category === selectedCategory;
    const matchesSearch = pref.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddPreference = () => {
    if (!newPreference.name.trim()) return;

    onAddPreference(
      newPreference.name,
      newPreference.category,
      newPreference.preference,
      newPreference.notes || undefined
    );

    setNewPreference({
      name: '',
      category: 'Vegetables',
      preference: 'neutral',
      notes: ''
    });
    setIsAdding(false);
  };

  const getPreferenceCount = (preference: FoodPreference['preference']) => {
    return preferences.filter(p => p.preference === preference).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Food Preferences
        </h2>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Preference
        </Button>
      </div>

      {/* Preference Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {(['love', 'like', 'neutral', 'dislike', 'hate'] as const).map(pref => {
          const Icon = PREFERENCE_ICONS[pref];
          const count = getPreferenceCount(pref);
          return (
            <Card key={pref}>
              <CardContent className="p-4 text-center">
                <Icon className="h-6 w-6 mx-auto mb-2 text-gray-600" />
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-gray-600 capitalize">{pref}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add Preference Form */}
      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Add Food Preference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="food-name">Food Name</Label>
                <Input
                  id="food-name"
                  value={newPreference.name}
                  onChange={(e) => setNewPreference(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter food name"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={newPreference.category}
                  onValueChange={(value) => setNewPreference(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_CATEGORIES.map(category => (
                      <SelectItem key={category} value={category}>{category}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Preference Level</Label>
              <div className="flex gap-2 mt-2">
                {(['love', 'like', 'neutral', 'dislike', 'hate'] as const).map(pref => {
                  const Icon = PREFERENCE_ICONS[pref];
                  return (
                    <Button
                      key={pref}
                      variant={newPreference.preference === pref ? "default" : "outline"}
                      size="sm"
                      onClick={() => setNewPreference(prev => ({ ...prev, preference: pref }))}
                      className="flex items-center gap-2"
                    >
                      <Icon className="h-4 w-4" />
                      {pref}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input
                id="notes"
                value={newPreference.notes}
                onChange={(e) => setNewPreference(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional notes about this food"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddPreference} disabled={!newPreference.name.trim()}>
                Add Preference
              </Button>
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Label htmlFor="search">Search</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search preferences..."
              className="pl-10"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <Label htmlFor="category-filter">Category</Label>
          <Select
            value={selectedCategory}
            onValueChange={setSelectedCategory}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {FOOD_CATEGORIES.map(category => (
                <SelectItem key={category} value={category}>{category}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preferences List */}
      <div className="grid gap-4">
        {filteredPreferences.map(preference => (
          <Card key={preference.id}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-lg">{preference.name}</h3>
                    <Badge variant="outline">{preference.category}</Badge>
                    <Badge 
                      variant="outline" 
                      className={PREFERENCE_COLORS[preference.preference]}
                    >
                      {preference.preference}
                    </Badge>
                  </div>
                  {preference.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {preference.notes}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {(['love', 'like', 'neutral', 'dislike', 'hate'] as const).map(pref => {
                    const Icon = PREFERENCE_ICONS[pref];
                    return (
                      <Button
                        key={pref}
                        variant={preference.preference === pref ? "default" : "outline"}
                        size="sm"
                        onClick={() => onUpdatePreference(preference.id, pref, preference.notes)}
                        className="flex items-center gap-1"
                      >
                        <Icon className="h-3 w-3" />
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRemovePreference(preference.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPreferences.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Heart className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No Preferences Found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm || selectedCategory !== 'All' 
                ? 'Try adjusting your search or category filter.'
                : 'Start adding your food preferences to get personalized recipe recommendations.'
              }
            </p>
            {!searchTerm && selectedCategory === 'All' && (
              <Button onClick={() => setIsAdding(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Preference
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Add Suggestions */}
      {selectedCategory !== 'All' && COMMON_INGREDIENTS[selectedCategory as keyof typeof COMMON_INGREDIENTS] && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Add Common {selectedCategory}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {COMMON_INGREDIENTS[selectedCategory as keyof typeof COMMON_INGREDIENTS]
                .filter(item => !preferences.some(p => p.name.toLowerCase() === item.toLowerCase()))
                .map(item => (
                  <Button
                    key={item}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setNewPreference({
                        name: item,
                        category: selectedCategory,
                        preference: 'neutral',
                        notes: ''
                      });
                      setIsAdding(true);
                    }}
                  >
                    {item}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

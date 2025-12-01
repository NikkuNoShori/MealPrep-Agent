import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calendar, Plus, ChefHat, Clock, Users, Utensils } from 'lucide-react';

interface MealPlan {
  id: string;
  date: string;
  meals: {
    breakfast?: PlannedMeal;
    lunch?: PlannedMeal;
    dinner?: PlannedMeal;
    snacks?: PlannedMeal[];
  };
  notes?: string;
}

interface PlannedMeal {
  id: string;
  recipeId?: string;
  recipeName: string;
  servings: number;
  prepTime?: number;
  cookTime?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  notes?: string;
}

interface MealPlanCalendarProps {
  mealPlans: MealPlan[];
  onRemoveMeal: (date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks', mealId: string) => void;
  onGenerateMealPlan: (startDate: string, endDate: string) => void;
}

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const;

export const MealPlanCalendar: React.FC<MealPlanCalendarProps> = ({
  mealPlans,
  onRemoveMeal,
  onGenerateMealPlan,
}) => {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    return startOfWeek;
  });

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<
    "breakfast" | "lunch" | "dinner" | "snacks" | null
  >(null);

  const getWeekDates = () => {
    const dates = [];
    const startDate = new Date(currentWeek);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split("T")[0];
  };

  const getMealPlanForDate = (date: string) => {
    return mealPlans.find((plan) => plan.date === date);
  };

  const getMealCount = (date: string) => {
    const plan = getMealPlanForDate(date);
    if (!plan) return 0;

    let count = 0;
    if (plan.meals.breakfast) count++;
    if (plan.meals.lunch) count++;
    if (plan.meals.dinner) count++;
    if (plan.meals.snacks) count += plan.meals.snacks.length;

    return count;
  };

  const getTotalPrepTime = (date: string) => {
    const plan = getMealPlanForDate(date);
    if (!plan) return 0;

    let totalTime = 0;
    Object.values(plan.meals).forEach((meal) => {
      if (meal && "prepTime" in meal && meal.prepTime) {
        totalTime += meal.prepTime;
      }
      if (meal && "cookTime" in meal && meal.cookTime) {
        totalTime += meal.cookTime;
      }
    });

    return totalTime;
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newWeek = new Date(currentWeek);
    if (direction === "prev") {
      newWeek.setDate(newWeek.getDate() - 7);
    } else {
      newWeek.setDate(newWeek.getDate() + 7);
    }
    setCurrentWeek(newWeek);
  };

  const handleAddMeal = (
    date: string,
    mealType: "breakfast" | "lunch" | "dinner" | "snacks"
  ) => {
    setSelectedDate(date);
    setSelectedMealType(mealType);
    // TODO: Open meal selection modal
  };

  const generateWeekPlan = () => {
    const startDate = formatDate(currentWeek);
    const endDate = formatDate(
      new Date(currentWeek.getTime() + 6 * 24 * 60 * 60 * 1000)
    );
    onGenerateMealPlan(startDate, endDate);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Meal Planning Calendar
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigateWeek("prev")}>
            Previous Week
          </Button>
          <Button onClick={generateWeekPlan}>
            <ChefHat className="h-4 w-4 mr-2" />
            Generate Meal Plan
          </Button>
          <Button variant="outline" onClick={() => navigateWeek("next")}>
            Next Week
          </Button>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="flex justify-center items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateWeek("prev")}
        >
          ←
        </Button>
        <div className="text-lg font-semibold">
          {currentWeek.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}{" "}
          - Week of{" "}
          {currentWeek.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigateWeek("next")}
        >
          →
        </Button>
      </div>

      {/* Weekly Calendar */}
      <div className="grid grid-cols-7 gap-4">
        {/* Day Headers */}
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-700 dark:text-gray-300 py-2"
          >
            {day}
          </div>
        ))}

        {/* Day Cards */}
        {getWeekDates().map((date) => {
          const dateString = formatDate(date);
          const mealPlan = getMealPlanForDate(dateString);
          const mealCount = getMealCount(dateString);
          const totalTime = getTotalPrepTime(dateString);
          const isToday = formatDate(new Date()) === dateString;

          return (
            <Card
              key={dateString}
              className={`min-h-[200px] ${
                isToday ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex justify-between items-center">
                  <span>{date.getDate()}</span>
                  {isToday && (
                    <Badge variant="default" className="text-xs">
                      Today
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Meal Summary */}
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <div className="flex items-center gap-1">
                    <Utensils className="h-3 w-3" />
                    <span>{mealCount} meals</span>
                  </div>
                  {totalTime > 0 && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{totalTime} min</span>
                    </div>
                  )}
                </div>

                {/* Meal Types */}
                <div className="space-y-1">
                  {MEAL_TYPES.map((mealType) => {
                    const meal = mealPlan?.meals[mealType];
                    return (
                      <div
                        key={mealType}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium capitalize">
                          {mealType}
                        </span>
                        {meal ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {meal.recipeName}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0"
                              onClick={() =>
                                onRemoveMeal(dateString, mealType, meal.id)
                              }
                            >
                              ×
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                            onClick={() => handleAddMeal(dateString, mealType)}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Snacks */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Snacks</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 text-gray-400 hover:text-gray-600"
                      onClick={() => handleAddMeal(dateString, "snacks")}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {mealPlan?.meals.snacks?.map((snack) => (
                    <div key={snack.id} className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {snack.recipeName}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0"
                        onClick={() =>
                          onRemoveMeal(dateString, "snacks", snack.id)
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Notes */}
                {mealPlan?.notes && (
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 p-1 bg-gray-50 dark:bg-gray-800 rounded">
                    {mealPlan.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Weekly Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {getWeekDates().reduce(
                  (total, date) => total + getMealCount(formatDate(date)),
                  0
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Meals
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {getWeekDates().reduce(
                  (total, date) => total + getTotalPrepTime(formatDate(date)),
                  0
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Prep Time (min)
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {
                  getWeekDates().filter(
                    (date) => getMealCount(formatDate(date)) > 0
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Days Planned
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary-600">
                {
                  mealPlans.filter((plan) => {
                    const planDate = new Date(plan.date);
                    const weekStart = new Date(currentWeek);
                    const weekEnd = new Date(currentWeek);
                    weekEnd.setDate(weekEnd.getDate() + 6);
                    return planDate >= weekStart && planDate <= weekEnd;
                  }).length
                }
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Meal Plans
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TODO: Meal Selection Modal */}
      {selectedDate && selectedMealType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Meal for {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Select a recipe for {selectedMealType} on {selectedDate}
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setSelectedDate(null);
                    setSelectedMealType(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    // TODO: Open recipe selection
                    setSelectedDate(null);
                    setSelectedMealType(null);
                  }}
                >
                  Select Recipe
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

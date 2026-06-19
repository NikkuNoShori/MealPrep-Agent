import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { RecipeCard } from '../RecipeCard';
import { renderWithProviders } from '@/test/render';

vi.mock('@/components/meal-planning/AddToPlanButton', () => ({
  default: () => null,
}));

const baseRecipe = {
  id: 'r-1',
  title: 'Classic Carbonara',
  description: 'A Roman classic',
  prepTime: 10,
  cookTime: 20,
  servings: 4,
  difficulty: 'medium' as const,
  tags: ['pasta', 'italian'],
};

describe('RecipeCard', () => {
  it('renders title and timing in grid view', () => {
    renderWithProviders(
      <RecipeCard recipe={baseRecipe} viewMode="grid" />
    );

    expect(screen.getByText('Classic Carbonara')).toBeInTheDocument();
    expect(screen.getByText(/30/)).toBeInTheDocument();
  });

  it('invokes onReact when thumbs-up is clicked', () => {
    const onReact = vi.fn();
    renderWithProviders(
      <RecipeCard
        recipe={baseRecipe}
        viewMode="grid"
        onReact={onReact}
      />
    );

    fireEvent.click(screen.getByTitle('Thumbs up'));

    expect(onReact).toHaveBeenCalledWith('r-1', 'thumbs_up', undefined);
  });

  it('shows reaction counts when reactions are provided', () => {
    renderWithProviders(
      <RecipeCard
        recipe={baseRecipe}
        viewMode="list"
        reactions={[
          { id: 'rx-1', recipeId: 'r-1', reaction: 'thumbs_up', name: 'Sam' },
          { id: 'rx-2', recipeId: 'r-1', reaction: 'thumbs_up', name: 'Alex' },
        ]}
      />
    );

    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

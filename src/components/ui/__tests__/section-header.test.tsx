/**
 * SectionHeader (MOP-0029 Phase 6) — covers the one real logic branch worth
 * a regression guard: the trailing action renders conditionally, and picks
 * Link vs <a> vs <button> based on which of `to` / `href` / `onClick` was
 * given. Everything else about the component is presentational styling,
 * which is out of scope for unit tests per this repo's conventions.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import { SectionHeader } from '../section-header';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('SectionHeader', () => {
  it('renders the title and no action row when none is given', () => {
    renderWithRouter(<SectionHeader title="Today" />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a react-router Link when action.to is given', () => {
    renderWithRouter(<SectionHeader title="Grocery cart" action={{ label: 'Open cart', to: '/meal-planner' }} />);

    const link = screen.getByRole('link', { name: 'Open cart' });
    expect(link).toHaveAttribute('href', '/meal-planner');
  });

  it('renders a plain anchor when action.href is given', () => {
    renderWithRouter(<SectionHeader title="Recipes" action={{ label: 'Docs', href: 'https://example.com' }} />);

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', 'https://example.com');
  });

  it('renders a button and fires onClick when neither to nor href is given', () => {
    const onClick = vi.fn();
    renderWithRouter(<SectionHeader title="Filters" action={{ label: 'Clear', onClick }} />);

    const button = screen.getByRole('button', { name: 'Clear' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('merges a custom action className over the default hover accent', () => {
    renderWithRouter(
      <SectionHeader
        title="Grocery cart"
        action={{ label: 'Open cart', to: '/meal-planner', className: 'hover:text-teal-500' }}
      />
    );

    const link = screen.getByRole('link', { name: 'Open cart' });
    expect(link.className).toContain('hover:text-teal-500');
    expect(link.className).not.toContain('hover:text-primary-500');
  });

  it('renders trailing content alongside or instead of action', () => {
    renderWithRouter(<SectionHeader title="Stats" trailing={<span data-testid="badge">3</span>} />);

    expect(screen.getByTestId('badge')).toBeInTheDocument();
  });

  it('omits the dashed divider wrapper classes when divider=false', () => {
    const { container } = renderWithRouter(<SectionHeader title="Today" divider={false} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toContain('border-b');
  });
});

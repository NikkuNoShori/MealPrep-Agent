import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import Household from '@/pages/Household';
import { renderWithProviders } from '@/test/render';

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u-1', email: 'alice@example.com', display_name: 'Alice' },
  }),
}));

const mockHousehold = {
  household: { id: 'h-1', name: 'Smith Family' },
  myRole: 'owner',
  members: [
    {
      id: 'm-1',
      userId: 'u-1',
      role: 'owner',
      profiles: { displayName: 'Alice', email: 'alice@example.com' },
    },
  ],
  dependents: [],
  pendingInvites: [],
};

vi.mock('@/services/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api')>();
  return {
    ...actual,
    useMyHousehold: () => ({
      data: mockHousehold,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    }),
    useUpdateHousehold: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateHouseholdInvite: () => ({ mutate: vi.fn(), isPending: false }),
    useMyPendingInvites: () => ({ data: [], isLoading: false }),
    useRespondToInvite: () => ({ mutate: vi.fn(), isPending: false }),
    useCreateFamilyMember: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateFamilyMember: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteFamilyMember: () => ({ mutate: vi.fn(), isPending: false }),
    useUpdateMemberRole: () => ({ mutate: vi.fn(), isPending: false }),
    useRemoveHouseholdMember: () => ({ mutate: vi.fn(), isPending: false }),
    useTransferOwnership: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

describe('Household page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the household name and member list', () => {
    renderWithProviders(<Household />);

    expect(screen.getByText('Smith Family')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('shows the invite form for household owners', () => {
    renderWithProviders(<Household />);

    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });
});

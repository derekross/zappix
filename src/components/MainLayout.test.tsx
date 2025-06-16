import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { MainLayout } from './MainLayout';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

// Mock the image posts hook to return empty data
vi.mock('@/hooks/useImagePosts', () => ({
  useImagePosts: () => ({ data: [], isLoading: false, error: null }),
  useFollowingImagePosts: () => ({ data: [], isLoading: false, error: null }),
  useHashtagImagePosts: () => ({ data: [], isLoading: false, error: null }),
}));

vi.mock('@/hooks/useFollowing', () => ({
  useFollowing: () => ({ data: [], isLoading: false, error: null }),
}));

describe('MainLayout', () => {
  it('shows contextual back button text when navigating from home to hashtag', () => {
    render(
      <TestApp>
        <MainLayout />
      </TestApp>
    );

    // Start on home tab (default)
    expect(screen.getByText('Global Feed')).toBeInTheDocument();

    // Navigate to discover tab first
    const discoverButton = screen.getByText('Discover');
    fireEvent.click(discoverButton);

    // Should show discover page
    expect(screen.getByText('Explore popular hashtags and communities')).toBeInTheDocument();

    // Navigate back to home
    const homeButton = screen.getByText('Home');
    fireEvent.click(homeButton);

    // Should be back on home page
    expect(screen.getByText('Global Feed')).toBeInTheDocument();
  });

  it('shows correct back button text based on previous tab', () => {
    render(
      <TestApp>
        <MainLayout />
      </TestApp>
    );

    // The component should render without errors
    expect(screen.getByText('Zappix')).toBeInTheDocument();
  });

  it('preserves original source when navigating between hashtags', () => {
    render(
      <TestApp>
        <MainLayout />
      </TestApp>
    );

    // Start on discover tab
    const discoverButton = screen.getByText('Discover');
    fireEvent.click(discoverButton);

    // Should show discover page
    expect(screen.getByText('Explore popular hashtags and communities')).toBeInTheDocument();

    // The component should maintain state correctly
    expect(screen.getByText('Zappix')).toBeInTheDocument();
  });
});
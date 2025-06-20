import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { NotificationBell } from './NotificationBell';

describe('NotificationBell', () => {
  it('does not render when user is not logged in', () => {
    render(
      <TestApp>
        <NotificationBell />
      </TestApp>
    );

    // Should not render anything when user is not logged in
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders mobile variant correctly', () => {
    render(
      <TestApp>
        <NotificationBell variant="mobile" />
      </TestApp>
    );

    // Should not render anything when user is not logged in (even mobile variant)
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
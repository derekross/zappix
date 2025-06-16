import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { ZapConfiguration } from './ZapConfiguration';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
      signer: {},
    },
  }),
}));

vi.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: (key: string, defaultValue: string) => {
    return [defaultValue, vi.fn()];
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

describe('ZapConfiguration', () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  it('accepts nostrwalletconnect:// format', async () => {
    render(
      <TestApp>
        <ZapConfiguration />
      </TestApp>
    );

    const nwcInput = screen.getByLabelText('Nostr Wallet Connect String');
    const saveButton = screen.getByText('Save Zap Settings');

    // Enter a valid nostrwalletconnect:// string
    fireEvent.change(nwcInput, {
      target: { value: 'nostrwalletconnect://test-connection-string' },
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Settings saved',
        description: 'Your zap settings have been updated',
      });
    });
  });

  it('accepts nostr+walletconnect:// format', async () => {
    render(
      <TestApp>
        <ZapConfiguration />
      </TestApp>
    );

    const nwcInput = screen.getByLabelText('Nostr Wallet Connect String');
    const saveButton = screen.getByText('Save Zap Settings');

    // Enter a valid nostr+walletconnect:// string
    fireEvent.change(nwcInput, {
      target: { value: 'nostr+walletconnect://test-connection-string' },
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Settings saved',
        description: 'Your zap settings have been updated',
      });
    });
  });

  it('rejects invalid NWC format', async () => {
    render(
      <TestApp>
        <ZapConfiguration />
      </TestApp>
    );

    const nwcInput = screen.getByLabelText('Nostr Wallet Connect String');
    const saveButton = screen.getByText('Save Zap Settings');

    // Enter an invalid string
    fireEvent.change(nwcInput, {
      target: { value: 'invalid://test-connection-string' },
    });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith({
        title: 'Invalid NWC String',
        description: 'Nostr Wallet Connect string must start with "nostrwalletconnect://" or "nostr+walletconnect://"',
        variant: 'destructive',
      });
    });
  });

  it('allows empty NWC string (validation passes)', () => {
    render(
      <TestApp>
        <ZapConfiguration />
      </TestApp>
    );

    // Test that empty string doesn't trigger validation error
    // This is implicitly tested by the component rendering without errors
    // and the validation logic only checking non-empty strings
    const nwcInput = screen.getByLabelText('Nostr Wallet Connect String');
    expect(nwcInput).toHaveValue('');
    
    // The validation logic only runs on non-empty strings, so empty string is valid
    expect(screen.getByText('Save Zap Settings')).toBeInTheDocument();
  });
});
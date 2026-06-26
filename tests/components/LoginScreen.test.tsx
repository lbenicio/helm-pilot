import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LoginScreen from '@/components/LoginScreen';

// Mock motion/react to avoid animation issues
vi.mock('motion/react', () => ({
  motion: {
    div: 'div',
    button: 'button',
    h1: 'h1',
    p: 'p',
  },
}));

describe('LoginScreen', () => {
  let onLoginSuccess: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onLoginSuccess = vi.fn<() => void>();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- Loading state ---
  it('shows loading spinner initially while fetching auth URL', () => {
    // Don't resolve the fetch so it stays in loading
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    expect(screen.getByText('Checking auth status...')).toBeInTheDocument();
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // --- OIDC configured ---
  it('shows OIDC login button when authType is oidc', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://auth.example.com/login', type: 'oidc' }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText('Sign in with OIDC Identity')).toBeInTheDocument();
    });
  });

  it('does not show loading spinner after auth URL fetch completes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://auth.example.com/login', type: 'oidc' }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.queryByText('Checking auth status...')).toBeNull();
    });
  });

  // --- OIDC not configured ---
  it('shows error message when OIDC is not configured (type not oidc)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: '', type: null }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(
        screen.getByText(/OIDC identity provider is not configured/),
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Identity Provider Required')).toBeInTheDocument();
  });

  it('does not show OIDC button when authType is not oidc', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: '', type: 'demo' }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText(/OIDC identity provider is not configured/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Sign in with OIDC Identity')).toBeNull();
  });

  // --- Clicking OIDC button ---
  it('clicking OIDC button redirects to authUrl', async () => {
    const authUrl = 'https://auth.example.com/oauth/authorize';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: authUrl, type: 'oidc' }),
    } as Response);

    // jsdom: replace window.location with a mock to intercept href assignment
    const originalLocation = window.location;
    const mockLocation = { ...originalLocation, href: '' };
    delete (globalThis as any).window.location;
    (globalThis as any).window.location = mockLocation;

    const user = userEvent.setup();
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText('Sign in with OIDC Identity')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Sign in with OIDC Identity'));
    expect(mockLocation.href).toBe(authUrl);

    // Restore original location
    delete (globalThis as any).window.location;
    (globalThis as any).window.location = originalLocation;
  });

  // --- Fetch error handling ---
  it('handles fetch errors gracefully and stops loading', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.queryByText('Checking auth status...')).toBeNull();
    });
    // When fetch fails, authType stays null, so it shows the OIDC not configured message
    await waitFor(() => {
      expect(screen.getByText(/OIDC identity provider is not configured/)).toBeInTheDocument();
    });
  });

  // --- OAuth success via postMessage ---
  it('calls onLoginSuccess when OAUTH_AUTH_SUCCESS message is received from localhost', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://auth.example.com/login', type: 'oidc' }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText('Sign in with OIDC Identity')).toBeInTheDocument();
    });

    // Dispatch a MessageEvent with a trusted origin (contains localhost)
    const event = new MessageEvent('message', {
      data: { type: 'OAUTH_AUTH_SUCCESS' },
      origin: 'http://localhost:3000',
    });
    window.dispatchEvent(event);
    await waitFor(() => {
      expect(onLoginSuccess).toHaveBeenCalled();
    });
  });

  it('ignores postMessage from untrusted origins', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: 'https://auth.example.com/login', type: 'oidc' }),
    } as Response);
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText('Sign in with OIDC Identity')).toBeInTheDocument();
    });

    // Dispatch a MessageEvent from an untrusted origin
    const event = new MessageEvent('message', {
      data: { type: 'OAUTH_AUTH_SUCCESS' },
      origin: 'https://evil.com',
    });
    window.dispatchEvent(event);
    // onLoginSuccess should NOT have been called (origin check rejects it)
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('does not call handleLogin when authUrl is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ url: '', type: 'oidc' }),
    } as Response);

    // Replace location to intercept href assignment
    const originalHref = window.location.href;
    const user = userEvent.setup();
    render(<LoginScreen onLoginSuccess={onLoginSuccess} />);
    await waitFor(() => {
      expect(screen.getByText('Sign in with OIDC Identity')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Sign in with OIDC Identity'));
    // Since authUrl is empty, handleLogin returns early, href should not change
    expect(window.location.href).toBe(originalHref);
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('@/contexts/AppContext', () => ({
  AppProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-provider">{children}</div>
  ),
}));

vi.mock('@/components/AppShell', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

// Mocks for CSS import
vi.mock('@/styles/index.css', () => ({}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const RootLayoutModule = await import('@/app/layout');
const RootLayout = RootLayoutModule.default;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RootLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders html with lang=en', () => {
    render(
      <RootLayout>
        <span data-testid="child">Content</span>
      </RootLayout>,
    );

    const html = document.documentElement;
    expect(html.getAttribute('lang')).toBe('en');
  });

  it('renders body containing Providers-wrapped children', () => {
    render(
      <RootLayout>
        <span data-testid="child">Hello</span>
      </RootLayout>,
    );

    const child = screen.getByTestId('child');
    const appProvider = screen.getByTestId('app-provider');
    const appShell = screen.getByTestId('app-shell');

    expect(child).toBeInTheDocument();
    expect(child.textContent).toBe('Hello');
    expect(appProvider).toBeInTheDocument();
    expect(appShell).toBeInTheDocument();
  });

  it('renders meta theme-color tags', () => {
    render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>,
    );

    const lightMeta = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: light)"]');
    const darkMeta = document.querySelector('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]');

    expect(lightMeta).toBeInTheDocument();
    expect(lightMeta!.getAttribute('content')).toBe('#2563eb');
    expect(darkMeta).toBeInTheDocument();
    expect(darkMeta!.getAttribute('content')).toBe('#0f172a');
  });

  it('renders apple-mobile-web-app meta tags', () => {
    render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>,
    );

    const capableMeta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    const statusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');

    expect(capableMeta).toBeInTheDocument();
    expect(capableMeta!.getAttribute('content')).toBe('yes');
    expect(statusBarMeta).toBeInTheDocument();
    expect(statusBarMeta!.getAttribute('content')).toBe('black-translucent');
  });

  it('renders favicon link tags', () => {
    render(
      <RootLayout>
        <span>Content</span>
      </RootLayout>,
    );

    const link192 = document.querySelector('link[href="/static/favicon/android-chrome-192x192.png"]');
    const link512 = document.querySelector('link[href="/static/favicon/android-chrome-512x512.png"]');

    expect(link192).toBeInTheDocument();
    expect(link192!.getAttribute('sizes')).toBe('192x192');
    expect(link512).toBeInTheDocument();
    expect(link512!.getAttribute('sizes')).toBe('512x512');
  });

  describe('metadata', () => {
    it('has correct title', () => {
      expect(RootLayoutModule.metadata.title).toBe('Helm Pilot');
    });

    it('has correct description', () => {
      expect(RootLayoutModule.metadata.description).toBe('Helm Chart and Kubernetes Release Manager');
    });

    it('has favicon icons defined', () => {
      expect(RootLayoutModule.metadata.icons).toBeDefined();
      expect((RootLayoutModule.metadata.icons as any).icon).toHaveLength(2);
      expect((RootLayoutModule.metadata.icons as any).icon[0].sizes).toBe('32x32');
      expect((RootLayoutModule.metadata.icons as any).icon[1].sizes).toBe('16x16');
    });

    it('has manifest defined', () => {
      expect(RootLayoutModule.metadata.manifest).toBe('/static/favicon/site.webmanifest');
    });
  });
});

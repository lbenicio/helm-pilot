import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock next/server
// ---------------------------------------------------------------------------
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => ({
      body,
      status: init?.status ?? 200,
    })),
  },
}));

// ---------------------------------------------------------------------------
// Dynamic import after mocks are registered
// ---------------------------------------------------------------------------
const healthzModule = () => import('@/app/api/healthz/route');

describe('GET /api/healthz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns HTTP 200', async () => {
    const { GET } = await healthzModule();
    const response = (await GET()) as unknown as { status: number };

    expect(response.status).toBe(200);
  });

  it('returns status OK with a timestamp', async () => {
    const { GET } = await healthzModule();
    const response = (await GET()) as unknown as {
      body: { status: string; timestamp: string };
    };

    expect(response.body).toHaveProperty('status', 'OK');
    expect(response.body).toHaveProperty('timestamp');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('timestamp is a valid ISO 8601 string', async () => {
    const { GET } = await healthzModule();
    const response = (await GET()) as unknown as {
      body: { timestamp: string };
    };

    const parsed = new Date(response.body.timestamp);
    expect(parsed.toString()).not.toBe('Invalid Date');
    expect(response.body.timestamp).toBe(parsed.toISOString());
  });
});

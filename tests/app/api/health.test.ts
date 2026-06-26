import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookieSet = vi.fn();

const makeResponse = (body: unknown, status = 200) =>
  ({
    body,
    status,
    cookies: { set: mockCookieSet },
  }) as unknown as Response;

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => makeResponse(body, init?.status)),
  },
}));

const healthModule = () => import('@/app/api/health/route');
const liveModule = () => import('@/app/api/live/route');
const readyModule = () => import('@/app/api/ready/route');

describe('Health endpoints', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('GET /api/health', () => {
    it('returns status OK with uptime and timestamp', async () => {
      const { GET } = await healthModule();
      const response = (await GET()) as unknown as { body: Record<string, unknown>; status: number };

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.uptime).toBe('number');
      expect(typeof response.body.timestamp).toBe('string');
    });

    it('returns HTTP 200', async () => {
      const { GET } = await healthModule();
      const response = (await GET()) as unknown as { status: number };
      expect(response.status).toBe(200);
    });

    it('uptime is a positive number', async () => {
      const { GET } = await healthModule();
      const response = (await GET()) as unknown as { body: { uptime: number } };
      expect(response.body.uptime).toBeGreaterThan(0);
    });

    it('timestamp is a valid ISO date string', async () => {
      const { GET } = await healthModule();
      const response = (await GET()) as unknown as { body: { timestamp: string } };
      const parsed = new Date(response.body.timestamp);
      expect(parsed.toString()).not.toBe('Invalid Date');
      expect(response.body.timestamp).toBe(parsed.toISOString());
    });
  });

  describe('GET /api/live', () => {
    it('returns status OK', async () => {
      const { GET } = await liveModule();
      const response = (await GET()) as unknown as { body: unknown; status: number };
      expect(response.body).toEqual({ status: 'OK' });
    });

    it('returns HTTP 200', async () => {
      const { GET } = await liveModule();
      const response = (await GET()) as unknown as { status: number };
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/ready', () => {
    it('returns status OK', async () => {
      const { GET } = await readyModule();
      const response = (await GET()) as unknown as { body: unknown; status: number };
      expect(response.body).toEqual({ status: 'OK' });
    });

    it('returns HTTP 200', async () => {
      const { GET } = await readyModule();
      const response = (await GET()) as unknown as { status: number };
      expect(response.status).toBe(200);
    });
  });
});

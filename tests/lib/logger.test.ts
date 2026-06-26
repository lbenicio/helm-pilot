import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// The logger module reads LOG_LEVEL at import time, so we must reset modules
// and re-import on each test to pick up environment stubs.
// ---------------------------------------------------------------------------

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

describe('logger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Helper to import logger under a given LOG_LEVEL
  // -----------------------------------------------------------------------
  async function importLogger(logLevel: string) {
    vi.stubEnv('LOG_LEVEL', logLevel);
    const mod = await import('@/lib/logger');
    return mod.logger;
  }

  // -----------------------------------------------------------------------
  // Helper to expect a console method call with ANSI codes.
  // `bold` is only used by the error level; other levels skip it.
  // -----------------------------------------------------------------------
  function expectAnsiPrefix(actualCall: string, levelLabel: string, colorCode: string, bold = false) {
    // We expect: <dim><timestamp><reset> [<bold>]<color>[LABEL]<reset> ...args
    expect(actualCall).toContain(C.dim);
    expect(actualCall).toContain(C.reset);
    if (bold) expect(actualCall).toContain(C.bold);
    expect(actualCall).toContain(colorCode);
    expect(actualCall).toContain(`[${levelLabel}]`);
  }

  // -----------------------------------------------------------------------
  // error()
  // -----------------------------------------------------------------------
  describe('error', () => {
    it('outputs when LOG_LEVEL is error', async () => {
      const logger = await importLogger('error');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('something broke');
      expect(spy).toHaveBeenCalledTimes(1);
      expectAnsiPrefix(spy.mock.calls[0][0] as string, 'ERROR', C.red, true);
    });

    it('outputs when LOG_LEVEL is warn', async () => {
      const logger = await importLogger('warn');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('err');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('outputs when LOG_LEVEL is info', async () => {
      const logger = await importLogger('info');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('err');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('outputs when LOG_LEVEL is debug', async () => {
      const logger = await importLogger('debug');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('err');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('passes multiple arguments to console.error', async () => {
      const logger = await importLogger('error');
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.error('msg', { detail: true }, 42);
      expect(spy).toHaveBeenCalledTimes(1);
      const args = spy.mock.calls[0];
      expect(args.length).toBeGreaterThanOrEqual(2); // prefix + our args
      expect(args).toContainEqual({ detail: true });
      expect(args).toContain(42);
    });
  });

  // -----------------------------------------------------------------------
  // warn()
  // -----------------------------------------------------------------------
  describe('warn', () => {
    it('is hidden when LOG_LEVEL is error', async () => {
      const logger = await importLogger('error');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning');
      expect(spy).not.toHaveBeenCalled();
    });

    it('outputs when LOG_LEVEL is warn', async () => {
      const logger = await importLogger('warn');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('warning');
      expect(spy).toHaveBeenCalledTimes(1);
      expectAnsiPrefix(spy.mock.calls[0][0] as string, 'WARN', C.yellow, false);
    });

    it('outputs when LOG_LEVEL is info', async () => {
      const logger = await importLogger('info');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('w');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('outputs when LOG_LEVEL is debug', async () => {
      const logger = await importLogger('debug');
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.warn('w');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // info()
  // -----------------------------------------------------------------------
  describe('info', () => {
    it('is hidden when LOG_LEVEL is error', async () => {
      const logger = await importLogger('error');
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info msg');
      expect(spy).not.toHaveBeenCalled();
    });

    it('is hidden when LOG_LEVEL is warn', async () => {
      const logger = await importLogger('warn');
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info msg');
      expect(spy).not.toHaveBeenCalled();
    });

    it('outputs when LOG_LEVEL is info', async () => {
      const logger = await importLogger('info');
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info msg');
      expect(spy).toHaveBeenCalledTimes(1);
      expectAnsiPrefix(spy.mock.calls[0][0] as string, 'INFO', C.cyan, false);
    });

    it('outputs when LOG_LEVEL is debug', async () => {
      const logger = await importLogger('debug');
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('info msg');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // debug()
  // -----------------------------------------------------------------------
  describe('debug', () => {
    it('is hidden when LOG_LEVEL is error', async () => {
      const logger = await importLogger('error');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).not.toHaveBeenCalled();
    });

    it('is hidden when LOG_LEVEL is warn', async () => {
      const logger = await importLogger('warn');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).not.toHaveBeenCalled();
    });

    it('is hidden when LOG_LEVEL is info', async () => {
      const logger = await importLogger('info');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).not.toHaveBeenCalled();
    });

    it('outputs when LOG_LEVEL is debug', async () => {
      const logger = await importLogger('debug');
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.debug('debug msg');
      expect(spy).toHaveBeenCalledTimes(1);
      expectAnsiPrefix(spy.mock.calls[0][0] as string, 'DEBUG', C.dim, false);
    });
  });

  // -----------------------------------------------------------------------
  // Invalid LOG_LEVEL falls back to info
  // -----------------------------------------------------------------------
  describe('invalid LOG_LEVEL', () => {
    it('falls back to info level when LOG_LEVEL is an unknown string', async () => {
      const logger = await importLogger('verbose');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.error('e');
      logger.info('i');
      logger.debug('d');

      expect(errorSpy).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled(); // hidden at info
    });
  });

  // -----------------------------------------------------------------------
  // LOG_LEVEL default (no env set) = info
  // -----------------------------------------------------------------------
  describe('default LOG_LEVEL', () => {
    it('defaults to info when LOG_LEVEL is not set', async () => {
      // unstub all envs, then delete LOG_LEVEL so it's truly absent
      vi.unstubAllEnvs();
      delete (process.env as any).LOG_LEVEL;
      vi.resetModules();

      const { logger } = await import('@/lib/logger');
      const debugSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.debug('d');
      logger.info('i');

      expect(debugSpy).not.toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalled();
    });
  });
});

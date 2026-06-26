import { describe, expect, it } from 'vitest';

import { encodeHelmRelease, parseHelmSecret } from '@/lib/helm';

describe('helm', () => {
  // -----------------------------------------------------------------------
  // encodeHelmRelease + parseHelmSecret roundtrip
  // -----------------------------------------------------------------------
  describe('encodeHelmRelease', () => {
    it('encodes a release object into a base64-gzipped string', async () => {
      const release = { name: 'my-release', chart: 'nginx', version: 1 };
      const encoded = await encodeHelmRelease(release);
      expect(encoded).toBeTypeOf('string');
      // Should be valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('encodes an empty object', async () => {
      const encoded = await encodeHelmRelease({});
      expect(encoded).toBeTypeOf('string');
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('encodes complex nested objects with arrays', async () => {
      const release = {
        name: 'complex',
        config: { replicas: 3, env: [{ name: 'PORT', value: '8080' }] },
        manifest: 'apiVersion: v1\nkind: Service\n',
        info: { status: 'deployed', notes: 'release notes' },
      };
      const encoded = await encodeHelmRelease(release);
      expect(encoded).toBeTypeOf('string');
      const decoded = await parseHelmSecret(encoded);
      expect(decoded).toEqual(release);
    });
  });

  // -----------------------------------------------------------------------
  // parseHelmSecret
  // -----------------------------------------------------------------------
  describe('parseHelmSecret', () => {
    it('decodes a base64-gzipped JSON string (standard single-encode)', async () => {
      const release = { name: 'my-release', chart: 'nginx', version: 1 };
      const encoded = await encodeHelmRelease(release);
      const parsed = await parseHelmSecret(encoded);
      expect(parsed).toEqual(release);
    });

    it('roundtrips complex nested objects with unicode characters', async () => {
      const release = {
        name: 'unicode-release',
        config: {
          description: '日本語テスト 🎉',
          notes: 'Café résumé naïve',
          emoji: '🚀✨',
          nested: { 中文: '한국어', 日本語: 'テスト' },
        },
      };
      const encoded = await encodeHelmRelease(release);
      const parsed = await parseHelmSecret(encoded);
      expect(parsed).toEqual(release);
    });

    it('roundtrip preserves all data types (strings, numbers, booleans, null, arrays)', async () => {
      const release = {
        str: 'hello',
        num: 42,
        bool: true,
        nil: null,
        arr: [1, 'two', false],
        obj: { nested: 'value' },
      };
      const encoded = await encodeHelmRelease(release);
      const parsed = await parseHelmSecret(encoded);
      expect(parsed).toEqual(release);
    });

    it('handles the double-encoded base64 fallback', async () => {
      // Double-encoding: base64( base64( gzip(json) ) )
      const release = { name: 'double-encoded' };
      // First: normal encode
      const singleEncoded = await encodeHelmRelease(release);
      // Second: re-encode the already-base64 string as if it were raw bytes
      const doubleEncoded = Buffer.from(singleEncoded, 'utf-8').toString('base64');
      const parsed = await parseHelmSecret(doubleEncoded);
      expect(parsed).toEqual(release);
    });

    it('rejects invalid base64 input', async () => {
      await expect(parseHelmSecret('!!!not-base64!!!')).rejects.toThrow();
    });

    it('rejects valid base64 that is not gzip data', async () => {
      // "hello" in base64 is "aGVsbG8="
      await expect(parseHelmSecret('aGVsbG8=')).rejects.toThrow();
    });

    it('rejects valid base64+gzip that is not valid JSON', async () => {
      // Create gzip data from non-JSON text, then base64 it
      const { gzipSync } = await import('zlib');
      const badData = gzipSync(Buffer.from('not-json')).toString('base64');
      await expect(parseHelmSecret(badData)).rejects.toThrow();
    });

    it('rejects on circular references', async () => {
      const obj: any = { name: 'circular' };
      obj.self = obj;
      await expect(encodeHelmRelease(obj)).rejects.toThrow();
    });

    it('handles large release objects', async () => {
      const release = {
        name: 'large-release',
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, label: `item-${i}` })),
      };
      const encoded = await encodeHelmRelease(release);
      const parsed = await parseHelmSecret(encoded);
      expect(parsed).toEqual(release);
    });
  });
});

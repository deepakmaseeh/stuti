import { describe, expect, it } from 'vitest';
import { safeJsonLd } from '../../src/lib/jsonld';

describe('safeJsonLd', () => {
  const nasty = { name: '</script><script>alert(1)</script> & <!-- \u2028\u2029' };

  it('never emits characters that can close or open a tag', () => {
    const out = safeJsonLd(nasty);
    expect(out).not.toMatch(/[<>&\u2028\u2029]/);
  });

  it('round-trips to the same data', () => {
    expect(JSON.parse(safeJsonLd(nasty))).toEqual(nasty);
  });
});

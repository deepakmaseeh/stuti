import { describe, expect, it } from 'vitest';
import { shouldShowChorusMarker } from '../../src/lib/chorus';
import type { Section } from '../../src/lib/schema';

const verse = (n: string): Section => ({ type: 'verse', label: 'V', lines: [{ n }] });
const chorus = (n: string): Section => ({ type: 'chorus', label: 'C', lines: [{ n }] });

describe('shouldShowChorusMarker', () => {
  it('hides marker when the next section is the chorus', () => {
    const sections = [verse('a'), chorus('c'), verse('b')];
    expect(shouldShowChorusMarker(sections, 0, true)).toBe(false);
    expect(shouldShowChorusMarker(sections, 2, true)).toBe(true);
  });

  it('is off when flag is false', () => {
    expect(shouldShowChorusMarker([verse('a'), chorus('c')], 0, false)).toBe(false);
  });
});

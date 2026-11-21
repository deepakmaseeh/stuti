import { describe, expect, it } from 'vitest';
import { splitRepeatMarker } from '../../src/lib/lyric-line';

describe('splitRepeatMarker', () => {
  it('leaves plain lines alone', () => {
    expect(splitRepeatMarker('Hello world')).toEqual({ text: 'Hello world' });
  });

  it('extracts trailing (2) as times', () => {
    expect(splitRepeatMarker('गाओ (2)')).toEqual({ text: 'गाओ', times: 2 });
  });

  it('ignores mid-line markers', () => {
    expect(splitRepeatMarker('आओ (2) प्रभु')).toEqual({ text: 'आओ (2) प्रभु' });
  });
});

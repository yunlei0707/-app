import { describe, expect, it } from 'vitest';
import { normalizeMediaItem, normalizeMomentMedia, assertNoDisplayUrlInPath } from '../../src/utils/mediaSchema.js';

describe('media schema normalization', () => {
  it('normalizes legacy photo/video/audio fields into media arrays', () => {
    const result = normalizeMomentMedia({
      photos: ['BabyTime/photos/a.jpg'],
      videos: [{ path: 'BabyTime/videos/a.mp4', mimeType: 'video/mp4', size: 12 }],
      audios: [{ filename: 'BabyTime/audio/a.m4a', duration: 3 }],
    });

    expect(result.media).toHaveLength(3);
    expect(result.photos[0]).toMatchObject({ type: 'photo', path: 'BabyTime/photos/a.jpg' });
    expect(result.videos[0]).toMatchObject({ type: 'video', path: 'BabyTime/videos/a.mp4' });
    expect(result.audios[0]).toMatchObject({ type: 'audio', path: 'BabyTime/audio/a.m4a' });
  });

  it('keeps stable ids for the same persisted path', () => {
    const first = normalizeMediaItem('BabyTime/photos/a.jpg', 'photo');
    const second = normalizeMediaItem('BabyTime/photos/a.jpg', 'photo');

    expect(first.id).toBe(second.id);
    expect(first).toMatchObject({
      type: 'photo',
      path: 'BabyTime/photos/a.jpg',
    });
  });

  it('rejects temporary display URLs as persisted media paths', () => {
    expect(() => assertNoDisplayUrlInPath({ path: 'blob:http://localhost/temp' })).toThrow();
    expect(() => assertNoDisplayUrlInPath({ path: 'https://example.com/a.jpg' })).toThrow();
    expect(() => assertNoDisplayUrlInPath({ path: 'BabyTime/photos/a.jpg' })).not.toThrow();
  });
});

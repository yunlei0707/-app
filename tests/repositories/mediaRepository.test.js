import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/adapters/storageAdapter.js', () => ({
  saveVideoBlobDedup: vi.fn(),
  saveVideoBlob: vi.fn(),
  deleteMediaPath: vi.fn(async () => true),
  getVideoBlob: vi.fn(),
  readVideoFromNative: vi.fn(),
  saveVideoToNative: vi.fn(),
  deleteVideoFromNative: vi.fn(),
  calculateFileHash: vi.fn(),
  calculateFastHash: vi.fn(),
  generateUniqueFilename: vi.fn(name => `unique-${name}`),
}));

const storageAdapter = await import('../../src/adapters/storageAdapter.js');
const { deleteUnreferencedMomentMedia } = await import('../../src/repositories/mediaRepository.js');

describe('deleteUnreferencedMomentMedia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageAdapter.deleteMediaPath.mockResolvedValue(true);
  });

  it('deletes media files that are no longer referenced by remaining moments', async () => {
    await deleteUnreferencedMomentMedia(
      {
        media: [
          { id: 'photo1', type: 'photo', path: 'BabyTime/photos/a.jpg', thumbnailPath: 'BabyTime/thumbs/a.webp' },
          { id: 'audio1', type: 'audio', path: 'BabyTime/audio/a.m4a' },
        ],
      },
      []
    );

    expect(storageAdapter.deleteMediaPath).toHaveBeenCalledWith('BabyTime/photos/a.jpg');
    expect(storageAdapter.deleteMediaPath).toHaveBeenCalledWith('BabyTime/thumbs/a.webp');
    expect(storageAdapter.deleteMediaPath).toHaveBeenCalledWith('BabyTime/audio/a.m4a');
  });

  it('keeps files that are still referenced by another moment', async () => {
    await deleteUnreferencedMomentMedia(
      { media: [{ id: 'photo1', type: 'photo', path: 'BabyTime/photos/shared.jpg' }] },
      [{ media: [{ id: 'photo2', type: 'photo', path: 'BabyTime/photos/shared.jpg' }] }]
    );

    expect(storageAdapter.deleteMediaPath).not.toHaveBeenCalled();
  });
});

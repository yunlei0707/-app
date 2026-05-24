import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/dbV2.js', () => ({
  getCurrentV2Account: vi.fn(),
  updateV2AccountData: vi.fn(),
}));

const dbV2 = await import('../../src/utils/dbV2.js');
const { updateV2AccountData } = await import('../../src/repositories/stateRepository.js');

describe('stateRepository.updateV2AccountData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards explicit identity and account arguments to dbV2', () => {
    updateV2AccountData('mom', 'user', { timeline: [] });

    expect(dbV2.updateV2AccountData).toHaveBeenCalledWith('mom', 'user', { timeline: [] });
  });

  it('supports one-argument updates for the current v2 account', () => {
    dbV2.getCurrentV2Account.mockReturnValue({
      identityName: 'dad',
      accountId: 'user',
    });

    updateV2AccountData({ growth: { height: 80 } });

    expect(dbV2.updateV2AccountData).toHaveBeenCalledWith('dad', 'user', { growth: { height: 80 } });
  });

  it('returns false for one-argument updates when no current account exists', () => {
    dbV2.getCurrentV2Account.mockReturnValue(null);

    expect(updateV2AccountData({ timeline: [] })).toBe(false);
    expect(dbV2.updateV2AccountData).not.toHaveBeenCalled();
  });
});

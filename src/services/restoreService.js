import { addMoment, updateMoment, getMomentById } from '../utils/db.js';

export async function restoreMoments(moments, options = { mode: 'merge' }) {
  const { mode } = options;

  if (!Array.isArray(moments) || moments.length === 0) {
    return { restored: 0, skipped: 0, conflicts: [] };
  }

  let restored = 0;
  let skipped = 0;
  let conflicts = [];

  for (const m of moments) {
    try {
      const existing = await getMomentById(m.id);

      if (existing) {
        if (mode === 'overwrite') {
          await updateMoment(m.id, m);
          restored++;
        } else {
          skipped++;
          conflicts.push({
            id: m.id,
            type: 'duplicate',
            existing,
            incoming: m
          });
        }
      } else {
        await addMoment(m);
        restored++;
      }
    } catch (e) {
      conflicts.push({
        id: m.id,
        type: 'error',
        error: e.message
      });
    }
  }

  return { restored, skipped, conflicts };
}

export default { restoreMoments };

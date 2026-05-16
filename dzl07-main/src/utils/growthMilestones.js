// 成长名场面定义

export const GROWTH_MILESTONES = {
  height: [50, 60, 70, 75, 80, 85, 90, 100, 110, 120],
  weight: [3, 5, 7, 10, 12, 15, 20],
  headCircumference: [34, 40, 45, 48, 50],
  footLength: [5, 8, 10, 12, 15],
};

export const GROWTH_LABELS = {
  height: '身高',
  weight: '体重',
  headCircumference: '头围',
  footLength: '脚长',
};

export const GROWTH_UNITS = {
  height: 'cm',
  weight: 'kg',
  headCircumference: 'cm',
  footLength: 'cm',
};

export const GROWTH_ICONS = {
  height: '📏',
  weight: '⚖️',
  headCircumference: '🧠',
  footLength: '👣',
};

// 检查是否有新的名场面触发
// 返回触发的名场面数组 [{field, value, label}]
export function checkGrowthMilestones(newRecord, previousRecord) {
  const triggered = [];
  
  for (const [field, milestones] of Object.entries(GROWTH_MILESTONES)) {
    const newValue = newRecord[field];
    const oldValue = previousRecord?.[field];
    
    if (newValue == null || newValue <= 0) continue;
    
    for (const milestone of milestones) {
      // 新值达到名场面，旧值未达到（或没有旧值）
      if (newValue >= milestone && (oldValue == null || oldValue < milestone)) {
        triggered.push({
          field,
          value: milestone,
          label: `${GROWTH_LABELS[field]}突破${milestone}${GROWTH_UNITS[field]}`,
        });
      }
    }
  }
  
  return triggered;
}

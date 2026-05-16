/**
 * 日期处理工具函数
 * 基于 date-fns 封装常用日期操作
 */

import { 
  format, 
  formatDistanceToNow, 
  differenceInDays, 
  differenceInMonths, 
  differenceInYears,
  differenceInHours,
  differenceInMinutes,
  isToday, 
  isYesterday,
  isSameYear,
  parseISO,
  addDays,
  addMonths,
  addYears,
  setYear,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isBefore,
  isAfter,
  getYear,
  getMonth,
  getDate
} from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 计算宝宝年龄
 * @param {string|Date} birthDate - 出生日期
 * @param {string|Date} dueDate - 预产期（可选，用于未出生宝宝）
 * @returns {Object} 年龄对象 { years, months, days, totalDays, isUnborn, display }
 */
export function calculateAge(birthDate, dueDate) {
  // 空值保护：如果生日为空但有预产期，计算出生前天数
  const effectiveDate = birthDate || dueDate;
  if (!effectiveDate) {
    return {
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      isUnborn: true,
      display: '等待设置生日'
    };
  }
  
  const birth = typeof effectiveDate === 'string' ? parseISO(effectiveDate) : effectiveDate;
  const now = new Date();
  
  // 检查是否是未来日期（未出生宝宝）
  if (isAfter(birth, now)) {
    const totalDays = differenceInDays(birth, now);
    const months = differenceInMonths(birth, now) % 12;
    const days = totalDays % 30;
    
    return {
      years: 0,
      months: months,
      days: days,
      totalDays: -totalDays, // 负数表示出生前
      isUnborn: true,
      display: `出生前${totalDays}天`,
    };
  }
  
  const years = differenceInYears(now, birth);
  const months = differenceInMonths(now, birth) % 12;
  const totalDays = differenceInDays(now, birth);
  
  // 精确计算天数（排除整月）
  const birthWithCurrentYear = setYear(birth, now.getFullYear());
  let days = differenceInDays(now, birthWithCurrentYear);
  
  if (days < 0) {
    // 还没到今年的生日
    const birthWithPrevYear = setYear(birth, now.getFullYear() - 1);
    days = differenceInDays(now, birthWithPrevYear);
  }
  
  return {
    years,
    months,
    days,
    totalDays,
    isUnborn: false,
    display: formatAgeDisplay(years, months, days),
  };
}

/**
 * 格式化年龄显示
 */
export function formatAgeDisplay(years, months, days) {
  const parts = [];
  if (years > 0) parts.push(`${years}岁`);
  if (months > 0) parts.push(`${months}个月`);
  if (days >= 0 && years === 0) {
    parts.push(`${days}天`);
  } else if (days > 0) {
    parts.push(`${days}天`);
  }
  return parts.join('') || '0天';
}

/**
 * 格式化日期为友好显示
 */
export function formatDateFriendly(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  
  if (isToday(d)) {
    return '今天';
  }
  if (isYesterday(d)) {
    return '昨天';
  }
  if (isSameYear(d, new Date())) {
    return format(d, 'M月d日 EEE', { locale: zhCN });
  }
  return format(d, 'yyyy年M月d日', { locale: zhCN });
}

/**
 * 格式化日期为完整显示
 */
export function formatDateFull(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy年M月d日 EEE', { locale: zhCN });
}

/**
 * 格式化日期为短显示
 */
export function formatDateShort(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'M月d日');
}

/**
 * 格式化日期为年份显示
 */
export function formatYear(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return `${getYear(d)}年`;
}

/**
 * 格式化月份显示
 */
export function formatMonth(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'M月', { locale: zhCN });
}

/**
 * 获取相对时间
 */
export function getRelativeTime(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: zhCN });
}

/**
 * 计算距离指定日期的倒计时
 */
export function getCountdown(targetDate) {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  const now = new Date();
  
  if (isBefore(target, now)) {
    return { expired: true, years: 0, months: 0, days: 0, hours: 0 };
  }
  
  const years = differenceInYears(target, now);
  const months = differenceInMonths(target, now) % 12;
  const days = differenceInDays(target, now) % 30;
  const hours = differenceInHours(target, now) % 24;
  
  return {
    expired: false,
    years,
    months,
    days,
    hours,
    display: formatCountdownDisplay(years, months, days, hours),
  };
}

/**
 * 格式化倒计时显示
 */
export function formatCountdownDisplay(years, months, days, hours) {
  if (years > 0) return `${years}年${months}个月后开启`;
  if (months > 0) return `${months}个月${days}天后开启`;
  if (days > 0) return `${days}天${hours}小时后开启`;
  if (hours > 0) return `${hours}小时后开启`;
  return '即将开启';
}

/**
 * 基于宝宝生日格式化日期为相对时间显示
 * @param {string|Date} date - 记录日期
 * @param {string|Date} birthday - 宝宝生日
 * @returns {Object|null} { display: 显示文本, monthsDiff: 月份差 } 或 null（无生日时）
 */
export function formatDateRelativeToBirthday(date, birthday) {
  const recordDate = typeof date === 'string' ? parseISO(date) : date;
  
  // 如果没有生日，返回 null 以便降级显示原日历日期
  if (!birthday) {
    return null;
  }
  
  const birthDate = typeof birthday === 'string' ? parseISO(birthday) : birthday;
  
  // 使用本地时间计算年月
  const recordYear = recordDate.getFullYear();
  const recordMonth = recordDate.getMonth();
  const birthYear = birthDate.getFullYear();
  const birthMonth = birthDate.getMonth();
  
  // 计算总月份差（使用年*12+月，确保跨年正确）
  const totalRecordMonths = recordYear * 12 + recordMonth;
  const totalBirthMonths = birthYear * 12 + birthMonth;
  const monthsDiff = totalRecordMonths - totalBirthMonths;
  
  // 判断出生前后
  if (monthsDiff < 0) {
    return {
      display: `出生前${Math.abs(monthsDiff)}个月`,
      monthsDiff
    };
  } else if (monthsDiff === 0) {
    return {
      display: '出生月',
      monthsDiff
    };
  } else {
    return {
      display: `出生后${monthsDiff}个月`,
      monthsDiff
    };
  }
}

/**
 * 按年月分组
 * @param {Array} moments - 动态数组
 * @param {string|Date} birthday - 宝宝生日（可选），传入后分组标题显示相对时间
 * @returns {Array} 分组后的数组，每个分组包含 year, month, moments, relativeDisplay, monthsDiff
 */
export function groupByYearAndMonth(moments, birthday = null) {
  // 空值保护
  const safeMoments = Array.isArray(moments) ? moments : [];
  
  // 先按创建时间倒序排列所有动态
  const sortedMoments = [...safeMoments].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.date);
    const dateB = new Date(b.createdAt || b.date);
    return dateB.getTime() - dateA.getTime();
  });
  
  // 按年份分组
  const yearGroups = {};
  
  sortedMoments.forEach(moment => {
    const date = parseISO(moment.date);
    const year = getYear(date);
    const month = getMonth(date);
    
    if (!yearGroups[year]) {
      yearGroups[year] = {};
    }
    
    const monthKey = month + 1;
    
    if (!yearGroups[year][monthKey]) {
      // 计算该月第一条记录的相对时间
      const relativeInfo = formatDateRelativeToBirthday(date, birthday);
      
      yearGroups[year][monthKey] = {
        month: month + 1,
        moments: [],
        relativeDisplay: relativeInfo?.display || null,
        monthsDiff: relativeInfo?.monthsDiff ?? null,
      };
    }
    
    yearGroups[year][monthKey].moments.push(moment);
  });
  
  // 转换为嵌套结构: [ { year, months: [ { month, moments, ... } ] } ]
  return Object.entries(yearGroups)
    .map(([year, monthsData]) => ({
      year: parseInt(year),
      months: Object.values(monthsData).sort((a, b) => b.month - a.month)
    }))
    .sort((a, b) => b.year - a.year);
}

/**
 * 获取月份的所有日期
 */
export function getMonthDays(year, month) {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(new Date(year, month));
  return eachDayOfInterval({ start, end });
}

/**
 * 检查日期是否是今天
 */
export function isSameDayCheck(date1, date2) {
  const d1 = typeof date1 === 'string' ? parseISO(date1) : date1;
  const d2 = typeof date2 === 'string' ? parseISO(date2) : date2;
  return isSameDay(d1, d2);
}

/**
 * 格式化时间为 HH:mm
 */
export function formatTime(date) {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'HH:mm');
}

/**
 * 获取快捷日期选项
 */
export function getQuickDateOptions(baseDate = new Date()) {
  return [
    { label: '1年后', date: addYears(baseDate, 1) },
    { label: '5年后', date: addYears(baseDate, 5) },
    { label: '10年后', date: addYears(baseDate, 10) },
    { label: '18岁生日', date: addYears(baseDate, 18) },
    { label: '自定义', date: null },
  ];
}

export { getYear, getMonth, getDate };

// ============ 属相和星座计算函数 ============

/**
 * 属相数据
 */
const ZODIAC_ANIMALS = [
  { emoji: '🐀', name: '鼠', celestial: '子' },
  { emoji: '🐂', name: '牛', celestial: '丑' },
  { emoji: '🐅', name: '虎', celestial: '寅' },
  { emoji: '🐇', name: '兔', celestial: '卯' },
  { emoji: '🐉', name: '龙', celestial: '辰' },
  { emoji: '🐍', name: '蛇', celestial: '巳' },
  { emoji: '🐎', name: '马', celestial: '午' },
  { emoji: '🐏', name: '羊', celestial: '未' },
  { emoji: '🐒', name: '猴', celestial: '申' },
  { emoji: '🐓', name: '鸡', celestial: '酉' },
  { emoji: '🐕', name: '狗', celestial: '戌' },
  { emoji: '🐖', name: '猪', celestial: '亥' },
];

/**
 * 星座数据
 */
const CONSTELLATIONS = [
  { emoji: '♈', name: '白羊座', start: [3, 21], end: [4, 19] },
  { emoji: '♉', name: '金牛座', start: [4, 20], end: [5, 20] },
  { emoji: '♊', name: '双子座', start: [5, 21], end: [6, 21] },
  { emoji: '♋', name: '巨蟹座', start: [6, 22], end: [7, 22] },
  { emoji: '♌', name: '狮子座', start: [7, 23], end: [8, 22] },
  { emoji: '♍', name: '处女座', start: [8, 23], end: [9, 22] },
  { emoji: '♎', name: '天秤座', start: [9, 23], end: [10, 23] },
  { emoji: '♏', name: '天蝎座', start: [10, 24], end: [11, 22] },
  { emoji: '♐', name: '射手座', start: [11, 23], end: [12, 21] },
  { emoji: '♑', name: '摩羯座', start: [12, 22], end: [1, 19] },
  { emoji: '♒', name: '水瓶座', start: [1, 20], end: [2, 18] },
  { emoji: '♓', name: '双鱼座', start: [2, 19], end: [3, 20] },
];

/**
 * 计算属相
 * @param {string|Date} dateStr - 日期字符串或日期对象
 * @returns {Object} { emoji, name, fullName } 如 { emoji: '🐉', name: '龙', fullName: '辰龙' }
 */
export function calculateZodiac(dateStr) {
  if (!dateStr) {
    return { emoji: '', name: '', fullName: '' };
  }
  
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    const year = getYear(date);
    // 属相计算：(年份 - 4) % 12，1900年是鼠年（索引0）
    const index = ((year - 4) % 12 + 12) % 12;
    const zodiac = ZODIAC_ANIMALS[index];
    
    return {
      emoji: zodiac.emoji,
      name: zodiac.name,
      fullName: zodiac.celestial + zodiac.name,
    };
  } catch (e) {
    return { emoji: '', name: '', fullName: '' };
  }
}

/**
 * 计算星座
 * @param {string|Date} dateStr - 日期字符串或日期对象
 * @returns {Object} { emoji, name } 如 { emoji: '♌', name: '狮子座' }
 */
export function calculateConstellation(dateStr) {
  if (!dateStr) {
    return { emoji: '', name: '' };
  }
  
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    const month = getMonth(date) + 1; // 月份从1开始
    const day = getDate(date);
    
    // 遍历星座，找到匹配的
    for (const constellation of CONSTELLATIONS) {
      const [startMonth, startDay] = constellation.start;
      const [endMonth, endDay] = constellation.end;
      
      // 处理跨年星座（摩羯座）
      if (startMonth > endMonth) {
        // 摩羯座：12.22 - 1.19
        if (month === startMonth && day >= startDay) {
          return { emoji: constellation.emoji, name: constellation.name };
        }
        if (month === endMonth && day <= endDay) {
          return { emoji: constellation.emoji, name: constellation.name };
        }
      } else {
        // 普通星座
        if (month === startMonth && day >= startDay) {
          return { emoji: constellation.emoji, name: constellation.name };
        }
        if (month === startMonth + 1 && day <= endDay) {
          return { emoji: constellation.emoji, name: constellation.name };
        }
      }
    }
    
    return { emoji: '', name: '' };
  } catch (e) {
    return { emoji: '', name: '' };
  }
}

/**
 * 根据出生日期或预产期计算属相
 * @param {string|Date} birthDate - 出生日期
 * @param {string|Date} dueDate - 预产期
 * @returns {Object} { emoji, name, fullName }
 */
export function getZodiacFromBirthOrDue(birthDate, dueDate) {
  return calculateZodiac(birthDate || dueDate);
}

/**
 * 根据出生日期或预产期计算星座
 * @param {string|Date} birthDate - 出生日期
 * @param {string|Date} dueDate - 预产期
 * @returns {Object} { emoji, name }
 */
export function getConstellationFromBirthOrDue(birthDate, dueDate) {
  return calculateConstellation(birthDate || dueDate);
}

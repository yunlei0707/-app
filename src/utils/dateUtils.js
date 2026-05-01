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
 * @returns {Object} 年龄对象 { years, months, days, totalDays }
 */
export function calculateAge(birthDate) {
  const birth = typeof birthDate === 'string' ? parseISO(birthDate) : birthDate;
  const now = new Date();
  
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
 * 按年月分组
 */
export function groupByYearAndMonth(moments) {
  const groups = {};
  
  // 先按创建时间倒序排列所有动态
  const sortedMoments = [...moments].sort((a, b) => {
    const dateA = new Date(a.createdAt || a.date);
    const dateB = new Date(b.createdAt || b.date);
    return dateB.getTime() - dateA.getTime();
  });
  
  sortedMoments.forEach(moment => {
    const date = parseISO(moment.date);
    const year = getYear(date);
    const month = getMonth(date);
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    if (!groups[key]) {
      groups[key] = {
        year,
        month: month + 1,
        moments: [],
      };
    }
    groups[key].moments.push(moment);
  });
  
  // 转换为数组并按年月倒序排序
  return Object.values(groups).sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return b.month - a.month;
  });
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

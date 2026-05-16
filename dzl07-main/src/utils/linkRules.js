/**
 * 虚拟时光与真实记录联动规则配置
 * 
 * 功能：定义真实记录到虚拟时光的联动规则
 * 使用方式：调用 matchLinkRule(record, babyInfo) 进行规则匹配
 */

/**
 * 联动规则表
 * 每个规则包含：
 * - id: 规则唯一标识
 * - record_type: 匹配的记录类型 (photo/video/diary/milestone/mood/any)
 * - trigger: 触发条件函数 (record, babyInfo) => boolean
 * - target_category: 目标虚拟时光分类
 * - template: 内容模板，支持变量替换 {baby_name}/{content}/[key_sentence]/等
 */
export const LINK_RULES = [
  // 规则1：照片 + 标签含"第一次" → 宝宝朋友圈
  {
    id: "rule_001",
    record_type: "photo",
    trigger: (record) => record.tags?.includes("第一次"),
    target_category: "宝宝朋友圈",
    template: "{baby_name}小时候{content}，现在的你看到会笑吗？"
  },
  
  // 规则2：视频 + 时长>10秒 → 中学的宝宝
  {
    id: "rule_002",
    record_type: "video",
    trigger: (record) => record.duration > 10,
    target_category: "中学的宝宝",
    template: "当年学{action}的视频，现在体育课还在用这个技能"
  },
  
  // 规则3：日记 + 关键词"生病/打针/康复" → 结婚的宝宝
  {
    id: "rule_003",
    record_type: "diary",
    trigger: (record) => /生病|打针|康复/.test(record.content),
    target_category: "结婚的宝宝",
    template: "以后我的孩子生病，我也要像妈妈一样{key_sentence}"
  },
  
  // 规则4：名场面 + 类型=第一次叫爸妈 → 幼儿园宝宝
  {
    id: "rule_004",
    record_type: "milestone",
    trigger: (record) => /第一次叫.*爸妈|第一次叫妈妈|第一次叫爸爸/.test(record.title || record.milestoneLabel || ''),
    target_category: "幼儿园宝宝",
    template: "{baby_name}在 {date} 第一次叫妈妈，老师问谁会给妈妈唱歌，{baby_name}第一个举手"
  },
  
  // 规则5：心情 + 心情=感动 → 宝宝背唐诗
  {
    id: "rule_005",
    record_type: "mood",
    trigger: (record) => record.mood === "感动",
    target_category: "宝宝背唐诗",
    template: "《游子吟》\n慈母手中线，游子身上衣...\n\n[💖 来自妈妈记录的真实时刻]"
  },
  
  // 规则6：任何记录 + 生日当天 → 宝宝朋友圈
  {
    id: "rule_006",
    record_type: "any",
    trigger: (record, babyInfo) => {
      // 判断记录日期是否是宝宝生日（月日相同）
      const recordMonthDay = record.date?.slice(5, 10); // "MM-DD"
      const babyBirthMonthDay = babyInfo?.birthDate?.slice(5, 10);
      return recordMonthDay && babyBirthMonthDay && recordMonthDay === babyBirthMonthDay;
    },
    target_category: "宝宝朋友圈",
    template: "{age}岁生日那天，{recorder}记下了：{record_title}"
  }
];

/**
 * 匹配联动规则
 * @param {Object} record - 真实记录数据
 * @param {Object} babyInfo - 宝宝信息 { name, birthDate, ... }
 * @returns {Object|null} 匹配的规则对象，未匹配返回 null
 */
export function matchLinkRule(record, babyInfo) {
  return LINK_RULES.find(rule => {
    if (rule.record_type === "any") {
      return rule.trigger(record, babyInfo);
    }
    return record.type === rule.record_type && rule.trigger(record, babyInfo);
  }) || null;
}

/**
 * 生成联动内容
 * @param {Object} rule - 匹配的规则
 * @param {Object} record - 真实记录数据
 * @param {Object} babyInfo - 宝宝信息
 * @returns {string} 替换后的内容
 */
export function generateLinkedContent(rule, record, babyInfo) {
  if (!rule) return '';
  
  let content = rule.template;
  
  // 替换变量
  content = content.replace(/\{baby_name\}/g, babyInfo?.name || '宝宝');
  content = content.replace(/\{content\}/g, record.content || '');
  content = content.replace(/\{record_title\}/g, record.title || record.content?.slice(0, 20) || '');
  content = content.replace(/\{date\}/g, record.date ? new Date(record.date).toLocaleDateString('zh-CN') : '');
  
  // 计算年龄
  if (babyInfo?.birthDate && record.date) {
    const birth = new Date(babyInfo.birthDate);
    const recordDate = new Date(record.date);
    const age = Math.floor((recordDate - birth) / (365.25 * 24 * 60 * 60 * 1000));
    content = content.replace(/\{age\}/g, age);
  }
  
  // 提取关键句子
  if (record.content) {
    const sentences = record.content.split(/[。.!?！]/).filter(s => s.trim());
    const keySentence = sentences[0] || '';
    content = content.replace(/\{key_sentence\}/g, keySentence);
  }
  
  // 提取动作（从内容中提取动词或动作词）
  if (record.content) {
    const actionMatch = record.content.match(/(?:学|会|做|练|尝试)([\\u4e00-\\u9fa5]+)/);
    const action = actionMatch ? actionMatch[1] : '运动';
    content = content.replace(/\{action\}/g, action);
  }
  
  // 记录人（假设是妈妈）
  content = content.replace(/\{recorder\}/g, babyInfo?.recorder || '妈妈');
  
  return content;
}

export default LINK_RULES;

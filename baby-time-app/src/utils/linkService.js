/**
 * 虚拟时光与真实记录联动服务
 * 
 * 功能：
 * 1. 处理真实记录的联动匹配
 * 2. 生成联动内容
 * 3. 保存到虚拟时光数据库
 */

import { matchLinkRule, generateLinkedContent } from './linkRules';
import { getCurrentBabyInfo, addVirtualTimeToCurrentAccount } from './dbV2';

/**
 * 分类标题到 ID 的映射（用于联动时设置正确的分类）
 */
const CATEGORY_TITLE_TO_ID = {
  '幼儿园宝宝': 'kindergarten',
  '中学的宝宝': 'middle_school',
  '宝宝朋友圈': 'baby_moments',
  '结婚的宝宝': 'wedding',
  '宝宝背唐诗': 'poetry'
};

/**
 * 处理真实记录的联动
 * @param {Object} record - 真实记录数据
 * @returns {Object|null} 联动结果，未匹配到规则返回 null
 */
export async function handleRecordLink(record) {
  try {
    // 1. 获取当前宝宝信息
    const babyInfo = getCurrentBabyInfo();
    
    if (!babyInfo) {
      console.log('[Link] 未获取到宝宝信息，跳过联动');
      return null;
    }
    
    // 2. 匹配联动规则
    const matchedRule = matchLinkRule(record, babyInfo);
    
    // 3. 没有匹配到规则，直接返回
    if (!matchedRule) {
      console.log('[Link] 没有匹配到联动规则，跳过');
      return null;
    }
    
    console.log('[Link] 匹配到联动规则:', matchedRule.id, matchedRule.target_category);
    
    // 4. 生成联动内容
    const linkedContent = generateLinkedContent(matchedRule, record, babyInfo);
    
    // 5. 获取分类 ID
    const categoryId = CATEGORY_TITLE_TO_ID[matchedRule.target_category] || matchedRule.target_category;
    
    // 6. 构建虚拟时光记录
    const virtualTimeRecord = {
      category_id: categoryId,
      category_title: matchedRule.target_category,
      title: `[💖 来自真实记录] ${record.title || record.milestoneLabel || '新时刻'}`,
      content: linkedContent,
      date: new Date().toISOString(),
      create_time: new Date().toISOString(),
      type: 'linked',
      
      // 联动相关字段
      linked_from_record_id: record.id,
      linked_from_record_type: record.type,
      link_rule_id: matchedRule.id,
      link_type: 'auto',
      is_linked: true
    };
    
    // 7. 保存到当前账号的虚拟时光中
    const savedRecord = addVirtualTimeToCurrentAccount(virtualTimeRecord);
    
    if (savedRecord) {
      console.log('[Link] 联动内容已生成并保存:', savedRecord.id);
    }
    
    return savedRecord;
    
  } catch (error) {
    console.error('[Link] 联动处理失败:', error);
    return null;
  }
}

export default handleRecordLink;

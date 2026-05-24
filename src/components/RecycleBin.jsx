/**
 * 回收站组件
 * 双账号支持版本：支持 IndexedDB 和 v2 localStorage 两种存储
 */

import { useState, useEffect } from 'react';
import { X, RotateCcw, Trash2, AlertTriangle, Clock } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getDeletedMomentsByBaby, restoreMoment, deleteMomentPermanently, emptyRecycleBin } from '../repositories/stateRepository';
import { getCurrentV2Account, getCurrentTimeline, isSystemAccount, deleteMomentFromCurrentAccount, updateMomentInCurrentAccount, getCurrentBabyInfo, updateV2AccountData } from "../repositories/stateRepository.js";

export function RecycleBin({ onClose }) {
  const { currentBaby, showToast, setMoments } = useApp();
  const [deletedMoments, setDeletedMoments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [hasV2Baby, setHasV2Baby] = useState(false);

  // 加载回收站数据
  useEffect(() => {
    loadDeletedMoments();
  }, [currentBaby]);

  const loadDeletedMoments = async () => {
    setIsLoading(true);
    try {
      const v2BabyInfo = getCurrentBabyInfo();
      const account = getCurrentV2Account();
      const isV2Account = !!v2BabyInfo && !!account?.accountData;
      if (isV2Account) {
        setHasV2Baby(true);
        setDeletedMoments((account.accountData.timeline || []).filter(m => m.isDeleted));
        return;
      }

      // ✅ 修复数据隔离：与 TimelinePage 保持一致，优先判断 currentBaby
      // 有普通宝宝（currentBaby 存在）时，使用 IndexedDB 的回收站数据
      // 只有没有普通宝宝但有 v2 宝宝时，才使用 v2 账号的回收站数据
      if (currentBaby?.id) {
        // 普通宝宝：从 IndexedDB 获取
        setHasV2Baby(false);
        const moments = await getDeletedMomentsByBaby(currentBaby.id);
        setDeletedMoments(moments);
      } else {
        // 检查是否为 v2 账号系统
        const v2BabyInfo = getCurrentBabyInfo();
        const isV2Account = !!v2BabyInfo;
        
        setHasV2Baby(isV2Account);
        
        if (isV2Account) {
          // v2 账号：从 timeline 中获取已删除的记录
          const account = getCurrentV2Account();
          if (account?.accountData?.timeline) {
            const deleted = account.accountData.timeline.filter(m => m.isDeleted) || [];
            setDeletedMoments(deleted);
          } else {
            setDeletedMoments([]);
          }
        } else {
          setDeletedMoments([]);
        }
      }
    } catch (error) {
      console.error('加载回收站失败:', error);
      showToast('加载回收站失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // 还原动态
  const handleRestore = async (momentId) => {
    setActionLoading(momentId);
    try {
      if (hasV2Baby) {
        const account = getCurrentV2Account();
        if (account?.accountData?.timeline) {
          const timeline = account.accountData.timeline.map(m =>
            m.id === momentId ? { ...m, isDeleted: false, deletedAt: null } : m
          );
          updateV2AccountData(account.identityName, account.accountId, { timeline });
          window.dispatchEvent(new Event('v2-moment-updated'));
        }
        showToast('已还原到时光轴');
        await loadDeletedMoments();
        return;
      }

      // ✅ 修复数据隔离：与 TimelinePage 保持一致，优先判断 currentBaby
      if (currentBaby?.id) {
        // 普通宝宝：恢复 IndexedDB 数据
        await restoreMoment(momentId);
        
        // 刷新时光轴
        const { getMomentsByBaby } = await import('../utils/db');
        const moments = await getMomentsByBaby(currentBaby.id);
        setMoments(moments);
      } else if (hasV2Baby) {
        // v2 账号：恢复 v2 数据
        const account = getCurrentV2Account();
        if (account?.accountData?.timeline) {
          const timeline = account.accountData.timeline.map(m => 
            m.id === momentId ? { ...m, isDeleted: false } : m
          );
          updateV2AccountData(account.identityName, account.accountId, { timeline });
          // 触发 TimelinePage 刷新
          window.dispatchEvent(new Event('v2-moment-updated'));
        }
      }
      
      showToast('已还原到时光轴');
      await loadDeletedMoments();
    } catch (error) {
      console.error('还原失败:', error);
      showToast('还原失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 永久删除
  const handlePermanentDelete = async (momentId) => {
    if (!confirm('确定要永久删除吗？此操作不可恢复！')) return;

    setActionLoading(momentId);
    try {
      if (hasV2Baby) {
        const account = getCurrentV2Account();
        if (account?.accountData?.timeline) {
          const timeline = account.accountData.timeline.filter(m => m.id !== momentId);
          updateV2AccountData(account.identityName, account.accountId, { timeline });
          window.dispatchEvent(new Event('v2-moment-updated'));
        }
        showToast('已永久删除');
        await loadDeletedMoments();
        return;
      }

      // ✅ 修复数据隔离：与 TimelinePage 保持一致，优先判断 currentBaby
      if (currentBaby?.id) {
        // 普通宝宝：永久删除 IndexedDB 数据
        await deleteMomentPermanently(momentId);
      } else if (hasV2Baby) {
        // v2 账号：永久删除
        deleteMomentFromCurrentAccount(momentId);
      }
      
      showToast('已永久删除');
      await loadDeletedMoments();
    } catch (error) {
      console.error('删除失败:', error);
      showToast('删除失败', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // 清空回收站
  const handleEmptyBin = async () => {
    if (!confirm('确定要清空回收站吗？所有已删除的记录将被永久删除！')) return;

    try {
      if (hasV2Baby) {
        const account = getCurrentV2Account();
        if (account?.accountData?.timeline) {
          const timeline = account.accountData.timeline.filter(m => !m.isDeleted);
          updateV2AccountData(account.identityName, account.accountId, { timeline });
          window.dispatchEvent(new Event('v2-moment-updated'));
        }
        showToast('回收站已清空');
        await loadDeletedMoments();
        return;
      }

      // ✅ 修复数据隔离：与 TimelinePage 保持一致，优先判断 currentBaby
      if (currentBaby?.id) {
        // 普通宝宝：清空 IndexedDB 回收站
        await emptyRecycleBin(currentBaby.id);
      } else if (hasV2Baby) {
        // v2 账号：清空所有已删除的 v2 记录
        const account = getCurrentV2Account();
        if (account?.accountData?.timeline) {
          const timeline = account.accountData.timeline.filter(m => !m.isDeleted);
          updateV2AccountData(account.identityName, account.accountId, { timeline });
        }
      }
      
      showToast('回收站已清空');
      await loadDeletedMoments();
    } catch (error) {
      console.error('清空失败:', error);
      showToast('清空失败', 'error');
    }
  };

  // 格式化日期
  const formatDeletedDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return '今天删除';
    if (diffDays === 1) return '昨天删除';
    if (diffDays < 7) return `${diffDays}天前删除`;
    
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  // 格式化原始日期
  const formatOriginalDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-cream-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">回收站</h2>
            <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs rounded-full">
              {deletedMoments.length}条
            </span>
            {hasV2Baby && (
              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-600 text-xs rounded-full">
                系统账号
              </span>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 提示 */}
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              删除的记录会在30天后自动清除，可随时还原
            </p>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : deletedMoments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Trash2 className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-center">回收站是空的</p>
            </div>
          ) : (
            <div className="divide-y divide-cream-100 dark:divide-gray-700">
              {deletedMoments.map(moment => (
                <div key={moment.id} className="p-4 bg-white dark:bg-gray-800">
                  {/* 内容预览 */}
                  <div className="flex gap-3">
                    {/* 缩略图 */}
                    {(moment.photos?.[0] || moment.videos?.[0]?.cover) && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img 
                          src={moment.photos?.[0] || moment.videos?.[0]?.cover} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    
                    {/* 文字内容 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {moment.content || '(无文字内容)'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatOriginalDate(moment.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 删除时间和操作 */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <span className="text-xs text-amber-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDeletedDate(moment.deletedAt || moment.updatedAt)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRestore(moment.id)}
                        disabled={actionLoading === moment.id}
                        className="px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        {actionLoading === moment.id ? (
                          <div className="w-3 h-3 border border-primary-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        还原
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(moment.id)}
                        disabled={actionLoading === moment.id}
                        className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        永久删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        {deletedMoments.length > 0 && (
          <div className="p-4 border-t border-cream-100 dark:border-gray-700">
            <button
              onClick={handleEmptyBin}
              className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              清空回收站
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

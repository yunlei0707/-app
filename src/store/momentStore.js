/**
 * ✅ 生产级：Zustand 状态管理 - 动态列表状态
 * 支持分页加载、无限滚动、加载状态管理
 */

import { create } from 'zustand';

export const useMomentStore = create((set, get) => ({
  // 状态
  moments: [],          // 动态列表
  loading: false,       // 加载状态
  hasMore: true,        // 是否还有更多数据
  error: null,          // 错误信息
  
  // 动作
  /**
   * 设置动态列表（覆盖）
   */
  setMoments: (data) => set({ 
    moments: data,
    hasMore: data.length >= 20  // 如果返回数据小于20，说明没有更多了
  }),
  
  /**
   * 追加动态列表（分页）
   */
  appendMoments: (data) => set((state) => ({
    moments: [...state.moments, ...data],
    hasMore: data.length >= 20,  // 如果返回数据小于20，说明没有更多了
  })),
  
  /**
   * 设置加载状态
   */
  setLoading: (loading) => set({ loading }),
  
  /**
   * 设置错误信息
   */
  setError: (error) => set({ error }),
  
  /**
   * 重置状态
   */
  reset: () => set({
    moments: [],
    loading: false,
    hasMore: true,
    error: null,
  }),
  
  /**
   * 在列表开头添加新动态
   */
  prependMoment: (moment) => set((state) => ({
    moments: [moment, ...state.moments],
  })),
  
  /**
   * 更新某条动态
   */
  updateMoment: (id, updates) => set((state) => ({
    moments: state.moments.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ),
  })),
  
  /**
   * 删除某条动态（软删除标记）
   */
  removeMoment: (id) => set((state) => ({
    moments: state.moments.map(m => 
      m.id === id ? { ...m, isDeleted: true } : m
    ).filter(m => !m.isDeleted),
  })),
  
  /**
   * 获取最后一条动态的createdAt（用于分页）
   */
  getLastCreatedAt: () => {
    const { moments } = get();
    if (moments.length === 0) return null;
    return moments[moments.length - 1]?.createdAt || null;
  },
}));

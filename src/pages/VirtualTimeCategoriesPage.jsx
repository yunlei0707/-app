/**
 * 未来宝宝目录管理页面
 * 支持添加、编辑、删除未来宝宝的一级分类和二级内容项
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit3, Trash2, ChevronRight, X, Check, Folder, FileText, Sparkles } from 'lucide-react';
import { BabyHeader } from '../components/BabyHeader';
import { useApp } from '../store/AppContext';
import {
  getVirtualTimeCategories,
  addVirtualTimeCategory,
  updateVirtualTimeCategory,
  deleteVirtualTimeCategory,
  addVirtualTimeCategoryItem,
  updateVirtualTimeCategoryItem,
  deleteVirtualTimeCategoryItem,
  getCurrentBabyInfo,
  isSystemAccount as checkIsSystemAccount
} from "../repositories/stateRepository.js";

export function VirtualTimeCategoriesPage() {
  const navigate = useNavigate();
  const { showToast } = useApp();
  
  // 状态
  const [categories, setCategories] = useState([]);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSystemAccount, setIsSystemAccount] = useState(false);
  
  // 编辑状态
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ title: '', description: '' });
  const [itemForm, setItemForm] = useState({ title: '', description: '', content: '', emoji: '📝' });
  const [currentCategoryId, setCurrentCategoryId] = useState(null);
  
  // 加载数据
  const loadCategories = useCallback(() => {
    const cats = getVirtualTimeCategories();
    setCategories(cats);
    setIsLoading(false);
  }, []);
  
  useEffect(() => {
    const updateInfo = () => {
      const isSystem = checkIsSystemAccount();
      setIsSystemAccount(isSystem);
      loadCategories();
    };
    
    updateInfo();
    const interval = setInterval(updateInfo, 500);
    return () => clearInterval(interval);
  }, [loadCategories]);
  
  // 切换分类展开
  const toggleCategory = (categoryId) => {
    setExpandedCategory(prev => prev === categoryId ? null : categoryId);
  };
  
  // 新增一级分类
  const handleAddCategory = () => {
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    setEditingCategory(null);
    setCategoryForm({ title: '', description: '' });
    setShowCategoryForm(true);
  };
  
  // 编辑一级分类
  const handleEditCategory = (category, e) => {
    e.stopPropagation();
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    setEditingCategory(category);
    setCategoryForm({ title: category.title, description: category.description || '' });
    setShowCategoryForm(true);
  };
  
  // 删除一级分类
  const handleDeleteCategory = (category, e) => {
    e.stopPropagation();
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    if (category.isPreset) {
      showToast('预置分类不可删除', 'error');
      return;
    }
    if (!confirm(`确定要删除分类"${category.title}"吗？`)) return;
    
    const success = deleteVirtualTimeCategory(category.id);
    if (success) {
      showToast('已删除');
      loadCategories();
      if (expandedCategory === category.id) {
        setExpandedCategory(null);
      }
    }
  };
  
  // 保存一级分类
  const handleSaveCategory = () => {
    if (!categoryForm.title.trim()) {
      showToast('请输入分类名称', 'error');
      return;
    }
    
    if (editingCategory) {
      // 更新
      updateVirtualTimeCategory(editingCategory.id, {
        title: categoryForm.title.trim(),
        description: categoryForm.description.trim()
      });
      showToast('已更新');
    } else {
      // 新增
      addVirtualTimeCategory({
        title: categoryForm.title.trim(),
        description: categoryForm.description.trim()
      });
      showToast('已添加');
    }
    
    setShowCategoryForm(false);
    loadCategories();
  };
  
  // 新增二级内容项
  const handleAddItem = (categoryId) => {
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    setCurrentCategoryId(categoryId);
    setEditingItem(null);
    setItemForm({ title: '', description: '', content: '', emoji: '📝' });
    setShowItemForm(true);
  };
  
  // 编辑二级内容项
  const handleEditItem = (categoryId, item, e) => {
    e.stopPropagation();
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    setCurrentCategoryId(categoryId);
    setEditingItem(item);
    setItemForm({
      title: item.title,
      description: item.description || '',
      content: item.content || '',
      emoji: item.emoji || '📝'
    });
    setShowItemForm(true);
  };
  
  // 删除二级内容项
  const handleDeleteItem = (categoryId, item, e) => {
    e.stopPropagation();
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    if (item.isPreset) {
      showToast('预置内容不可删除', 'error');
      return;
    }
    if (!confirm(`确定要删除"${item.title}"吗？`)) return;
    
    const success = deleteVirtualTimeCategoryItem(categoryId, item.id);
    if (success) {
      showToast('已删除');
      loadCategories();
    }
  };
  
  // 保存二级内容项
  const handleSaveItem = () => {
    if (!itemForm.title.trim()) {
      showToast('请输入内容标题', 'error');
      return;
    }
    
    if (editingItem) {
      updateVirtualTimeCategoryItem(currentCategoryId, editingItem.id, {
        title: itemForm.title.trim(),
        description: itemForm.description.trim(),
        content: itemForm.content.trim(),
        emoji: itemForm.emoji
      });
      showToast('已更新');
    } else {
      addVirtualTimeCategoryItem(currentCategoryId, {
        title: itemForm.title.trim(),
        description: itemForm.description.trim(),
        content: itemForm.content.trim(),
        emoji: itemForm.emoji
      });
      showToast('已添加');
    }
    
    setShowItemForm(false);
    loadCategories();
  };
  
  // 打开未来宝宝预览
  const handlePreview = (category) => {
    navigate('/virtual', { state: { categoryId: category.id } });
  };
  
  return (
    <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900">
      {/* 头部 */}
      <header className="bg-white dark:bg-gray-800 safe-top border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center px-4 h-14">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h1 className="flex-1 text-center font-bold text-gray-800 dark:text-white pr-10">未来宝宝自定义</h1>
        </div>
      </header>
      
      {/* 账号切换器 */}
      <BabyHeader />
      
      {/* 内容 */}
      <main className="px-4 py-4 max-w-lg mx-auto space-y-3">
        {isLoading ? (
          <div className="text-center py-8 text-gray-500">加载中...</div>
        ) : categories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">暂无分类</p>
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
              {/* 一级分类标题 */}
              <div 
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                onClick={() => toggleCategory(category.id)}
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${category.coverGradient || 'from-gray-400 to-gray-500'} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-2xl">{category.coverEmoji || '📁'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-800 dark:text-white">{category.title}</h3>
                    {category.isPreset && (
                      <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full">
                        预置
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-400 truncate">
                    {category.description || `${category.items?.length || 0} 个内容项`}
                  </p>
                </div>
                <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedCategory === category.id ? 'rotate-90' : ''}`} />
              </div>
              
              {/* 操作按钮 */}
              <div className="px-4 pb-3 flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePreview(category); }}
                  className="px-3 py-1.5 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50"
                >
                  预览
                </button>
                {false && !category.isPreset && (
                  <>
                    <button
                      onClick={(e) => handleEditCategory(category, e)}
                      className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    >
                      编辑
                    </button>
                    <button
                      onClick={(e) => handleDeleteCategory(category, e)}
                      className="px-3 py-1.5 text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50"
                    >
                      删除
                    </button>
                  </>
                )}
                {false && category.isPreset && (
                  <button
                    onClick={(e) => handleEditCategory(category, e)}
                    className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    重命名
                  </button>
                )}
              </div>
              
              {/* 二级内容项列表 */}
              {expandedCategory === category.id && (
                <div className="border-t border-gray-100 dark:border-gray-700">
                  {/* 内容项列表 */}
                  {category.items?.map(item => (
                    <div 
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <span className="text-xl">{item.emoji || '📝'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 dark:text-white">{item.title}</span>
                          {item.isPreset && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded">
                              预置
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.description}</p>
                        )}
                      </div>
                      {false && !item.isPreset && !category.isPreset && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleEditItem(category.id, item, e)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-400 hover:text-blue-500"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteItem(category.id, item, e)}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {/* 添加内容项按钮 */}
                  {false && !category.isPreset && (
                    <button
                      onClick={() => handleAddItem(category.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="font-medium">添加内容项</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        
        {/* 添加一级分类按钮 */}
        {false && !isSystemAccount && (
          <button
            onClick={handleAddCategory}
            className="w-full py-4 bg-white dark:bg-gray-800 rounded-xl shadow-sm flex items-center justify-center gap-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">添加分类</span>
          </button>
        )}
        
        {/* 提示 */}
        <div className="bg-gray-100 dark:bg-gray-800/50 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            💡 预置分类不可删除，预置内容不可删除。用户添加的内容可自由编辑和删除。
          </p>
        </div>
      </main>
      
      {/* 一级分类表单弹窗 */}
      {false && showCategoryForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-white">
                {editingCategory ? (editingCategory.isPreset ? '重命名分类' : '编辑分类') : '添加分类'}
              </h3>
              <button onClick={() => setShowCategoryForm(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  分类名称 *
                </label>
                <input
                  type="text"
                  value={categoryForm.title}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例如：我的成长记录"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  分类描述
                </label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简短描述这个分类..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
              
              <button
                onClick={handleSaveCategory}
                disabled={!categoryForm.title.trim()}
                className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 二级内容项表单弹窗 */}
      {false && showItemForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 dark:text-white">
                {editingItem ? '编辑内容项' : '添加内容项'}
              </h3>
              <button onClick={() => setShowItemForm(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  内容标题 *
                </label>
                <input
                  type="text"
                  value={itemForm.title}
                  onChange={(e) => setItemForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="例如：我的第一次游泳"
                  className="input-field"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  描述
                </label>
                <textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="简短描述..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  内容
                </label>
                <textarea
                  value={itemForm.content}
                  onChange={(e) => setItemForm(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="详细记录..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  图标
                </label>
                <div className="flex gap-2 flex-wrap">
                  {['📝', '📖', '🎨', '🎵', '🏃', '📸', '🎁', '⭐'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setItemForm(prev => ({ ...prev, emoji }))}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                        itemForm.emoji === emoji 
                          ? 'bg-primary-100 dark:bg-primary-900/50 border-2 border-primary-500' 
                          : 'bg-gray-100 dark:bg-gray-700 border-2 border-transparent'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              
              <button
                onClick={handleSaveItem}
                disabled={!itemForm.title.trim()}
                className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

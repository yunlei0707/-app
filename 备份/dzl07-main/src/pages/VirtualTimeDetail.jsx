/**
 * 未来宝宝详情页
 * 展示单个专题的详细内容，支持添加用户内容
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock, Plus, Trash2, X, Share2, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { virtualTimeTopics } from '../data/virtualTimeData';
import { BabyHeader } from '../components/BabyHeader';
import { useApp } from '../store/AppContext';
import {
  getVirtualTimeContents,
  addVirtualTimeContent,
  deleteVirtualTimeContent,
  getCurrentV2Account,
  getCurrentBabyInfo,
  isSystemAccount as checkIsSystemAccount,
  getVirtualTimeCategories,
} from '../utils/dbV2';

export function VirtualTimeDetail() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useApp();
  
  const [userContents, setUserContents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContent, setNewContent] = useState({ title: '', content: '', emoji: '📝', images: [] });
  const [newImages, setNewImages] = useState([]);
  const [isSystemAccount, setIsSystemAccount] = useState(false);
  const [sharingItem, setSharingItem] = useState(null);
  const [isSharing, setIsSharing] = useState(false);
  const [viewingImages, setViewingImages] = useState(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const fileInputRef = useRef(null);
  const contentCardRef = useRef(null);
  
  // 获取专题信息
  const topic = virtualTimeTopics.find(t => t.id === topicId);
  
  // 加载用户内容（使用专题ID作为itemId）
  const loadContents = useCallback(() => {
    if (!topicId) return;
    
    const contents = getVirtualTimeContents(topicId, topicId);
    setUserContents(contents || []);
    setIsLoading(false);
  }, [topicId]);
  
  // 监听账号切换
  useEffect(() => {
    const updateInfo = () => {
      const babyInfo = getCurrentBabyInfo();
      const isV2 = !!babyInfo;
      const isSystem = isV2 && checkIsSystemAccount();
      setIsSystemAccount(isSystem);
      loadContents();
    };
    
    updateInfo();
    const interval = setInterval(updateInfo, 500);
    return () => clearInterval(interval);
  }, [loadContents]);
  
  // 处理图片上传
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (newImages.length + files.length > 9) {
      showToast('最多支持9张图片', 'error');
      return;
    }
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNewImages(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
    
    // 清空input，允许重复选择同一张图片
    e.target.value = '';
  };
  
  // 删除已选择的图片
  const handleRemoveNewImage = (index) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
  };
  
  // 添加内容
  const handleAddContent = useCallback(() => {
    if (!newContent.title.trim()) {
      showToast('请输入标题', 'error');
      return;
    }
    if (isSystemAccount) {
      showToast('系统账号不可修改', 'error');
      return;
    }
    
    addVirtualTimeContent(topicId, topicId, {
      title: newContent.title.trim(),
      content: newContent.content.trim(),
      emoji: newContent.emoji,
      images: newImages,
      date: new Date().toLocaleDateString('zh-CN')
    });
    
    showToast('已添加内容');
    setNewContent({ title: '', content: '', emoji: '📝', images: [] });
    setNewImages([]);
    setShowAddForm(false);
    loadContents();
  }, [topicId, newContent, newImages, isSystemAccount, showToast, loadContents]);
  
  // 删除内容
  const handleDeleteContent = useCallback((contentId) => {
    if (!confirm('确定要删除这条内容吗？')) return;
    
    const success = deleteVirtualTimeContent(topicId, topicId, contentId);
    if (success) {
      showToast('已删除');
      loadContents();
    } else {
      showToast('删除失败', 'error');
    }
  }, [topicId, showToast, loadContents]);
  
  // 生成分享图片
  const handleShareContent = useCallback(async (item) => {
    setSharingItem(item);
    setIsSharing(true);
    
    try {
      // 构建图片区域HTML
      let imagesHtml = '';
      const images = item.images || [];
      if (images.length > 0) {
        const gridStyle = images.length === 1
          ? 'display: flex; gap: 6px; margin-bottom: 16px;'
          : 'display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 16px;';
        
        const imgItems = images.map(img => {
          const imgStyle = images.length === 1
            ? 'width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px;'
            : 'width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px;';
          return `<img src="${img}" style="${imgStyle}" crossorigin="anonymous" />`;
        }).join('');
        
        imagesHtml = `<div style="${gridStyle}">${imgItems}</div>`;
      }

      // 创建分享卡片DOM
      const shareCard = document.createElement('div');
      shareCard.style.cssText = `
        width: 350px;
        padding: 24px;
        background: linear-gradient(135deg, #FF7B70 0%, #FF9B8E 100%);
        border-radius: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: white;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
      `;
      
      const content = `
        <div style="margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
          <div style="font-size: 48px;">${item.emoji || '📝'}</div>
          <div>
            <div style="font-size: 14px; opacity: 0.9;">未来宝宝 · ${topic.title}</div>
            <div style="font-size: 20px; font-weight: bold; margin-top: 4px;">${item.title}</div>
          </div>
        </div>
        ${imagesHtml}
        ${item.content ? `
        <div style="
          background: rgba(255,255,255,0.15);
          border-radius: 12px;
          padding: 16px;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 16px;
        ">
          ${item.content}
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; opacity: 0.9;">
          <span>📅 ${item.date || new Date().toLocaleDateString('zh-CN')}</span>
          <span>👶 宝贝时光</span>
        </div>
      `;
      
      shareCard.innerHTML = content;
      document.body.appendChild(shareCard);
      
      // 使用 html2canvas 生成图片
      const canvas = await html2canvas(shareCard, {
        backgroundColor: null,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      
      // 移除临时DOM
      document.body.removeChild(shareCard);
      
      // 转换为图片并下载
      const link = document.createElement('a');
      link.download = `宝贝时光_${topic.title}_${item.title}_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      showToast('图片已保存');
    } catch (error) {
      console.error('分享失败:', error);
      showToast('分享失败', 'error');
    } finally {
      setIsSharing(false);
      setSharingItem(null);
    }
  }, [topic, showToast]);
  
  if (!topic) {
    return (
      <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">专题不存在</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg"
          >
            返回
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900">
      {/* 头部 */}
      <header className={`bg-gradient-to-b ${topic.coverGradient} text-white safe-top relative`}>
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center opacity-20">
          <span className="text-[150px]">{topic.coverEmoji}</span>
        </div>
        
        <div className="relative px-4 pt-4 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">未来宝宝</span>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">{topic.title}</h1>
          <p className="text-white/80 text-sm">{topic.description}</p>
        </div>
      </header>
      
      {/* 账号切换器 */}
      <BabyHeader />
      
      {/* 添加按钮 */}
      {!isSystemAccount && (
        <div className="px-4 py-3">
          <button
            onClick={() => setShowAddForm(true)}
            className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            添加{topic.title}记录
          </button>
        </div>
      )}
      
      {/* 添加表单 */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white dark:bg-gray-800 rounded-t-3xl p-4 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">添加{topic.title}记录</h3>
              <button 
                onClick={() => {
                  setShowAddForm(false);
                  setNewImages([]);
                  setNewContent({ title: '', content: '', emoji: '📝', images: [] });
                }} 
                className="p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">标题</label>
                <input
                  type="text"
                  value={newContent.title}
                  onChange={(e) => setNewContent(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="记录标题..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">内容</label>
                <textarea
                  value={newContent.content}
                  onChange={(e) => setNewContent(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="详细记录..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 resize-none"
                />
              </div>
              
              {/* 图片上传 */}
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">图片（可选）</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {newImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {newImages.map((img, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveNewImage(index)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center text-white text-xs hover:bg-black/70"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {newImages.length < 9 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
                  >
                    <span>📷</span>
                    <span>添加图片</span>
                  </button>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">图标</label>
                <div className="flex gap-2 flex-wrap">
                  {['📝', '📖', '🎨', '🎵', '🏃', '📸', '🎁', '⭐', '🌟', '💫', '❤️', '👏'].map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => setNewContent(prev => ({ ...prev, emoji }))}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center ${
                        newContent.emoji === emoji
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
                onClick={handleAddContent}
                disabled={!newContent.title.trim()}
                className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 内容列表 */}
      <main className="px-4 py-4 max-w-lg mx-auto space-y-4">
        {/* 用户添加的内容 */}
        {userContents.length > 0 && (
          <>
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2">我的记录</h3>
            {userContents.map((item, index) => (
              <div
                key={item.id}
                className={`rounded-2xl overflow-hidden shadow-sm transition-all ${
                  item.is_linked 
                    ? 'bg-gradient-to-br from-white to-pink-50 dark:from-gray-800 dark:to-pink-900/20 border-2 border-pink-200 dark:border-pink-800 relative' 
                    : 'bg-white dark:bg-gray-800'
                }`}
                style={{ animationDelay: `${index * 0.1}s` }}
                title={item.is_linked ? '这条内容基于你添加的真实记录自动生成' : ''}
              >
                {/* 联动内容标识 */}
                {item.is_linked && (
                  <div className="px-4 pt-3 flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-gradient-to-r from-primary-500 to-amber-500 text-white text-xs font-medium rounded-full shadow-sm flex items-center gap-1">
                      💖 来自真实记录
                    </div>
                    <span className="text-xs text-pink-600 dark:text-pink-400">
                      本内容基于你添加的真实记录自动生成
                    </span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.is_linked 
                        ? 'bg-gradient-to-br from-pink-400 to-rose-400' 
                        : 'bg-gradient-to-br from-primary-400 to-primary-500'
                    }`}>
                      <span className="text-2xl">{item.emoji || '📝'}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
                        {item.content || '暂无详细描述'}
                      </p>
                      {/* 图片展示 */}
                      {item.images && item.images.length > 0 && (
                        <div 
                          className={`mt-3 grid gap-2 ${
                            item.images.length === 1 
                              ? 'grid-cols-1' 
                              : item.images.length === 2 
                                ? 'grid-cols-2' 
                                : 'grid-cols-3'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            const target = e.target;
                            if (target.tagName === 'IMG') {
                              const imgIndex = parseInt(target.dataset.index);
                              setViewingImages(item.images);
                              setViewingIndex(imgIndex || 0);
                            }
                          }}
                        >
                          {item.images.slice(0, 9).map((img, imgIndex) => (
                            <div 
                              key={imgIndex} 
                              className={`relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
                                item.images.length === 1 ? 'aspect-video' : 'aspect-square'
                              } ${item.images.length === 3 && imgIndex === 0 ? 'row-span-2 aspect-auto' : ''}`}
                            >
                              <img 
                                src={img} 
                                alt="" 
                                data-index={imgIndex}
                                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity" 
                              />
                              {imgIndex === 8 && item.images.length > 9 && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">
                                  +{item.images.length - 9}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-400">{item.date || '刚刚'}</span>
                        <div className="flex-1" />
                        <button
                          onClick={() => handleShareContent(item)}
                          disabled={isSharing && sharingItem?.id === item.id}
                          className="p-1.5 text-gray-400 hover:text-primary-500"
                        >
                          {isSharing && sharingItem?.id === item.id ? (
                            <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Share2 className="w-4 h-4" />
                          )}
                        </button>
                        {!item.is_linked && (
                          <button
                            onClick={() => handleDeleteContent(item.id)}
                            className="p-1.5 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* 预置内容 */}
        {topic.items && topic.items.length > 0 && (
          <>
            <h3 className="font-bold text-gray-700 dark:text-gray-300 mb-2 mt-4">推荐记录</h3>
            {topic.items.map((item, index) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${topic.coverGradient} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-2xl">{item.emoji || topic.coverEmoji}</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 dark:text-white">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
                        {item.description || item.content || '暂无描述'}
                      </p>
                      {item.date && (
                        <div className="flex items-center gap-2 mt-3">
                          <Clock className="w-4 h-4 text-gray-400" />
                          <span className="text-xs text-gray-400">{item.date}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
        
        {/* 空状态 */}
        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (!userContents.length && (!topic.items || !topic.items.length)) && (
          <div className="text-center py-12">
            <span className="text-6xl block mb-4 opacity-30">{topic.coverEmoji}</span>
            <p className="text-gray-500 dark:text-gray-400">还没有记录哦</p>
            {!isSystemAccount && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-4 px-6 py-2 bg-primary-500 text-white rounded-lg"
              >
                添加第一条记录
              </button>
            )}
          </div>
        )}
      </main>
      
      {/* 图片查看器 */}
      {viewingImages && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setViewingImages(null)}
        >
          <button 
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full"
            onClick={() => setViewingImages(null)}
          >
            <X className="w-6 h-6" />
          </button>
          
          {viewingImages.length > 1 && (
            <>
              <button 
                className="absolute left-4 p-2 text-white hover:bg-white/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingIndex(prev => prev > 0 ? prev - 1 : viewingImages.length - 1);
                }}
              >
                <span className="text-2xl">‹</span>
              </button>
              <button 
                className="absolute right-4 p-2 text-white hover:bg-white/20 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewingIndex(prev => prev < viewingImages.length - 1 ? prev + 1 : 0);
                }}
              >
                <span className="text-2xl">›</span>
              </button>
            </>
          )}
          
          <img 
            src={viewingImages[viewingIndex]} 
            alt=""
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          
          {viewingImages.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
              {viewingIndex + 1} / {viewingImages.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

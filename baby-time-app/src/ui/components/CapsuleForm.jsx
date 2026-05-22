/**
 * 给宝宝的信编辑表单组件
 */

import { useState } from 'react';
import { isSystemAccount } from "@utils/dbV2";
import { X, Image, Gift, AlertCircle } from 'lucide-react';

export function CapsuleForm({ capsule, onSave, onCancel, babyId }) {
  const [title, setTitle] = useState(capsule?.title || '');
  const [content, setContent] = useState(capsule?.content || '');
  const [photos, setPhotos] = useState(capsule?.photos || []);
  const [videos, setVideos] = useState([]);
  const [unlockType, setUnlockType] = useState('date');
  const [unlockDate, setUnlockDate] = useState('');
  const [quickOption, setQuickOption] = useState('');
  const [saving, setSaving] = useState(false);
  
  // 计算快速选项的日期
  const getQuickDate = (option) => {
    const now = new Date();
    
    switch (option) {
      case '1year':
        now.setFullYear(now.getFullYear() + 1);
        return now.toISOString().split('T')[0];
      case '5years':
        now.setFullYear(now.getFullYear() + 5);
        return now.toISOString().split('T')[0];
      case '18years':
        now.setFullYear(now.getFullYear() + 18);
        return now.toISOString().split('T')[0];
      default:
        return '';
    }
  };
  
  // 照片上传
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };
  
  // 视频上传 - 生成封面
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 1; // 取第1秒作为封面
    
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const coverImage = canvas.toDataURL('image/jpeg');
      const videoData = {
        cover: coverImage,
        name: file.name,
        size: file.size
      };
      
      setVideos(prev => [...prev, videoData]);
      URL.revokeObjectURL(video.src);
    };
  };
  
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleSubmit = async () => {
    // 系统账号不可添加胶囊记录
    if (isSystemAccount()) {
      alert("系统账号不可添加胶囊记录");
      return;
    }

    if (!title.trim()) {
      alert('请输入胶囊标题');
      return;
    }
    
    if (!content.trim() && photos.length === 0 && videos.length === 0) {
      alert('请添加内容、照片或视频');
      return;
    }
    
    if (!babyId) {
      alert('错误：未找到宝宝档案');
      return;
    }
    
    let finalUnlockDate = unlockDate;
    if (unlockType === 'quick' && quickOption) {
      finalUnlockDate = getQuickDate(quickOption);
    }
    
    if (!finalUnlockDate) {
      alert('请设置开启日期');
      return;
    }
    
    const capsuleData = {
      babyId: babyId,
      title: title.trim(),
      content: content.trim(),
      photos,
      videos,
      unlockDate: new Date(finalUnlockDate).toISOString(),
    };
    
    setSaving(true);
    
    try {
      if (typeof onSave === 'function') {
        await onSave(capsuleData);
      }
    } catch (error) {
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-cream-50 dark:bg-gray-900 z-50 overflow-y-auto">
      {/* 顶部导航 */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 z-10">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={onCancel} className="p-2 -ml-2">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-white">
            {capsule ? '编辑胶囊' : '创建给宝宝的信'}
          </h2>
          <button 
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-500 text-white rounded-lg font-medium text-sm hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      
      <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
        {/* 图标 */}
        <div className="flex justify-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-warm-400 rounded-full flex items-center justify-center shadow-lg">
            <Gift className="w-10 h-10 text-white" />
          </div>
        </div>
        
        {/* 提示 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              给宝宝的信将在设定日期后解锁，期间内容会被加密保存
            </p>
          </div>
        </div>
        
        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            胶囊标题 *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给胶囊起个名字..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        
        {/* 内容 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            想对未来说的话
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录此刻的心情、期望或祝福..."
            rows={6}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
          />
        </div>
        
        {/* 照片 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            添加照片
          </label>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 dark:bg-gray-700">
                  <img src={photo} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors">
              <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">添加照片</p>
            </div>
            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
          </label>
        </div>
        
        {/* 视频 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            添加视频
          </label>
          
          {videos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              {videos.map((video, index) => (
                <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-gray-800">
                  <img src={video.cover} alt="视频封面" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[14px] border-l-gray-800 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1" />
                    </div>
                  </div>
                  <button
                    onClick={() => removeVideo(index)}
                    className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <label className="block">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors">
              <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                <span className="text-2xl">🎬</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">添加视频</p>
            </div>
            <input type="file" accept="video/*" onChange={handleVideoUpload} className="hidden" />
          </label>
        </div>
        
        {/* 开启日期 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            开启日期 *
          </label>
          
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => { setUnlockType('quick'); setQuickOption('1year'); }}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                unlockType === 'quick' && quickOption === '1year'
                  ? 'bg-primary-500 text-white'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              1年后
            </button>
            <button
              onClick={() => { setUnlockType('quick'); setQuickOption('5years'); }}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                unlockType === 'quick' && quickOption === '5years'
                  ? 'bg-primary-500 text-white'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              5年后
            </button>
            <button
              onClick={() => { setUnlockType('quick'); setQuickOption('18years'); }}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                unlockType === 'quick' && quickOption === '18years'
                  ? 'bg-primary-500 text-white'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              18年后
            </button>
          </div>
          
          <button
            onClick={() => setUnlockType(unlockType === 'custom' ? 'date' : 'custom')}
            className="w-full py-2 rounded-lg text-sm bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 mb-3"
          >
            {unlockType === 'custom' ? '自定义日期' : '自定义日期'}
          </button>
          
          {(unlockType === 'date' || unlockType === 'custom') && (
            <input
              type="date"
              value={unlockDate}
              onChange={(e) => { setUnlockDate(e.target.value); setUnlockType('date'); }}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          )}
        </div>
      </div>
    </div>
  );
}

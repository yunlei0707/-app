/**
 * 成长记录表单组件
 */

import { useState, useRef } from 'react';
import { isSystemAccount } from "../repositories/stateRepository.js";
import { X, Image, Trash2 } from 'lucide-react';

export function GrowthRecordForm({ record, onSave, onCancel, babyId }) {
  const today = new Date().toISOString().split('T')[0];
  
  const [date, setDate] = useState(
    record?.date || today
  );
  const [height, setHeight] = useState(record?.height || '');
  const [weight, setWeight] = useState(record?.weight || '');
  const [headCircumference, setHeadCircumference] = useState(record?.headCircumference || '');
  const [footLength, setFootLength] = useState(record?.footLength || '');
  const [photos, setPhotos] = useState(record?.photos || []);
  const [note, setNote] = useState(record?.note || '');
  const [saving, setSaving] = useState(false);
  
  const fileInputRef = useRef(null);
  
  // 照片上传处理
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
  
  // 删除照片
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  // 提交表单
  const handleSubmit = async () => {
    // 系统账号不可添加成长记录
    if (isSystemAccount()) {
      alert('系统账号不可添加成长记录');
      return;
    }
    
    // 至少填一个数值才保存
    if (!height && !weight && !headCircumference && !footLength) {
      alert('请至少填写一项身体数据');
      return;
    }
    
    setSaving(true);
    try {
      const data = {
        babyId: record?.babyId || babyId,
        date,
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        headCircumference: headCircumference ? parseFloat(headCircumference) : null,
        footLength: footLength ? parseFloat(footLength) : null,
        photos,
        note: note.trim() || null,
      };
      
      if (record?.id) {
        data.id = record.id;
      }
      
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button 
            onClick={onCancel}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            <X className="w-6 h-6" />
          </button>
          <h1 className="font-medium text-gray-800 dark:text-white">
            {record?.id ? '编辑记录' : '记录成长'}
          </h1>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-500 text-white rounded-full text-sm font-medium disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>
      
      {/* 表单内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        {/* 日期 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
            日期
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={today}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>
        
        {/* 身体数据 */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
            身体数据（选填，有啥填啥）
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            {/* 身高 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span>📏</span> 身高
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="75.0"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
              </div>
            </div>
            
            {/* 体重 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span>⚖️</span> 体重
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="10.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">kg</span>
              </div>
            </div>
            
            {/* 头围 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span>🧠</span> 头围
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="46.0"
                  value={headCircumference}
                  onChange={(e) => setHeadCircumference(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
              </div>
            </div>
            
            {/* 脚长 */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span>👣</span> 脚长
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="12.0"
                  value={footLength}
                  onChange={(e) => setFootLength(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">cm</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* 照片上传 */}
        <div className="space-y-3">
          <label className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-400">
            <span>📷</span> 记录这一刻（选填）
          </label>
          
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img 
                    src={photo} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1 right-1 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {photos.length < 9 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-video border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors"
            >
              <Image className="w-8 h-8 mb-2" />
              <span className="text-sm">添加照片</span>
            </button>
          )}
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
        
        {/* 备注 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">
            备注（选填）
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="体检记录、身体状况等..."
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
          />
        </div>
      </div>
    </div>
  );
}

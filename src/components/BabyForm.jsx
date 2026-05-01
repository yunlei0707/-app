/**
 * 宝宝档案表单组件
 */

import { useState } from 'react';
import { X, User, Camera } from 'lucide-react';

export function BabyForm({ baby, onSave, onCancel }) {
  const [name, setName] = useState(baby?.name || '');
  const [nickname, setNickname] = useState(baby?.nickname || '');
  const [gender, setGender] = useState(baby?.gender || 'girl');
  const [birthDate, setBirthDate] = useState(
    baby?.birthDate 
      ? new Date(baby.birthDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [avatar, setAvatar] = useState(baby?.avatar || '');
  const [saving, setSaving] = useState(false);
  
  const handleAvatarUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('请输入宝宝姓名');
      return;
    }
    
    if (saving) return;
    
    setSaving(true);
    
    const babyData = {
      id: baby?.id,
      name: name.trim(),
      nickname: nickname.trim() || name.trim(),
      gender,
      birthDate: new Date(birthDate).toISOString(),
      avatar,
    };
    
    try {
      if (typeof onSave === 'function') {
        await onSave(babyData);
      }
      // 无论成功失败都重置状态
      setSaving(false);
    } catch (error) {
      alert('保存失败: ' + error.message);
      setSaving(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-cream-50 dark:bg-gray-900 z-50 overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 z-10 safe-top">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={onCancel} className="p-2 -ml-2">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-white">
            {baby ? '编辑宝宝信息' : '添加宝宝'}
          </h2>
          <button 
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-500 text-white rounded-lg font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      
      <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
        <div className="flex flex-col items-center">
          <label className="relative cursor-pointer group">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-cream-100 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>
            <div className="absolute bottom-1 right-1 w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </label>
          <p className="text-sm text-gray-500 mt-2">点击更换头像</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            宝宝姓名 *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="输入宝宝姓名"
            className="input-field"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            小名/昵称
          </label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="输入宝宝小名（选填）"
            className="input-field"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            性别
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setGender('girl')}
              className={`flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center ${
                gender === 'girl'
                  ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border-2 border-pink-400'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-500 border-2 border-transparent'
              }`}
            >
              <span className="text-2xl mb-1">👧</span>
              女宝宝
            </button>
            <button
              onClick={() => setGender('boy')}
              className={`flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center ${
                gender === 'boy'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-400'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-500 border-2 border-transparent'
              }`}
            >
              <span className="text-2xl mb-1">👦</span>
              男宝宝
            </button>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            出生日期 *
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="input-field"
          />
        </div>
      </div>
    </div>
  );
}

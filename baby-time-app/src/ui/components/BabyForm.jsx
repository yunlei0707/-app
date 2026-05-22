/**
 * 宝宝档案表单组件
 * 支持系统账号只读模式
 * 支持未出生宝宝（预产期）
 */

import { useState, useMemo } from 'react';
import { X, User, Camera } from 'lucide-react';
import { calculateZodiac, calculateConstellation } from '@utils/dateUtils';

// 出生时辰选项
const BIRTH_TIME_OPTIONS = [
  { value: '', label: '请选择（选填）' },
  { value: '子时', label: '子时 (23-1点)' },
  { value: '丑时', label: '丑时 (1-3点)' },
  { value: '寅时', label: '寅时 (3-5点)' },
  { value: '卯时', label: '卯时 (5-7点)' },
  { value: '辰时', label: '辰时 (7-9点)' },
  { value: '巳时', label: '巳时 (9-11点)' },
  { value: '午时', label: '午时 (11-13点)' },
  { value: '未时', label: '未时 (13-15点)' },
  { value: '申时', label: '申时 (15-17点)' },
  { value: '酉时', label: '酉时 (17-19点)' },
  { value: '戌时', label: '戌时 (19-21点)' },
  { value: '亥时', label: '亥时 (21-23点)' },
];

export function BabyForm({ baby, onSave, onCancel, isSystem = false }) {
  // 处理 birthDate 和 birthday 两种字段名
  const initialBirthday = baby?.birthday 
    ? new Date(baby.birthday).toISOString().split('T')[0]
    : baby?.birthDate
      ? new Date(baby.birthDate).toISOString().split('T')[0]
      : '';

  const initialDueDate = baby?.dueDate 
    ? new Date(baby.dueDate).toISOString().split('T')[0]
    : '';

  const [name, setName] = useState(baby?.name || '');
  const [nickname, setNickname] = useState(baby?.nickname || '');
  const [gender, setGender] = useState(baby?.gender || 'girl');
  const [birthDate, setBirthDate] = useState(initialBirthday);
  const [dueDate, setDueDate] = useState(initialDueDate);
  const [birthTime, setBirthTime] = useState(baby?.birthTime || '');
  const [birthHeight, setBirthHeight] = useState(baby?.birthHeight || '');
  const [birthWeight, setBirthWeight] = useState(baby?.birthWeight || '');
  const [birthplace, setBirthplace] = useState(baby?.birthplace || '');
  const [avatar, setAvatar] = useState(baby?.avatar || '');
  const [saving, setSaving] = useState(false);

  // 计算属相和星座
  const { zodiac, constellation } = useMemo(() => {
    const effectiveDate = birthDate || dueDate;
    const zodiacResult = calculateZodiac(effectiveDate);
    const constellationResult = calculateConstellation(effectiveDate);
    return {
      zodiac: zodiacResult,
      constellation: constellationResult,
    };
  }, [birthDate, dueDate]);

  // 判断是否未出生宝宝（有预产期但没有出生日期）
  const isUnborn = !birthDate && dueDate;

  const handleAvatarUpload = (e) => {
    if (isSystem) return;
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
    if (isSystem) return;
    
    if (!name.trim()) {
      alert('请输入宝宝姓名');
      return;
    }
    
    // 如果有预产期但没有出生日期，允许保存（未出生宝宝）
    // 如果有出生日期才需要验证（出生日期不能在未来）
    if (birthDate && new Date(birthDate) > new Date()) {
      alert('出生日期不能是未来日期');
      return;
    }
    
    if (saving) return;
    
    setSaving(true);
    
    const babyData = {
      id: baby?.id,
      name: name.trim(),
      nickname: nickname.trim() || name.trim(),
      gender,
      birthday: birthDate ? new Date(birthDate).toISOString() : '',
      dueDate: dueDate ? new Date(dueDate).toISOString() : '',
      birthTime,
      birthHeight: birthHeight ? parseFloat(birthHeight) : null,
      birthWeight: birthWeight ? parseFloat(birthWeight) : null,
      birthplace: birthplace.trim(),
      avatar,
    };
    
    try {
      if (typeof onSave === 'function') {
        await onSave(babyData);
      }
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
            {isSystem ? '查看宝宝信息' : (baby ? '编辑宝宝信息' : '添加宝宝')}
          </h2>
          {isSystem ? (
            <div className="w-16" />
          ) : (
            <button 
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-1.5 bg-primary-500 text-white rounded-lg font-medium text-sm hover:bg-primary-600 transition-colors disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          )}
        </div>
      </div>
      
      {/* 系统账号提示 */}
      {isSystem && (
        <div className="mx-4 mt-4 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
          <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
            ⚠️ 系统账号不可编辑，此为示例数据
          </p>
        </div>
      )}
      
      <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
        <div className="flex flex-col items-center">
          <div 
            className={`relative ${!isSystem ? 'cursor-pointer group' : ''}`}
            onClick={() => !isSystem && document.getElementById('baby-avatar-input')?.click()}
          >
            <div className="w-28 h-28 rounded-full overflow-hidden bg-cream-100 dark:bg-gray-700 border-4 border-white dark:border-gray-600 shadow-lg">
              {avatar ? (
                <img src={avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-12 h-12 text-gray-300" />
                </div>
              )}
            </div>
            {!isSystem && (
              <>
                <div className="absolute bottom-1 right-1 w-9 h-9 bg-primary-500 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5 text-white" />
                </div>
                <input
                  id="baby-avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </>
            )}
          </div>
          <p className={`text-sm mt-2 ${isSystem ? 'text-gray-400' : 'text-gray-500'}`}>
            {isSystem ? '系统示例' : '点击更换头像'}
          </p>
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
            disabled={isSystem}
            className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
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
            disabled={isSystem}
            className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            性别
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => !isSystem && setGender('girl')}
              disabled={isSystem}
              className={`flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center ${
                gender === 'girl'
                  ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 border-2 border-pink-400'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-500 border-2 border-transparent'
              } ${isSystem ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span className="text-2xl mb-1">👧</span>
              女宝宝
            </button>
            <button
              onClick={() => !isSystem && setGender('boy')}
              disabled={isSystem}
              className={`flex-1 py-4 rounded-xl font-medium transition-all flex flex-col items-center ${
                gender === 'boy'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-2 border-blue-400'
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-500 border-2 border-transparent'
              } ${isSystem ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <span className="text-2xl mb-1">👦</span>
              男宝宝
            </button>
          </div>
        </div>
        
        {/* 出生日期和预产期 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              出生日期
            </label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              disabled={isSystem}
              className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              预产期
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              disabled={isSystem}
              className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
            />
          </div>
        </div>
        
        {/* 未出生提示 */}
        {isUnborn && (
          <div className="px-4 py-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-purple-600 dark:text-purple-400 text-center">
              🤰 宝宝还没出生哦！记得出生后填写实际出生日期~
            </p>
          </div>
        )}
        
        {/* 属相和星座卡片 */}
        {(zodiac.name || constellation.name) && (
          <div className="grid grid-cols-2 gap-3">
            {zodiac.name && (
              <div className="bg-cream-100 dark:bg-gray-700 rounded-xl p-3 text-center opacity-70">
                <div className="text-2xl mb-1">{zodiac.emoji}</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {zodiac.name}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">属相</div>
              </div>
            )}
            {constellation.name && (
              <div className="bg-cream-100 dark:bg-gray-700 rounded-xl p-3 text-center opacity-70">
                <div className="text-2xl mb-1">{constellation.emoji}</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {constellation.name}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">星座</div>
              </div>
            )}
          </div>
        )}
        
        {/* 出生时辰 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            出生时辰
          </label>
          <select
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            disabled={isSystem}
            className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
          >
            {BIRTH_TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        
        {/* 出生身高体重 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              出生身高 (cm)
            </label>
            <input
              type="number"
              value={birthHeight}
              onChange={(e) => setBirthHeight(e.target.value)}
              placeholder="如：50"
              min="20"
              max="100"
              step="0.1"
              disabled={isSystem}
              className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              出生体重 (kg)
            </label>
            <input
              type="number"
              value={birthWeight}
              onChange={(e) => setBirthWeight(e.target.value)}
              placeholder="如：3.5"
              min="0.5"
              max="10"
              step="0.1"
              disabled={isSystem}
              className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
            />
          </div>
        </div>
        
        {/* 出生地 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            出生地
          </label>
          <input
            type="text"
            value={birthplace}
            onChange={(e) => setBirthplace(e.target.value)}
            placeholder="如：北京市朝阳区（选填）"
            disabled={isSystem}
            className={`input-field ${isSystem ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : ''}`}
          />
        </div>
      </div>
    </div>
  );
}

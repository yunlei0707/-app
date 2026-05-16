/**
 * 编辑宝宝信息弹窗
 * 支持修改昵称、生日、头像
 * 系统账号不可编辑
 */

import { useState, useEffect } from 'react';
import { X, Check, User, Calendar, Sparkles } from 'lucide-react';
import { updateUserAccountInfo, getIdentityData } from '../utils/dbV2';
import { safeGetItem } from '../utils/migration';

// 预设头像选项
const AVATAR_OPTIONS = ['👶', '👧', '👦', '🍼', '🌟', '🎀', '👑', '🦄', '🐻', '🐰', '🌸', '🎈'];

export function EditBabyModal({ isOpen, onClose, account, onSave }) {
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [avatar, setAvatar] = useState('👶');
  const [isSaving, setIsSaving] = useState(false);

  // 打开时初始化数据
  useEffect(() => {
    if (account && isOpen) {
      setName(account.name || '');
      setBirthday(account.birthday || '');
      setAvatar(account.avatar || '👶');
    }
  }, [account, isOpen]);

  if (!isOpen) return null;

  const isSystemAccount = account?.isSystem;

  // 保存修改
  const handleSave = async () => {
    if (isSystemAccount) return;
    
    setIsSaving(true);
    try {
      const userRole = safeGetItem('user_role', { name: '访客参观' });
      const success = updateUserAccountInfo(userRole.name, {
        name,
        birthday,
        avatar
      });
      
      if (success) {
        // 获取更新后的数据
        const updatedData = getIdentityData(userRole.name);
        const updatedAccount = updatedData.accounts.user;
        
        if (onSave) {
          onSave(updatedAccount);
        }
        
        onClose();
      }
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 遮罩 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* 弹窗主体 */}
      <div className="relative w-full sm:w-[400px] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* 头部 */}
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-800">宝宝信息</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* 系统账号提示 */}
        {isSystemAccount && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">系统示例账号</p>
                <p className="text-xs text-amber-600 mt-1">豆芽是系统预设的示例账号，信息不可编辑。你可以在自己的账号中自定义宝宝信息。</p>
              </div>
            </div>
          </div>
        )}

        {/* 表单内容 */}
        <div className="px-6 py-6 space-y-6">
          {/* 头像选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              宝宝头像
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  disabled={isSystemAccount}
                  onClick={() => setAvatar(emoji)}
                  className={`p-3 rounded-xl text-2xl transition-all ${
                    avatar === emoji
                      ? 'bg-pink-100 ring-2 ring-pink-500 scale-110'
                      : 'bg-gray-50 hover:bg-gray-100'
                  } ${isSystemAccount ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 昵称 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              宝宝昵称
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystemAccount}
                placeholder="给宝宝起个可爱的名字"
                maxLength={20}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border transition-colors ${
                  isSystemAccount
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none'
                }`}
              />
            </div>
          </div>

          {/* 生日 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              宝宝生日
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                disabled={isSystemAccount}
                max={new Date().toISOString().split('T')[0]}
                className={`w-full pl-11 pr-4 py-3 rounded-xl border transition-colors ${
                  isSystemAccount
                    ? 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-100 outline-none'
                }`}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={isSystemAccount || isSaving || !name.trim()}
            className={`w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 ${
              isSystemAccount || !name.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 active:scale-[0.98] shadow-lg shadow-pink-500/30'
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                {isSystemAccount ? '系统账号不可编辑' : '保存修改'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditBabyModal;

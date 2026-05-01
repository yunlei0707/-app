/**
 * 注册页面
 * 温馨可爱的UI风格，与宝贝时光主题一致
 * 支持头像选择
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, User, Lock, Eye, EyeOff, Baby, Check, X, Image } from 'lucide-react';
import { registerUser, PRESET_AVATARS } from '../utils/db';

export function RegisterPage({ onRegister }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: 基本信息, 2: 完善资料

  const fileInputRef = useState(null);

  // 密码强度检查
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { level: 0, text: '', color: '' };
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 8) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;

    const levels = [
      { level: 0, text: '', color: '' },
      { level: 1, text: '弱', color: 'bg-red-400' },
      { level: 2, text: '中等', color: 'bg-yellow-400' },
      { level: 3, text: '良好', color: 'bg-blue-400' },
      { level: 4, text: '强', color: 'bg-green-400' },
      { level: 5, text: '非常强', color: 'bg-green-500' },
    ];
    return levels[Math.min(strength, 5)];
  };

  const passwordStrength = getPasswordStrength(password);

  // 确认密码验证
  const passwordsMatch = confirmPassword && password === confirmPassword;
  const passwordsMismatch = confirmPassword && password !== confirmPassword;

  // 验证基本信息
  const validateBasicInfo = () => {
    if (!username.trim()) {
      setError('请输入用户名');
      return false;
    }
    if (username.length < 3) {
      setError('用户名至少需要3个字符');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('用户名只能包含字母、数字和下划线');
      return false;
    }
    if (!password) {
      setError('请输入密码');
      return false;
    }
    if (password.length < 6) {
      setError('密码至少需要6个字符');
      return false;
    }
    if (!confirmPassword) {
      setError('请确认密码');
      return false;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return false;
    }
    return true;
  };

  // 下一步
  const handleNextStep = () => {
    setError('');
    if (validateBasicInfo()) {
      setNickname(username);
      setStep(2);
    }
  };

  // 从相册选择头像
  const handleAvatarFromAlbum = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatar(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // 随机选择头像
  const handleRandomAvatar = () => {
    const randomIndex = Math.floor(Math.random() * PRESET_AVATARS.length);
    setAvatar(PRESET_AVATARS[randomIndex]);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    setIsLoading(true);
    try {
      const user = await registerUser(username, password, {
        nickname: nickname || username,
        avatar: avatar,
      });
      
      // 注册成功后自动登录，保存登录状态到 localStorage
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // 回调通知父组件
      if (onRegister) {
        onRegister(user);
      }
      
      // 跳转到首页
      navigate('/', { replace: true });
    } catch (err) {
      if (err.message === '用户名已存在') {
        setError('该用户名已被注册，请选择其他用户名');
      } else {
        setError(err.message || '注册失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream-50 to-orange-50 flex flex-col items-center justify-center px-4 safe-top safe-bottom py-8">
      {/* 装饰元素 */}
      <div className="absolute top-10 right-10 w-24 h-24 bg-primary-200/30 rounded-full blur-2xl" />
      <div className="absolute bottom-32 left-10 w-28 h-28 bg-orange-200/30 rounded-full blur-3xl" />
      
      {/* Logo 区域 */}
      <div className="mb-6 animate-bounce-in">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-500 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-200/50">
            <Baby className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-br from-orange-300 to-orange-400 rounded-full flex items-center justify-center shadow-sm">
            <Heart className="w-2.5 h-2.5 text-white fill-current" />
          </div>
        </div>
      </div>
      
      {/* 标题 */}
      <h1 className="text-2xl font-bold text-gray-800 mb-1">
        {step === 1 ? '创建账号' : '完善资料'}
      </h1>
      <p className="text-gray-500 mb-6">
        {step === 1 ? '开启宝宝成长记录之旅' : '选一个喜欢的头像吧'}
      </p>

      {/* 步骤指示器 */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-8 h-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
        <div className={`w-8 h-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
      </div>

      {/* 步骤1：基本信息 */}
      {step === 1 && (
        <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="w-full max-w-sm space-y-4">
          {/* 用户名输入 */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <User className="w-5 h-5" />
            </div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="设置用户名（3-20个字符）"
              className="input-field pl-12 pr-4"
              autoComplete="username"
              maxLength={20}
              disabled={isLoading}
            />
          </div>
          <p className="text-xs text-gray-400 -mt-2 ml-1">仅支持字母、数字和下划线</p>

          {/* 密码输入 */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="设置密码（至少6个字符）"
              className="input-field pl-12 pr-12"
              autoComplete="new-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {/* 密码强度指示器 */}
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      passwordStrength.level >= level ? passwordStrength.color : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              {passwordStrength.text && (
                <p className={`text-xs ${passwordStrength.level >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
                  密码强度：{passwordStrength.text}
                </p>
              )}
            </div>
          )}

          {/* 确认密码输入 */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <Lock className="w-5 h-5" />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码确认"
              className={`input-field pl-12 pr-12 ${
                passwordsMismatch ? 'border-red-400 focus:border-red-500' : 
                passwordsMatch ? 'border-green-400 focus:border-green-500' : ''
              }`}
              autoComplete="new-password"
              disabled={isLoading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
            {passwordsMatch && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2 text-green-500">
                <Check className="w-5 h-5" />
              </div>
            )}
            {passwordsMismatch && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2 text-red-500">
                <X className="w-5 h-5" />
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl animate-shake">
              {error}
            </div>
          )}

          {/* 下一步按钮 */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            下一步 →
          </button>
        </form>
      )}

      {/* 步骤2：完善资料 */}
      {step === 2 && (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          {/* 头像选择 */}
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center text-4xl overflow-hidden border-4 border-primary-200">
                {avatar ? (
                  avatar.startsWith('data:') || avatar.startsWith('http') ? (
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{avatar}</span>
                  )
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <button
                type="button"
                onClick={handleRandomAvatar}
                className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-primary-600 transition-colors"
              >
                🎲
              </button>
            </div>
            
            {/* 预设头像网格 */}
            <div className="grid grid-cols-6 gap-2 mb-3">
              {PRESET_AVATARS.slice(0, 12).map((a, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setAvatar(a)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl transition-all ${
                    avatar === a 
                      ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500 scale-110' 
                      : 'bg-cream-100 dark:bg-gray-700 hover:scale-105'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
            
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-primary-500 hover:text-primary-600 flex items-center justify-center gap-1 mx-auto"
            >
              <Image className="w-4 h-4" />
              从相册选择
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarFromAlbum}
              className="hidden"
            />
          </div>

          {/* 昵称输入 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              昵称（选填）
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="给自己取个昵称"
              className="input-field"
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl animate-shake">
              {error}
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 btn-secondary"
            >
              上一步
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>注册中...</span>
                </>
              ) : (
                <>
                  <Heart className="w-5 h-5" />
                  <span>完成注册</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* 登录链接 */}
      <div className="mt-6 flex items-center gap-2 text-sm">
        <span className="text-gray-400">已有账号？</span>
        <Link
          to="/login"
          className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
        >
          立即登录 →
        </Link>
      </div>

      {/* 服务条款提示 */}
      <p className="mt-4 text-xs text-gray-400 text-center max-w-xs">
        注册即表示同意我们的服务条款和隐私政策
      </p>
    </div>
  );
}

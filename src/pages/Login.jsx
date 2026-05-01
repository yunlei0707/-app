/**
 * 登录页面
 * 温馨可爱的UI风格，与宝贝时光主题一致
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Heart, User, Lock, Eye, EyeOff, Baby } from 'lucide-react';
import { loginUser } from '../utils/db';

export function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // 简单的表单验证
    if (!username.trim()) {
      setError('请输入用户名');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginUser(username, password);
      
      // 保存登录状态到 localStorage
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('currentUser', JSON.stringify(user));
      
      // 回调通知父组件
      if (onLogin) {
        onLogin(user);
      }
      
      // 跳转到首页
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || '登录失败，请检查用户名和密码');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-cream-50 to-orange-50 flex flex-col items-center justify-center px-4 safe-top safe-bottom">
      {/* 装饰元素 */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-primary-200/30 rounded-full blur-2xl" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-orange-200/30 rounded-full blur-3xl" />
      
      {/* Logo 区域 */}
      <div className="mb-8 animate-bounce-in">
        <div className="relative">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-500 rounded-3xl flex items-center justify-center shadow-lg shadow-primary-200/50">
            <Baby className="w-10 h-10 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-br from-orange-300 to-orange-400 rounded-full flex items-center justify-center shadow-sm animate-wiggle">
            <Heart className="w-3 h-3 text-white fill-current" />
          </div>
        </div>
      </div>
      
      {/* 标题 */}
      <h1 className="text-2xl font-bold text-gray-800 mb-2">欢迎回来</h1>
      <p className="text-gray-500 mb-8">记录宝宝成长的美好时光</p>

      {/* 登录表单 */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
        {/* 用户名输入 */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <User className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名"
            className="input-field pl-12 pr-4"
            autoComplete="username"
            disabled={isLoading}
          />
        </div>

        {/* 密码输入 */}
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Lock className="w-5 h-5" />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            className="input-field pl-12 pr-12"
            autoComplete="current-password"
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

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl animate-shake">
            {error}
          </div>
        )}

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>登录中...</span>
            </>
          ) : (
            <>
              <Heart className="w-5 h-5" />
              <span>登录</span>
            </>
          )}
        </button>
      </form>

      {/* 注册链接 */}
      <div className="mt-8 flex items-center gap-2 text-sm">
        <span className="text-gray-400">还没有账号？</span>
        <Link
          to="/register"
          className="text-primary-500 hover:text-primary-600 font-medium transition-colors"
        >
          立即注册 →
        </Link>
      </div>

      {/* 跳过登录提示 */}
      <button
        onClick={() => navigate('/', { replace: true })}
        className="mt-6 text-sm text-gray-400 hover:text-gray-600 transition-colors"
      >
        游客模式登录
      </button>
    </div>
  );
}

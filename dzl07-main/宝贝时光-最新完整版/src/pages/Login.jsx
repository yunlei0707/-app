/**
 * 登录页面 - 亲属角色选择模式
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Baby, Camera, X, User, Users, Smile, Eye } from 'lucide-react';

// 亲属角色配置
const FAMILY_ROLES = [
  { id: 'father', name: '无敌奶爸', icon: '👨', color: 'from-blue-400 to-blue-500', welcome: '欢迎爸爸光临' },
  { id: 'mother', name: '温柔宝妈', icon: '👩', color: 'from-pink-400 to-pink-500', welcome: '欢迎妈妈光临' },
  { id: 'grandpa', name: '慈祥姥爷', icon: '👴', color: 'from-amber-400 to-amber-500', welcome: '欢迎姥爷光临' },
  { id: 'grandma', name: '和蔼姥姥', icon: '👵', color: 'from-rose-400 to-rose-500', welcome: '欢迎姥姥光临' },
  { id: 'uncle', name: '帅气老舅', icon: '🧔', color: 'from-indigo-400 to-indigo-500', welcome: '欢迎舅舅光临' },
  { id: 'aunt', name: '漂亮小姨', icon: '💃', color: 'from-fuchsia-400 to-fuchsia-500', welcome: '欢迎小姨光临' },
  { id: 'grandpa-father', name: '慈祥爷爷', icon: '👴🏻', color: 'from-orange-400 to-orange-500', welcome: '欢迎爷爷光临' },
  { id: 'baby', name: '宝宝本人', icon: '👶', color: 'from-yellow-400 to-yellow-500', welcome: '欢迎宝宝光临' },
  { id: 'guest', name: '访客参观', icon: '👀', color: 'from-gray-400 to-gray-500', welcome: '欢迎您来参观' },
];

export function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(null);
  const [customBg, setCustomBg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 从 localStorage 恢复状态
  useState(() => {
    const savedRole = localStorage.getItem('selectedFamilyRole');
    const savedBg = localStorage.getItem('customBackground');
    if (savedRole) {
      const role = FAMILY_ROLES.find(r => r.id === savedRole);
      if (role) setSelectedRole(role);
    }
    if (savedBg) {
      setCustomBg(savedBg);
    }
  });

  // 保存选择的角色
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    localStorage.setItem('selectedFamilyRole', role.id);
  };

  // 处理背景图上传
  const handleBgUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const bg = event.target.result;
        setCustomBg(bg);
        localStorage.setItem('customBackground', bg);
      };
      reader.readAsDataURL(file);
    }
  };

  // 清除自定义背景
  const clearCustomBg = () => {
    setCustomBg(null);
    localStorage.removeItem('customBackground');
  };

  // 登录
  const handleLogin = async () => {
    if (!selectedRole) return;
    
    setIsLoading(true);

    const user = {
      id: `user-${selectedRole.id}`,
      name: selectedRole.name,
      role: selectedRole.id,
      welcome: selectedRole.welcome,
      avatar: selectedRole.icon,
    };

    // 保存登录状态到 localStorage
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(user));

    // 模拟登录延迟
    setTimeout(() => {
      if (typeof onLogin === 'function') {
        onLogin(user);
      }
      navigate('/');
    }, 300);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* 背景渐变 */}
      <div 
        className="absolute inset-0 bg-gradient-to-br transition-all duration-500"
        style={{
          background: customBg 
            ? `url(${customBg}) center/cover no-repeat`
            : selectedRole 
              ? `linear-gradient(135deg, var(--tw-gradient-stops))` 
              : 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 50%, #fbcfe8 100%)',
          '--tw-gradient-stops': selectedRole 
            ? `var(--color-${selectedRole.color.split('-')[0]}-400), var(--color-${selectedRole.color.split('-')[1]}-500)`
            : undefined,
        }}
      />
      
      {/* 遮罩层 - 有自定义背景时使用深色遮罩 */}
      {customBg && (
        <div className="absolute inset-0 bg-black bg-opacity-40" />
      )}

      {/* 内容 */}
      <div className="relative z-10 flex-1 flex flex-col px-6 py-12">
        {/* Logo区域 */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 mx-auto bg-white rounded-2xl shadow-xl flex items-center justify-center mb-4">
            <Baby className="w-12 h-12 text-pink-500" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">宝贝时光</h1>
          <p className="text-gray-600">记录宝宝成长的每一个珍贵瞬间</p>
        </div>

        {/* 角色选择 */}
        <div className="flex-1">
          <h2 className="text-center text-lg font-semibold text-gray-700 mb-6">请选择您的身份</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            {FAMILY_ROLES.map((role) => (
              <button
                key={role.id}
                onClick={() => handleRoleSelect(role)}
                className={`flex flex-col items-center p-4 rounded-2xl transition-all duration-200 ${
                  selectedRole?.id === role.id
                    ? 'bg-white shadow-lg scale-105 ring-2 ring-offset-2 ring-pink-500'
                    : 'bg-white bg-opacity-60 hover:bg-opacity-100 hover:shadow-md'
                }`}
              >
                <span className="text-3xl mb-2">{role.icon}</span>
                <span className="text-sm font-medium text-gray-700">{role.name}</span>
              </button>
            ))}
          </div>

          {/* 自定义背景上传 */}
          <div className="mb-6">
            <label className="flex items-center justify-center gap-2 py-3 px-4 bg-white bg-opacity-60 rounded-xl cursor-pointer hover:bg-opacity-100 transition-all">
              <Camera className="w-5 h-5 text-gray-600" />
              <span className="text-sm text-gray-700">
                {customBg ? '更换登录背景图' : '自定义登录背景图'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleBgUpload}
                className="hidden"
              />
            </label>
            {customBg && (
              <button
                onClick={clearCustomBg}
                className="w-full mt-2 text-sm text-red-500 hover:text-red-600 text-center"
              >
                清除背景图
              </button>
            )}
          </div>
        </div>

        {/* 登录按钮 */}
        <button
          onClick={handleLogin}
          disabled={!selectedRole || isLoading}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-200 ${
            selectedRole
              ? 'bg-white text-gray-800 shadow-lg hover:shadow-xl active:scale-98'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? '登录中...' : selectedRole ? `以${selectedRole.name}身份进入` : '请先选择身份'}
        </button>

        {/* 底部提示 */}
        <div className="text-center mt-6 text-sm text-gray-500">
          <Heart className="w-4 h-4 inline mx-1 text-red-500" />
          用爱记录宝宝的每一次成长
        </div>
      </div>
    </div>
  );
}

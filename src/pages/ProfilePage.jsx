/**
 * 个人中心页面
 * 包含数据导入导出、主题切换、资料编辑、里程碑管理等功能
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { 
  Moon, Sun, Download, Upload, Trash2, ChevronRight, Heart, LogOut, User, 
  Palette, Tag, Edit3, Plus, X, Check, Image, Users, Trophy, Sparkles, Copy, Check as CheckIcon, Settings
} from 'lucide-react';
import { exportAllData, importAllData, PRESET_AVATARS, generateInviteToken } from '../utils/db';
import { calculateAge } from '../utils/dateUtils';
import { MusicPlayer } from '../components/MusicPlayer';

// 主题预设配置
const THEME_PRESETS = [
  { id: 'pink', name: '默认粉橙', color: '#FF7B70', gradient: 'from-primary-400 to-primary-500' },
  { id: 'forest', name: '森林绿', color: '#34D399', gradient: 'from-emerald-400 to-emerald-500' },
  { id: 'ocean', name: '海洋蓝', color: '#60A5FA', gradient: 'from-blue-400 to-blue-500' },
  { id: 'lavender', name: '薰衣草紫', color: '#A78BFA', gradient: 'from-violet-400 to-violet-500' },
  { id: 'sunshine', name: '暖阳黄', color: '#FBBF24', gradient: 'from-amber-400 to-amber-500' },
];

// 里程碑emoji选项
const EMOJI_OPTIONS = ['⭐', '🌱', '💪', '📚', '✨', '🎈', '🎀', '🌟', '💫', '🌈', '☀️', '🌙', '❤️', '🎉', '👏', '🦋', '🌸', '🍀'];

export function ProfilePage({ onEditBaby, onAddBaby }) {
  const navigate = useNavigate();
  const { 
    currentBaby, 
    babies,
    setBabies,
    setMoments,
    setCapsules,
    theme, 
    themePreset,
    customThemeColor,
    toggleTheme, 
    setTheme,
    showToast,
    currentUser,
    logout,
    updateUserProfile,
    customMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    getAllMilestones,
  } = useApp();
  
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);
  
  // 状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState({ label: '', emoji: '⭐', color: '#FF7B70' });
  
  // 邀约打卡状态
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  // 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  
  // 个人资料编辑状态
  const [editProfile, setEditProfile] = useState({
    nickname: '',
    avatar: '',
    signature: ''
  });
  
  // 导入模式
  const [importMode, setImportMode] = useState('merge');
  const [importFile, setImportFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  
  // 下拉刷新状态
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  const containerRef = useRef(null);
  
  // 初始化编辑资料
  useEffect(() => {
    if (currentUser) {
      setEditProfile({
        nickname: currentUser.nickname || '',
        avatar: currentUser.avatar || '',
        signature: currentUser.signature || ''
      });
    }
  }, [currentUser]);

  // 刷新数据
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const { getAllBabies, getMomentsByBaby, getCapsulesByBaby } = await import('../utils/db');
      const allBabies = await getAllBabies();
      setBabies(allBabies);
      
      if (currentBaby?.id) {
        const [updatedMoments, updatedCapsules] = await Promise.all([
          getMomentsByBaby(currentBaby.id),
          getCapsulesByBaby(currentBaby.id)
        ]);
        setMoments(updatedMoments);
        setCapsules(updatedCapsules);
      }
      
      showToast('已刷新');
    } catch (error) {
      showToast('刷新失败', 'error');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [currentBaby, isRefreshing, setBabies, setMoments, setCapsules, showToast]);
  
  // 下拉刷新手势处理
  const handleTouchStart = useCallback((e) => {
    touchStartY.current = e.touches[0].clientY;
    if (containerRef.current) {
      scrollTop.current = containerRef.current.scrollTop;
    }
  }, []);
  
  const handleTouchMove = useCallback((e) => {
    if (isRefreshing) return;
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    
    if (scrollTop.current <= 0 && diff > 0) {
      const dampened = Math.min(diff * 0.3, 100);
      setPullDistance(dampened);
    } else {
      setPullDistance(0);
    }
  }, [isRefreshing]);
  
  const handleTouchEnd = useCallback(() => {
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, handleRefresh]);
  
  // 打开邀约打卡弹窗
  const handleOpenInvite = () => {
    if (!currentBaby?.id) {
      showToast('请先创建宝宝档案', 'error');
      return;
    }
    const token = generateInviteToken(currentBaby.id);
    const baseUrl = window.location.origin;
    setInviteLink(`${baseUrl}/invite?babyId=${currentBaby.id}&token=${token}`);
    setShowInviteModal(true);
  };
  
  // 复制邀请链接
  const handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast('链接已复制，快去分享给亲戚吧~');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast('复制失败，请手动复制', 'error');
    }
  };
  
  // 导出数据
  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `宝贝时光-备份-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('数据导出成功！');
    } catch (error) {
      showToast('导出失败，请重试', 'error');
    }
  };
  
  // 处理导入文件选择
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        showToast('请选择 JSON 文件', 'error');
        return;
      }
      setImportFile(file);
      setShowImportModal(true);
    }
  };
  
  // 执行数据导入
  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const text = await importFile.text();
      const data = JSON.parse(text);
      
      if (!data.version || !data.data) {
        throw new Error('无效的备份文件');
      }
      
      await importAllData(data, importMode);
      showToast('数据导入成功！');
      setShowImportModal(false);
      
      // 刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      showToast(error.message || '导入失败，请重试', 'error');
    } finally {
      setIsImporting(false);
    }
  };
  
  // 切换主题
  const handleThemeChange = async (preset, customColor = null) => {
    await setTheme(preset, customColor);
    showToast('主题已更换');
  };
  
  // 保存资料编辑
  const handleSaveProfile = async () => {
    try {
      await updateUserProfile(editProfile);
      showToast('资料已更新');
      setShowProfileModal(false);
    } catch (error) {
      showToast('保存失败', 'error');
    }
  };
  
  // 选择头像
  const handleSelectAvatar = (avatar) => {
    setEditProfile(prev => ({ ...prev, avatar }));
  };
  
  // 从相册选择头像
  const handleAvatarFromAlbum = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditProfile(prev => ({ ...prev, avatar: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };
  
  // 打开里程碑编辑
  const handleEditMilestone = (milestone = null) => {
    if (milestone) {
      setEditingMilestone(milestone);
      setMilestoneForm({
        label: milestone.label,
        emoji: milestone.emoji,
        color: milestone.color || '#FF7B70'
      });
    } else {
      setEditingMilestone(null);
      setMilestoneForm({ label: '', emoji: '⭐', color: '#FF7B70' });
    }
    setShowMilestoneModal(true);
  };
  
  // 保存里程碑
  const handleSaveMilestone = async () => {
    if (!milestoneForm.label.trim()) {
      showToast('请输入标签名称', 'error');
      return;
    }
    
    try {
      if (editingMilestone) {
        await updateMilestone(editingMilestone.id, milestoneForm);
        showToast('标签已更新');
      } else {
        await addMilestone(milestoneForm);
        showToast('标签已添加');
      }
      setShowMilestoneModal(false);
    } catch (error) {
      showToast('保存失败', 'error');
    }
  };
  
  // 删除里程碑
  const handleDeleteMilestone = async (id) => {
    if (!window.confirm('确定要删除这个标签吗？')) return;
    
    try {
      await deleteMilestone(id);
      showToast('标签已删除');
    } catch (error) {
      showToast('删除失败', 'error');
    }
  };
  
  // 删除宝宝
  const handleDeleteBaby = async () => {
    if (!currentBaby) return;
    
    try {
      const { deleteBaby, getAllBabies } = await import('../utils/db');
      await deleteBaby(currentBaby.id);
      const allBabies = await getAllBabies();
      setBabies(allBabies);
      setShowDeleteConfirm(false);
      showToast('已删除');
      window.location.reload();
    } catch (error) {
      showToast('删除失败', 'error');
    }
  };
  
  // 退出登录
  const handleLogout = () => {
    if (window.confirm('确定要退出登录吗？')) {
      logout();
      navigate('/login', { replace: true });
    }
  };
  
  return (
    <div 
      ref={containerRef}
      className="min-h-screen pb-20"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 下拉刷新指示器 */}
      {(pullDistance > 0 || isRefreshing) && (
        <div 
          className="flex items-center justify-center py-3 text-gray-400 transition-transform"
          style={{ transform: `translateY(${pullDistance}px)` }}
        >
          {isRefreshing ? (
            <div className="animate-spin w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full" />
          ) : (
            <div 
              className="w-5 h-5 border-2 border-gray-300 border-t-primary-400 rounded-full transition-transform"
              style={{ transform: `rotate(${pullDistance * 3}deg)` }}
            />
          )}
        </div>
      )}
      
      {/* 头部 */}
      <header className="bg-gradient-to-b from-primary-400 to-primary-500 text-white safe-top">
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">👤 我的</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
              <div 
                className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl overflow-hidden cursor-pointer"
                onClick={() => setShowProfileModal(true)}
              >
                {currentUser?.avatar ? (
                  currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.avatar}</span>
                  )
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
          </div>
          
          {/* 用户信息 */}
          <div 
            className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm mb-3 cursor-pointer hover:bg-white/15 transition-colors"
            onClick={() => setShowProfileModal(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl overflow-hidden">
                {currentUser?.avatar ? (
                  currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.avatar}</span>
                  )
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2 className="font-bold">{currentUser?.nickname || currentUser?.username || '用户'}</h2>
                <p className="text-white/70 text-sm">@{currentUser?.username}</p>
                {currentUser?.signature && (
                  <p className="text-white/60 text-xs mt-1">{currentUser.signature}</p>
                )}
              </div>
              <Edit3 className="w-5 h-5 text-white/60" />
            </div>
          </div>
          
          {/* 宝宝信息 - 横向滚动卡片 */}
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2 -mx-4 px-4">
            {/* 当前宝宝卡片 */}
            {currentBaby && (
              <div 
                className="flex-shrink-0 w-28 bg-white/20 rounded-2xl p-3 backdrop-blur-sm cursor-pointer hover:bg-white/25 transition-all active:scale-95"
                onClick={() => onEditBaby(currentBaby)}
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/10 mb-2">
                  {currentBaby.avatar ? (
                    <img src={currentBaby.avatar} alt={currentBaby.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      👶
                    </div>
                  )}
                </div>
                <p className="text-white text-sm font-bold text-center truncate">{currentBaby.nickname || currentBaby.name}</p>
                <p className="text-white/70 text-xs text-center">{calculateAge(currentBaby.birthDate)}</p>
              </div>
            )}
            
            {/* 其他宝宝卡片 */}
            {babies.filter(b => b.id !== currentBaby?.id).map(baby => (
              <div 
                key={baby.id}
                className="flex-shrink-0 w-28 bg-white/10 rounded-2xl p-3 backdrop-blur-sm cursor-pointer hover:bg-white/15 transition-all active:scale-95"
                onClick={() => handleSwitchBaby(baby.id)}
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-white/10 mb-2">
                  {baby.avatar ? (
                    <img src={baby.avatar} alt={baby.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      👶
                    </div>
                  )}
                </div>
                <p className="text-white text-sm font-bold text-center truncate">{baby.nickname || baby.name}</p>
                <p className="text-white/70 text-xs text-center">{calculateAge(baby.birthDate)}</p>
              </div>
            ))}
            
            {/* 添加宝宝卡片 */}
            <button
              onClick={onAddBaby}
              className="flex-shrink-0 w-28 h-36 bg-white/10 rounded-2xl border-2 border-dashed border-white/30 flex flex-col items-center justify-center gap-1 hover:bg-white/15 transition-all active:scale-95"
            >
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-white/80 text-xs">添加宝宝</span>
            </button>
          </div>
        </div>
      </header>
      
      {/* 功能列表 */}
      <main className="px-4 -mt-4 max-w-lg mx-auto">

        {/* 音乐播放器卡片 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">🎵 背景音乐</h3>
          <MusicPlayer />
        </div>
        
        {/* 邀约打卡 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.03s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            邀约打卡
          </h3>
          
          {/* 生成邀请链接 */}
          <button
            onClick={handleOpenInvite}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary-500" />
              <span className="text-gray-700 dark:text-gray-200">邀请亲友打卡</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          
          {/* 查看来访排行 */}
          <button
            onClick={() => navigate('/invite')}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-gray-700 dark:text-gray-200">来访排行榜</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 个性化设置 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">个性化</h3>
          
          {/* 主题切换 */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-purple-500" />
              <span className="text-gray-700 dark:text-gray-200">主题风格</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: themePreset === 'custom' ? customThemeColor : (THEME_PRESETS.find(t => t.id === themePreset)?.color || '#FF7B70') }}
              />
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          
          {/* 里程碑管理 */}
          <button
            onClick={() => handleEditMilestone(null)}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-orange-500" />
              <span className="text-gray-700 dark:text-gray-200">里程碑标签</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-sm">
              <span>{getAllMilestones().length}个</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
          
        
        {/* 邀约打卡 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.03s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            邀约打卡
          </h3>
          
          {/* 生成邀请链接 */}
          <button
            onClick={handleOpenInvite}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary-500" />
              <span className="text-gray-700 dark:text-gray-200">邀请亲友打卡</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          
          {/* 查看来访排行 */}
          <button
            onClick={() => navigate('/invite')}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span className="text-gray-700 dark:text-gray-200">来访排行榜</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 个性化设置 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.05s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">个性化</h3>
          
          {/* 主题切换 */}
          <button
            onClick={() => setShowThemeModal(true)}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-purple-500" />
              <span className="text-gray-700 dark:text-gray-200">主题风格</span>
            </div>
            <div className="flex items-center gap-2">
              <div 
                className="w-5 h-5 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: themePreset === 'custom' ? customThemeColor : (THEME_PRESETS.find(t => t.id === themePreset)?.color || '#FF7B70') }}
              />
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </div>
          </button>
          
          {/* 里程碑管理 */}
          <button
            onClick={() => handleEditMilestone(null)}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Tag className="w-5 h-5 text-orange-500" />
              <span className="text-gray-700 dark:text-gray-200">里程碑标签</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400 text-sm">
              <span>{getAllMilestones().length}个</span>
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
          
            </div>
            <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
              theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300'
            }`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </div>
          </button>
        </div>
        
        {/* 数据管理 */}

        {/* 音乐播放器卡片 */}
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.08s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">🎵 背景音乐</h3>
          <MusicPlayer />
        </div>
        <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">数据管理</h3>
          
          {/* 导出数据 */}
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-green-500" />
              <span className="text-gray-700 dark:text-gray-200">导出数据</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          
          {/* 导入数据 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Upload className="w-5 h-5 text-blue-500" />
              <span className="text-gray-700 dark:text-gray-200">导入数据</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {/* 删除档案 */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full flex items-center justify-between py-3 hover:bg-red-50 dark:hover:bg-red-900/20 -mx-4 px-4 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5 text-red-500" />
              <span className="text-red-500">删除宝宝档案</span>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        
        {/* 关于 */}
        <div className="card animate-fade-in" style={{ animationDelay: '0.15s' }}>
          <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">关于</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700 dark:text-gray-200">版本</span>
              <span className="text-gray-500">1.1.0</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-gray-700 dark:text-gray-200">存储方式</span>
              <span className="text-gray-500">本地 IndexedDB</span>
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-cream-50 dark:bg-gray-700 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
              <Heart className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
              <span>
                宝贝时光是一款纯本地存储的应用，所有数据仅保存在您的设备中，
                不上传至任何服务器，充分保护您的隐私。
              </span>
            </p>
          </div>
        </div>
        
        {/* 退出登录 */}
        <div className="card mt-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>退出登录</span>
          </button>
        </div>
        

      {/* 设置面板抽屉 */}
      {showSettings && (
        <div 
          className="fixed inset-0 z-50"
          onClick={() => setShowSettings(false)}
        >
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />
          
          {/* 抽屉内容 */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-gray-800 animate-slide-in-right shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 p-4 z-10">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800 dark:text-white">设置</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-10 h-10 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* 深夜模式 */}
              <div className="card">
                <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">显示</h3>
                <button
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {theme === 'dark' ? (
                      <Moon className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <Sun className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="text-gray-700 dark:text-gray-200">深夜模式</span>
                  </div>
                  <div className={`w-12 h-7 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-primary-500' : 'bg-gray-300'}`}>
                    <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                </button>
              </div>
              
              {/* 数据管理 */}
              <div className="card">
                <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">数据管理</h3>
                
                <button
                  onClick={handleExport}
                  className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Download className="w-5 h-5 text-green-500" />
                    <span className="text-gray-700 dark:text-gray-200">导出数据</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between py-3 hover:bg-cream-50 dark:hover:bg-gray-700 -mx-4 px-4 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Upload className="w-5 h-5 text-blue-500" />
                    <span className="text-gray-700 dark:text-gray-200">导入数据</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center justify-between py-3 hover:bg-red-50 dark:hover:bg-red-900/20 -mx-4 px-4 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 className="w-5 h-5 text-red-500" />
                    <span className="text-red-500">删除宝宝档案</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              
              {/* 关于 */}
              <div className="card">
                <h3 className="font-medium text-gray-600 dark:text-gray-400 mb-3">关于</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-700 dark:text-gray-200">版本</span>
                    <span className="text-gray-500">1.1.0</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-gray-700 dark:text-gray-200">存储方式</span>
                    <span className="text-gray-500">本地 IndexedDB</span>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-cream-50 dark:bg-gray-700 rounded-xl">
                  <p className="text-sm text-gray-500 dark:text-gray-400 flex items-start gap-2">
                    <Heart className="w-4 h-4 text-primary-500 mt-0.5 flex-shrink-0" />
                    <span>
                      宝贝时光是一款纯本地存储的应用，所有数据仅保存在您的设备中，
                      不上传至任何服务器，充分保护您的隐私。
                    </span>
                  </p>
                </div>
              </div>
              
              {/* 退出登录 */}
              <div className="card">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* 底部信息 */}
        <div className="text-center py-8 text-gray-400 text-sm">
          <p>Made with ❤️ for families</p>
          <p className="mt-1">© 2024 宝贝时光</p>
        </div>
      </main>
      
      {/* 邀约打卡弹窗 */}
      {showInviteModal && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowInviteModal(false)}
        >
          <div 
            className="modal-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                邀请亲友打卡
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              复制下方链接发送给亲戚朋友，他们可以来为宝宝打卡送祝福~
            </p>
            
            <div className="bg-cream-50 dark:bg-gray-700 rounded-xl p-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">邀请链接</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 break-all">
                {inviteLink}
              </p>
            </div>
            
            <button
              onClick={handleCopyInviteLink}
              className={`w-full py-3 rounded-xl font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                copied 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700'
              }`}
            >
              {copied ? (
                <>
                  <CheckIcon className="w-5 h-5" />
                  已复制到剪贴板
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  复制链接
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-3">
              💡 同一称呼每天只能打卡一次，每次+1积分
            </p>
          </div>
        </div>
      )}
      
      {/* 删除确认弹窗 */}
      {showDeleteConfirm && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white text-center mb-2">
              确定要删除吗？
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
              删除"{currentBaby?.name}"的档案将同时删除所有相关记录，此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleDeleteBaby}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-6 rounded-xl transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 主题选择弹窗 */}
      {showThemeModal && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowThemeModal(false)}
        >
          <div 
            className="modal-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">选择主题风格</h3>
              <button onClick={() => setShowThemeModal(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            {/* 预设主题 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {THEME_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => handleThemeChange(preset.id)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    themePreset === preset.id ? 'border-primary-500' : 'border-transparent bg-cream-100 dark:bg-gray-700'
                  }`}
                >
                  <div className={`w-full h-12 rounded-lg bg-gradient-to-br ${preset.gradient} mb-2`} />
                  <span className="text-sm text-gray-700 dark:text-gray-200">{preset.name}</span>
                </button>
              ))}
            </div>
            
            {/* 自定义颜色 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">自定义颜色</h4>
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: customThemeColor || '#FF7B70' }}
                  onClick={() => colorInputRef.current?.click()}
                >
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <input
                  ref={colorInputRef}
                  type="color"
                  value={customThemeColor || '#FF7B70'}
                  onChange={(e) => handleThemeChange('custom', e.target.value)}
                  className="hidden"
                />
                <span className="text-sm text-gray-500">
                  选择一个颜色作为主题色
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* 导入确认弹窗 */}
      {showImportModal && (
        <div 
          className="modal-backdrop"
          onClick={() => { setShowImportModal(false); setImportFile(null); }}
        >
          <div 
            className="modal-content"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">导入数据</h3>
              <button onClick={() => { setShowImportModal(false); setImportFile(null); }}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              文件: {importFile?.name}
            </p>
            
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">导入模式</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge"
                    checked={importMode === 'merge'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-200">合并（追加现有数据）</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={(e) => setImportMode(e.target.value)}
                    className="w-4 h-4 text-primary-500"
                  />
                  <span className="text-gray-700 dark:text-gray-200">覆盖（清空后导入）</span>
                </label>
              </div>
            </div>
            
            {importMode === 'replace' && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-xl mb-4">
                ⚠️ 覆盖模式会清空所有现有数据，此操作不可恢复！
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="flex-1 btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex-1 btn-primary disabled:opacity-50"
              >
                {isImporting ? '导入中...' : '确认导入'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 编辑资料弹窗 */}
      {showProfileModal && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowProfileModal(false)}
        >
          <div 
            className="modal-content max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">编辑资料</h3>
              <button onClick={() => setShowProfileModal(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            {/* 头像选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">头像</label>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center text-2xl overflow-hidden">
                  {editProfile.avatar ? (
                    editProfile.avatar.startsWith('data:') || editProfile.avatar.startsWith('http') ? (
                      <img src={editProfile.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span>{editProfile.avatar}</span>
                    )
                  ) : (
                    <User className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 bg-cream-100 dark:bg-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2"
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
              <div className="avatar-grid">
                {PRESET_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectAvatar(avatar)}
                    className={`avatar-option ${editProfile.avatar === avatar ? 'selected' : ''}`}
                  >
                    <span className="text-2xl">{avatar}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* 昵称 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">昵称</label>
              <input
                type="text"
                value={editProfile.nickname}
                onChange={(e) => setEditProfile(prev => ({ ...prev, nickname: e.target.value }))}
                placeholder="设置昵称"
                className="input-field"
                maxLength={20}
              />
            </div>
            
            {/* 个性签名 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">个性签名</label>
              <textarea
                value={editProfile.signature}
                onChange={(e) => setEditProfile(prev => ({ ...prev, signature: e.target.value }))}
                placeholder="添加个性签名..."
                className="input-field resize-none"
                rows={2}
                maxLength={50}
              />
            </div>
            
            <button onClick={handleSaveProfile} className="btn-primary w-full">
              保存
            </button>
          </div>
        </div>
      )}
      
      {/* 里程碑管理弹窗 */}
      {showMilestoneModal && (
        <div 
          className="modal-backdrop"
          onClick={() => setShowMilestoneModal(false)}
        >
          <div 
            className="modal-content max-w-md max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                {editingMilestone ? '编辑标签' : '添加标签'}
              </h3>
              <button onClick={() => setShowMilestoneModal(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            {/* 标签名称 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">标签名称</label>
              <input
                type="text"
                value={milestoneForm.label}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="例如：第一次走路"
                className="input-field"
                maxLength={10}
              />
            </div>
            
            {/* emoji选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">选择图标</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => setMilestoneForm(prev => ({ ...prev, emoji }))}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                      milestoneForm.emoji === emoji 
                        ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500' 
                        : 'bg-cream-100 dark:bg-gray-700 hover:bg-cream-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <button onClick={handleSaveMilestone} className="btn-primary w-full mb-4">
              {editingMilestone ? '保存修改' : '添加标签'}
            </button>
            
            {/* 已有标签列表 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">已有标签</h4>
              <div className="space-y-2">
                {getAllMilestones().map(milestone => (
                  <div 
                    key={milestone.id} 
                    className="flex items-center justify-between p-2 bg-cream-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{milestone.emoji}</span>
                      <span className="text-gray-700 dark:text-gray-200">{milestone.label}</span>
                      {milestone.id.startsWith('custom_') && (
                        <span className="text-xs text-primary-500">(自定义)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditMilestone(milestone)}
                        className="p-1.5 text-gray-400 hover:text-primary-500"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      {milestone.id.startsWith('custom_') && (
                        <button
                          onClick={() => handleDeleteMilestone(milestone.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

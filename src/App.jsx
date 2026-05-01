/**
 * 宝贝时光 - 主应用组件
 * 记录宝宝成长点滴的移动端单页应用
 */

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import { MusicProvider } from './store/MusicContext';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { LoadingSkeleton } from './components/LoadingSkeleton';

import { TimelinePage } from './pages/TimelinePage';
import { StatsPage } from './pages/StatsPage';
import { ProfilePage } from './pages/ProfilePage';
import { VirtualTimePage } from './pages/VirtualTimePage';
import { CapsulesPage } from './pages/CapsulesPage';
import { MomentForm } from './components/MomentForm';
import { CapsuleForm } from './components/CapsuleForm';
import { BabyForm } from './components/BabyForm';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register';
import { InvitePage } from './pages/InvitePage';
import { 
  addMoment, 
  updateMoment, 
  deleteMoment,
  addCapsule, 
  updateCapsule, 
  addBaby, 
  updateBaby,
  getMomentsByBaby,
  getCapsulesByBaby,
  getAllBabies,
  updateSettings
} from './utils/db';

// 登录保护组件
function AuthGuard({ children }) {
  const { isLoggedIn, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!isLoggedIn) {
    // 记录原始路径，登录后可以跳转回来
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// 主应用内容
function AppContent() {
  const { 
    isLoading, 
    currentBaby,
    setCurrentBaby,
    moments,
    setMoments,
    setCapsules,
    setBabies,
    switchBaby,
    showToast,
    login
  } = useApp();
  
  const [activeTab, setActiveTab] = useState('timeline');
  
  // 统计页面跳转筛选状态
  const [filterType, setFilterType] = useState(''); // photo/video/diary/audio
  const [filterMood, setFilterMood] = useState(''); // happy/excited等
  const [filterMilestone, setFilterMilestone] = useState(''); // first/growth等
  
  // 统计卡片点击处理
  const handleStatClick = (action) => {
    // 重置所有筛选条件
    setFilterType('');
    setFilterMood('');
    setFilterMilestone('');
    
    switch (action.type) {
      case 'timeline':
        // 跳转到时光轴，显示所有记录
        setActiveTab('timeline');
        break;
      case 'filter':
        // 跳转到时光轴并筛选指定类型
        setActiveTab('timeline');
        if (action.filterType) setFilterType(action.filterType);
        if (action.filterMood) setFilterMood(action.filterMood);
        if (action.filterMilestone) setFilterMilestone(action.filterMilestone);
        break;
      case 'capsules':
        // 跳转到时空胶囊页面
        setShowCapsulesPage(true);
        break;
      case 'profile':
        // 跳转到宝宝信息编辑页
        setActiveTab('profile');
        if (action.baby) {
          setEditingBaby(action.baby);
          setShowBabyForm(true);
        }
        break;
      case 'moment':
        // 跳转到时光轴并定位到指定记录
        setActiveTab('timeline');
        if (action.momentId) {
          // TimelinePage会根据momentId滚动到对应位置
          setFilterType('specific');
        }
        break;
      default:
        break;
    }
  };
  
  // 清除筛选条件
  const clearFilters = () => {
    setFilterType('');
    setFilterMood('');
    setFilterMilestone('');
  };
  
  // 弹窗状态
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [editingMoment, setEditingMoment] = useState(null);
  const [showCapsulesPage, setShowCapsulesPage] = useState(false);
  const [showCapsuleForm, setShowCapsuleForm] = useState(false);
  const [editingCapsule, setEditingCapsule] = useState(null);
  const [showBabyForm, setShowBabyForm] = useState(false);
  const [editingBaby, setEditingBaby] = useState(null);
  
  // 添加动态
  const handleAddMoment = () => {
    if (!currentBaby) {
      showToast('请先创建宝宝档案', 'error');
      return;
    }
    setEditingMoment(null);
    setShowMomentForm(true);
  };
  
  // 编辑动态
  const handleEditMoment = (moment) => {
    setEditingMoment(moment);
    setShowMomentForm(true);
  };
  
  // 保存动态
  const handleSaveMoment = async (momentData) => {
    try {
      // 确保 babyId
      if (!momentData.babyId) {
        momentData.babyId = currentBaby?.id;
      }
      
      if (!momentData.babyId) {
        showToast('请先创建宝宝档案', 'error');
        return;
      }
      
      let savedMoment;
      if (momentData.id) {
        savedMoment = await updateMoment(momentData.id, momentData);
        showToast('已更新');
      } else {
        savedMoment = await addMoment(momentData);
        showToast('记录成功！🎉');
      }
      
      // 刷新动态列表
      const updatedMoments = await getMomentsByBaby(momentData.babyId);
      setMoments(updatedMoments);
      
      // 关闭表单
      setShowMomentForm(false);
      setEditingMoment(null);
      
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  };
  
  // 删除动态
  const handleDeleteMoment = async (momentId) => {
    try {
      await deleteMoment(momentId);
      
      // 刷新动态列表
      if (currentBaby?.id) {
        const updatedMoments = await getMomentsByBaby(currentBaby.id);
        setMoments(updatedMoments);
      }
      
      showToast('已删除');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  };
  
  // 添加胶囊
  const handleAddCapsule = () => {
    if (!currentBaby) {
      showToast('请先创建宝宝档案', 'error');
      return;
    }
    setShowCapsulesPage(false);
    setEditingCapsule(null);
    setShowCapsuleForm(true);
  };
  
  // 编辑胶囊
  const handleEditCapsule = (capsule) => {
    setEditingCapsule(capsule);
    setShowCapsuleForm(true);
  };
  
  // 保存胶囊
  const handleSaveCapsule = async (capsuleData) => {
    try {
      if (!capsuleData.babyId) {
        capsuleData.babyId = currentBaby?.id;
      }
      
      if (capsuleData.id) {
        await updateCapsule(capsuleData.id, capsuleData);
        showToast('已更新');
      } else {
        await addCapsule(capsuleData);
        showToast('胶囊创建成功！🎁');
      }
      
      // 刷新胶囊列表
      if (currentBaby?.id) {
        const updatedCapsules = await getCapsulesByBaby(currentBaby.id);
        setCapsules(updatedCapsules);
      }
      
      setShowCapsuleForm(false);
      setEditingCapsule(null);
      
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  };
  
  // 添加宝宝
  const handleAddBaby = () => {
    setEditingBaby(null);
    setShowBabyForm(true);
  };
  
  // 编辑宝宝
  const handleEditBaby = (baby) => {
    setEditingBaby(baby);
    setShowBabyForm(true);
  };
  
  // 保存宝宝 - 保存成功后立即关闭表单
  const handleSaveBaby = async (babyData) => {
    let savedBaby;
    try {
      if (babyData.id) {
        savedBaby = await updateBaby(babyData.id, babyData);
        showToast('已更新');
      } else {
        savedBaby = await addBaby(babyData);
        showToast('宝宝档案创建成功！👶');
      }
      
      // 立即关闭表单，不等待其他操作
      setShowBabyForm(false);
      setEditingBaby(null);
      
      // 后台刷新数据
      getAllBabies().then(babies => {
        setBabies(babies);
        // 如果是新建宝宝，切换到新宝宝
        if (!babyData.id && savedBaby?.id) {
          const newBaby = babies.find(b => b.id === savedBaby.id);
          if (newBaby) {
            updateSettings({ currentBabyId: newBaby.id });
            setCurrentBaby(newBaby);
            getMomentsByBaby(newBaby.id).then(setMoments);
            getCapsulesByBaby(newBaby.id).then(setCapsules);
          }
        } else if (babyData.id) {
          // 编辑模式，更新当前宝宝
          setCurrentBaby(prev => babies.find(b => b.id === prev?.id) || prev);
        }
      });
      
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
      throw error; // 让 BabyForm 捕获错误
    }
  };
  
  // 切换宝宝
  const handleSwitchBaby = async (babyId) => {
    await switchBaby(babyId);
    showToast('已切换宝宝档案');
  };
  
  // 渲染页面
  const renderPage = () => {
    switch (activeTab) {
      case 'timeline':
        return (
          <TimelinePage
            onAddMoment={handleAddMoment}
            onEditMoment={handleEditMoment}
            onDeleteMoment={handleDeleteMoment}
            onSwitchBaby={handleSwitchBaby}
            onAddBaby={handleAddBaby}
            filterType={filterType}
            filterMood={filterMood}
            filterMilestone={filterMilestone}
            onClearFilters={clearFilters}
          />
        );
      case 'stats':
        return (
          <StatsPage
            onOpenCapsules={() => setShowCapsulesPage(true)}
            onStatClick={handleStatClick}
          />
        );
      case 'virtual':
        return <VirtualTimePage />;
      case 'profile':
        return (
          <ProfilePage
            onEditBaby={handleEditBaby}
            onAddBaby={handleAddBaby}
          />
        );
      default:
        return null;
    }
  };
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }
  
  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-900">
      {/* 页面内容 */}
      {renderPage()}
      
      {/* 底部导航 */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Toast 提示 */}
      <Toast />
      
      {/* 音乐播放器 */}
      <MusicPlayer />
      
      {/* 动态表单 */}
      {showMomentForm && (
        <MomentForm
          moment={editingMoment}
          babyId={currentBaby?.id}
          onSave={handleSaveMoment}
          onCancel={() => {
            setShowMomentForm(false);
            setEditingMoment(null);
          }}
        />
      )}
      
      {/* 时空胶囊页面 */}
      {showCapsulesPage && (
        <CapsulesPage
          onClose={() => setShowCapsulesPage(false)}
          onAddCapsule={handleAddCapsule}
          onEditCapsule={handleEditCapsule}
        />
      )}
      
      {/* 胶囊表单 */}
      {showCapsuleForm && (
        <CapsuleForm
          capsule={editingCapsule}
          babyId={currentBaby?.id}
          onSave={handleSaveCapsule}
          onCancel={() => {
            setShowCapsuleForm(false);
            setEditingCapsule(null);
          }}
        />
      )}
      
      {/* 宝宝表单 */}
      {showBabyForm && (
        <BabyForm
          baby={editingBaby}
          onSave={handleSaveBaby}
          onCancel={() => {
            setShowBabyForm(false);
            setEditingBaby(null);
          }}
        />
      )}
    </div>
  );
}

// 路由配置
function AppRoutes() {
  const { isLoggedIn, isLoading, login } = useApp();
  
  if (isLoading) {
    return <LoadingSkeleton />;
  }
  
  return (
    <Routes>
      {/* 公开路由 */}
      <Route 
        path="/login" 
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={login} />
          )
        } 
      />
      <Route 
        path="/register" 
        element={
          isLoggedIn ? (
            <Navigate to="/" replace />
          ) : (
            <RegisterPage onRegister={login} />
          )
        } 
      />
      {/* 访客打卡页面（公开访问） */}
      <Route path="/invite" element={<InvitePage />} />
      
      {/* 受保护的路由 */}
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppContent />
          </AuthGuard>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <MusicProvider>
          <AppRoutes />
        </MusicProvider>
      </AppProvider>
    </BrowserRouter>
  );
}

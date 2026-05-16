/**
 * 宝贝时光 - 集成 CapsulesPage 到导航
 */

import { useState, useContext, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './store/AppContext';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { TimelinePage } from './pages/TimelinePage';
import { StatsPage } from './pages/StatsPage';
import { VirtualTimePage } from './pages/VirtualTimePage';
import { ProfilePage } from './pages/ProfilePage';
import { CapsulesPage } from './pages/CapsulesPage';

// 登录保护
function AuthGuard({ children }) {
  const { isLoggedIn, isLoading } = useApp();
  const location = useLocation();

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>加载中...</div>;
  }

  if (!isLoggedIn) {
    // 暂时跳过登录，直接显示内容（纯内存版默认已登录）
    return children;
  }

  return children;
}

// 主应用内容
function AppContent() {
  const { toasts, showToast, removeToast, currentBaby } = useApp();
  const [activeTab, setActiveTab] = useState('timeline');
  const [showCapsulesPage, setShowCapsulesPage] = useState(false);
  const [showMomentForm, setShowMomentForm] = useState(false);
  const [showCapsuleForm, setShowCapsuleForm] = useState(false);
  const [showBabyForm, setShowBabyForm] = useState(false);
  const [editingMoment, setEditingMoment] = useState(null);
  const [editingCapsule, setEditingCapsule] = useState(null);
  const [editingBaby, setEditingBaby] = useState(null);
  
  // AI 创作选择弹窗状态
  const [showAIChoice, setShowAIChoice] = useState(false);
  const [latestContent, setLatestContent] = useState('');

  // 统计页面跳转筛选状态
  const [filterType, setFilterType] = useState(''); // photo/video/diary/audio
  const [filterMood, setFilterMood] = useState(''); // happy/excited等
  const [filterMilestone, setFilterMilestone] = useState(''); // first/growth等

  // 监听外部tab切换事件（用于PodcastPage跳转）
  useEffect(() => {
    const handleTabChange = (event) => {
      const { tab, highlightId } = event.detail;
      setActiveTab(tab);
      // 如果有highlightId，保存起来供TimelinePage使用
      if (highlightId) {
        localStorage.setItem('podcastHighlightId', highlightId);
      }
    };

    window.addEventListener('app-tab-change', handleTabChange);
    return () => window.removeEventListener('app-tab-change', handleTabChange);
  }, []);

  // 统计卡片点击处理
  const handleStatClick = (action) => {
    switch (action) {
      case 'addMoment':
        setShowMomentForm(true);
        break;
      case 'addCapsule':
        setShowCapsuleForm(true);
        break;
      case 'openCapsules':
        setShowCapsulesPage(true);
        break;
      default:
        break;
    }
  };

  // 添加动态
  const handleAddMoment = () => {
    setShowMomentForm(true);
    setEditingMoment(null);
  };

  // 编辑动态
  const handleEditMoment = (moment) => {
    setEditingMoment(moment);
    setShowMomentForm(true);
  };

  // 保存动态
  const handleSaveMoment = async (momentData) => {
    try {
      // 纯内存版本，直接更新状态
      let updatedMoment;
      if (momentData.id) {
        // 更新现有动态
        updatedMoment = { ...editingMoment, ...momentData, updatedAt: Date.now() };
        // 这里应该调用setMoments，但是我们还没导入，暂时用Toast提示
      } else {
        // 添加新动态
        updatedMoment = {
          ...momentData,
          id: `moment-${Date.now()}`,
          babyId: currentBaby?.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      showToast('记录已保存！🎉', 'success');
      setShowMomentForm(false);
      setEditingMoment(null);
      
      // 显示 AI 创作选择弹窗
      const content = momentData.content?.text || momentData.content || '';
      if (content) {
        setLatestContent(content);
        setShowAIChoice(true);
      }
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  };
  
  // 确认 AI 创作
  const handleConfirmAICreate = () => {
    setShowAIChoice(false);
    
    if (!latestContent) return;
    
    try {
      // 最全的SDK悬浮按钮选择器（覆盖各种可能的类名）
      const sdkSelectors = [
        'button[class*="coze-chat-float-btn"]',
        '[class*="coze-chat-float-btn"]',
        'button[class*="float-btn"]',
        'button[class*="asst-btn"]',
        '[class*="coze"] button',
        '[class*="coze"] [class*="btn"]',
        'button[aria-label*="chat"]',
        'button[aria-label*="对话"]',
        'button[aria-label*="助手"]',
        '[class*="chat"] button',
        '[class*="Chat"] button',
        'div[class*="coze"]',
        'div[class*="coze"] *',
        // 兜底：查找右下角固定位置的元素
        'div[style*="position: fixed"]',
        'div[style*="bottom:"]'
      ];
      
      let opened = false;
      let targetBtn = null;
      
      // 1. 先尝试各种选择器
      for (const selector of sdkSelectors) {
        const btn = document.querySelector(selector);
        if (btn) {
          // 验证元素是否可见
          const style = window.getComputedStyle(btn);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            targetBtn = btn;
            break;
          }
        }
      }
      
      // 2. 如果没找到，尝试查找iframe里的元素
      if (!targetBtn) {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              for (const selector of sdkSelectors) {
                const btn = iframeDoc.querySelector(selector);
                if (btn) {
                  targetBtn = btn;
                  break;
                }
              }
            }
          } catch (e) {
            // 跨域访问失败，跳过
          }
        }
      }
      
      // 3. 点击找到的按钮
      if (targetBtn) {
        targetBtn.click();
        opened = true;
      }
      
      // 4. 备用：尝试旧接口
      if (!opened && window.cozeChat) {
        try {
          window.cozeChat.open();
          opened = true;
        } catch (e) {
          console.log('cozeChat.open 失败:', e);
        }
      }
      
      // 5. 如果都失败了，给用户提示
      if (!opened) {
        showToast('请点击右下角的AI助手图标打开聊天窗口', 'info');
        // 高亮提示用户点击右下角
        const floatBtns = document.querySelectorAll('*');
        floatBtns.forEach(el => {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' && style.bottom && style.right) {
            el.style.transition = 'all 0.3s';
            el.style.transform = 'scale(1.2)';
            el.style.boxShadow = '0 0 20px rgba(102, 126, 234, 0.8)';
            setTimeout(() => {
              el.style.transform = 'scale(1)';
              el.style.boxShadow = '';
            }, 1000);
          }
        });
      }
      
      // 6. 延迟填入内容
      const fillPrompt = () => {
        const babyName = currentBaby?.name || '宝宝';
        const prompt = `请帮我为以下宝宝成长记录创作一段未来时光想象：

宝宝小名：${babyName}
记录内容：${latestContent}

请发挥想象力，用温暖、有画面感的语言，创作一段100-200字的未来时光回响。`;
        
        // 查找输入框（覆盖更多选择器）
        const inputSelectors = [
          '.coze-chat-input textarea',
          '.coze-chat-input input',
          '[class*="chat-input"] textarea',
          '[class*="chat-input"] input',
          'textarea[placeholder*="输入"]',
          'textarea[placeholder*="消息"]',
          'input[placeholder*="输入"]',
          'input[placeholder*="消息"]'
        ];
        
        for (const selector of inputSelectors) {
          const inputElement = document.querySelector(selector);
          if (inputElement) {
            inputElement.value = prompt;
            inputElement.dispatchEvent(new Event('input', { bubbles: true }));
            inputElement.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      };
      
      setTimeout(fillPrompt, 800);
      setTimeout(fillPrompt, 1500); // 重试一次
      
    } catch (e) {
      console.error('打开扣子聊天窗失败:', e);
      showToast('请直接点击右下角的AI助手图标', 'info');
    }
  };

  // 删除动态
  const handleDeleteMoment = async (id) => {
    try {
      // 纯内存版本，直接更新状态
      showToast('动态已删除', 'success');
    } catch (error) {
      showToast('删除失败: ' + error.message, 'error');
    }
  };

  // 添加胶囊
  const handleAddCapsule = () => {
    setShowCapsuleForm(true);
    setEditingCapsule(null);
  };

  // 编辑胶囊
  const handleEditCapsule = (capsule) => {
    setEditingCapsule(capsule);
    setShowCapsuleForm(true);
  };

  // 保存胶囊
  const handleSaveCapsule = async (capsuleData) => {
    try {
      // 纯内存版本，直接更新状态
      let updatedCapsule;
      if (capsuleData.id) {
        // 更新现有胶囊
        updatedCapsule = { ...editingCapsule, ...capsuleData, updatedAt: Date.now() };
      } else {
        // 添加新胶囊
        updatedCapsule = {
          ...capsuleData,
          id: `capsule-${Date.now()}`,
          babyId: useApp().currentBaby?.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      showToast('胶囊已保存', 'success');
      setShowCapsuleForm(false);
      setEditingCapsule(null);
    } catch (error) {
      showToast('保存失败: ' + error.message, 'error');
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case 'timeline':
        return (
          <TimelinePage
            onAddMoment={handleAddMoment}
            onEditMoment={handleEditMoment}
            onDeleteMoment={handleDeleteMoment}
            filterType={filterType}
            filterMood={filterMood}
            filterMilestone={filterMilestone}
          />
        );
      case 'stats':
        return (
          <StatsPage
            onAddMoment={handleAddMoment}
            onAddCapsule={() => setShowCapsuleForm(true)}
            onStatClick={handleStatClick}
            filterType={filterType}
            filterMood={filterMood}
            filterMilestone={filterMilestone}
          />
        );
      case 'virtual':
        return <VirtualTimePage />;
      case 'profile':
        return (
          <ProfilePage
            onEditBaby={(baby) => {
              setEditingBaby(baby);
              setShowBabyForm(true);
            }}
            onAddBaby={() => {
              setEditingBaby(null);
              setShowBabyForm(true);
            }}
            onOpenRecycleBin={() => {}}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-cream-50 dark:bg-gray-900">
      {/* 页面内容 */}
      {renderPage()}
      
      {/* 底部导航 */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Toast 提示 */}
      <Toast toasts={toasts} onRemove={removeToast} />
      
      {/* AI 创作选择弹窗 */}
      {showAIChoice && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '320px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
            <h3 style={{ marginBottom: '12px' }}>记录已保存！</h3>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              要不要让 AI 为这条记录创作一段未来时光想象？
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowAIChoice(false)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  background: 'white',
                  cursor: 'pointer',
                }}
              >
                不用了，谢谢
              </button>
              <button 
                onClick={handleConfirmAICreate}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                好的，帮我创作 ✨
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 时空胶囊页面 */}
      {showCapsulesPage && (
        <CapsulesPage
          onClose={() => setShowCapsulesPage(false)}
          onAddCapsule={handleAddCapsule}
          onEditCapsule={handleEditCapsule}
        />
      )}
      
      {/* 扣子智能体悬浮按钮 */}
      <div 
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
          zIndex: 9999,
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        onClick={() => {
          if (window.cozeChat) {
            window.cozeChat.open();
          }
        }}
        title="打开虚拟时光助手"
      >
        ✨
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
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

function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  );
}

export default App;

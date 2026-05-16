/**
 * 未来宝宝页面 - AI生成内容专题展示
 * 支持点击内容项全屏展示和分享，双账号支持
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Share2, Mail } from 'lucide-react';
import { virtualTimeTopics } from '../data/virtualTimeData';
import { useApp } from '../store/AppContext';
import { ShareCard } from '../components/ShareCard';
import { BabyHeader } from '../components/BabyHeader';
import { BabyLetter } from '../components/BabyLetter';
import { 
  getCurrentV2Account, 
  getCurrentBabyInfo, 
  isSystemAccount as checkIsSystemAccount,
  getCurrentVirtualTime,
  addVirtualTimeToCurrentAccount,
  deleteVirtualTimeFromCurrentAccount,
  updateCurrentBabyInfo,
  getVirtualTimeCategories
} from '../utils/dbV2';

export function VirtualTimePage() {
  const navigate = useNavigate();
  const { currentBaby, currentUser, showToast } = useApp();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [fullscreenItem, setFullscreenItem] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sharingItem, setSharingItem] = useState(null);
  const [showBabyLetter, setShowBabyLetter] = useState(false);
  
  // v2 账号系统状态
  const [v2AccountInfo, setV2AccountInfo] = useState(null);
  const [v2VirtualTime, setV2VirtualTime] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVirtualTime, setNewVirtualTime] = useState({ title: '', content: '' });
  
  // 监听账号切换
  useEffect(() => {
    const updateV2Info = () => {
      const account = getCurrentV2Account();
      const virtualTime = getCurrentVirtualTime();
      setV2AccountInfo(account || null);
      setV2VirtualTime(virtualTime || []);
    };
    
    updateV2Info();
    
    // 监听 localStorage 变化（跨标签页同步、导入数据刷新）
    window.addEventListener('storage', updateV2Info);
    // 轮询更新
    const interval = setInterval(updateV2Info, 500);
    
    return () => {
      window.removeEventListener('storage', updateV2Info);
      clearInterval(interval);
    };
  }, []);
  
  // 检查是否为系统账号
  const isSystemAccount = v2AccountInfo?.isSystem === true;
  
  // 同步宝宝名称到未来宝宝显示
  const babyName = v2AccountInfo?.nickname || v2AccountInfo?.name || currentBaby?.nickname || currentBaby?.name || '宝宝';
  
  // 添加未来宝宝
  const handleAddVirtualTime = useCallback(() => {
    if (isSystemAccount) {
      showToast('系统账号不可添加', 'error');
      return;
    }
    if (!newVirtualTime.title.trim() || !newVirtualTime.content.trim()) {
      showToast('请填写标题和内容', 'error');
      return;
    }
    
    const item = addVirtualTimeToCurrentAccount({
      title: newVirtualTime.title.trim(),
      content: newVirtualTime.content.trim(),
      createdAt: new Date().toISOString()
    });
    
    if (item) {
      setV2VirtualTime(prev => [item, ...prev]);
      setNewVirtualTime({ title: '', content: '' });
      setShowAddForm(false);
      showToast('已添加');
    }
  }, [isSystemAccount, newVirtualTime, showToast]);
  
  // 删除未来宝宝
  const handleDeleteVirtualTime = useCallback((itemId) => {
    if (isSystemAccount) {
      showToast('系统账号不可删除', 'error');
      return;
    }
    
    if (window.confirm('确定要删除这条记录吗？')) {
      const success = deleteVirtualTimeFromCurrentAccount(itemId);
      if (success) {
        setV2VirtualTime(prev => prev.filter(item => item.id !== itemId));
        showToast('已删除');
      }
    }
  }, [isSystemAccount, showToast]);
  
  // 处理专题点击 - 跳转到详情页
  const handleTopicClick = (topic) => {
    navigate(`/virtual/topic/${topic.id}`);
  };

  const handleBack = () => {
    setSelectedTopic(null);
    setFullscreenItem(null);
  };

  // 打开全屏查看
  const openFullscreen = useCallback((item) => {
    setFullscreenItem(item);
  }, []);

  // 关闭全屏
  const closeFullscreen = useCallback(() => {
    setFullscreenItem(null);
  }, []);

  // 打开分享
  const handleShare = useCallback((item) => {
    setSharingItem(item);
  }, []);

  // 复制内容到剪贴板
  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      showToast('已复制到剪贴板', 'success');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      showToast('复制失败', 'error');
    });
  }, [showToast]);

  // 专题卡片组件
  const TopicCard = ({ topic }) => (
    <div
      onClick={() => handleTopicClick(topic)}
      className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer active:scale-[0.98] group"
    >
      <div className={`h-36 bg-gradient-to-br ${topic.coverGradient} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-4 text-4xl animate-bounce" style={{ animationDuration: '2s' }}>{topic.coverEmoji}</div>
          <div className="absolute bottom-4 right-4 text-3xl opacity-50">{topic.coverIcon}</div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-lg drop-shadow-lg">{topic.title}</h3>
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-medium">AI</span>
        </div>
      </div>
      <div className="p-4">
        <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2 mb-3">
          {topic.description}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
              {topic.items.length}个内容
            </span>
          </div>
          <span className="text-xs text-gray-400 group-hover:text-primary-500 transition-colors">
            点击查看 →
          </span>
        </div>
      </div>
    </div>
  );

  // 渲染内容卡片 (简化版，保留核心功能)
  const renderContentCard = (item, topic) => {
    return (
      <div key={item.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-300 flex items-center justify-center flex-shrink-0">
            <span className="text-xl">{topic.coverEmoji}</span>
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 dark:text-white">{item.title}</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.description || item.content}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 rounded-full">
                点击查看详情
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900">
      <header className="bg-gradient-to-b from-[#FFF0E0] via-[#FFF8F0] to-white safe-top">
        <div className="px-4 pt-4 pb-6">
      
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* 头像显示在左上角（使用v2账号身份信息） */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-300 flex items-center justify-center text-lg overflow-hidden shadow-sm">
                {v2AccountInfo?.accountData?.avatar ? (
                  v2AccountInfo.accountData.avatar.startsWith('data:') || v2AccountInfo.accountData.avatar.startsWith('http') ? (
                    <img src={v2AccountInfo.accountData.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{v2AccountInfo.accountData.avatar}</span>
                  )
                ) : currentUser?.avatar ? (
                  currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                    <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{currentUser.avatar}</span>
                  )
                ) : (
                  <span>✨</span>
                )}
              </div>
              <h1 className="text-base font-medium text-gray-600 dark:text-gray-300">
                {v2AccountInfo?.identityName || currentUser?.name || "✨ 未来宝宝"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
            {/* 来自宝宝的信按钮 */}
            <button
              onClick={() => setShowBabyLetter(true)}
              className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-pink-50 to-amber-50 hover:from-pink-100 hover:to-amber-100 rounded-full transition-all shadow-sm border border-pink-100/50"
            >
              <span className="text-sm">💌</span>
              <span className="text-sm font-medium text-pink-600">来自宝宝的信</span>
            </button>
            </div>
          </div>
          
          <BabyHeader />
        </div>
      </header>

      <main className="px-4 -mt-4 max-w-lg mx-auto space-y-4">

        {/* 专题卡片列表 */}
        {virtualTimeTopics.map((topic) => (
          <div key={topic.id} className="card">
            <TopicCard topic={topic} />
          </div>
        ))}

        <div className="h-8" />
      </main>

      {/* 分享卡片弹窗 */}
      <ShareCard
        visible={!!sharingItem}
        onClose={() => setSharingItem(null)}
        data={sharingItem}
        title={sharingItem?.title}
        content={sharingItem?.content || sharingItem?.description}
        babyName={currentBaby?.name}
        type="diary"
        mood={sharingItem?.mood}
      />
      
      {/* 来自宝宝的信弹窗 */}
      <BabyLetter
        visible={showBabyLetter}
        onClose={() => setShowBabyLetter(false)}
        virtualTimeRecords={v2VirtualTime}
        babyName={babyName}
        parentName={v2AccountInfo?.identityName || currentUser?.name || '妈妈'}
      />
    </div>
  );
}

export default VirtualTimePage;

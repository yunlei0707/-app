/**
 * 访客打卡页面
 * 亲戚通过链接打卡，记录来访
 */

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Heart, Calendar, Users, Trophy, Copy, Check, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { addVisit, getVisitsByBaby, getVisitRanking, generateInviteToken, verifyInviteToken } from '../utils/db';

export function InvitePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentBaby, showToast, isLoggedIn } = useApp();

  const [mode, setMode] = useState('home'); // home | checkin | ranking
  const [visitorName, setVisitorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [ranking, setRanking] = useState([]);
  const [inviteToken, setInviteToken] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [recentVisits, setRecentVisits] = useState([]);

  // 从URL获取邀请信息
  const babyId = searchParams.get('babyId');
  const token = searchParams.get('token');

  // 初始化
  useEffect(() => {
    if (babyId && token) {
      // 验证token
      const isValid = verifyInviteToken(babyId, token);
      if (isValid) {
        setMode('checkin');
      } else {
        showToast('邀请链接已失效', 'error');
        setMode('home');
      }
    }
  }, [babyId, token]);

  // 加载数据
  useEffect(() => {
    if (currentBaby?.id) {
      loadData();
    }
  }, [currentBaby?.id]);

  const loadData = async () => {
    if (!currentBaby?.id) return;
    
    try {
      // 加载排行榜
      const rankingData = await getVisitRanking(currentBaby.id);
      setRanking(rankingData.slice(0, 10));

      // 加载今日打卡
      const visits = await getVisitsByBaby(currentBaby.id);
      const today = new Date().toISOString().split('T')[0];
      const todayVisits = visits.filter(v => v.visitDate === today);
      setTodayCount(todayVisits.length);

      // 加载最近来访
      setRecentVisits(visits.slice(0, 20));

      // 生成邀请链接
      const newToken = generateInviteToken(currentBaby.id);
      setInviteToken(newToken);
      const baseUrl = window.location.origin;
      setInviteLink(`${baseUrl}/invite?babyId=${currentBaby.id}&token=${newToken}`);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // 检查今日是否已打卡
  useEffect(() => {
    if (babyId && visitorName) {
      checkTodayCheckin();
    }
  }, [babyId, visitorName]);

  const checkTodayCheckin = async () => {
    if (!babyId) return;
    
    const visits = await getVisitsByBaby(babyId);
    const today = new Date().toISOString().split('T')[0];
    const hasChecked = visits.some(
      v => v.babyId === babyId && v.visitorName === visitorName && v.visitDate === today
    );
    setHasCheckedIn(hasChecked);
  };

  // 打卡
  const handleCheckin = async () => {
    if (!visitorName.trim()) {
      showToast('请输入您的称呼', 'error');
      return;
    }

    if (hasCheckedIn) {
      showToast('今天已经打过卡啦，明天再来吧~', 'info');
      return;
    }

    setIsSubmitting(true);
    try {
      await addVisit({
        babyId: babyId || currentBaby?.id,
        visitorName: visitorName.trim(),
        visitDate: new Date().toISOString().split('T')[0],
      });
      
      setHasCheckedIn(true);
      showToast(`打卡成功！感谢 "${visitorName}" 的祝福~ 🎉`);
      loadData();
    } catch (error) {
      showToast('打卡失败，请重试', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 复制链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      showToast('链接已复制，快去分享给亲戚吧~');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      showToast('复制失败，请手动复制', 'error');
    }
  };

  // 返回主页
  const handleBack = () => {
    navigate('/', { replace: true });
  };

  // 称呼选项
  const relationOptions = [
    '爷爷', '奶奶', '姥姥', '姥爷', '姑姑', '舅舅', '姨姨',
    '叔叔', '伯伯', '婶婶', '阿姨', '哥哥', '姐姐', 
    '弟弟', '妹妹', '小姨', '姑父', '舅妈', '其他'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-cream-50 dark:from-gray-900 dark:to-gray-800">
      {/* 头部 */}
      <header className="bg-gradient-to-b from-primary-400 to-primary-500 text-white safe-top">
        <div className="px-4 pt-4 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg overflow-hidden">
              {currentUser?.avatar ? (
                currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.avatar}</span>
                )
              ) : (
                <span>👶</span>
              )}
            </div>
            <h1 className="text-xl font-bold">宝贝时光</h1>
          </div>
            {mode !== 'home' && !babyId && (
              <button
                onClick={handleBack}
                className="text-white/80 text-sm hover:text-white"
              >
                返回
              </button>
            )}
          </div>
          <p className="text-white/80 text-sm">
            {babyId 
              ? '为宝宝送上祝福，留下您的足迹~' 
              : '邀请亲友为宝宝打卡祝福，记录温馨时刻'}
          </p>
        </div>
      </header>

      <main className="px-4 -mt-4 max-w-lg mx-auto">
        {/* 打卡模式（外部链接访问） */}
        {mode === 'checkin' && (
          <div className="card animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-pink-400 to-orange-400 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <span className="text-4xl">👶</span>
              </div>
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                {currentBaby?.nickname || currentBaby?.name || '小宝宝'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                邀请您为他/她送上祝福
              </p>
            </div>

            {/* 祝福语输入 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  请选择您的称呼
                </label>
                <div className="flex flex-wrap gap-2">
                  {relationOptions.map((rel) => (
                    <button
                      key={rel}
                      onClick={() => setVisitorName(rel)}
                      className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                        visitorName === rel
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/30'
                      }`}
                    >
                      {rel}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  或直接输入称呼
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="如：姑姑、舅舅等"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>

              <button
                onClick={handleCheckin}
                disabled={isSubmitting || hasCheckedIn || !visitorName.trim()}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  hasCheckedIn
                    ? 'bg-green-500'
                    : isSubmitting || !visitorName.trim()
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 active:scale-[0.98]'
                }`}
              >
                {isSubmitting ? (
                  '打卡中...'
                ) : hasCheckedIn ? (
                  '✅ 今日已打卡'
                ) : (
                  '💝 为宝宝打卡送祝福'
                )}
              </button>

              {hasCheckedIn && (
                <p className="text-center text-green-600 dark:text-green-400 text-sm">
                  感谢您的祝福！🎉
                </p>
              )}
            </div>
          </div>
        )}

        {/* 主页模式（已登录用户） */}
        {mode === 'home' && !babyId && (
          <>
            {/* 统计卡片 */}
            <div className="card mb-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                  <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                    {todayCount}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">今日打卡</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                    {ranking.reduce((sum, v) => sum + v.count, 0)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">累计打卡</p>
                </div>
              </div>
            </div>

            {/* 邀请链接 */}
            <div className="card mb-4 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h3 className="font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary-500" />
                邀请打卡
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                复制链接发送给亲戚，他们可以来为宝宝打卡送祝福~
              </p>
              
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors flex items-center gap-1"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      复制
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 来访排行 */}
            <div className="card animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  来访排行榜
                </h3>
              </div>

              {ranking.length > 0 ? (
                <div className="space-y-3">
                  {ranking.map((item, index) => (
                    <div
                      key={item.visitorName}
                      className={`flex items-center gap-3 p-2 rounded-lg ${
                        index < 3 
                          ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20' 
                          : ''
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 
                          ? 'bg-amber-400 text-white' 
                          : index === 1 
                          ? 'bg-gray-300 text-gray-600' 
                          : index === 2 
                          ? 'bg-orange-300 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white">{item.visitorName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary-600 dark:text-primary-400">{item.count}</p>
                        <p className="text-xs text-gray-400">次</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无来访记录</p>
                  <p className="text-sm">快分享链接邀请亲友打卡吧~</p>
                </div>
              )}
            </div>

            {/* 最近来访 */}
            {recentVisits.length > 0 && (
              <div className="card mt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary-500" />
                  最近来访
                </h3>
                <div className="space-y-2">
                  {recentVisits.slice(0, 10).map((visit, index) => (
                    <div
                      key={visit.id || index}
                      className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                    >
                      <span className="text-gray-700 dark:text-gray-300">{visit.visitorName}</span>
                      <span className="text-sm text-gray-400">{visit.visitDate}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default InvitePage;

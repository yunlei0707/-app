/**
 * 宝宝播客首页
 * 展示所有播客内容，点击显示详情和播放器
 * 支持独立创建播客功能
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, X, Mic } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getPodcastPlayUrl } from '../utils/audioStorage';
import { getCurrentBabyInfo, getCurrentTimeline, addMomentToCurrentAccount, isSystemAccount } from "../repositories/stateRepository.js";
import { getMomentsByBaby } from '../repositories/stateRepository';
import { MomentForm } from '../components/MomentForm';

export function PodcastPage() {
  const navigate = useNavigate();
  const { currentBaby, showToast } = useApp();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  // 创建播客模态框状态
  const [showPodcastForm, setShowPodcastForm] = useState(false);
  // 选中的播客（用于显示详情和播放）
  const [selectedPodcast, setSelectedPodcast] = useState(null);
  // 播客播放器状态
  const [podcastAudioUrl, setPodcastAudioUrl] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState(false);

  // 从localStorage或IndexedDB加载所有播客数据
  useEffect(() => {
    loadAllPodcasts();
  }, [currentBaby]);

  const loadAllPodcasts = async () => {
    try {
      setLoading(true);
      
      // ✅ 合并 v1 + v2 的播客数据
      const allPodcasts = [];
      
      // 1. 从 v2（localStorage）加载播客
      const v2Timeline = getCurrentTimeline() || [];
      const v2Podcasts = v2Timeline.filter(m => m.type === 'podcast' && m.podcast);
      allPodcasts.push(...v2Podcasts);
      
      // 2. 从 v1（IndexedDB）加载播客
      const babyId = currentBaby?.id || getCurrentBabyInfo()?.id;
      if (babyId) {
        const v1Moments = await getMomentsByBaby(babyId);
        const v1Podcasts = v1Moments.filter(m => m.type === 'podcast' && m.podcast);
        allPodcasts.push(...v1Podcasts);
      }
      
      // 按时间倒序排列
      allPodcasts.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
      
      setPodcasts(allPodcasts);
    } catch (error) {
      console.error('加载播客失败:', error);
      setPodcasts([]);
    } finally {
      setLoading(false);
    }
  };

  // 点击播客卡片 - 显示详情和播放
  const handlePodcastClick = async (moment) => {
    setSelectedPodcast(moment);
    setAudioLoading(true);
    setAudioError(false);
    setPodcastAudioUrl(null);
    
    try {
      const playUrl = await getPodcastPlayUrl(moment.podcast.audio);
      if (playUrl) {
        setPodcastAudioUrl(playUrl);
      } else {
        setAudioError(true);
      }
    } catch (error) {
      console.error('加载播客音频失败:', error);
      setAudioError(true);
    } finally {
      setAudioLoading(false);
    }
  };

  // 关闭播客详情
  const handleClosePodcast = () => {
    setSelectedPodcast(null);
    setPodcastAudioUrl(null);
  };

  // 打开创建播客表单
  const handleCreatePodcast = () => {
    if (isSystemAccount()) {
      showToast('系统账号不可添加记录', 'error');
      return;
    }
    setShowPodcastForm(true);
  };

  // 保存播客
  const handleSavePodcast = async (podcastData) => {
    try {
      // 确保类型是 podcast
      const momentData = {
        ...podcastData,
        type: 'podcast',
        isDeleted: false
      };
      
      // 保存到当前账号
      addMomentToCurrentAccount(momentData);
      
      showToast('播客创建成功！🎉', 'success');
      setShowPodcastForm(false);
      
      // 重新加载播客列表
      loadAllPodcasts();
    } catch (error) {
      console.error('保存播客失败:', error);
      showToast('保存失败，请重试', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20">
      {/* 创建播客模态框 */}
      {showPodcastForm && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary-500" />
                创建播客
              </h2>
              <button
                onClick={() => setShowPodcastForm(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {/* 播客表单 - 强制类型为 podcast */}
            <MomentForm
              moment={{ type: 'podcast' }}
              onSave={handleSavePodcast}
              babyId={currentBaby?.id || getCurrentBabyInfo()?.id}
              onCancel={() => setShowPodcastForm(false)}
            />
          </div>
        </div>
      )}

      {/* 顶部标题 */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 shadow-sm flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">
          🎙️ 宝宝播客
        </h1>
        <button
          onClick={handleCreatePodcast}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
        >
          <Mic className="w-4 h-4" />
          <span className="text-sm font-medium">创建播客</span>
        </button>
      </div>

      {/* 未来时光专区入口 */}
      <div className="p-4">
        <div 
          className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/future-time')}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">✨</span>
            <h2 className="text-xl font-bold">未来时光</h2>
          </div>
          <p className="text-white/80 text-sm">
            给未来的宝宝写封信、录段音，穿越时空送给长大的TA
          </p>
          <div className="mt-4 text-right">
            <span className="bg-white/20 px-4 py-1.5 rounded-full text-sm">
              点击进入 →
            </span>
          </div>
        </div>
      </div>

      {/* 播客列表 */}
      <div className="px-4">
        {loading ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-2xl mb-2 animate-pulse">⏳</p>
            <p>加载中...</p>
          </div>
        ) : podcasts.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-4xl mb-3">🎙️</p>
            <p>还没有播客，点击右上角创建第一个吧~</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {podcasts.map(moment => (
              <div 
                key={moment.id}
                className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handlePodcastClick(moment)}
              >
                {/* 播客封面 */}
                <div className="aspect-square relative">
                  {moment.podcast.cover ? (
                    <img 
                      src={typeof moment.podcast.cover === 'string' ? moment.podcast.cover : moment.podcast.cover.url}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                      <span className="text-4xl">🎙️</span>
                    </div>
                  )}
                  {/* 播放按钮小图标 */}
                  <div className="absolute bottom-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow">
                    <Play className="w-4 h-4 text-gray-700" />
                  </div>
                </div>
                {/* 播客标题 */}
                <div className="p-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-white truncate">
                    {moment.podcast.title || '未命名播客'}
                  </p>
                  {moment.podcast.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                      {moment.podcast.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 播客详情和播放器 */}
      {selectedPodcast && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl p-4 pb-8">
            {/* 头部 */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-800 dark:text-white">播客详情</h3>
              <button
                onClick={handleClosePodcast}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            {/* 播客封面 */}
            {selectedPodcast.podcast.cover && (
              <div className="aspect-square rounded-xl overflow-hidden mb-4">
                <img
                  src={typeof selectedPodcast.podcast.cover === 'string' ? selectedPodcast.podcast.cover : selectedPodcast.podcast.cover.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            {/* 播客标题和描述 */}
            <h4 className="text-base font-medium text-gray-800 dark:text-white mb-2">
              {selectedPodcast.podcast.title || '未命名播客'}
            </h4>
            {selectedPodcast.podcast.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {selectedPodcast.podcast.description}
              </p>
            )}
            
            {/* 播放器 */}
            <div className="bg-cream-50 dark:bg-gray-700 rounded-xl p-3">
              {audioLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent"></div>
                </div>
              ) : audioError ? (
                <div className="text-center py-4 text-red-500 text-sm">
                  ⚠️ 音频加载失败
                </div>
              ) : podcastAudioUrl ? (
                <audio
                  src={podcastAudioUrl}
                  controls
                  style={{
                    width: '100%',
                    height: '40px',
                    borderRadius: '20px'
                  }}
                  preload="metadata"
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

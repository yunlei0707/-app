/**
 * 虚拟时光页面 - AI生成内容专题展示
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft, Heart, Copy, Share2, X } from 'lucide-react';
import { virtualTimeTopics } from '../data/virtualTimeData';
import { useApp } from '../store/AppContext';

export function VirtualTimePage() {
  const navigate = useNavigate();
  const { currentBaby, showToast } = useApp();
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
  };

  const handleBack = () => {
    setSelectedTopic(null);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
  };

  const handleCloseItem = () => {
    setSelectedItem(null);
  };

  const handleCopyContent = (content) => {
    navigator.clipboard.writeText(content).then(() => {
      showToast('已复制到剪贴板');
    }).catch(() => {
      showToast('复制失败');
    });
  };

  const handleShare = async (item) => {
    const shareText = `${item.title}\n\n${item.content || item.description || ''}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: shareText
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          showToast('分享失败');
        }
      }
    } else {
      handleCopyContent(shareText);
    }
  };

  // 专题卡片组件
  const TopicCard = ({ topic }) => (
    <div
      onClick={() => handleTopicClick(topic)}
      className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer active:scale-[0.98] group"
    >
      {/* 封面 */}
      <div className={`h-36 bg-gradient-to-br ${topic.coverGradient} relative overflow-hidden`}>
        {/* 装饰元素 */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-4 text-4xl animate-bounce" style={{ animationDuration: '2s' }}>{topic.coverEmoji}</div>
          <div className="absolute bottom-4 right-4 text-3xl opacity-50">{topic.coverIcon}</div>
        </div>
        
        {/* 渐变遮罩 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        
        {/* 标题 */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-lg drop-shadow-lg">{topic.title}</h3>
        </div>

        {/* AI标识 */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white" />
          <span className="text-white text-xs font-medium">AI</span>
        </div>
      </div>

      {/* 内容预览 */}
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

  // 获取内容项的展示文本
  const getItemContent = (item) => {
    if (item.content) return item.content;
    if (item.description) return item.description;
    if (item.poem) return item.poem;
    return '';
  };

  return (
    <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900">
      {/* 头部 */}
      <header className="bg-gradient-to-b from-violet-400 to-violet-500 text-white safe-top">
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
            <h1 className="text-xl font-bold">虚拟时光</h1>
          </div>
          <p className="text-white/80 text-sm">
            {currentBaby ? `想象${currentBaby.nickname || currentBaby.name}未来的美好时光` : 'AI生成的温馨未来场景'}
          </p>
        </div>
      </header>

      {/* 内容区域 */}
      <main className="px-4 -mt-4 max-w-lg mx-auto">
        {/* 温馨提醒 */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 mb-4 border border-amber-100 dark:border-amber-800">
          <p className="text-amber-800 dark:text-amber-200 text-sm flex items-start gap-2">
            <span className="text-lg">💫</span>
            <span>这里是AI想象的未来时光，内容仅供参考娱乐，希望能给您带来温暖和感动~</span>
          </p>
        </div>

        {/* 专题列表 */}
        <div className="space-y-4">
          {virtualTimeTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </div>

        {/* 底部留白 */}
        <div className="h-8" />
      </main>

      {/* 专题详情弹窗 */}
      {selectedTopic && !selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in overflow-hidden">
          <div 
            className="absolute inset-x-0 bottom-0 top-0 max-h-full bg-cream-50 dark:bg-gray-900 overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className={`h-40 bg-gradient-to-br ${selectedTopic.coverGradient} relative flex-shrink-0`}>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-7xl animate-pulse">{selectedTopic.coverEmoji}</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
                <h2 className="text-white font-bold text-xl">{selectedTopic.title}</h2>
                <p className="text-white/80 text-sm mt-1">{selectedTopic.description}</p>
              </div>
              <button
                onClick={handleBack}
                className="absolute top-4 left-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">AI生成</span>
              </div>
            </div>

            {/* 内容列表 - 可滚动 */}
            <div className="overflow-y-auto max-h-[calc(100vh-10rem)] p-4 space-y-4">
              {selectedTopic.items.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {item.type === 'image' && (
                      <>
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedTopic.coverGradient} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-2xl">{selectedTopic.coverEmoji}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 dark:text-white">{item.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {item.tags?.map((tag, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {item.type === 'text' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{item.emoji || '📝'}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 dark:text-white">{item.title}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            {item.tags?.map((tag, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {item.type === 'moment' && (
                      <>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center flex-shrink-0">
                          <span className="text-xl">{item.authorAvatar}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-gray-800 dark:text-white">{item.authorName}</span>
                            <span className="text-xs text-gray-400">{item.time}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{item.title}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                          <div className="flex items-center gap-4 mt-2 text-gray-400 text-sm">
                            <span>❤️ {item.likes}</span>
                            <span>💬 {item.comments}</span>
                          </div>
                        </div>
                      </>
                    )}
                    {item.type === 'poem' && (
                      <>
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-2xl">📜</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-gray-800 dark:text-white">{item.title}</h4>
                            <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                              {item.difficulty}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">— {item.author}</p>
                          <p className="text-primary-600 dark:text-primary-400 font-medium text-sm whitespace-pre-line line-clamp-2">
                            {item.content}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {item.tags?.map((tag, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* AI生成提示 */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  💡 以上内容由AI生成，仅供娱乐参考
                </p>
                <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                  希望能为您和家人带来温暖和快乐
                </p>
              </div>

              <div className="h-4" />
            </div>
          </div>
        </div>
      )}

      {/* 内容项全屏展示 */}
      {selectedItem && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={handleCloseItem}
        >
          {/* 关闭按钮 */}
          <button
            onClick={handleCloseItem}
            className="absolute top-4 right-4 z-10 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* 内容区域 */}
          <div 
            className="absolute inset-0 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
              {/* 内容头部 */}
              <div className={`h-32 bg-gradient-to-br ${selectedTopic?.coverGradient || 'from-violet-400 to-violet-500'} relative`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl animate-pulse">
                    {selectedItem.emoji || selectedTopic?.coverEmoji || '✨'}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/40 to-transparent">
                  <h2 className="text-white font-bold text-xl drop-shadow-lg">{selectedItem.title}</h2>
                </div>
              </div>

              {/* 内容主体 */}
              <div className="p-6">
                {/* 标签 */}
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedItem.tags.map((tag, idx) => (
                      <span key={idx} className="text-sm px-3 py-1 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 主要内容 */}
                <div className="text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {selectedItem.type === 'poem' && (
                    <>
                      <p className="text-2xl font-serif text-center text-primary-600 dark:text-primary-400 mb-4 whitespace-pre-line">
                        {selectedItem.content}
                      </p>
                      {selectedItem.translation && (
                        <p className="text-gray-500 dark:text-gray-400 text-sm italic text-center mb-4">
                          {selectedItem.translation}
                        </p>
                      )}
                      <p className="text-right text-gray-400 text-sm">
                        — {selectedItem.author}
                      </p>
                    </>
                  )}
                  {selectedItem.type === 'moment' && (
                    <>
                      <p className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                        {selectedItem.title}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {selectedItem.content}
                      </p>
                      <div className="flex items-center gap-4 mt-4 text-gray-400 text-sm">
                        <span className="flex items-center gap-1">
                          <span>❤️</span> {selectedItem.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>💬</span> {selectedItem.comments}
                        </span>
                      </div>
                    </>
                  )}
                  {(selectedItem.type === 'text' || selectedItem.type === 'image') && (
                    <>
                      <p className="text-lg font-medium text-gray-800 dark:text-white mb-2">
                        {selectedItem.title}
                      </p>
                      <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                        {getItemContent(selectedItem)}
                      </p>
                    </>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => handleCopyContent(getItemContent(selectedItem) || selectedItem.title)}
                    className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center">
                      <Copy className="w-5 h-5" />
                    </div>
                    <span className="text-xs">复制</span>
                  </button>
                  
                  <button
                    onClick={() => handleShare(selectedItem)}
                    className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs">分享</span>
                  </button>
                  
                  <button
                    onClick={handleCloseItem}
                    className="flex flex-col items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-cream-100 dark:bg-gray-700 flex items-center justify-center">
                      <X className="w-5 h-5" />
                    </div>
                    <span className="text-xs">关闭</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VirtualTimePage;

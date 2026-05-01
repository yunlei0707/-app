/**
 * 虚拟时光页面 - AI生成内容专题展示
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { virtualTimeTopics } from '../data/virtualTimeData';
import { useApp } from '../store/AppContext';

export function VirtualTimePage() {
  const navigate = useNavigate();
  const { currentBaby, showToast } = useApp();
  const [selectedTopic, setSelectedTopic] = useState(null);

  const handleTopicClick = (topic) => {
    setSelectedTopic(topic);
  };

  const handleBack = () => {
    setSelectedTopic(null);
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
            <h1 className="text-xl font-bold">宝贝时光</h1>
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
      {selectedTopic && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div 
            className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-cream-50 dark:bg-gray-900 rounded-t-3xl overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className={`h-40 bg-gradient-to-br ${selectedTopic.coverGradient} relative`}>
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

            {/* 内容列表 */}
            <div className="overflow-y-auto max-h-[calc(85vh-10rem)] p-4 space-y-4">
              {selectedTopic.items.map((item) => (
                <div 
                  key={item.id}
                  className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    {item.type === 'image' && (
                      <>
                        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${selectedTopic.coverGradient} flex items-center justify-center flex-shrink-0`}>
                          <span className="text-2xl">{selectedTopic.coverEmoji}</span>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-gray-800 dark:text-white">{item.title}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
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
                          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{item.content}</p>
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
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.content}</p>
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
                          <p className="text-primary-600 dark:text-primary-400 font-medium text-sm whitespace-pre-line">
                            {item.content}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                            {item.translation}
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
    </div>
  );
}

export default VirtualTimePage;

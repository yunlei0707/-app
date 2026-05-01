/**
 * 虚拟时光详情页
 * 展示单个专题的详细内容
 */

import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Clock } from 'lucide-react';
import { virtualTimeTopics } from '../data/virtualTimeData';

export function VirtualTimeDetail() {
  const { topicId } = useParams();
  const navigate = useNavigate();
  
  const topic = virtualTimeTopics.find(t => t.id === topicId);

  if (!topic) {
    return (
      <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">专题不存在</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-cream-50 dark:bg-gray-900">
      {/* 头部 */}
      <header className={`bg-gradient-to-b ${topic.coverGradient} text-white safe-top relative`}>
        <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center opacity-20">
          <span className="text-[150px]">{topic.coverEmoji}</span>
        </div>
        
        <div className="relative px-4 pt-4 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">AI生成内容</span>
          </div>
          
          <h1 className="text-2xl font-bold mb-2">{topic.title}</h1>
          <p className="text-white/80 text-sm">{topic.description}</p>
        </div>
      </header>

      {/* 内容列表 */}
      <main className="px-4 -mt-4 max-w-lg mx-auto space-y-4">
        {topic.items.map((item, index) => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* 图片类型 */}
            {item.type === 'image' && (
              <>
                <div className={`h-48 bg-gradient-to-br ${topic.coverGradient} relative flex items-center justify-center`}>
                  <div className="text-center">
                    <span className="text-6xl block mb-2">{topic.coverEmoji}</span>
                    <span className="text-white/60 text-sm">AI生成预览</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-800 dark:text-white text-lg">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
                    {item.description}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-400">{item.date}</span>
                    <div className="flex-1" />
                    {item.tags?.map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* 文字类型 */}
            {item.type === 'text' && (
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">{item.emoji || '📝'}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 dark:text-white">{item.title}</h3>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 text-sm leading-relaxed">
                      {item.content}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-400">{item.date}</span>
                      <div className="flex-1" />
                      {item.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 朋友圈类型 */}
            {item.type === 'moment' && (
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-400 flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl">{item.authorAvatar}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-gray-800 dark:text-white">{item.authorName}</span>
                      <span className="text-xs text-gray-400">{item.time}</span>
                    </div>
                    <p className="text-gray-800 dark:text-white font-medium">{item.title}</p>
                    <p className="text-gray-600 dark:text-gray-300 mt-1 text-sm">{item.content}</p>
                    {item.images && (
                      <div className="flex gap-2 mt-2">
                        {item.images.map((img, idx) => (
                          <div key={idx} className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
                            {img}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-gray-400 text-sm">
                      <span>❤️ {item.likes}</span>
                      <span>💬 {item.comments}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 唐诗类型 */}
            {item.type === 'poem' && (
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl">📜</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-800 dark:text-white text-lg">{item.title}</h3>
                      <span className="text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                        {item.difficulty}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">— {item.author}</p>
                    <p className="text-primary-600 dark:text-primary-400 font-medium leading-relaxed whitespace-pre-line">
                      {item.content}
                    </p>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                        {item.translation}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {item.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* AI生成提示 */}
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl p-4 text-center border border-violet-100 dark:border-violet-800">
          <Sparkles className="w-5 h-5 text-violet-500 mx-auto mb-2" />
          <p className="text-violet-700 dark:text-violet-300 text-sm font-medium">
            以上内容由AI生成，仅供娱乐参考
          </p>
          <p className="text-violet-500 dark:text-violet-400 text-xs mt-1">
            希望能为您和家人带来温暖和快乐~
          </p>
        </div>

        <div className="h-8" />
      </main>
    </div>
  );
}

export default VirtualTimeDetail;

/**
 * 访客排行榜组件
 * 展示来访次数排名
 */

import { Trophy, Users, Heart } from 'lucide-react';

export function VisitorRanking({ ranking = [], totalVisits = 0, onRefresh }) {
  if (ranking.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-800 dark:text-white">来访排行榜</h3>
        </div>
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-gray-500 dark:text-gray-400">暂无来访记录</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            分享邀约链接给亲友，获取更多祝福~
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-800 dark:text-white">来访排行榜</h3>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-sm text-primary-500 hover:text-primary-600"
          >
            刷新
          </button>
        )}
      </div>

      {/* 统计 */}
      <div className="flex items-center justify-center gap-6 mb-4 pb-4 border-b border-gray-100 dark:border-gray-700">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {ranking.length}
          </p>
          <p className="text-xs text-gray-400">位访客</p>
        </div>
        <div className="w-px h-8 bg-gray-200 dark:bg-gray-600" />
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {totalVisits}
          </p>
          <p className="text-xs text-gray-400">次打卡</p>
        </div>
      </div>

      {/* 排名列表 */}
      <div className="space-y-2">
        {ranking.slice(0, 10).map((item, index) => (
          <div
            key={item.visitorName}
            className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${
              index < 3
                ? 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            {/* 排名 */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
              index === 0
                ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow-lg'
                : index === 1
                ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-600'
                : index === 2
                ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}>
              {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
            </div>

            {/* 称呼 */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-800 dark:text-white truncate">
                {item.visitorName}
              </p>
              {index === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">👑 榜首</p>
              )}
            </div>

            {/* 次数 */}
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {item.count}
              </p>
              <p className="text-xs text-gray-400">次</p>
            </div>

            {/* 心形装饰 */}
            {index === 0 && (
              <Heart className="w-4 h-4 text-red-400 animate-pulse flex-shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* 提示 */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
          💡 同一称呼每天只能打卡一次，每次+1积分
        </p>
      </div>
    </div>
  );
}

export default VisitorRanking;

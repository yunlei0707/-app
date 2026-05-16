/**
 * 骨架屏组件
 */

export function LoadingSkeleton() {
  return (
    <div className="min-h-screen pb-20">
      {/* 头部骨架 */}
      <div className="bg-gradient-to-b from-primary-400 to-primary-500 px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full skeleton" />
            <div className="w-24 h-6 skeleton" />
          </div>
          <div className="w-20 h-8 skeleton rounded-full" />
        </div>
        
        {/* 宝宝信息骨架 */}
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full skeleton" />
            <div className="flex-1 space-y-2">
              <div className="w-24 h-5 skeleton" />
              <div className="w-32 h-4 skeleton" />
              <div className="w-40 h-3 skeleton" />
            </div>
          </div>
        </div>
        
        {/* 筛选骨架 */}
        <div className="flex gap-2 mt-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-16 h-8 skeleton rounded-full" />
          ))}
        </div>
      </div>
      
      {/* 内容骨架 */}
      <div className="px-4 -mt-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="card animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-20 h-4 skeleton" />
              <div className="w-6 h-6 skeleton rounded-full" />
            </div>
            <div className="w-full h-40 skeleton rounded-xl mb-3" />
            <div className="w-full h-4 skeleton rounded mb-2" />
            <div className="w-3/4 h-4 skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

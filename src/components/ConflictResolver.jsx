/**
 * P4阶段：冲突解决组件
 * 功能：展示同步冲突，提供选项供用户解决
 */

import React, { useState, useEffect } from 'react';
import {
  getConflicts,
  resolveConflict,
  resolveAllConflicts,
  getUnresolvedConflictCount,
  computeDiff,
  formatConflictType,
  RESOLVE_STRATEGY,
  onConflictsChanged,
} from '../utils/conflictResolver';

/**
 * 冲突徽章组件（显示在导航栏等位置）
 */
export function ConflictBadge({ onClick }) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    return onConflictsChanged(({ count: newCount }) => {
      setCount(newCount);
    });
  }, []);
  
  if (count === 0) return null;
  
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full hover:bg-red-600 transition-colors"
    >
      {count}
    </button>
  );
}

/**
 * 冲突详情弹窗组件
 */
export function ConflictResolverModal({ isOpen, onClose }) {
  const [conflicts, setConflicts] = useState([]);
  const [selectedConflict, setSelectedConflict] = useState(null);
  const [diff, setDiff] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      loadConflicts();
    }
  }, [isOpen]);
  
  useEffect(() => {
    if (selectedConflict) {
      const diffResult = computeDiff(
        selectedConflict.localVersion,
        selectedConflict.remoteVersion
      );
      setDiff(diffResult);
    } else {
      setDiff(null);
    }
  }, [selectedConflict]);
  
  const loadConflicts = () => {
    const allConflicts = getConflicts();
    setConflicts(allConflicts.filter(c => !c.resolved));
  };
  
  const handleResolve = async (strategy) => {
    if (!selectedConflict) return;
    
    setIsResolving(true);
    try {
      await resolveConflict(selectedConflict.id, strategy);
      loadConflicts();
      setSelectedConflict(null);
    } catch (e) {
      console.error('解决冲突失败:', e);
    } finally {
      setIsResolving(false);
    }
  };
  
  const handleResolveAll = async (strategy) => {
    setIsResolving(true);
    try {
      await resolveAllConflicts(strategy);
      loadConflicts();
      setSelectedConflict(null);
    } catch (e) {
      console.error('批量解决冲突失败:', e);
    } finally {
      setIsResolving(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* 头部 */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">数据冲突</h2>
            <p className="text-sm text-gray-500 mt-1">
              检测到 {conflicts.length} 条数据需要您确认处理方式
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            ✕
          </button>
        </div>
        
        {/* 内容区 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：冲突列表 */}
          <div className="w-1/3 border-r overflow-y-auto">
            {conflicts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">🎉</div>
                <p>暂无冲突需要处理</p>
              </div>
            ) : (
              <div className="divide-y">
                {conflicts.map((conflict) => (
                  <button
                    key={conflict.id}
                    onClick={() => setSelectedConflict(conflict)}
                    className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                      selectedConflict?.id === conflict.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {conflict.recordType === 'moment' ? '动态记录' : '宝宝信息'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        conflict.type === 'both_modified' 
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {formatConflictType(conflict.type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      检测时间: {new Date(conflict.detectedAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* 右侧：冲突详情 */}
          <div className="flex-1 overflow-y-auto">
            {selectedConflict ? (
              <div className="p-4">
                {/* 冲突说明 */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-yellow-500 mr-2">⚠️</span>
                    <div>
                      <h3 className="font-medium text-yellow-800">冲突说明</h3>
                      <p className="text-sm text-yellow-700 mt-1">
                        这条记录在两台设备上都被修改了，请您选择保留哪个版本
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 差异对比 */}
                {diff && diff.count > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">差异详情 ({diff.count} 处)</h4>
                    <div className="space-y-2">
                      {diff.fields.map((field, index) => (
                        <div key={index} className="border rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-3 py-1 text-sm font-medium text-gray-600">
                            {field.field}
                          </div>
                          <div className="grid grid-cols-2 divide-x">
                            <div className="p-3 bg-blue-50">
                              <div className="text-xs text-blue-600 font-medium mb-1">本地版本</div>
                              <div className="text-sm text-gray-800">
                                {JSON.stringify(field.local)}
                              </div>
                            </div>
                            <div className="p-3 bg-green-50">
                              <div className="text-xs text-green-600 font-medium mb-1">云端版本</div>
                              <div className="text-sm text-gray-800">
                                {JSON.stringify(field.remote)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* 解决选项 */}
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700 mb-2">选择处理方式</h4>
                  
                  <button
                    onClick={() => handleResolve(RESOLVE_STRATEGY.KEEP_LOCAL)}
                    disabled={isResolving}
                    className="w-full p-3 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-blue-700">保留本地版本</div>
                    <div className="text-xs text-gray-500">云端数据将被本地数据覆盖</div>
                  </button>
                  
                  <button
                    onClick={() => handleResolve(RESOLVE_STRATEGY.KEEP_REMOTE)}
                    disabled={isResolving}
                    className="w-full p-3 text-left border rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-green-700">保留云端版本</div>
                    <div className="text-xs text-gray-500">本地数据将被云端数据覆盖</div>
                  </button>
                  
                  <button
                    onClick={() => handleResolve(RESOLVE_STRATEGY.KEEP_BOTH)}
                    disabled={isResolving}
                    className="w-full p-3 text-left border rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium text-purple-700">两者都保留</div>
                    <div className="text-xs text-gray-500">创建两条独立的记录</div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <div className="text-4xl mb-2">👈</div>
                <p>请从左侧选择一个冲突查看详情</p>
              </div>
            )}
          </div>
        </div>
        
        {/* 底部操作 */}
        <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            共 {conflicts.length} 条未处理冲突
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => handleResolveAll(RESOLVE_STRATEGY.KEEP_LOCAL)}
              disabled={isResolving || conflicts.length === 0}
              className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              全部保留本地
            </button>
            <button
              onClick={() => handleResolveAll(RESOLVE_STRATEGY.KEEP_REMOTE)}
              disabled={isResolving || conflicts.length === 0}
              className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              全部保留云端
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-100"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 默认导出
export default {
  ConflictBadge,
  ConflictResolverModal,
};

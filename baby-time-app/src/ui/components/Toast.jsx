/**
 * Toast 提示组件
 */

import { useApp } from '@state/store/AppContext';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export function Toast() {
  const { toast } = useApp();
  
  if (!toast) return null;
  
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <XCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />,
  };
  
  const bgColors = {
    success: 'bg-white dark:bg-gray-800',
    error: 'bg-white dark:bg-gray-800',
    info: 'bg-white dark:bg-gray-800',
  };
  
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 toast-enter">
      <div className={`${bgColors[toast.type]} px-4 py-3 rounded-xl shadow-lg flex items-center gap-2`}>
        {icons[toast.type]}
        <span className="text-gray-700 dark:text-gray-200 text-sm font-medium whitespace-nowrap">
          {toast.message}
        </span>
      </div>
    </div>
  );
}

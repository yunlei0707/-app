/**
 * 个人中心页面
 * 优化版本：MusicPlayer折叠式、横向滚动宝宝卡片、设置抽屉、回收站入口
 */

import 
{ useState, useRef, useCallback, useEffect } from 'react';
import 
{ useNavigate } from 'react-router-dom';
import 
{ useApp } from '../store/AppContext';
import 
{ 
  Moon, Sun, Download, Upload, Trash2, ChevronRight, Heart, LogOut, User, 
  Palette, Tag, Tags, Edit3, Plus, X, Check, Image, Users, Trophy, Sparkles, Copy, Check as CheckIcon, ChevronDown,
  HelpCircle, Shield, FileText, Info
} from 'lucide-react';
import 
{ 
  // V1 数据兼容
  exportAllData as exportAllIDBData, 
  importAllData, 
  importAllDataV2, 
  importFromZipStream, 
  importMultipleFiles, 
  PRESET_AVATARS, 
  getAllBabies, 
  getMomentsByBaby, 
  getCapsulesByBaby, 
  addMoment, 
  deleteBaby,
  // V2 数据
  exportV2AccountData, 
  importV2AccountData, 
  isSystemAccount,
} from '../repositories/stateRepository';
import { exportAllData, exportAllDataWithVideos, triggerDownload } from '../services/exportService.js';
import JSZipLib from 'jszip';
import 
{ calculateAge } from '../utils/dateUtils';
import 
{ BabyHeader } from '../components/BabyHeader';
import 
{ getCurrentV2Account, getCurrentBabyInfo, isSystemAccount as checkIsSystemAccount } from '../repositories/stateRepository';
import { isInApp, exportToFile, importFromFile } from '../utils/jsBridge';
import { ImportProgressModal } from '../components/ImportProgressModal';
import { ImportProgressCalculator } from '../utils/progressCalculator';
import { deleteMediaFile, saveMediaBlobAtPath } from '../repositories/mediaRepository.js';

// 主题预设配置
const THEME_PRESETS = [
  
{ id: 'pink', name: '默认粉橙', color: '#FF7B70', gradient: 'from-primary-400 to-primary-500' },
  
{ id: 'forest', name: '森林绿', color: '#34D399', gradient: 'from-emerald-400 to-emerald-500' },
  
{ id: 'ocean', name: '海洋蓝', color: '#60A5FA', gradient: 'from-blue-400 to-blue-500' },
  
{ id: 'lavender', name: '薰衣草紫', color: '#A78BFA', gradient: 'from-violet-400 to-violet-500' },
  
{ id: 'sunshine', name: '暖阳黄', color: '#FBBF24', gradient: 'from-amber-400 to-amber-500' },
];

function collectImportMedia(data) {
  const result = [];
  const addMedia = (item) => {
    if (item?.id && item?.path) result.push(item);
  };
  const scanMoment = (moment) => {
    if (!moment || typeof moment !== 'object') return;
    if (Array.isArray(moment.media)) moment.media.forEach(addMedia);
    if (Array.isArray(moment.photos)) moment.photos.forEach(addMedia);
    if (Array.isArray(moment.videos)) moment.videos.forEach(addMedia);
    if (Array.isArray(moment.audios)) moment.audios.forEach(addMedia);
  };

  (data?.v2AccountData?.timeline || []).forEach(scanMoment);
  (data?.data?.moments || []).forEach(scanMoment);
  (data?.moments || []).forEach(scanMoment);

  const byId = new Map();
  result.forEach(item => {
    if (!byId.has(item.id)) byId.set(item.id, item);
  });
  return [...byId.values()];
}

function zipFolderForMedia(type, path = '') {
  if (type === 'photo' || path.includes('/photos/')) return 'photos';
  if (type === 'audio' || path.includes('/audio/') || path.includes('/audios/')) return 'audios';
  return 'videos';
}

async function importZipMediaFiles(zipContent, data, { onProgress, onMessage, onCancelCheck } = {}) {
  const mediaItems = collectImportMedia(data);
  const fileMap = data?.fileMap || {};
  if (mediaItems.length === 0) return { total: 0, imported: 0, failed: 0 };

  let imported = 0;
  let failed = 0;
  for (let i = 0; i < mediaItems.length; i++) {
    if (onCancelCheck?.()) throw new Error('导入已取消');
    const media = mediaItems[i];
    const mapped = fileMap[media.id];
    const folder = zipFolderForMedia(media.type, media.path);
    const archiveName = mapped?.fileName || media.fileName || media.name || media.path.split('/').pop();
    const candidates = [
      `${folder}/${archiveName}`,
      `${folder}/${media.path.split('/').pop()}`,
    ];
    const zipFile = candidates.map(path => zipContent.file(path)).find(Boolean);

    if (!zipFile) {
      console.warn('[Import] 媒体文件缺失:', media.id, candidates);
      failed++;
      continue;
    }

    try {
      const blob = await zipFile.async('blob');
      const tempPath = `BabyTime/import_tmp/${Date.now()}_${archiveName}`;
      await saveMediaBlobAtPath(tempPath, blob);
      await saveMediaBlobAtPath(media.path, blob);
      await deleteMediaFile(tempPath);
      imported++;
      const percent = Math.round((imported / mediaItems.length) * 100);
      onProgress?.(percent);
      onMessage?.(`正在导入媒体 ${imported}/${mediaItems.length}`);
    } catch (e) {
      console.error('[Import] 媒体文件导入失败:', media.path, e);
      failed++;
    }
  }

  return { total: mediaItems.length, imported, failed };
}

// 名场面emoji选项
const EMOJI_OPTIONS = ['⭐', '🌱', '💪', '📚', '✨', '🎈', '🎀', '🌟', '💫', '🌈', '☀️', '🌙', '❤️', '🎉', '👏', '🦋', '🌸', '🍀'];

export function ProfilePage(
{ onEditBaby, onAddBaby, onOpenRecycleBin, onOpenCapsules }) 
{
  const navigate = useNavigate();
  const 
{ 
    currentBaby, 
    babies,
    setBabies,
    setMoments,
    setCapsules,
    theme, 
    themePreset,
    customThemeColor,
    toggleTheme, 
    setTheme,
    showToast,
    currentUser,
    logout,
    refreshBabies,
    updateUserProfile,
    customMilestones,
    addMilestone,
    updateMilestone,
    deleteMilestone,
    switchBaby,
    deleteBaby,
    customMoods,
    addMood,
    updateMood,
    deleteMood,
    refreshMoments,
    refreshCapsules,
  } = useApp();
  
  const fileInputRef = useRef(null);
  const colorInputRef = useRef(null);
  const containerRef = useRef(null);
  
  // 状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState('');
  // ZIP导出状态
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportProgressMessage, setExportProgressMessage] = useState('');
  const [exportStats, setExportStats] = useState(null);
  const [showZipExportModal, setShowZipExportModal] = useState(false);
  const [showZipSuccessModal, setShowZipSuccessModal] = useState(false);
  const [zipSuccessFilename, setZipSuccessFilename] = useState('');
  const [zipSuccessFilePath, setZipSuccessFilePath] = useState('');
  const [zipIncludeVideos, setZipIncludeVideos] = useState(true);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [milestoneForm, setMilestoneForm] = useState(
{ label: '', emoji: '⭐', color: '#FF7B70' });
  // 错误提示弹窗
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState('');
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [errorModalType, setErrorModalType] = useState('error');

  // 显示错误弹窗
  const showErrorModalFunc = useCallback((title, message, type = 'error') => {
    setErrorModalTitle(title);
    setErrorModalMessage(message);
    setErrorModalType(type);
    setShowErrorModal(true);
  }, []);
  
  // 心情标签管理状态
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [editingMood, setEditingMood] = useState(null);
  const [moodForm, setMoodForm] = useState(
{ label: '', emoji: '😊' });
  
  // 设置面板抽屉状态 - 已移除，内容整合到主体菜单
  
  // 导入模式
  const [importMode, setImportMode] = useState('merge');
  const [importFile, setImportFile] = useState(null);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importMessage, setImportMessage] = useState('准备中...');
  const [importStatus, setImportStatus] = useState('running'); // running | success | error
  const [importError, setImportError] = useState(null);
  const importCancelRef = useRef(false);
  const [isMultiFileMode, setIsMultiFileMode] = useState(false);
  
  const [showTagGroup, setShowTagGroup] = useState(false);
  
  // 分组折叠状态 - 数据管理和"其他"默认折叠
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [showOther, setShowOther] = useState(false);
  
  // v2 账号系统状态
  const [v2AccountInfo, setV2AccountInfo] = useState(null);
  const [hasV2Baby, setHasV2Baby] = useState(false);
  
  // 监听账号切换
  useEffect(() => 
{
    const updateV2Info = () => 
{
      const account = getCurrentV2Account();
      const babyInfo = getCurrentBabyInfo();
      setV2AccountInfo(account || null);
      setHasV2Baby(!!babyInfo);
    };
    
    updateV2Info();
    
    // 监听 localStorage 变化
    window.addEventListener('storage', updateV2Info);
    // 轮询更新
    const interval = setInterval(updateV2Info, 5000);
    
    return () => 
{
      window.removeEventListener('storage', updateV2Info);
      clearInterval(interval);
    };
  }, []);
  
  // 检查是否为系统账号
  const isSystemAccount = v2AccountInfo?.isSystem === true;
  const openThemeModal = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setShowThemeModal(true);
  }, []);
  
  const generateWaveform = useCallback(() => 
{
    return Array(32).fill(0).map(() => Array(6).fill(0).map(() => Math.random() * 255));
  }, []);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const scrollTop = useRef(0);
  
  // 刷新数据
  const refreshData = useCallback(async () => 
{
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try 
{
      // 调用全局store的刷新方法，这样所有页面都能看到更新
      await refreshBabies();
      
      if (currentBaby?.id) 
{
        await Promise.all([
          refreshMoments(currentBaby.id),
          refreshCapsules(currentBaby.id)
        ]);
      }
      
      showToast('刷新成功', 'success');
    } catch (error) 
{
      console.error('刷新数据失败:', error);
      showToast('刷新失败', 'error');
    } finally 
{
      setIsRefreshing(false);
    }
  }, [currentBaby, isRefreshing, refreshBabies, refreshMoments, refreshCapsules, showToast]);
  
  // 下拉刷新处理已禁用，避免移动端出现网页式下拉刷新反馈。
  const handleTouchStart = useCallback(() => {
    setPullDistance(0);
  }, []);

  const handleTouchMove = useCallback(() => {
    setPullDistance(0);
  }, []);

  const handleTouchEnd = useCallback(() => {
    setPullDistance(0);
  }, []);

  // 显示导出选择弹窗
  const handleExport = useCallback(() => {
    setShowZipExportModal(true);
  }, []);

  // 原JSON导出（保持向后兼容）
  const handleExportJSON = useCallback(async () => {
    try {
      const idbData = await exportAllIDBData();
      const v2Data = exportV2AccountData();
      const mergedData = {
        ...idbData,
        v2AccountData: v2Data,
      };
      const jsonStr = JSON.stringify(mergedData, null, 2);
      setExportData(jsonStr);
      setShowExportModal(true);
      
      if (isInApp()) {
        try {
          await exportToFile(jsonStr);
        } catch (e) {
          console.log('APP文件分享失败，将使用传统方式');
        }
      }
    } catch (error) {
      console.error('导出失败:', error);
      showToast('导出失败', 'error');
    }
  }, [showToast]);

  // ZIP导出（包含视频）
  // 适配新的exportAllData返回格式：支持原生文件系统导出（返回filePath）和JSZip导出（返回blob）
  const handleExportZIP = useCallback(async (includeVideos = false) => {
    if (isExporting) return;
    
    setIsExporting(true);
    setExportProgress(0);
    setExportProgressMessage("准备导出...");
    setExportStats(null);
    
    try {
      // 调用导出函数：
      // - includeVideos=true: 使用exportAllDataWithVideos（终极方案）
      // - includeVideos=false: 使用exportAllData（仅JSON）
      const exportFunction = includeVideos ? exportAllDataWithVideos : exportAllData;
      const exportResult = await exportFunction({
        includeVideos,
        onProgress: ({ progress, message, stats }) => {
          setExportProgress(progress);
          setExportProgressMessage(message);
          if (stats) {
            setExportStats(stats);
          }
        }
      });
      
      let finalFilename = "";
      let finalFilePath = "";
      
      if (exportResult.isNative && exportResult.filePath) {
        // ========== 原生文件系统导出成功 ==========
        console.log("[ProfilePage] 原生文件系统导出成功:", exportResult.filePath);
        finalFilename = exportResult.filename;
        finalFilePath = exportResult.filePath;
      } else if (exportResult.blob) {
        // ========== JSZip导出成功（降级方案） ==========
        console.log("[ProfilePage] 使用JSZip导出（降级方案）");
        
        // 生成文件名
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
        finalFilename = `宝宝时光数据备份_${timestamp}.zip`;
        
        // APP环境：写入系统下载目录
        if (isInApp()) {
          try {
            const { jsBridgeFS } = await import("../utils/jsBridge");
            finalFilePath = `fs://file/BabyTimeBackup/${finalFilename}`;
            
            // Blob转Base64写入
            const reader = new FileReader();
            await new Promise((resolve, reject) => {
              reader.onload = async () => {
                try {
                  const base64 = reader.result.split(",")[1];
                  await jsBridgeFS.writeBinary(finalFilePath, base64);
                  resolve();
                } catch (e) {
                  reject(e);
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(exportResult.blob);
            });
          } catch (e) {
            console.log("APP写入失败，将使用传统方式");
            triggerDownload(exportResult.blob, finalFilename);
            finalFilePath = ""; // 浏览器下载，无文件路径
          }
        } else {
          // 浏览器环境：触发下载
          triggerDownload(exportResult.blob, finalFilename);
          finalFilePath = ""; // 浏览器下载，无文件路径
        }
      } else {
        throw new Error("导出结果无效");
      }
      
      // 显示成功弹窗
      setZipSuccessFilename(finalFilename);
      setZipSuccessFilePath(finalFilePath);
      setZipIncludeVideos(includeVideos);
      setShowZipSuccessModal(true);
      setShowZipExportModal(false);
    } catch (error) {
      console.error("ZIP导出失败:", error);
      showErrorModalFunc("导出失败", error.message || "导出失败，请重试", "error");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, showErrorModalFunc]);
  // 取消ZIP导出
  const handleCancelExport = useCallback(() => {
    setShowZipExportModal(false);
    setIsExporting(false);
    setExportProgress(0);
    setExportProgressMessage('');
  }, []);

  // 打开备份文件
  const handleOpenBackupFile = useCallback(async () => {
    console.log('[ProfilePage] ============== 开始打开备份文件 ==============');
    console.log('[ProfilePage] 当前zipSuccessFilePath:', zipSuccessFilePath);
    console.log('[ProfilePage] 当前文件名:', zipSuccessFilename);
    
    if (!isInApp()) {
      console.warn('[ProfilePage] 当前不在APP环境中，无法打开文件');
      showErrorModalFunc('提示', '当前环境不支持直接打开，请在文件管理中查看', 'warning');
      return;
    }
    
    // 确保路径格式正确
    let fullPath = zipSuccessFilePath;
    if (!fullPath) {
      console.warn('[ProfilePage] 文件路径为空，尝试从文件名构建路径');
      if (zipSuccessFilename) {
        fullPath = `fs://file/BabyTimeBackup/${zipSuccessFilename}`;
        console.log('[ProfilePage] 构建路径:', fullPath);
      } else {
        showErrorModalFunc('提示', '文件路径无效，请重新导出备份', 'warning');
        return;
      }
    }
    
    // 确保路径格式正确（以 fs://file/BabyTimeBackup/ 开头）
    if (!fullPath.startsWith('fs://') && !fullPath.startsWith('file://') && !fullPath.startsWith('content://')) {
      console.warn('[ProfilePage] 路径格式不正确，修正路径');
      fullPath = `fs://file/BabyTimeBackup/${zipSuccessFilename || fullPath}`;
      console.log('[ProfilePage] 修正后路径:', fullPath);
    }
    
    console.log('[ProfilePage] 最终打开路径:', fullPath);
    
    try {
      console.log('[ProfilePage] 调用 jsBridgeFS.open 方法...');
      // 使用 Promise 封装的 jsBridgeFS
      const { jsBridgeFS } = await import('../utils/jsBridge');
      await jsBridgeFS.open(fullPath);
      console.log('[ProfilePage] ✅ 打开文件成功');
      showErrorModalFunc('提示', '正在打开文件...', 'success');
    } catch (e) {
      console.error('[ProfilePage] ❌ 打开文件异常:', e);
      const errorMsg = e?.message || '未知错误';
      showErrorModalFunc('打开失败', `打开文件失败: ${errorMsg}，请在文件管理器的"下载"目录中查看`, 'error');
    }
    console.log('[ProfilePage] ============== 打开备份文件结束 ==============');
  }, [zipSuccessFilePath, zipSuccessFilename, showErrorModalFunc]);

  // 分享备份文件
  const handleShareBackupFile = useCallback(async () => {
    console.log('[ProfilePage] ============== 开始分享备份文件 ==============');
    console.log('[ProfilePage] 当前zipSuccessFilePath:', zipSuccessFilePath);
    console.log('[ProfilePage] 当前文件名:', zipSuccessFilename);
    
    if (!isInApp()) {
      console.warn('[ProfilePage] 当前不在APP环境中，无法分享文件');
      showErrorModalFunc('提示', '当前环境不支持直接分享，请在文件管理中查看', 'warning');
      return;
    }
    
    // 确保路径格式正确
    let fullPath = zipSuccessFilePath;
    if (!fullPath) {
      console.warn('[ProfilePage] 文件路径为空，尝试从文件名构建路径');
      if (zipSuccessFilename) {
        fullPath = `fs://file/BabyTimeBackup/${zipSuccessFilename}`;
        console.log('[ProfilePage] 构建路径:', fullPath);
      } else {
        showErrorModalFunc('提示', '文件路径无效，请重新导出备份', 'warning');
        return;
      }
    }
    
    // 确保路径格式正确（以 fs://file/BabyTimeBackup/ 开头）
    if (!fullPath.startsWith('fs://') && !fullPath.startsWith('file://') && !fullPath.startsWith('content://')) {
      console.warn('[ProfilePage] 路径格式不正确，修正路径');
      fullPath = `fs://file/BabyTimeBackup/${zipSuccessFilename || fullPath}`;
      console.log('[ProfilePage] 修正后路径:', fullPath);
    }
    
    console.log('[ProfilePage] 最终分享路径:', fullPath);
    
    try {
      console.log('[ProfilePage] 调用 jsBridgeFS.share 方法...');
      // 使用 Promise 封装的 jsBridgeFS
      const { jsBridgeFS } = await import('../utils/jsBridge');
      await jsBridgeFS.share(fullPath);
      console.log('[ProfilePage] ✅ 分享文件成功');
      showErrorModalFunc('提示', '正在打开分享面板...', 'success');
    } catch (e) {
      console.error('[ProfilePage] ❌ 分享文件异常:', e);
      const errorMsg = e?.message || '未知错误';
      showErrorModalFunc('分享失败', `分享文件失败: ${errorMsg}，请在文件管理器的"下载"目录中分享`, 'error');
    }
    console.log('[ProfilePage] ============== 分享备份文件结束 ==============');
  }, [zipSuccessFilePath, zipSuccessFilename, showErrorModalFunc]);
  
  // 复制到剪贴板
  const handleCopyToClipboard = useCallback(async () => 
{
    try {
      await navigator.clipboard.writeText(exportData);
      showToast('已复制到剪贴板！可粘贴到备忘录保存', 'success');
    } catch (e) {
      // 备用方案：创建临时textarea
      const textarea = document.createElement('textarea');
      textarea.value = exportData;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板！可粘贴到备忘录保存', 'success');
      } catch (e2) {
        showToast('复制失败，请手动选中下方文本复制', 'warning');
      }
      document.body.removeChild(textarea);
    }
  }, [exportData, showToast]);
  
  // 下载文件
  const handleDownloadFile = useCallback(() => 
{
    const blob = new Blob([exportData], 
{ type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `宝贝时光备份_$
{new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('文件已下载', 'success');
  }, [exportData, showToast]);

  // 从ZIP文件中解压并读取data.json
  const extractDataFromZip = async (file) => {
    const zip = new (window.JSZip || JSZipLib)();
    const zipContent = await zip.loadAsync(file);
    
    // 查找data.json文件
    const dataJsonFile = zipContent.file('data.json');
    if (!dataJsonFile) {
      throw new Error('ZIP文件中未找到data.json');
    }
    
    // 读取data.json内容
    const jsonContent = await dataJsonFile.async('string');
    return JSON.parse(jsonContent);
  };
  
  // 导入数据
  
  // 导入数据 - v2 优化版本
  const handleImportV2 = useCallback(async () => {
    if (isImporting) {
      console.log('[Import] 正在导入中，跳过重复请求');
      return;
    }
    
    console.log('[Import] 开始导入，文件:', importFile?.name, '文本长度:', importText?.length);
    
    // 支持两种方式：文件选择 或 剪贴板粘贴
    let data;
    if (importText.trim()) {
      // 方式1：从剪贴板粘贴的文本
      try {
        data = JSON.parse(importText.trim());
        console.log('[Import] 从剪贴板解析数据成功');
      } catch (e) {
        console.error('[Import] 剪贴板数据解析失败:', e);
        showErrorModalFunc('导入失败', '粘贴的数据格式错误，请检查', 'error');
        return;
      }
    } else if (importFile) {
      // 方式2：从文件选择
      try {
        const fileName = importFile.name.toLowerCase();
        console.log('[Import] 选择文件:', fileName);
        
        if (fileName.endsWith('.zip')) {
          // 处理ZIP文件 - 使用流式导入
          setShowImportModal(false);
          
          // 打开进度弹窗并初始化状态
          setIsImporting(true);
          setShowImportProgress(true);
          setImportProgress(0);
          setImportMessage('准备导入...');
          setImportStatus('running');
          setImportError(null);
          importCancelRef.current = false;
          
          try {
            console.log('[Import] 开始ZIP流式导入');
            // 先读取ZIP中的 data.json
            const JSZip = window.JSZip || JSZipLib;
            if (!JSZip) {
              throw new Error('JSZip库未加载，请检查网络连接');
            }
            
            const zip = new JSZip();
            const zipContent = await zip.loadAsync(importFile);
            const dataJsonFile = zipContent.file('data.json');
            if (!dataJsonFile) {
              throw new Error('ZIP文件中未找到data.json');
            }
            
            const jsonContent = await dataJsonFile.async('string');
            const data = JSON.parse(jsonContent);
            
            setImportProgress(20);
            const mediaImportResult = await importZipMediaFiles(zipContent, data, {
              onProgress: percent => setImportProgress(20 + Math.round(percent * 0.45)),
              onMessage: setImportMessage,
              onCancelCheck: () => importCancelRef.current,
            });
            if (mediaImportResult.total > 0) {
              console.log('[Import] 媒体导入完成:', mediaImportResult);
              setImportMessage(`媒体文件导入完成 ${mediaImportResult.imported}/${mediaImportResult.total}`);
            }
            setImportMessage('数据解析完成，开始导入...');
            
            // 优先导入 v2 数据
            if (data.v2AccountData) {
              console.log('[Import] 检测到v2数据，开始导入');
              importV2AccountData(data.v2AccountData, importMode);
              setImportProgress(70);
              setImportMessage('v2数据导入完成，准备导入视频文件...');
              await new Promise(r => setTimeout(r, 200));
            }
            
            // ========== 导入视频文件到 OPFS ==========
            const videoFiles = [];
            console.log('[Import] 开始遍历 ZIP 文件...');
            zipContent.forEach((relativePath, file) => {
              console.log('[Import] 发现文件:', relativePath, 'dir:', file.dir);
              if (false && relativePath.startsWith('videos/') && !file.dir) {
                videoFiles.push({ relativePath, file });
              }
            });
            console.log('[Import] 视频文件列表:', videoFiles.map(f => f.relativePath));
            
            if (videoFiles.length > 0) {
              console.log(`[Import] 检测到 ${videoFiles.length} 个视频文件，开始导入到 OPFS`);
              setImportMessage(`检测到 ${videoFiles.length} 个视频文件，正在导入...`);
              
              let importedVideos = 0;
              const progressCalc = new ImportProgressCalculator(videoFiles.length);
              for (let i = 0; i < videoFiles.length; i++) {
                const { relativePath, file } = videoFiles[i];
                try {
                  console.log(`[Import] 开始处理视频: ${relativePath}`);
                  
                  // 从 ZIP 中读取视频
                  console.log(`[Import] 从 ZIP 读取 blob...`);
                  const videoBlob = await file.async('blob');
                  
                  // 保存 blob 大小，用于后续验证
                  videoFiles[i].blobSize = videoBlob.size;
                  console.log(`[Import] 读取 blob 成功，大小: ${videoBlob.size} bytes`);
                  
                  const filename = relativePath.replace('videos/', '');
                  console.log(`[Import] 目标文件名: ${filename}`);
                  
                  // 写入 OPFS（直接用原文件名）
                  console.log(`[Import] 获取 OPFS 根目录...`);
                  const root = await navigator.storage.getDirectory();
                  console.log(`[Import] 创建文件句柄...`);
                  const fileHandle = await root.getFileHandle(filename, { create: true });
                  console.log(`[Import] 创建可写流...`);
                  const writable = await fileHandle.createWritable();
                  console.log(`[Import] 写入视频...`);
                  await writable.write(videoBlob);
                  console.log(`[Import] 关闭流...`);
                  await writable.close();
                  
                  importedVideos++;
                  const progress = 40 + Math.round((importedVideos / videoFiles.length) * 40);
                  setImportProgress(progress);
                  setImportMessage(progressCalc.formatMessage(filename));
                  
                  progressCalc.markFileComplete(videoBlob.size);
                  console.log(`[Import] 视频导入成功: ${filename}`);
                } catch (e) {
                  console.error('[Import] 视频导入失败:', relativePath, e);
                }
              }
              
              setImportMessage(`${importedVideos}/${videoFiles.length} 个视频导入完成，正在同步到磁盘...`);
              console.log(`[Import] 视频导入完成，共 ${importedVideos}/${videoFiles.length} 个，开始边等边验证...`);
              
              // 多次验证文件是否真的写入，最多等待 150 秒（大视频需要更多时间）
              const root = await navigator.storage.getDirectory();
              let allVerified = false;
              let retryCount = 0;
              const maxRetries = 300; // 300 * 1000ms = 300秒 = 5分钟
              
              while (!allVerified && retryCount < maxRetries) {
                allVerified = true;
                console.log(`[Import] 第 ${retryCount + 1} 次验证文件...`);
                
                for (let i = 0; i < videoFiles.length; i++) {
                  const { relativePath, blobSize } = videoFiles[i];
                  const filename = relativePath.replace('videos/', '');
                  try {
                    const handle = await root.getFileHandle(filename);
                    const file = await handle.getFile();
                    
                    // 加强验证：1. 文件大小必须 > 0  2. 大小必须和原始大小一致（误差 1% 以内）
                    if (file.size === 0) {
                      allVerified = false;
                      console.log(`[Import] 文件大小为 0，等待中: ${filename}`);
                    } else if (blobSize && Math.abs(file.size - blobSize) / blobSize > 0.01) {
                      allVerified = false;
                      console.log(`[Import] 文件大小不匹配，等待中: ${filename}, 期望: ${blobSize}, 实际: ${file.size}`);
                    } else {
                      // 额外验证：实际读取前 1KB 内容，确保文件真的可读
                      try {
                        const slice = file.slice(0, Math.min(512 * 1024, file.size)); // 验证前512KB内容
                        const buffer = await slice.arrayBuffer();
                        if (buffer.byteLength === 0) {
                          allVerified = false;
                          console.log(`[Import] 文件内容为空，等待中: ${filename}`);
                        }
                      } catch (readError) {
                        allVerified = false;
                        console.log(`[Import] 文件读取失败，等待中: ${filename}`, readError);
                      }
                    }
                  } catch (e) {
                    allVerified = false;
                    console.log(`[Import] 文件不存在，等待中: ${filename}`);
                  }
                }
                
                if (!allVerified) {
                  await new Promise(r => setTimeout(r, 500));
                  retryCount++;
                }
              }
              
              if (allVerified) {
                console.log(`[Import] 所有文件验证成功，共等待 ${retryCount * 0.5} 秒`);
                setImportMessage(`视频文件已同步到磁盘`);
              } else {
                console.warn(`[Import] 部分文件验证超时，继续刷新`);
                setImportMessage(`视频同步超时，继续刷新`);
              }
            }
            
            setImportProgress(85);
            
            // 同时也尝试导入 v1 数据（如果有的话）
            try {
              if (data.data || data.babies || data.moments) {
                console.log('[Import] 检测到v1数据，开始导入');
                await importAllDataV2(data, importMode, {
                  onProgress: (p, msg) => {
                    setImportProgress(80 + Math.round(p * 0.2));
                  },
                  onCancelCheck: () => importCancelRef.current
                });
              }
            } catch (e) {
              console.log('[Import] v1数据导入跳过:', e.message);
            }
            
            setImportStatus('success');
            setImportMessage('导入成功！');
            setImportProgress(100);
            showToast('导入成功，正在刷新...', 'success');
            console.log('[Import] ZIP导入完成，准备刷新');
            setTimeout(() => window.location.reload(), 1500);
          } catch (e) {
            console.error('[Import] ZIP导入失败:', e);
            if (e.message === '导入已取消') {
              setImportStatus('error');
              setImportMessage('导入已取消');
            } else {
              setImportStatus('error');
              setImportError(e.message || '未知错误');
              setImportMessage('导入失败');
              showErrorModalFunc('导入失败', e.message || '未知错误', 'error');
            }
          } finally {
            setIsImporting(false);
          }
          return;
        } else if (fileName.endsWith('.json')) {
          // 处理JSON文件
          console.log('[Import] 开始读取JSON文件');
          const text = await importFile.text();
          data = JSON.parse(text);
          console.log('[Import] JSON文件解析成功');
        } else {
          showErrorModalFunc('导入失败', '不支持的文件格式，请选择.json或.zip文件', 'error');
          return;
        }
      } catch (e) {
        console.error('[Import] 文件读取失败:', e);
        showErrorModalFunc('导入失败', '文件格式错误: ' + e.message, 'error');
        return;
      }
    } else if (importText.trim()) {
      // 从剪贴板粘贴的文本 - 已经解析为 data 了
      console.log('[Import] 使用剪贴板数据');
    } else {
      showErrorModalFunc('提示', '请先选择备份文件或粘贴备份数据', 'warning');
      return;
    }

    // 对于JSON数据，显示进度弹窗并执行导入
    setShowImportModal(false);
    
    setIsImporting(true);
    setShowImportProgress(true);
    setImportProgress(0);
    setImportMessage('准备导入...');
    setImportStatus('running');
    setImportError(null);
    importCancelRef.current = false;
    
    try {
      console.log('[Import] 开始JSON数据导入');
      
      // 优先导入 v2 数据
      if (data.v2AccountData) {
        console.log('[Import] 检测到v2数据，开始导入');
        importV2AccountData(data.v2AccountData, importMode);
        setImportProgress(50);
        setImportMessage('v2数据导入完成...');
        await new Promise(r => setTimeout(r, 300));
      }
      
      // 同时也尝试导入 v1 数据（如果有的话）
      try {
        if (data.data || data.babies || data.moments) {
          console.log('[Import] 检测到v1数据，开始导入');
          await importAllDataV2(data, importMode, {
            onProgress: (p, msg) => {
              setImportProgress(50 + Math.round(p * 0.5));
              if (msg) setImportMessage(msg);
            },
            onCancelCheck: () => importCancelRef.current
          });
        }
      } catch (e) {
        console.log('[Import] v1数据导入跳过:', e.message);
      }
      
      setImportStatus('success');
      setImportMessage('导入成功！');
      setImportProgress(100);
      showToast('导入成功，正在刷新...', 'success');
      console.log('[Import] JSON导入完成，准备刷新');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      console.error('[Import] JSON导入失败:', e);
      if (e.message === '导入已取消') {
        setImportStatus('error');
        setImportMessage('导入已取消');
      } else {
        setImportStatus('error');
        setImportError(e.message || '未知错误');
        setImportMessage('导入失败');
        showErrorModalFunc('导入失败', e.message || '未知错误', 'error');
      }
    } finally {
      setIsImporting(false);
    }
  }, [importFile, importText, importMode, isImporting, showErrorModalFunc, showToast]);

  // 批量导入多个文件
  const handleMultiFileImport = useCallback(async (files) => {
    if (!files || files.length === 0) {
      showErrorModalFunc('提示', '请选择至少一个文件', 'warning');
      return;
    }
    if (isImporting) return;

    setShowImportModal(false);
    
    // 打开进度弹窗并初始化状态
    setIsImporting(true);
    setShowImportProgress(true);
    setImportProgress(0);
    setImportMessage('准备导入...');
    setImportStatus('running');
    setImportError(null);
    importCancelRef.current = false;
    
    try {
      const result = await importMultipleFiles(files, importMode, {
        onProgress: (p, msg) => {
          setImportProgress(p);
          if (msg) setImportMessage(msg);
        },
        onCancelCheck: () => importCancelRef.current
      });
      setImportStatus('success');
      setImportMessage('导入成功！');
      setImportProgress(100);
      showToast(`批量导入完成：成功 ${result.success} 个，失败 ${result.failed} 个`, result.failed === 0 ? 'success' : 'warning');
      if (result.success > 0) {
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      if (e.message === '导入已取消') {
        setImportStatus('error');
        setImportMessage('导入已取消');
      } else {
        setImportStatus('error');
        setImportError(e.message || '未知错误');
        setImportMessage('导入失败');
        showErrorModalFunc('导入失败', e.message || '未知错误', 'error');
      }
    } finally {
      setIsImporting(false);
    }
  }, [importMode, isImporting, showErrorModalFunc, showToast]);

  // 关闭导入进度弹窗
  const handleCloseImportProgress = useCallback(() => {
    setShowImportProgress(false);
    setImportProgress(0);
    setImportMessage('准备中...');
    setImportStatus('running');
    setImportError(null);
  }, []);
  
  // 取消导入
  const handleCancelImport = useCallback(() => {
    importCancelRef.current = true;
  }, []);

  // 将handleImport指向新的v2版本
  const handleImport = handleImportV2;

  // 原始导入函数（保留向后兼容）
  const handleImportLegacy = useCallback(async () => 
{
    // 支持两种方式：文件选择 或 剪贴板粘贴
    // APP环境下同样支持，不做阻断
    let data;
    if (importText.trim()) {
      // 方式1：从剪贴板粘贴的文本
      try {
        data = JSON.parse(importText.trim());
      } catch (e) {
        showErrorModalFunc('导入失败', '粘贴的数据格式错误，请检查', 'error');
        return;
      }
    } else if (importFile) {
      // 方式2：从文件选择
      try {
        const fileName = importFile.name.toLowerCase();
        if (fileName.endsWith('.zip')) {
          // 处理ZIP文件
          try {
            data = await extractDataFromZip(importFile);
          } catch (e) {
            console.error('ZIP解压失败:', e);
            const errorMsg = e?.message || '未知错误';
            showErrorModalFunc('导入失败', 'ZIP解压失败: ' + errorMsg, 'error');
            return;
          }
        } else if (fileName.endsWith('.json')) {
          // 处理JSON文件
          const text = await importFile.text();
          data = JSON.parse(text);
        } else {
          showErrorModalFunc('导入失败', '不支持的文件格式，请选择.json或.zip文件', 'error');
          return;
        }
      } catch (e) {
        showErrorModalFunc('导入失败', '文件格式错误', 'error');
        return;
      }
    } else {
      showErrorModalFunc('提示', '请先选择备份文件或粘贴备份数据', 'warning');
      return;
    }
    
    setIsImporting(true);
    try 
{
      // 导入 IndexedDB 数据
      await importAllData(data, importMode);
      
      // 如果包含 v2 账号数据，也导入
      if (data.v2AccountData) {
        importV2AccountData(data.v2AccountData, importMode);
      }
      
      showToast('导入成功，正在刷新...', 'success');
      setShowImportModal(false);
      setImportText('');
      setImportFile(null);
      // 延迟刷新页面，确保toast提示能显示
      setTimeout(() => window.location.reload(), 500);
    } catch (error) 
{
      console.error('导入失败:', error);
      const errorMsg = error?.message || error?.toString() || '未知错误';
      showErrorModalFunc('导入失败', '导入失败: ' + errorMsg, 'error');
    } finally 
{
      setIsImporting(false);
    }
  }, [importFile, importText, importMode, showErrorModalFunc, refreshData, extractDataFromZip]);
  
  
  // 退出登录
  const handleLogout = useCallback(() => 
{
    logout();
    navigate('/login');
  }, [logout, navigate]);
  
  // 保存名场面
  const handleSaveMilestone = useCallback(async () => 
{
    try 
{
      if (editingMilestone) 
{
        await updateMilestone(editingMilestone.id, milestoneForm);
        showToast('更新成功', 'success');
      } else 
{
        await addMilestone(milestoneForm);
        showToast('添加成功', 'success');
      }
      setShowMilestoneModal(false);
      setEditingMilestone(null);
      setMilestoneForm(
{ label: '', emoji: '⭐', color: '#FF7B70' });
    } catch (error) 
{
      console.error('保存失败:', error);
      showErrorModalFunc('保存失败', '保存失败', 'error');
    }
  }, [editingMilestone, milestoneForm, addMilestone, updateMilestone, showToast]);

  // 保存心情标签
  const handleSaveMood = useCallback(async () => 
{
    try 
{
      if (editingMood) 
{
        await updateMood(editingMood.id, moodForm);
        showToast('更新成功', 'success');
      } else 
{
        await addMood(moodForm);
        showToast('添加成功', 'success');
      }
      setShowMoodModal(false);
      setEditingMood(null);
      setMoodForm(
{ label: '', emoji: '😊' });
    } catch (error) 
{
      console.error('保存失败:', error);
      showErrorModalFunc('保存失败', '保存失败', 'error');
    }
  }, [editingMood, moodForm, addMood, updateMood, showToast]);

  // 如果没有用户数据，显示登录提示
  if (!currentUser) 
{
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-50 dark:bg-gray-900">
        <div className="text-center p-8">
          <User className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">请先登录</p>
          <button
            onClick=
{() => navigate('/login')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg"
          >
            去登录
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div 
      ref=
{containerRef}
      className="min-h-screen pb-20"
      onTouchStart=
{handleTouchStart}
      onTouchMove=
{handleTouchMove}
      onTouchEnd=
{handleTouchEnd}
    >
      
{/* 下拉刷新指示器 */}
      
{false && (pullDistance > 0 || isRefreshing) && (
        <div 
          className="flex items-center justify-center py-3 text-gray-400 transition-transform"
          style=
{
{ transform: `translateY($
{pullDistance}px)` }}
        >
          
{isRefreshing ? (
            <div className="animate-spin w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full" />
          ) : (
            <div 
              className="w-5 h-5 border-2 border-gray-300 border-t-primary-400 rounded-full transition-transform"
              style=
{
{ transform: `rotate($
{pullDistance * 3}deg)` }}
            />
          )}
        </div>
      )}
      
      
{/* 头部 - 左上角展示账号头像和名称，参考成长数据页面 */}
      <header className="bg-gradient-to-b from-[#FFF0E0] via-[#FFF8F0] to-white safe-top">
        <div className="px-4 pt-4 pb-6">
      
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
            {/* 账号头像显示在左上角 */}
            <div 
              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-200 to-primary-300 flex items-center justify-center text-lg overflow-hidden shadow-sm"
            >
              {currentUser?.avatar ? (
                currentUser.avatar.startsWith('data:') || currentUser.avatar.startsWith('http') ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser.avatar}</span>
                )
              ) : v2AccountInfo?.accountData?.avatar ? (
                v2AccountInfo.accountData.avatar.startsWith('data:') || v2AccountInfo.accountData.avatar.startsWith('http') ? (
                  <img src={v2AccountInfo.accountData.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span>{v2AccountInfo.accountData.avatar}</span>
                )
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <h1 className="text-base font-medium text-gray-600 dark:text-gray-300">
              {currentUser?.name || "我的"}
            </h1>
            </div>
            <div className="flex items-center gap-2">
            {/* 给宝宝的信按钮 */}
            <button
              onClick={onOpenCapsules}
              className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-rose-50 to-pink-50 hover:from-rose-100 hover:to-pink-100 rounded-full transition-all shadow-sm border border-rose-100/50"
            >
              <span className="text-sm">💌</span>
              <span className="text-sm font-medium text-rose-600">给宝宝的信</span>
            </button>
            </div>
          </div>
          
          {/* 账号切换器 */}
          <BabyHeader onEditBaby={(babyInfo) => onEditBaby(babyInfo)} isSystemAccount={isSystemAccount} showToast={showToast} />
        </div>
      </header>
      
      {/* 功能菜单 - 分组结构 */}
      <main className="px-4 -mt-4 max-w-lg mx-auto space-y-3">
        
        {/* 数据管理分组 */}
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-500 mb-2 px-1">数据管理</p>
          <div className="space-y-2">
            {/* 导出数据 */}
            <button
              onClick={() => handleExport()}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Download className="w-5 h-5 text-amber-500" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">导出数据</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">备份应用数据到本地</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 导入数据 */}
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Upload className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">导入数据</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">从备份文件恢复数据</p>
              </div>
            </button>

            {/* 回收站 */}
            <button
              onClick={() => onOpenRecycleBin()}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Trash2 className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">回收站</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">查看已删除的时光记录</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 退出登录 */}
            <button
              onClick={handleLogout}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <LogOut className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">退出登录</span>
              </div>
            </button>
          </div>
        </div>

        {/* 其他分组 - 可折叠 */}
        <div>
          <button
            onClick={() => setShowOther(!showOther)}
            className="w-full flex items-center justify-between cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-2 px-1"
          >
            <p className="text-sm font-medium text-gray-500">其他</p>
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${showOther ? 'rotate-180' : ''}`} />
          </button>
          {showOther && (
            <div className="space-y-2">
            {/* 帮助与反馈 */}
            <button
              onClick={() => showToast('帮助与反馈暂未配置', 'info')}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">帮助与反馈</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">获取使用帮助或提交反馈</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 隐私政策 */}
            <button
              onClick={() => showToast('隐私政策暂未配置', 'info')}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <Shield className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">隐私政策</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">了解数据收集与使用政策</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 用户协议 */}
            <button
              onClick={() => showToast('用户协议暂未配置', 'info')}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <FileText className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm dark:text-white">用户协议</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">使用条款与免责声明</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            {/* 版本信息 */}
            <div className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 flex items-center gap-3">
              <Info className="w-5 h-5 text-gray-400" />
              <div className="flex-1 text-left">
                <span className="text-sm text-gray-700 dark:text-white">版本信息</span>
                <p className="text-xs text-gray-400 dark:text-gray-400">当前版本 v2.42.0</p>
              </div>
            </div>
          </div>
          )}
        </div>


      </main>
      
      
{/* 底部标语 */}
      <div className="text-center pb-4 pt-2 text-sm text-gray-400">
        <Heart className="w-4 h-4 inline mx-1 text-red-400" />
        用心记录每一个成长瞬间
      </div>
      
      
{/* 导入数据弹窗 */}
      
{showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 dark:text-white">导入数据</h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">导入模式</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="importMode"
                    checked=
{importMode === 'merge'}
                    onChange=
{() => setImportMode('merge')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div>
                    <p className="font-medium dark:text-white">合并导入</p>
                    <p className="text-xs text-gray-400">保留现有数据，只添加新内容</p>
                  </div>
                </label>
                <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    name="importMode"
                    checked=
{importMode === 'replace'}
                    onChange=
{() => setImportMode('replace')}
                    className="w-4 h-4 text-primary-500"
                  />
                  <div>
                    <p className="font-medium dark:text-white">覆盖导入</p>
                    <p className="text-xs text-gray-400">删除现有数据，完全替换</p>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">选择备份文件</label>
              <input
                ref=
{fileInputRef}
                type="file"
                accept=".json,.zip"
                onChange=
{(e) => { setImportFile(e.target.files?.[0] || null); setImportText(''); }}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200 file:cursor-pointer dark:file:bg-primary-900/30 dark:file:text-primary-400"
              />
              
{importFile && (
                <p className="text-sm text-green-600 mt-2">已选择: 
{importFile.name}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">支持 .json 和 .zip 格式的备份文件</p>
              
              <div className="flex items-center gap-2 my-3">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"></div>
                <span className="text-xs text-gray-400">或者</span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-600"></div>
              </div>
              
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">从剪贴板粘贴</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick=
{async () => { try { const text = await navigator.clipboard.readText(); setImportText(text); setImportFile(null); } catch(e) { showErrorModalFunc('提示', '无法读取剪贴板，请手动粘贴', 'warning'); } }}
                  className="px-3 py-1.5 text-xs bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-400"
                >
                  读取剪贴板
                </button>
              </div>
              <textarea
                value=
{importText}
                onChange=
{(e) => { setImportText(e.target.value); if (e.target.value) setImportFile(null); }}
                placeholder="粘贴备份数据（JSON格式）..."
                className="w-full h-24 text-xs p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick=
{() => { setShowImportModal(false); setImportText(''); }}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                取消
              </button>
              <button
                onClick={handleImport}
                disabled={(!importFile && !importText.trim()) || isImporting}
                className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {isImporting ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 导入进度弹窗 */}
      <ImportProgressModal
        isOpen={showImportProgress}
        onClose={handleCloseImportProgress}
        progress={importProgress}
        message={importMessage}
        status={importStatus}
        error={importError}
        onCancel={handleCancelImport}
        title="导入数据"
      />
      
{/* 导出数据弹窗 */}
      
{showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-bold mb-3 dark:text-white">📦 导出数据</h3>
            
            <div className="flex gap-2 mb-3">
              <button
                onClick=
{handleCopyToClipboard}
                className="flex-1 py-2.5 bg-primary-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1"
              >
                <Copy className="w-4 h-4" />
                复制到剪贴板
              </button>
              <button
                onClick=
{handleDownloadFile}
                className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-1"
              >
                <Download className="w-4 h-4" />
                下载文件
              </button>
            </div>
            
            <p className="text-xs text-gray-400 mb-2">APP用户建议用「复制到剪贴板」，然后粘贴到备忘录保存</p>
            
            <textarea
              value=
{exportData}
              readOnly
              className="flex-1 min-h-[120px] text-xs p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none font-mono"
            />
            
            <button
              onClick=
{() => { setShowExportModal(false); setExportData(''); }}
              className="mt-3 w-full py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      )}
      
      {/* ZIP导出选择弹窗 */}
      {showZipExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-4 dark:text-white">📦 选择导出方式</h3>
            
            {!isExporting ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  ZIP格式可同时导出数据和视频文件，推荐使用
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleExportZIP(true)}
                    className="w-full py-3 bg-primary-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-primary-600 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    <div className="text-left">
                      <div>导出为ZIP（推荐）</div>
                      <div className="text-xs opacity-80">包含所有数据 + 视频文件</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleExportZIP(false)}
                    className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                  >
                    <FileText className="w-5 h-5" />
                    <div className="text-left">
                      <div>仅导出数据</div>
                      <div className="text-xs opacity-80">不含视频，文件较小</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowZipExportModal(false);
                      handleExportJSON();
                    }}
                    className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                    <div className="text-left">
                      <div>传统JSON导出</div>
                      <div className="text-xs opacity-80">纯文本格式</div>
                    </div>
                  </button>
                </div>
                
                <button
                  onClick={handleCancelExport}
                  className="mt-4 w-full py-2 text-gray-500 dark:text-gray-400 text-sm font-medium"
                >
                  取消
                </button>
              </>
            ) : (
              <>
                {/* 导出进度显示 */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">{exportProgressMessage}</span>
                    <span className="font-medium text-primary-500">{exportProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-primary-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${exportProgress}%` }}
                    />
                  </div>
                </div>
                
                {exportStats && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mb-4 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-gray-500 dark:text-gray-400">动态数量:</div>
                      <div className="font-medium dark:text-white">{exportStats.v2Timeline || exportStats.oldMoments} 条</div>
                      <div className="text-gray-500 dark:text-gray-400">视频数量:</div>
                      <div className="font-medium dark:text-white">{exportStats.totalVideos} 个</div>
                      {exportStats.opfsVideos > 0 && (
                        <>
                          <div className="text-gray-500 dark:text-gray-400">OPFS视频:</div>
                          <div className="font-medium dark:text-white">{exportStats.opfsVideos} 个</div>
                        </>
                      )}
                      {exportStats.base64Videos > 0 && (
                        <>
                          <div className="text-gray-500 dark:text-gray-400">Base64视频:</div>
                          <div className="font-medium dark:text-white">{exportStats.base64Videos} 个</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-gray-400 text-center mb-4">
                  ⚠️ 导出过程中请勿关闭页面
                </p>
                
                <button
                  disabled={true}
                  className="w-full py-3 bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded-xl font-medium cursor-not-allowed"
                >
                  正在导出...
                </button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* ZIP导出成功弹窗 */}
      {showZipSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2 dark:text-white">✅ 备份文件已下载完成！</h3>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 mb-6 text-sm space-y-3">
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">文件名：</div>
                <div className="font-medium dark:text-white font-mono break-all">{zipSuccessFilename}</div>
              </div>
              <div>
                <div className="text-gray-500 dark:text-gray-400 mb-1">保存位置：</div>
                <div className="font-medium dark:text-white">系统下载文件夹，可在文件管理中查看</div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
                <div className="text-gray-500 dark:text-gray-400 text-xs">
                  💡 提示：解压后包含数据文件{zipIncludeVideos ? '和所有视频' : ''}。
                </div>
              </div>
            </div>
            
            {/* 打开和分享按钮 - 始终显示，非APP环境点击时提示 */}
            <div className="flex gap-3 mb-3">
              <button
                onClick={handleOpenBackupFile}
                className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                立即打开
              </button>
              <button
                onClick={handleShareBackupFile}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                分享文件
              </button>
            </div>
            
            <button
              onClick={() => setShowZipSuccessModal(false)}
              className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
      
      
{/* 个人资料编辑弹窗 */}
      
      
{/* 主题设置弹窗 */}
      
{false && showThemeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold mb-6 dark:text-white">选择主题</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              
{THEME_PRESETS.map(preset => (
                <button
                  key=
{preset.id}
                  onClick=
{() => setTheme(preset.id)}
                  className=
{`p-4 rounded-xl flex flex-col items-center gap-2 transition-all $
{
                    themePreset === preset.id 
                      ? 'ring-2 ring-offset-2 ring-gray-400' 
                      : ''
                  }`}
                  style=
{
{ backgroundColor: preset.color + '20' }}
                >
                  <div 
                    className="w-10 h-10 rounded-full"
                    style=
{
{ backgroundColor: preset.color }}
                  />
                  <span className="text-xs font-medium dark:text-white">
{preset.name}</span>
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-3 mb-6">
              <label className="text-sm font-medium dark:text-gray-300">自定义颜色:</label>
              <input
                ref=
{colorInputRef}
                type="color"
                value=
{customThemeColor || '#EC4899'}
                onChange=
{(e) => setTheme('custom', e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer"
              />
            </div>
            
            <button
              onClick=
{() => setShowThemeModal(false)}
              className="w-full py-2 bg-primary-500 text-white rounded-lg font-medium"
            >
              完成
            </button>
          </div>
        </div>
      )}
      
      
{/* 名场面编辑弹窗 */}
      
{false && showMilestoneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6 dark:text-white">
              
{editingMilestone ? '编辑名场面' : '添加名场面'}
            </h3>
            
            
{/* 名称 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">名场面名称</label>
              <input
                type="text"
                value=
{milestoneForm.label}
                onChange=
{(e) => setMilestoneForm(m => (
{ ...m, label: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="如: 第一次游泳"
              />
            </div>
            
            
{/* emoji选择 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">选择图标</label>
              <div className="grid grid-cols-9 gap-1">
                
{EMOJI_OPTIONS.map((emoji, i) => (
                  <button
                    key=
{i}
                    onClick=
{() => setMilestoneForm(m => (
{ ...m, emoji }))}
                    className=
{`aspect-square rounded-lg text-xl flex items-center justify-center transition-all $
{
                      milestoneForm.emoji === emoji
                        ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    
{emoji}
                  </button>
                ))}
              </div>
            </div>
            
            
{/* 颜色选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">选择颜色</label>
              <input
                type="color"
                value=
{milestoneForm.color}
                onChange=
{(e) => setMilestoneForm(m => (
{ ...m, color: e.target.value }))}
                className="w-full h-12 rounded-lg cursor-pointer"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick=
{() => setShowMilestoneModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                取消
              </button>
              <button
                onClick=
{handleSaveMilestone}
                disabled=
{!milestoneForm.label}
                className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                保存
              </button>
            </div>
            
            
{/* 已有名场面列表 */}
            
{customMilestones.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-3 dark:text-gray-300">已有的名场面自定义</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  
{customMilestones.map(ms => (
                    <div
                      key=
{ms.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span>
{ms.emoji}</span>
                        <span className="text-sm dark:text-white">
{ms.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick=
{() => 
{
                            setEditingMilestone(ms);
                            setMilestoneForm(
{ label: ms.label, emoji: ms.emoji, color: ms.color });
                          }}
                          className="p-1 text-gray-500 hover:text-primary-500"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick=
{() => deleteMilestone(ms.id)}
                          className="p-1 text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      
{/* 心情标签编辑弹窗 */}
      
{false && showMoodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-6 dark:text-white">
              
{editingMood ? '编辑心情标签' : '添加心情标签'}
            </h3>
            
            
{/* 名称 */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">心情名称</label>
              <input
                type="text"
                value=
{moodForm.label}
                onChange=
{(e) => setMoodForm(m => (
{ ...m, label: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="如: 兴奋"
              />
            </div>
            
            
{/* emoji选择 */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2 dark:text-gray-300">选择表情</label>
              <div className="grid grid-cols-9 gap-1">
                
{EMOJI_OPTIONS.map((emoji, i) => (
                  <button
                    key=
{i}
                    onClick=
{() => setMoodForm(m => (
{ ...m, emoji }))}
                    className=
{`aspect-square rounded-lg text-xl flex items-center justify-center transition-all $
{
                      moodForm.emoji === emoji
                        ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                        : 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                  >
                    
{emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick=
{() => setShowMoodModal(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium"
              >
                取消
              </button>
              <button
                onClick=
{handleSaveMood}
                disabled=
{!moodForm.label}
                className="flex-1 py-2 bg-primary-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                保存
              </button>
            </div>
            
            
{/* 已有自定义心情标签列表 */}
            
{customMoods.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium mb-3 dark:text-gray-300">已有的自定义心情标签</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  
{customMoods.map(mood => (
                    <div
                      key=
{mood.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span>
{mood.emoji}</span>
                        <span className="text-sm dark:text-white">
{mood.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick=
{() => 
{
                            setEditingMood(mood);
                            setMoodForm(
{ label: mood.label, emoji: mood.emoji });
                          }}
                          className="p-1 text-gray-500 hover:text-primary-500"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick=
{() => deleteMood(mood.id)}
                          className="p-1 text-gray-500 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      
      {showErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className={`p-4 ${
              errorModalType === 'error' ? 'bg-red-50 dark:bg-red-900/30' : 
              errorModalType === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/30' : 
              'bg-green-50 dark:bg-green-900/30'
            }`}>
              <div className="flex items-center justify-center mb-2">
                {errorModalType === 'error' ? (
                  <X className="w-12 h-12 text-red-500" />
                ) : errorModalType === 'warning' ? (
                  <HelpCircle className="w-12 h-12 text-yellow-500" />
                ) : (
                  <Check className="w-12 h-12 text-green-500" />
                )}
              </div>
              <h3 className="text-lg font-bold text-center text-gray-800 dark:text-gray-200">
                {errorModalTitle}
              </h3>
            </div>
            <div className="p-4">
              <p className="text-gray-600 dark:text-gray-400 text-center whitespace-pre-wrap">
                {errorModalMessage}
              </p>
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowErrorModal(false)}
                className={`w-full py-3 rounded-xl font-semibold text-white ${
                  errorModalType === 'error' ? 'bg-red-500 hover:bg-red-600' : 
                  errorModalType === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' : 
                  'bg-green-500 hover:bg-green-600'
                } transition-colors`}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

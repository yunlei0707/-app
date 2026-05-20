/**
 * 动态编辑表单组件
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Image, Video, FileText, Star, MapPin, AlertCircle, Mic, Square, Play, Pause, Navigation, Search, Upload } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { getCurrentBabyInfo, isSystemAccount } from '../utils/dbV2';
import { isInApp, jsBridgeAudioRecorder } from '../utils/jsBridge';
import { saveVideo, deleteVideo } from '../utils/storageAdapter';
import { ImportProgressCalculator } from '../utils/progressCalculator';
import { shouldUseFileStorage } from '../utils/storageCheck';
import { STORAGE_CONFIG } from '../config/storage';
import { saveAudioFile, deleteAudioFile, generateFileId, preInitAudioDB, inferAudioMimeType, isSupportedAudioFormat, getFileExtension, hasFileExtension } from '../utils/audioStorage';
import { getImageSrc } from '../utils/image';
import { takePhoto, startRecording as nativeStartRecording, stopRecording as nativeStopRecording, isNativePlatform } from '../utils/native';

const moodOptions = [
  { value: 'happy', emoji: '😊', label: '开心', score: 2 },
  { value: 'excited', emoji: '🎉', label: '兴奋', score: 3 },
  { value: 'touched', emoji: '🥰', label: '感动', score: 2 },
  { value: 'calm', emoji: '😌', label: '平静', score: 1 },
  { value: 'sleepy', emoji: '😴', label: '困倦', score: 0 },
  { value: 'sad', emoji: '😢', label: '难过', score: -2 },
  { value: 'angry', emoji: '😠', label: '生气', score: -3 },
  { value: 'sick', emoji: '🤒', label: '不舒服', score: -2 },
];

// 心情选项映射（用于快速查找score）
export const moodScoreMap = {
  happy: 2,
  excited: 3,
  touched: 2,
  calm: 1,
  sleepy: 0,
  sad: -2,
  angry: -3,
  sick: -2,
};

const weatherOptions = [
  { value: 'sunny', emoji: '☀️', label: '晴天' },
  { value: 'cloudy', emoji: '⛅', label: '多云' },
  { value: 'rainy', emoji: '🌧️', label: '雨天' },
];

// 格式化时间
const formatTime2 = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function MomentForm({ moment, onSave, onCancel, babyId }) {
  const { getAllMilestones, currentBaby } = useApp();
  const [type, setType] = useState(moment?.type || 'photo');
  // 是否强制使用播客类型（隐藏类型选择）
  const isPodcastOnly = moment?.type === 'podcast' && !moment?.id;
  // 播客相关状态
  const [podcastTitle, setPodcastTitle] = useState(moment?.podcastTitle || '');
  const [podcastDescription, setPodcastDescription] = useState(moment?.podcastDescription || '');
  const [podcastAudio, setPodcastAudio] = useState(moment?.podcastAudio || null);
  const [podcastCover, setPodcastCover] = useState(moment?.podcastCover || null);
  const [content, setContent] = useState(moment?.content || '');
  const [photos, setPhotos] = useState(moment?.photos || []);
  const [videos, setVideos] = useState(moment?.videos || []); // [{url, cover, name, size}]
  const [audios, setAudios] = useState(moment?.audios || []); // [{url, duration, waveform}]
  const [mood, setMood] = useState(moment?.mood || '');
  const [weather, setWeather] = useState(moment?.weather || '');
  const [location, setLocation] = useState(moment?.location || '');
  const [locationCoords, setLocationCoords] = useState(moment?.locationCoords || null);
  const [milestone, setMilestone] = useState(moment?.milestone || '');
  const [milestoneLabel, setMilestoneLabel] = useState(moment?.milestoneLabel || '');
  const [milestoneEmoji, setMilestoneEmoji] = useState(moment?.milestoneEmoji || '');
  const [date, setDate] = useState(
    moment?.date 
      ? (() => { const d = new Date(moment.date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
      : (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })()
  );
  const [saving, setSaving] = useState(false);
  
  const videoRef = useRef(null);
  
  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioWaveform, setAudioWaveform] = useState([]);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const streamRef = useRef(null);
  
  // 播放状态
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);
  
  // 定位状态
  const [isLocating, setIsLocating] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  // 获取所有名场面选项
  const milestoneOptions = getAllMilestones();

  // 清理录音资源 & 预初始化音频数据库
  useEffect(() => {
    // 预初始化音频数据库（异步，不阻塞）
    preInitAudioDB();
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // 初始化高德地图
  useEffect(() => {
    if (showLocationModal) {
      initMap();
    }
  }, [showLocationModal]);

  // 初始化高德地图
  const initMap = useCallback(() => {
    // 检查高德地图是否已加载
    if (window.AMap) {
      setMapLoaded(true);
      createMap();
    } else {
      // 等待高德地图加载
      const checkAMap = setInterval(() => {
        if (window.AMap) {
          clearInterval(checkAMap);
          setMapLoaded(true);
          createMap();
        }
      }, 100);
      
      // 超时处理
      setTimeout(() => {
        clearInterval(checkAMap);
        if (!window.AMap) {
          setMapLoaded(false);
        }
      }, 5000);
    }
  }, []);

  // 创建地图实例
  const createMap = useCallback(() => {
    if (!window.AMap || mapRef.current) return;

    try {
      const map = new window.AMap.Map('location-map-container', {
        zoom: 15,
        center: locationCoords ? [locationCoords.lng, locationCoords.lat] : [116.397428, 39.90923],
      });

      mapRef.current = map;

      // 初始化地理编码器
      geocoderRef.current = new window.AMap.Geocoder();

      // 添加点击事件
      map.on('click', (e) => {
        const lngLat = e.lnglat;
        setLocationCoords({
          lat: lngLat.lat,
          lng: lngLat.lng
        });
        
        // 逆地理编码获取地址
        if (geocoderRef.current) {
          geocoderRef.current.getAddress(lngLat, (status, result) => {
            if (status === 'complete') {
              setLocation(result.regeocode.formattedAddress);
            }
          });
        }

        // 更新标记
        updateMarker(lngLat);
      });

      // 如果已有坐标，添加标记
      if (locationCoords) {
        updateMarker(new window.AMap.LngLat(locationCoords.lng, locationCoords.lat));
      }
    } catch (error) {
      console.error('初始化地图失败:', error);
      setMapLoaded(false);
    }
  }, [locationCoords]);

  // 更新标记
  const updateMarker = useCallback((lngLat) => {
    if (!mapRef.current || !window.AMap) return;

    // 移除旧标记
    if (markerRef.current) {
      mapRef.current.remove(markerRef.current);
    }

    // 添加新标记
    markerRef.current = new window.AMap.Marker({
      position: lngLat,
      icon: new window.AMap.Icon({
        size: new window.AMap.Size(32, 32),
        image: '//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png',
        imageSize: new window.AMap.Size(32, 32),
      }),
      offset: new window.AMap.Pixel(-16, -32),
    });

    mapRef.current.add(markerRef.current);
  }, []);

  // 搜索地址
  const searchAddress = useCallback(() => {
    if (!searchKeyword.trim() || !window.AMap || !geocoderRef.current) return;

    geocoderRef.current.getLocation(searchKeyword, (status, result) => {
      if (status === 'complete' && result.geocodes.length > 0) {
        const firstResult = result.geocodes[0];
        const locationObj = firstResult.location;
        
        setLocationCoords({
          lat: locationObj.lat,
          lng: locationObj.lng
        });
        setLocation(firstResult.formattedAddress);

        // 移动地图
        if (mapRef.current) {
          mapRef.current.setCenter(locationObj);
          updateMarker(locationObj);
        }
      } else {
        alert('未找到相关地址');
      }
    });
  }, [searchKeyword, updateMarker]);

  // 停止录音（浏览器方式）
  const stopBrowserRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsRecording(false);
  };
  
  // 停止录音（APP方式）
  const stopAppRecording = async () => {
    try {
      const result = await jsBridgeAudioRecorder.stopRecord();
      const duration = result?.duration || recordingTime;
      
      // 读取录音数据并存入IndexedDB（避免Base64内存开销）
      const base64 = await jsBridgeAudioRecorder.read();
      const blob = jsBridgeAudioRecorder.toBlob(base64, 'audio/mp4');
      
      // 生成唯一文件ID并存入IndexedDB
      const fileId = generateFileId();
      await saveAudioFile(fileId, blob, {
        name: `recording_${Date.now()}.mp4`,
        type: 'audio/mp4',
        duration: duration
      });
      
      // 生成临时预览URL（不存入JSON，只用于当前会话显示）
      const displayURL = URL.createObjectURL(blob);
      
      // 生成模拟波形数据
      const simulatedWaveform = [];
      for (let i = 0; i < 50; i++) {
        simulatedWaveform.push(Array.from({length: 32}, () => Math.random() * 200));
      }
      
      // ✅ 只存fileId引用，不存Base64，避免JSON体积爆炸
      const audioData = {
        audioFileId: fileId,
        displayURL: displayURL,
        duration: duration,
        waveform: simulatedWaveform,
        storageType: 'indexeddb-blob'
      };
      setAudios(prev => [...prev, audioData]);
      
      setIsRecording(false);
      return true;
    } catch (error) {
      console.error('APP停止录音失败:', error);
      setIsRecording(false);
      alert('录音保存失败: ' + (error.message || '未知错误'));
      return false;
    }
  };
  
  // 停止录音（统一入口）
  const stopRecording = async () => {
    // 清理计时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (isNativePlatform()) {
      console.log('[录音] 停止Capacitor原生录音');
      try {
        const result = await nativeStopRecording();
        if (result && result.base64) {
          // 将base64转成blob，然后存入文件系统（不是IndexedDB）
          const base64Data = result.base64;
          const mimeType = result.mimeType || 'audio/m4a';
          const byteCharacters = atob(base64Data);
          const byteArrays = [];
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          const blob = new Blob(byteArrays, { type: mimeType });
          
          // ✅ 保存到文件系统（只存filename，不存整个Base64）
          const fileToSave = new File([blob], `recording_${Date.now()}.m4a`, { type: mimeType });
          const { filename, storageType } = await saveVideo(fileToSave);
          console.log('[录音] 保存到文件系统:', { filename, storageType });
          
          const audioData = {
            filename,
            storageType,
            name: `recording_${Date.now()}.m4a`,
            size: blob.size,
            duration: recordingTime,
            waveform: [...audioWaveform],
            mimeType,
            isImported: false,
          };
          setAudios(prev => [...prev, audioData]);
        }
        setIsRecording(false);
        console.log('[录音] 录音保存完成');
      } catch (e) {
        console.error('[录音] 原生录音停止失败:', e);
        setIsRecording(false);
        alert('录音保存失败: ' + (e.message || '未知错误'));
      }
    } else {
      stopBrowserRecording();
    }
  };
  
  // 开始录音（浏览器方式）
  const startBrowserRecording = async () => {
    // 先检查是否支持录音
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('当前浏览器不支持录音功能，请使用Chrome或Safari浏览器');
      return;
    }
    
    // 检查是否在安全上下文（HTTPS或localhost或file://协议）
    // APP环境下Capacitor使用http://localhost或file://协议，都是允许的
    const isSecure = location.protocol === 'https:' || 
                     location.hostname === 'localhost' ||
                     location.hostname === '127.0.0.1' ||
                     location.protocol === 'file:';
    
    if (!isSecure) {
      console.warn('[录音] 非安全上下文:', { protocol: location.protocol, hostname: location.hostname });
      alert('录音功能需要HTTPS安全连接，请使用HTTPS访问');
      return;
    }
    
    console.log('[录音] 开始浏览器录音，安全上下文检查通过');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    
    // 设置音频分析器
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;
    
    // 开始录音
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorderRef.current = mediaRecorder;
    audioChunksRef.current = [];
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunksRef.current.push(e.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // ✅ 存入IndexedDB，避免Base64内存开销
      const fileId = generateFileId();
      await saveAudioFile(fileId, audioBlob, {
        name: `recording_${Date.now()}.webm`,
        type: 'audio/webm',
        duration: recordingTime
      });
      
      // 生成临时预览URL（不存入JSON）
      const displayURL = URL.createObjectURL(audioBlob);
      
      const audioData = {
        audioFileId: fileId,
        displayURL: displayURL,
        duration: recordingTime,
        waveform: [...audioWaveform],
        storageType: 'indexeddb-blob'
      };
      setAudios(prev => [...prev, audioData]);
    };
    
    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    setAudioWaveform([]);
    
    // 开始计时
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 599) { // 10分钟限制
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    
    // 开始波形采集
    const captureWaveform = () => {
      if (!analyserRef.current) return;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      // 采样32个点
      const sampled = [];
      for (let i = 0; i < 32; i++) {
        sampled.push(dataArray[Math.floor(i * dataArray.length / 32)]);
      }
      setAudioWaveform(prev => [...prev.slice(-200), sampled]); // 保留最近200帧
      animationRef.current = requestAnimationFrame(captureWaveform);
    };
    captureWaveform();
    
    } catch (error) {
      console.error('[录音] 浏览器录音失败:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('麦克风权限被拒绝，请在设置中允许访问麦克风');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('未找到麦克风设备，请检查麦克风是否连接正常');
      } else {
        alert('录音启动失败：' + (error.message || '未知错误'));
      }
    }
  };
  
  // 开始录音（APP方式）
  const startAppRecording = async () => {
    try {
      // 设置监听器
      jsBridgeAudioRecorder.setListener({
        onDuration: (duration) => {
          setRecordingTime(Math.floor(duration));
        },
        onAmplitude: (amplitude) => {
          // 将振幅数据转换为波形格式
          const normalized = [];
          for (let i = 0; i < 32; i++) {
            // 模拟32个频段的振幅
            normalized.push(Math.min(255, amplitude * (0.5 + Math.random())));
          }
          setAudioWaveform(prev => [...prev.slice(-200), normalized]);
        },
        onMaxDuration: () => {
          stopRecording();
        },
        onStopped: (data) => {
          // 处理停止事件
        }
      });
      
      await jsBridgeAudioRecorder.startRecord({
        maxDuration: 60,
        hiddenUI: true,
        source: 'mic'
      });
      
      setIsRecording(true);
      setRecordingTime(0);
      setAudioWaveform([]);
      
    } catch (error) {
      console.error('APP开始录音失败:', error);
      alert('无法启动录音：' + (error.message || '未知错误'));
    }
  };
  
  // 开始录音（统一入口）
  const startRecording = async () => {
    // 先弹个框，确认点击事件触发了
    alert('1️⃣ 点击事件已触发！');
    
    try {
      alert('2️⃣ 开始检测环境...');
      const isNative = isNativePlatform();
      alert(`3️⃣ 环境检测结果: isNative=${isNative}`);
      
      if (isNative) {
        alert('4️⃣ 开始调用原生录音...');
        await nativeStartRecording();
        alert('5️⃣ ✅ 原生录音调用成功！');
        
        setIsRecording(true);
        setRecordingTime(0);
        setAudioWaveform([]);
        // 开始计时
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => {
            if (prev >= 599) {
              stopRecording();
              return prev;
            }
            return prev + 1;
          });
        }, 1000);
        alert('6️⃣ ✅ 录音已启动！UI已更新');
      } else {
        alert('4️⃣ 不是原生环境，检测Capacitor...');
        // APP环境下也用原生录音，即使isNativePlatform返回false
        if (window.Capacitor) {
          alert('5️⃣ 检测到Capacitor，强制使用原生录音');
          await nativeStartRecording();
          setIsRecording(true);
          setRecordingTime(0);
          timerRef.current = setInterval(() => {
            setRecordingTime(prev => prev + 1);
          }, 1000);
        } else {
          alert('5️⃣ 使用浏览器录音');
          await startBrowserRecording();
        }
      }
    } catch (e) {
      alert(`❌ 录音失败: ${e.message}`);
      console.error('[录音] 失败:', e);
    }
  };
  
  // 删除音频
  const removeAudio = (index) => {
    setAudios(prev => prev.filter((_, i) => i !== index));
  };

  // 播客音频上传 - 使用 IndexedDB 直接存储 Blob，避免 Base64 内存开销
  const handlePodcastAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('[Podcast Upload] ===== 开始上传（IndexedDB Blob模式）=====');
    console.log('[Podcast Upload] 文件信息:', { 
      type: file.type, 
      name: file.name, 
      size: file.size,
      sizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB'
    });
    
    // 1. 检查音频格式是否支持
    if (!isSupportedAudioFormat(file.name)) {
      const ext = getFileExtension(file.name) || '（无扩展名）';
      alert(`不支持的音频格式 "${ext}"。\n支持的格式：mp3, wav, m4a, aac, ogg, flac`);
      e.target.value = '';
      return;
    }
    
    // 2. 检查是否无扩展名，给出提示但不阻止上传
    const hasExt = hasFileExtension(file.name);
    if (!hasExt) {
      console.log('[Podcast Upload] 文件无扩展名，将尝试按 MP3 格式播放');
      alert('无法识别音频格式，将尝试按 MP3 格式播放');
    }
    
    // 3. 推断正确的 MIME type（优先 File.type，其次扩展名，都没有则默认 audio/mpeg）
    let audioBlob = file;
    const inferredMimeType = inferAudioMimeType(file.name, file.type);
    
    if (!file.type || file.type === 'application/octet-stream' || (hasExt && file.type !== inferredMimeType)) {
      console.log('[Podcast Upload] 调整 MIME type:', {
        original: file.type,
        inferred: inferredMimeType,
        reason: !file.type ? 'File.type 为空' : (file.type === 'application/octet-stream' ? '为通用二进制类型' : '与扩展名推断不一致')
      });
      audioBlob = new Blob([file], { type: inferredMimeType });
    }
    
    console.log('[Podcast Upload] 最终使用的 Blob:', {
      type: audioBlob.type,
      size: audioBlob.size
    });
    
    // 3. 限制音频大小 - IndexedDB 支持更大文件，但移动端还是做限制
    const MAX_AUDIO_SIZE = 50 * 1024 * 1024; // 提升到 50MB
    if (file.size > MAX_AUDIO_SIZE) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      alert(`音频文件过大（${sizeMB}MB），不能超过50MB，请压缩后重试`);
      e.target.value = '';
      return;
    }
    
    // 显示加载提示
    setSaving(true);
    
    try {
      // 1. 生成唯一的 fileId
      const fileId = generateFileId('podcast');
      console.log('[Podcast Upload] 生成 fileId:', fileId);
      
      // 2. 临时 URL 用于立即预览播放 - 直接用 File 对象创建，无需编码
      const displayURL = URL.createObjectURL(file);
      console.log('[Podcast Upload] 已创建临时预览URL');
      
      // 3. 获取音频时长
      console.log('[Podcast Upload] 开始获取音频时长...');
      const audioDuration = await new Promise((resolve) => {
        const tempAudio = new Audio();
        tempAudio.onloadedmetadata = () => {
          console.log('[Podcast Upload] 音频时长获取成功:', tempAudio.duration);
          resolve(Math.round(tempAudio.duration));
        };
        tempAudio.onerror = () => {
          console.warn('[Podcast Upload] 音频时长获取失败，使用默认值');
          resolve(0);
        };
        tempAudio.src = displayURL;
        // 超时处理：5秒后返回0
        setTimeout(() => resolve(0), 5000);
      });
      
      // 4. 直接将 Blob 存入 IndexedDB，不转 Base64！
      // 这样完全避免了大文件在内存中的编码开销
      console.log('[Podcast Upload] 开始保存 Blob 到 IndexedDB...');
      await saveAudioFile(fileId, audioBlob, {
        name: file.name,
        type: audioBlob.type,
        category: 'podcast',
        duration: audioDuration
      });
      console.log('[Podcast Upload] IndexedDB 保存成功！');
      
      // 5. formData 中只保存 fileId 引用，极大减少数据体积
      const audioData = {
        audioFileId: fileId,  // 新格式：只存 fileId 引用
        displayURL: displayURL, // 临时 URL 用于当前会话的预览播放
        name: file.name,
        size: file.size,
        mimeType: audioBlob.type, // 保存正确的 MIME type
        duration: audioDuration,  // 实际音频时长
        storageType: 'indexeddb-blob' // 标记存储类型
      };
      
      setPodcastAudio(audioData);
      console.log('[Podcast Upload] ===== 上传成功（Blob模式）=====');
      
    } catch (error) {
      console.error('[Podcast Upload] ===== 上传失败 =====');
      console.error('[Podcast Upload] 错误类型:', error.name);
      console.error('[Podcast Upload] 错误消息:', error.message);
      console.error('[Podcast Upload] 完整错误:', error);
      
      // 降级方案：如果 IndexedDB 失败，尝试传统方式
      console.log('[Podcast Upload] IndexedDB失败，尝试降级方案...');
      try {
        const file = e.target.files[0];
        const displayURL = URL.createObjectURL(file);
        
        // 获取音频时长
        const audioDuration = await new Promise((resolve) => {
          const tempAudio = new Audio();
          tempAudio.onloadedmetadata = () => resolve(Math.round(tempAudio.duration));
          tempAudio.onerror = () => resolve(0);
          tempAudio.src = displayURL;
          setTimeout(() => resolve(0), 5000);
        });
        
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('音频读取失败'));
          reader.readAsDataURL(file);
        });
        
        setPodcastAudio({
          url: base64,
          displayURL: displayURL,
          name: file.name,
          size: file.size,
          duration: audioDuration,
          storageType: 'base64'
        });
      } catch (fallbackError) {
        let userMessage = '播客音频上传失败，请重试';
        if (error.message.includes('内存') || error.name === 'OutOfMemoryError') {
          userMessage = '文件过大导致内存不足，请使用更小的音频文件';
        }
        alert(userMessage);
      }
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };
  
  // ✅ 原生相机/相册上传播客封面
  const handleNativePodcastCoverUpload = async () => {
    try {
      // 调用原生API拍照或从相册选择
      const photoUri = await takePhoto({
        quality: 85,
        width: 1920,
        height: 1920
      });
      
      if (photoUri) {
        // 存储文件URI而不是Base64
        setPodcastCover(photoUri);
        
        if (STORAGE_CONFIG.DEBUG_MODE) {
          console.log('[MomentForm] 播客封面上传成功:', photoUri.substring(0, 50) + '...');
        }
      }
    } catch (error) {
      console.error('[MomentForm] 播客封面上传失败:', error);
      if (error.message !== '未选择图片') {
        alert('播客封面上传失败，请重试');
      }
    }
  };

  // 播客封面上传 - 上传时立即转Base64避免File对象失效
  const handlePodcastCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('[Podcast Cover Upload] 开始上传:', { type: file.type, name: file.name, size: file.size });

    try {
      // 临时URL用于立即预览
      const displayURL = URL.createObjectURL(file);
      
      // 立即转成Base64存入state
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('封面读取失败'));
        reader.readAsDataURL(file);
      });
      
      setPodcastCover({
        url: base64,  // 直接存base64用于保存
        displayURL: displayURL,  // 临时URL用于预览
        name: file.name,
        type: file.type,
        size: file.size
      });
      
      console.log('[Podcast Cover Upload] 上传成功！已转Base64');
      
    } catch (error) {
      console.error('[MomentForm] 播客封面上传失败:', error);
      alert(error.message || '播客封面上传失败，请重试');
    } finally {
      e.target.value = '';
    }
  };
  
  // 删除播客音频
  const removePodcastAudio = async () => {
    if (!podcastAudio) {
      setPodcastAudio(null);
      return;
    }
    
    try {
      // 1. 如果是 IndexedDB Blob 格式，删除数据库中的文件
      if (podcastAudio.audioFileId) {
        await deleteAudioFile(podcastAudio.audioFileId);
        console.log('[Podcast Upload] IndexedDB音频文件已删除:', podcastAudio.audioFileId);
      }
      // 2. 如果是 OPFS 格式，删除文件
      else if (podcastAudio.filename) {
        await deleteVideoFromOPFS(podcastAudio.filename);
        await deleteFileMetadata(podcastAudio.filename);
        console.log('[Podcast Upload] OPFS文件已删除:', podcastAudio.filename);
      }
      
      // 3. 释放临时预览 URL
      if (podcastAudio.displayURL) {
        URL.revokeObjectURL(podcastAudio.displayURL);
        console.log('[Podcast Upload] 临时预览URL已释放');
      }
    } catch (e) {
      console.error('[Podcast Upload] 删除音频文件失败:', e);
    }
    
    setPodcastAudio(null);
  };
  
  // 删除播客封面
  const removePodcastCover = () => {
    setPodcastCover(null);
  };

  // 音频文件上传处理 - 上传时立即转Base64避免File对象失效
  const handleAudioUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    console.log('[Audio Upload] 开始上传:', { type: file.type, name: file.name, size: file.size });

    // 1. 检查音频格式是否支持
    if (!isSupportedAudioFormat(file.name)) {
      const ext = getFileExtension(file.name) || '（无扩展名）';
      alert(`不支持的音频格式 "${ext}"。\n支持的格式：mp3, wav, m4a, aac, ogg, flac`);
      e.target.value = '';
      return;
    }
    
    // 2. 检查是否无扩展名，给出提示但不阻止上传
    const hasExt = hasFileExtension(file.name);
    if (!hasExt) {
      console.log('[Audio Upload] 文件无扩展名，将尝试按 MP3 格式播放');
      alert('无法识别音频格式，将尝试按 MP3 格式播放');
    }
    
    // 3. 推断正确的 MIME type
    const inferredMimeType = inferAudioMimeType(file.name, file.type);
    
    try {
      // 临时URL用于立即预览播放
      let audioBlob = file;
      if (!file.type || file.type === 'application/octet-stream' || (hasExt && file.type !== inferredMimeType)) {
        console.log('[Audio Upload] 调整 MIME type:', {
          original: file.type,
          inferred: inferredMimeType
        });
        audioBlob = new Blob([file], { type: inferredMimeType });
      }
      
      const displayURL = URL.createObjectURL(audioBlob);
      
      // ✅ 存入文件系统，不再用Base64
      const useFS = await shouldUseFileStorage();
      let audioData;
      
      if (useFS) {
        // 使用文件系统：原生APP或OPFS（复用saveVideo函数，文件系统不区分类型）
        const fileToSave = new File([audioBlob], file.name, { type: inferredMimeType });
        const { filename, storageType } = await saveVideo(fileToSave);
        console.log('[Audio Upload] 保存到文件系统:', { filename, storageType });
        
        audioData = {
          filename,        // 文件名，不存Base64避免JSON超限
          storageType,     // 'native' or 'opfs'
          displayURL,      // 临时URL用于预览播放
          duration: 0,
          waveform: [],    // 简化波形
          fileName: file.name,
          fileType: inferredMimeType,
          fileSize: file.size,
          isImported: true
        };
      } else {
        // 降级：Base64方式
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('音频读取失败'));
          reader.readAsDataURL(audioBlob);
        });
        
        audioData = {
          url: base64,
          displayURL,
          duration: 0,
          waveform: [],
          fileName: file.name,
          fileType: inferredMimeType,
          fileSize: file.size,
          isImported: true
        };
      }
      
      setAudios(prev => [...prev, audioData]);
      console.log('[Audio Upload] 上传成功！');
      
    } catch (error) {
      console.error('[MomentForm] 音频上传失败:', error);
      alert(error.message || '音频上传失败，请重试');
    } finally {
      e.target.value = '';
    }
  };

  // 播放/暂停音频
  const togglePlayAudio = (index) => {
    if (playingIndex === index) {
      audioRef.current?.pause();
      setPlayingIndex(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      // 优先使用displayURL（临时ObjectURL）播放，避免base64解码延迟
      const audioUrl = audios[index].displayURL || audios[index].url;
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlayingIndex(null);
      audioRef.current.play();
      setPlayingIndex(index);
    }
  };

  // 获取当前位置（高德地图 + 备用浏览器定位）
  const getCurrentLocation = async () => {
    setIsLocating(true);

    // 优先使用高德地图定位
    if (window.AMap) {
      try {
        const geolocation = new window.AMap.Geolocation({
          enableHighAccuracy: true,
          timeout: 10000,
        });

        geolocation.getCurrentPosition((status, result) => {
          if (status === 'complete') {
            const { lat, lng } = result.position;
            setLocationCoords({ lat, lng });
            
            // 逆地理编码获取地址
            if (geocoderRef.current) {
              geocoderRef.current.getAddress(new window.AMap.LngLat(lng, lat), (geoStatus, geoResult) => {
                if (geoStatus === 'complete') {
                  setLocation(geoResult.regeocode.formattedAddress);
                } else {
                  setLocation(`位置: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                }
              });
            }
          } else {
            // 高德定位失败，使用浏览器定位
            useBrowserGeolocation();
          }
          setIsLocating(false);
        });
      } catch (error) {
        console.error('高德定位失败:', error);
        useBrowserGeolocation();
      }
    } else {
      useBrowserGeolocation();
    }
  };

  // 使用浏览器定位（备用方案）
  const useBrowserGeolocation = () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持定位功能');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationCoords({ lat: latitude, lng: longitude });
        
        try {
          // 使用 Nominatim 逆地理编码
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&accept-language=zh`,
            {
              mode: 'cors',
              headers: { 'User-Agent': 'BabyTimeApp/1.0' }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              const parts = [];
              if (addr.province || addr.state) parts.push(addr.province || addr.state);
              if (addr.city) parts.push(addr.city);
              if (addr.district || addr.county) parts.push(addr.district || addr.county);
              if (addr.road) parts.push(addr.road);
              
              if (parts.length > 0) {
                setLocation(parts.slice(0, 4).join(' '));
              } else {
                setLocation(data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
              }
            } else {
              setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            }
          } else {
            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (error) {
          setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        }
        
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        let errorMsg = '定位失败';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = '请允许访问位置信息';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = '位置信息不可用';
            break;
          case error.TIMEOUT:
            errorMsg = '定位超时，请重试';
            break;
        }
        alert(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // 照片上传处理
  // 处理单个照片上传
  const processSinglePhoto = async (file, useOPFS) => {
    // 生成显示用的ObjectURL（临时）
    const displayURL = URL.createObjectURL(file);
    
    if (useOPFS) {
      // OPFS模式：存文件，不存base64
      const { filename } = await savePhotoToOPFS(file);
      return {
        filename,
        name: file.name,
        size: file.size,
        type: file.type,
        displayURL, // 临时显示用
      };
    } else {
      // Base64模式（降级）
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            url: event.target.result,
            name: file.name,
            size: file.size,
            type: file.type,
            displayURL: event.target.result,
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // ✅ 使用原生相机/相册选择照片
  const handleNativePhotoUpload = async () => {
    try {
      // 调用原生API拍照或从相册选择
      const photoUri = await takePhoto({
        quality: 85,
        width: 1920,
        height: 1920
      });
      
      if (photoUri) {
        // 存储文件URI而不是Base64
        setPhotos(prev => [...prev, photoUri]);
        
        if (STORAGE_CONFIG.DEBUG_MODE) {
          console.log('[MomentForm] 原生照片上传成功:', photoUri.substring(0, 50) + '...');
        }
      }
    } catch (error) {
      console.error('[MomentForm] 原生照片上传失败:', error);
      // 忽略用户取消选择的情况（Capacitor可能返回不同的错误信息）
      const cancelMessages = [
        '未选择图片',
        'User cancelled',
        'User cancelled photos app',
        'userCancel',
        'cancel',
      ];
      const isUserCancel = cancelMessages.some(msg => 
        error.message?.includes(msg) || error.code?.includes(msg)
      );
      if (!isUserCancel) {
        alert('照片上传失败，请重试');
      }
    }
  };

  // 照片上传 - 智能选择存储方式（OPFS或Base64）
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    try {
      // 检测是否使用OPFS
      const useOPFS = await shouldUseFileStorage();
      
      if (STORAGE_CONFIG.DEBUG_MODE) {
        console.log('[MomentForm] 照片存储模式:', useOPFS ? 'OPFS' : 'Base64');
      }

      // 并行处理所有照片
      const photoPromises = files.map(file => processSinglePhoto(file, useOPFS));
      const newPhotos = await Promise.all(photoPromises);
      
      setPhotos(prev => [...prev, ...newPhotos]);
    } catch (error) {
      console.error('[MomentForm] 照片上传失败:', error);
      alert('照片上传失败，请重试');
    } finally {
      e.target.value = '';
    }
  };

  // 生成视频封面
  const generateVideoCover = async (file) => {
    const coverUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = coverUrl;
    video.currentTime = 0.5; // 取第0.5秒作为封面
    video.muted = true;
    video.playsInline = true;
    
    const result = await new Promise((resolve) => {
      const coverTimeout = setTimeout(() => resolve({ cover: null, duration: 0 }), 5000);
      
      video.onloadeddata = () => {
        clearTimeout(coverTimeout);
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const coverImage = canvas.toDataURL('image/jpeg', 0.6);
          resolve({ cover: coverImage, duration: video.duration });
        } catch (err) {
          resolve({ cover: null, duration: video.duration });
        }
      };
      
      video.onerror = () => {
        clearTimeout(coverTimeout);
        resolve({ cover: null, duration: 0 });
      };
    });
    
    URL.revokeObjectURL(coverUrl);
    video.src = '';
    video.remove();
    return result;
  };

  // 处理单个视频上传
  const processSingleVideo = async (file, useOPFS) => {
    const { cover, duration } = await generateVideoCover(file);
    
    if (useOPFS) {
      // 文件系统模式：原生APP用Capacitor Filesystem，Web用OPFS
      const { filename, storageType } = await saveVideo(file);
      return {
        filename,
        storageType,  // 'native' or 'opfs'
        cover: cover,
        name: file.name,
        size: file.size,
        duration: duration,
      };
    } else {
      // Base64模式：传统方式
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            url: event.target.result,
            cover: cover,
            name: file.name,
            size: file.size,
            duration: duration,
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // 视频上传 - 智能选择存储方式（OPFS或Base64）
  const handleVideoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    // 检查已有视频数量 + 新上传数量是否超过3个
    if (videos.length + files.length > 1) {
      alert('为保证稳定性，一条动态最多添加1个视频');
      e.target.value = '';
      return;
    }
    
    // 限制视频大小
    for (const file of files) {
      if (file.size > STORAGE_CONFIG.MAX_VIDEO_SIZE) {
        alert(`视频文件不能超过${STORAGE_CONFIG.MAX_VIDEO_SIZE / 1024 / 1024}MB，请压缩后重试`);
        e.target.value = '';
        return;
      }
    }
    
    // 显示加载提示
    setSaving(true);
    
    try {
      // 检测是否使用OPFS
      const useOPFS = await shouldUseFileStorage();
      
      if (STORAGE_CONFIG.DEBUG_MODE) {
        console.log('[MomentForm] 视频存储模式:', useOPFS ? 'OPFS' : 'Base64');
      }
      
      // 批量处理所有视频
      const videoPromises = files.map(file => processSingleVideo(file, useOPFS));
      const newVideos = await Promise.all(videoPromises);
      
      // 批量添加视频
      setVideos(prev => [...prev, ...newVideos]);
      
    } catch (error) {
      console.error('[MomentForm] 视频上传失败:', error);
      alert('视频上传失败，请重试');
    } finally {
      setSaving(false);
    }
    
    e.target.value = '';
  };

  const removePhoto = async (index) => {
    const photo = photos[index];
    // 如果是OPFS存储的照片，删除文件
    if (photo && photo.filename) {
      try {
        await deleteVideoFromOPFS(photo.filename);
        await deleteFileMetadata(photo.filename);
      } catch (e) {
        console.error('[MomentForm] 删除照片文件失败:', e);
      }
    }
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeVideo = async (index) => {
    const video = videos[index];
    // 如果是OPFS存储的视频，删除文件
    if (video && video.filename) {
      try {
        await deleteVideo(video.filename, video.storageType);
        await deleteFileMetadata(video.filename);
      } catch (e) {
        console.error('[MomentForm] 删除视频文件失败:', e);
      }
    }
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // 系统账号不可添加/编辑记录
    if (isSystemAccount()) {
      alert("系统账号不可添加或编辑记录");
      return;
    }

    if (!content.trim() && photos.length === 0 && videos.length === 0 && audios.length === 0 && type !== 'podcast') {
      alert('请添加内容、照片、视频或语音');
      return;
    }
    
    if (!babyId) {
      alert('错误：未找到宝宝档案，请返回首页重试');
      return;
    }
    
    setSaving(true);
    
    try {
      // ====== 音频/封面已在上传时转成Base64，无需在保存时处理 ======
      // 播客音频、播客封面、普通音频都已在上传时立即转Base64并存入state
      // 避免了File对象在等待保存时失效的问题
      console.log('[Save] 文件已提前处理完成，开始保存...');
      
      const momentData = {
        babyId: babyId,
        type,
        date: new Date(date + 'T12:00:00').toISOString(), // 用中午12点避免时区偏移
        content: content.trim(),
        photos: type === 'photo' ? photos : [],
        videos: type === 'video' ? videos : [],
        audios: type === 'audio' ? audios : [],
        podcast: type === 'podcast' ? {
          title: podcastTitle,
          description: podcastDescription,
          audio: podcastAudio,
          cover: podcastCover
        } : null,
        mood,
        weather,
        location,
        locationCoords,
        milestone,
        milestoneLabel: milestone ? milestoneLabel : '',
        milestoneEmoji: milestone ? milestoneEmoji : '',
    };
    
    
      // 根据存储类型设置不同的大小限制
      // v2 账号（localStorage）：5MB 限制，安全上限 4MB
      // 普通宝宝（IndexedDB）：空间充裕，放宽到 30MB
      const babyInfo = getCurrentBabyInfo();
      // 只有两种情况是v2账号：1)没有普通宝宝 且 2)babyId匹配v2账号id
      const isV2Account = !currentBaby && babyInfo && babyInfo.id === babyId;
      const MAX_SIZE = isV2Account ? 4 * 1024 * 1024 : 30 * 1024 * 1024;
      const dataSize = JSON.stringify(momentData).length;
      
      if (dataSize > MAX_SIZE) {
        // 尝试压缩：移除视频的 cover 图片
        const compressedData = {
          ...momentData,
          videos: momentData.videos.map(v => ({ ...v, cover: null }))
        };
        const compressedSize = JSON.stringify(compressedData).length;
        
        if (isV2Account) {
          // v2 账号（localStorage）：硬限制，无法绕过
          if (compressedSize > MAX_SIZE) {
            alert('存储空间不足，当前账号存储空间有限，请减少视频/音频附件后重试');
            setSaving(false);
            return;
          }
          Object.assign(momentData, compressedData);
        } else {
          // 普通宝宝（IndexedDB）：空间充裕，压缩后仍超限只警告不阻止
          if (compressedSize > MAX_SIZE) {
            const proceed = confirm('附件数据较大，保存可能需要较长时间，是否继续？');
            if (!proceed) {
              setSaving(false);
              return;
            }
          } else {
            Object.assign(momentData, compressedData);
          }
        }
      }
      
      if (typeof onSave === 'function') {
        await onSave(momentData);
      }
    } catch (error) {
      console.error('保存失败:', error);
      if (error.name === 'QuotaExceededError' || error.message?.includes('quota') || error.message?.includes('storage')) {
        alert('存储空间不足，请减少视频/音频附件后重试');
      } else {
        alert('保存失败: ' + (error.message || '未知错误'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-cream-50 dark:bg-gray-900 z-50 overflow-y-auto">
      {/* 顶部导航 */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-cream-200 dark:border-gray-700 z-10">
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={onCancel} className="p-2 -ml-2">
            <X className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </button>
          <h2 className="font-bold text-gray-800 dark:text-white">
            {moment ? '编辑记录' : '添加记录'}
          </h2>
          <button 
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-1.5 bg-primary-500 text-white rounded-lg font-medium text-sm hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
      
      <div className="p-4 pb-24 space-y-4 max-w-lg mx-auto">
        {/* 类型选择 - 播客模式下隐藏 */}
        {!isPodcastOnly && (
          <div className="flex gap-2">
            <button
              onClick={() => setType('photo')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-colors text-sm font-medium ${
                type === 'photo' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              📷 照片
            </button>
            <button
              onClick={() => setType('video')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-colors text-sm font-medium ${
                type === 'video' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              🎬 视频
            </button>
            <button
              onClick={() => setType('audio')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-colors text-sm font-medium ${
                type === 'audio' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              🎤 语音
            </button>
            <button
              onClick={() => setType('diary')}
              className={`flex-1 flex items-center justify-center py-2.5 rounded-xl transition-colors text-sm font-medium ${
                type === 'diary' 
                  ? 'bg-primary-500 text-white' 
                  : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              ✏️ 文字
            </button>
          </div>
        )}

        {/* 播客模式提示 */}
        {isPodcastOnly && (
          <div className="flex items-center gap-2 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
            <span className="text-2xl">🎙️</span>
            <div>
              <p className="font-medium text-primary-700 dark:text-primary-300">创建播客</p>
              <p className="text-sm text-primary-600 dark:text-primary-400">添加封面、音频和描述</p>
            </div>
          </div>
        )}
        
        {/* 日期选择 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            记录日期
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
          />
        </div>
        
        {/* 名场面 - 使用自定义名场面列表 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            <Star className="w-4 h-4 inline mr-1" />
            名场面标签
          </label>
          <div className="flex flex-wrap gap-2">
            {milestoneOptions.map(option => (
              <button
                key={option.id}
                onClick={() => {
                  if (milestone === option.id) {
                    setMilestone('');
                    setMilestoneLabel('');
                    setMilestoneEmoji('');
                  } else {
                    setMilestone(option.id);
                    setMilestoneLabel(option.label);
                    setMilestoneEmoji(option.emoji);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  milestone === option.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {option.emoji} {option.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* 照片上传 */}
        {type === 'photo' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              照片
            </label>
            
            {/* 提示 */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  当前为本地模拟上传，媒体文件仅本地存储
                </p>
              </div>
            </div>
            
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 dark:bg-gray-700">
                    {/* ✅ 使用 getImageSrc 统一处理图片路径 */}
                    <img src={getImageSrc(photo.displayURL || photo.url || photo)} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* ✅ 使用原生相机/相册按钮 */}
            <button
              onClick={handleNativePhotoUpload}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:border-primary-400 transition-colors"
            >
              <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">拍照或选择照片</p>
            </button>
          </div>
        )}
        
        {/* 视频上传 */}
        {type === 'video' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              视频
            </label>
            
            {/* 提示 */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  当前为本地模拟上传，媒体文件仅本地存储
                </p>
              </div>
            </div>
            
            {videos.length > 0 && (
              <div className="grid grid-cols-2 gap-2 mb-3">
                {videos.map((video, index) => (
                  <div key={index} className="relative aspect-video rounded-xl overflow-hidden bg-gray-800">
                    {video.cover ? (
                      <img src={video.cover} alt="视频封面" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-700">
                        <Video className="w-12 h-12 text-gray-500" />
                      </div>
                    )}
                    {/* 播放按钮覆盖 */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                        <div className="w-0 h-0 border-l-[16px] border-l-gray-800 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1" />
                      </div>
                    </div>
                    <button
                      onClick={() => removeVideo(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">添加视频</p>
              </div>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
        
        {/* 语音 */}
        {type === 'podcast' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  🎙️ 播客标题
                </label>
                <input
                  type="text"
                  value={podcastTitle}
                  onChange={(e) => setPodcastTitle(e.target.value)}
                  placeholder="输入播客标题..."
                  className="w-full px-4 py-2.5 bg-cream-100 dark:bg-gray-700 rounded-xl text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  📝 播客描述
                </label>
                <textarea
                  value={podcastDescription}
                  onChange={(e) => setPodcastDescription(e.target.value)}
                  placeholder="输入播客描述..."
                  rows={3}
                  className="w-full px-4 py-2.5 bg-cream-100 dark:bg-gray-700 rounded-xl text-sm resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  🎵 播客音频
                </label>
                {podcastAudio ? (
                  <div className="flex items-center justify-between bg-cream-100 dark:bg-gray-700 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎵</span>
                      <div>
                        <p className="text-sm font-medium">{podcastAudio.name}</p>
                        <p className="text-xs text-gray-500">{formatTime2(podcastAudio.duration)}</p>
                      </div>
                    </div>
                    <button
                      onClick={removePodcastAudio}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => document.getElementById('podcast-audio-input').click()}
                    className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-primary-500 transition-colors"
                  >
                    <Mic className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">上传播客音频</span>
                  </button>
                )}
                <input
                  id="podcast-audio-input"
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handlePodcastAudioUpload}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  🖼️ 播客封面（可选）
                </label>
                {podcastCover ? (
                  <div className="relative">
                    {/* ✅ 使用 getImageSrc 统一处理图片路径 */}
                    <img
                      src={getImageSrc(typeof podcastCover === 'string' ? podcastCover : podcastCover.url)}
                      alt="播客封面"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                    <button
                      onClick={removePodcastCover}
                      className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-800 rounded-full shadow-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  // ✅ 使用原生相机/相册
                  <button
                    onClick={handleNativePodcastCoverUpload}
                    className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-center hover:border-primary-500 transition-colors"
                  >
                    <Image className="w-8 h-8 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-500 dark:text-gray-400">选择封面图片</span>
                  </button>
                )}
              </div>
            </div>
          )}
          
          {type === 'audio' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              <Mic className="w-4 h-4 inline mr-1" />
              语音
            </label>
            
            {audios.length > 0 && (
              <div className="space-y-3 mb-3">
                {audios.map((audio, index) => (
                  <div key={index} className="bg-cream-100 dark:bg-gray-700 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePlayAudio(index)}
                        className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white"
                      >
                        {playingIndex === index ? (
                          <Square className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        {audio.fileName && (
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate mb-1">
                            {audio.fileName}
                          </p>
                        )}
                        <div className="h-6 bg-primary-200 dark:bg-primary-700 rounded-full overflow-hidden flex items-end px-1">
                          {(() => {
                            const waveform = audio.waveform;
                            if (!waveform || !Array.isArray(waveform)) return null;
                            const lastFrame = waveform.slice(-1)[0];
                            if (!Array.isArray(lastFrame)) return null;
                            return lastFrame.map((val, i) => (
                              <div
                                key={i}
                                className="w-1 bg-primary-500 mx-px rounded-full"
                                style={{ height: `${Math.max(4, val / 4)}%` }}
                              />
                            ));
                          })() || <div className="flex-1" />}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500 whitespace-nowrap">{formatTime2(audio.duration)}</span>
                      <button
                        onClick={() => removeAudio(index)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-2">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                  isRecording
                    ? 'bg-red-500 text-white'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square className="w-5 h-5" />
                    <span>停止录音 ({formatTime2(recordingTime)})</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    <span>开始录音</span>
                  </>
                )}
              </button>
              
              <label className="flex-1">
                <div className="w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors bg-cream-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-cream-300 dark:hover:bg-gray-500 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <span>导入音频</span>
                </div>
                <input
                  type="file"
                  accept="audio/mp3,audio/mpeg,audio/wav,audio/m4a,audio/mp4,audio/aac,.mp3,.wav,.m4a,.aac"
                  onChange={handleAudioUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}
        
        {/* 内容输入 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            {type === 'photo' ? '说说感想' : type === 'video' ? '视频描述' : type === 'audio' ? '语音备注' : '文字内容'}
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录这一刻的感受..."
            rows={4}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
          />
        </div>
        
        {/* 心情 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            心情
          </label>
          <div className="space-y-2">
            {/* 开心 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-8 flex-shrink-0">开心</span>
              <div className="flex flex-wrap gap-2">
                {moodOptions.filter(o => o.score >= 2).map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMood(mood === option.value ? '' : option.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      mood === option.value
                        ? 'bg-green-500 text-white'
                        : 'bg-green-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 平静 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-8 flex-shrink-0">平静</span>
              <div className="flex flex-wrap gap-2">
                {moodOptions.filter(o => o.score >= -1 && o.score <= 1).map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMood(mood === option.value ? '' : option.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      mood === option.value
                        ? 'bg-blue-500 text-white'
                        : 'bg-blue-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>
            </div>
            {/* 不开心 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-8 flex-shrink-0">低落</span>
              <div className="flex flex-wrap gap-2">
                {moodOptions.filter(o => o.score <= -2).map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMood(mood === option.value ? '' : option.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      mood === option.value
                        ? 'bg-orange-500 text-white'
                        : 'bg-orange-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* 天气 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            天气
          </label>
          <div className="flex gap-2">
            {weatherOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setWeather(weather === option.value ? '' : option.value)}
                className={`px-3 py-2 rounded-xl text-sm transition-colors ${
                  weather === option.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {option.emoji}
              </button>
            ))}
          </div>
        </div>
        
        {/* 位置 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            <MapPin className="w-4 h-4 inline mr-1" />
            位置
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="输入地点名称（可选）"
            className="w-full px-4 py-2.5 bg-cream-100 dark:bg-gray-700 rounded-xl text-sm"
          />
        </div>
      </div>
      
      {/* 位置选择弹窗 */}
      {showLocationModal && (
        <div className="location-modal" onClick={() => setShowLocationModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 rounded-t-3xl w-full max-w-lg mx-auto max-h-[85vh] overflow-hidden animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* 搜索栏 */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchAddress()}
                    placeholder="搜索地址..."
                    className="w-full pl-10 pr-4 py-2 bg-cream-100 dark:bg-gray-700 rounded-xl"
                  />
                </div>
                <button
                  onClick={searchAddress}
                  className="px-4 py-2 bg-primary-500 text-white rounded-xl"
                >
                  搜索
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {location || '点击地图选择位置'}
                </span>
                <button
                  onClick={() => setShowLocationModal(false)}
                  className="px-4 py-1.5 bg-primary-500 text-white rounded-lg text-sm"
                >
                  确定
                </button>
              </div>
            </div>
            
            {/* 地图容器 */}
            <div className="relative">
              <div 
                id="location-map-container" 
                className="map-container"
                style={{ height: '350px' }}
              />
              
              {!mapLoaded && (
                <div className="absolute inset-0 flex items-center justify-center bg-cream-100 dark:bg-gray-700">
                  <div className="text-center">
                    <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">正在加载地图...</p>
                    <button
                      onClick={() => {
                        setShowLocationModal(false);
                        useBrowserGeolocation();
                      }}
                      className="mt-2 text-sm text-primary-500"
                    >
                      使用浏览器定位
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

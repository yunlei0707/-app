/**
 * 动态编辑表单组件
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Image, Video, FileText, Star, MapPin, AlertCircle, Mic, Square, Play, Pause, Navigation } from 'lucide-react';

const milestoneOptions = [
  { value: 'first', label: '第一次', emoji: '⭐' },
  { value: 'growth', label: '成长', emoji: '🌱' },
  { value: 'health', label: '健康', emoji: '💪' },
  { value: 'learning', label: '学习', emoji: '📚' },
  { value: 'daily', label: '日常', emoji: '✨' },
];

const moodOptions = [
  { value: 'happy', emoji: '😊', label: '开心' },
  { value: 'excited', emoji: '🎉', label: '兴奋' },
  { value: 'touched', emoji: '🥰', label: '感动' },
  { value: 'sleepy', emoji: '😴', label: '困倦' },
];

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
  const [type, setType] = useState(moment?.type || 'photo');
  const [content, setContent] = useState(moment?.content || '');
  const [photos, setPhotos] = useState(moment?.photos || []);
  const [videos, setVideos] = useState(moment?.videos || []); // [{url, cover, name, size}]
  const [audios, setAudios] = useState(moment?.audios || []); // [{url, duration, waveform}]
  const [mood, setMood] = useState(moment?.mood || '');
  const [weather, setWeather] = useState(moment?.weather || '');
  const [location, setLocation] = useState(moment?.location || '');
  const [milestone, setMilestone] = useState(moment?.milestone || '');
  const [milestoneLabel, setMilestoneLabel] = useState(moment?.milestoneLabel || '');
  const [date, setDate] = useState(
    moment?.date 
      ? new Date(moment.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
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

  // 清理录音资源
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // 开始录音
  const startRecording = async () => {
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
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const audioData = {
            url: reader.result,
            duration: recordingTime,
            waveform: [...audioWaveform]
          };
          setAudios(prev => [...prev, audioData]);
        };
        reader.readAsDataURL(audioBlob);
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
      alert('无法访问麦克风，请检查权限设置');
    }
  };
  
  // 停止录音
  const stopRecording = () => {
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
  
  // 删除音频
  const removeAudio = (index) => {
    setAudios(prev => prev.filter((_, i) => i !== index));
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
      audioRef.current = new Audio(audios[index].url);
      audioRef.current.onended = () => setPlayingIndex(null);
      audioRef.current.play();
      setPlayingIndex(index);
    }
  };
  
  // 获取当前位置
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert('您的浏览器不支持定位功能');
      return;
    }
    
    setIsLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // 使用高德地图逆地理编码API（免费，无需key的基础版本）
          // 或者直接显示坐标
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=16&accept-language=zh`,
            {
              mode: 'cors',
              headers: {
                'User-Agent': 'BabyTimeApp/1.0'
              }
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.address) {
              const addr = data.address;
              // 构建中文地址
              const parts = [];
              if (addr.country) parts.push(addr.country);
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
            // API请求失败，使用坐标
            setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          }
        } catch (error) {
          // 如果逆地理编码失败，显示坐标
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
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 视频上传 - 生成封面图并存储视频数据
  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // 先将视频文件转为DataURL存储
    const videoReader = new FileReader();
    videoReader.onload = (event) => {
      const videoDataURL = event.target.result;
      
      // 创建视频元素读取封面
      const video = document.createElement('video');
      video.src = videoDataURL;
      video.currentTime = 0.5; // 取第0.5秒作为封面
      video.muted = true;
      
      video.onloadeddata = () => {
        // 创建canvas绘制封面
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const coverImage = canvas.toDataURL('image/jpeg', 0.8);
          
          const videoData = {
            url: videoDataURL, // 存储实际视频数据
            cover: coverImage,
            name: file.name,
            size: file.size,
            duration: video.duration
          };
          
          setVideos(prev => [...prev, videoData]);
        } catch (err) {
          // 如果生成失败，使用默认占位
          setVideos(prev => [...prev, {
            url: videoDataURL,
            cover: null,
            name: file.name,
            size: file.size
          }]);
        }
      };
      
      video.onerror = () => {
        // 即使封面失败，也保存视频
        setVideos(prev => [...prev, {
          url: videoDataURL,
          cover: null,
          name: file.name,
          size: file.size
        }]);
      };
    };
    
    videoReader.onerror = () => {
      alert('读取视频文件失败，请重试');
    };
    
    videoReader.readAsDataURL(file);
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };
  
  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && photos.length === 0 && videos.length === 0 && audios.length === 0) {
      alert('请添加内容、照片、视频或语音');
      return;
    }
    
    if (!babyId) {
      alert('错误：未找到宝宝档案，请返回首页重试');
      return;
    }
    
    const momentData = {
      babyId: babyId,
      type,
      date: new Date(date).toISOString(),
      content: content.trim(),
      photos: type === 'photo' ? photos : [],
      videos: type === 'video' ? videos : [],
      audios: type === 'audio' ? audios : [],
      mood,
      weather,
      location,
      milestone,
      milestoneLabel: milestone ? milestoneLabel : '',
    };
    
    setSaving(true);
    
    try {
      if (typeof onSave === 'function') {
        await onSave(momentData);
      }
    } catch (error) {
      alert('保存失败: ' + error.message);
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
        {/* 类型选择 */}
        <div className="flex gap-2">
          <button
            onClick={() => setType('photo')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors text-sm ${
              type === 'photo' 
                ? 'bg-primary-500 text-white' 
                : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Image className="w-4 h-4" />
            <span>照片</span>
          </button>
          <button
            onClick={() => setType('video')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors text-sm ${
              type === 'video' 
                ? 'bg-primary-500 text-white' 
                : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>视频</span>
          </button>
          <button
            onClick={() => setType('audio')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors text-sm ${
              type === 'audio' 
                ? 'bg-primary-500 text-white' 
                : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>语音日记</span>
          </button>
          <button
            onClick={() => setType('diary')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl transition-colors text-sm ${
              type === 'diary' 
                ? 'bg-primary-500 text-white' 
                : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>日记</span>
          </button>
        </div>
        
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
        
        {/* 里程碑 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            <Star className="w-4 h-4 inline mr-1" />
            里程碑标签
          </label>
          <div className="flex flex-wrap gap-2">
            {milestoneOptions.map(option => (
              <button
                key={option.value}
                onClick={() => {
                  if (milestone === option.value) {
                    setMilestone('');
                    setMilestoneLabel('');
                  } else {
                    setMilestone(option.value);
                    setMilestoneLabel(option.label);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  milestone === option.value
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
                    <img src={photo} alt="" className="w-full h-full object-cover" />
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
            
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <Image className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">添加照片</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
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
                    {/* 删除按钮 */}
                    <button
                      onClick={() => removeVideo(index)}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    {/* 视频信息 */}
                    <div className="absolute bottom-2 left-2 right-2 flex justify-between text-xs text-white/80">
                      <span>{video.name?.substring(0, 15)}...</span>
                      {video.duration && <span>{Math.round(video.duration)}s</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <label className="block">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-primary-400 transition-colors">
                <Video className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">添加视频</p>
                <p className="text-xs text-gray-400 mt-1">支持常见视频格式</p>
              </div>
              <input
                type="file"
                accept="video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />
            </label>
          </div>
        )}
        
        {/* 语音录制 */}
        {type === 'audio' && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              语音日记
            </label>
            
            {/* 提示 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  点击录音按钮开始录制，最长支持10分钟
                </p>
              </div>
            </div>
            
            {/* 已录制的音频列表 */}
            {audios.length > 0 && (
              <div className="space-y-2 mb-3">
                {audios.map((audio, index) => (
                  <div key={index} className="bg-cream-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => togglePlayAudio(index)}
                        className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        {playingIndex === index ? (
                          <Pause className="w-5 h-5 text-white" />
                        ) : (
                          <Play className="w-5 h-5 text-white ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            语音 {index + 1}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTime2(audio.duration)}
                          </span>
                        </div>
                        {/* 波形显示 */}
                        <div className="h-8 flex items-center gap-0.5 overflow-hidden">
                          {audio.waveform?.length > 0 ? (
                            audio.waveform.slice(-50).map((frame, i) => (
                              <div key={i} className="flex items-center gap-px h-full">
                                {frame?.slice(0, 8).map((v, j) => (
                                  <div
                                    key={j}
                                    className="w-1 bg-primary-300 dark:bg-primary-600 rounded-full"
                                    style={{ height: `${Math.max(10, (v / 255) * 100)}%` }}
                                  />
                                ))}
                              </div>
                            ))
                          ) : (
                            <div className="w-full h-2 bg-primary-200 dark:bg-primary-700 rounded" />
                          )}
                        </div>
                      </div>
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
            
            {/* 录音控制 */}
            <div className="flex flex-col items-center gap-4 py-6 bg-cream-50 dark:bg-gray-800 rounded-xl">
              {/* 录音时间 */}
              {isRecording && (
                <div className="text-2xl font-mono text-primary-600 dark:text-primary-400">
                  {formatTime2(recordingTime)}
                </div>
              )}
              
              {/* 实时波形 */}
              {isRecording && audioWaveform.length > 0 && (
                <div className="w-full max-w-xs h-16 flex items-center justify-center gap-0.5">
                  {audioWaveform[audioWaveform.length - 1]?.map((v, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-primary-500 rounded-full transition-all duration-75"
                      style={{ height: `${Math.max(4, (v / 255) * 64)}px` }}
                    />
                  ))}
                </div>
              )}
              
              {/* 录音按钮 */}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
                    : 'bg-primary-500 hover:bg-primary-600'
                }`}
              >
                {isRecording ? (
                  <Square className="w-8 h-8 text-white" />
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>
              
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isRecording ? '点击停止录音' : '点击开始录音'}
              </p>
            </div>
          </div>
        )}
        
        {/* 记录内容 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            记录内容
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录宝宝的成长点滴..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none"
          />
        </div>
        
        {/* 心情 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            心情
          </label>
          <div className="flex flex-wrap gap-2">
            {moodOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setMood(mood === option.value ? '' : option.value)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  mood === option.value
                    ? 'bg-primary-500 text-white'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {option.emoji}
              </button>
            ))}
          </div>
        </div>
        
        {/* 天气 */}
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            天气
          </label>
          <div className="flex flex-wrap gap-2">
            {weatherOptions.map(option => (
              <button
                key={option.value}
                onClick={() => setWeather(weather === option.value ? '' : option.value)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
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
          <div className="flex gap-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="添加位置（可选）"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <button
              type="button"
              onClick={getCurrentLocation}
              disabled={isLocating}
              className="px-3 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Navigation className={`w-4 h-4 ${isLocating ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{isLocating ? '定位中...' : '定位'}</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">点击定位按钮获取当前位置</p>
        </div>
      </div>
    </div>
  );
}

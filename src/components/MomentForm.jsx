/**
 * 动态编辑表单组件
 * 重构版本：顶部大图上传 + 中间文本输入 + 底部快捷标签栏
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Image, Video, FileText, Star, MapPin, AlertCircle, Mic, Square, Play, Pause, Navigation, Search, Calendar, Heart, Landmark } from 'lucide-react';
import { useApp } from '../store/AppContext';

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
  const { getAllMilestones, showToast } = useApp();
  const [type, setType] = useState(moment?.type || 'photo');
  const [content, setContent] = useState(moment?.content || '');
  const [photos, setPhotos] = useState(moment?.photos || []);
  const [videos, setVideos] = useState(moment?.videos || []);
  const [audios, setAudios] = useState(moment?.audios || []);
  const [mood, setMood] = useState(moment?.mood || '');
  const [weather, setWeather] = useState(moment?.weather || '');
  const [location, setLocation] = useState(moment?.location || '');
  const [locationCoords, setLocationCoords] = useState(moment?.locationCoords || null);
  const [milestone, setMilestone] = useState(moment?.milestone || '');
  const [milestoneLabel, setMilestoneLabel] = useState(moment?.milestoneLabel || '');
  const [milestoneEmoji, setMilestoneEmoji] = useState(moment?.milestoneEmoji || '');
  const [date, setDate] = useState(
    moment?.date 
      ? new Date(moment.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [saving, setSaving] = useState(false);
  
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocoderRef = useRef(null);

  // 获取所有里程碑选项
  const milestoneOptions = getAllMilestones();

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
  
  // 初始化高德地图
  useEffect(() => {
    if (showLocationModal) {
      initMap();
    }
  }, [showLocationModal]);

  const initMap = useCallback(() => {
    if (window.AMap) {
      setMapLoaded(true);
      createMap();
    } else {
      const checkAMap = setInterval(() => {
        if (window.AMap) {
          clearInterval(checkAMap);
          setMapLoaded(true);
          createMap();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkAMap);
        if (!window.AMap) {
          setMapLoaded(false);
        }
      }, 5000);
    }
  }, []);

  const createMap = useCallback(() => {
    if (!window.AMap || mapRef.current) return;

    try {
      const map = new window.AMap.Map('location-map-container', {
        zoom: 15,
        center: locationCoords ? [locationCoords.lng, locationCoords.lat] : [116.397428, 39.90923],
      });

      mapRef.current = map;
      geocoderRef.current = new window.AMap.Geocoder();

      map.on('click', (e) => {
        const lngLat = e.lnglat;
        setLocationCoords({ lat: lngLat.lat, lng: lngLat.lng });
        
        if (geocoderRef.current) {
          geocoderRef.current.getAddress(lngLat, (status, result) => {
            if (status === 'complete') {
              setLocation(result.regeocode.formattedAddress);
            }
          });
        }

        updateMarker(lngLat);
      });

      if (locationCoords) {
        updateMarker(new window.AMap.LngLat(locationCoords.lng, locationCoords.lat));
      }
    } catch (error) {
      console.error('初始化地图失败:', error);
      setMapLoaded(false);
    }
  }, [locationCoords]);

  const updateMarker = useCallback((lngLat) => {
    if (!mapRef.current || !window.AMap) return;

    if (markerRef.current) {
      mapRef.current.remove(markerRef.current);
    }

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

  const searchAddress = useCallback(() => {
    if (!searchKeyword.trim() || !window.AMap || !geocoderRef.current) return;

    geocoderRef.current.getLocation(searchKeyword, (status, result) => {
      if (status === 'complete' && result.geocodes.length > 0) {
        const firstResult = result.geocodes[0];
        const locationObj = firstResult.location;
        
        setLocationCoords({ lat: locationObj.lat, lng: locationObj.lng });
        setLocation(firstResult.formattedAddress);

        if (mapRef.current) {
          mapRef.current.setCenter(locationObj);
          updateMarker(locationObj);
        }
      } else {
        showToast('未找到相关地址', 'error');
      }
    });
  }, [searchKeyword, updateMarker, showToast]);

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
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
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      // 波形动画
      const updateWaveform = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);
          const values = Array.from(dataArray.slice(0, 32));
          setAudioWaveform(prev => {
            const newWaveform = [...prev, values];
            if (newWaveform.length > 50) {
              return newWaveform.slice(-50);
            }
            return newWaveform;
          });
          animationRef.current = requestAnimationFrame(updateWaveform);
        }
      };
      updateWaveform();
      
    } catch (error) {
      showToast('无法访问麦克风', 'error');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  // 播放音频
  const togglePlayAudio = (index) => {
    if (playingIndex === index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingIndex(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audios[index].url);
      audioRef.current = audio;
      audio.play();
      setPlayingIndex(index);
      audio.onended = () => setPlayingIndex(null);
    }
  };

  // 删除音频
  const removeAudio = (index) => {
    setAudios(prev => prev.filter((_, i) => i !== index));
  };

  // 获取当前位置
  const useBrowserGeolocation = () => {
    if (!navigator.geolocation) {
      showToast('浏览器不支持定位', 'error');
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocationCoords({ lat: latitude, lng: longitude });
        
        // 逆地理编码
        if (window.AMap && geocoderRef.current) {
          geocoderRef.current.getAddress(new window.AMap.LngLat(longitude, latitude), (status, result) => {
            if (status === 'complete') {
              setLocation(result.regeocode.formattedAddress);
            }
          });
        }
        
        setIsLocating(false);
        showToast('定位成功');
      },
      (error) => {
        setIsLocating(false);
        showToast('定位失败', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 使用高德地图定位
  const getCurrentLocation = () => {
    useBrowserGeolocation();
  };

  // 处理图片上传
  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  // 处理视频上传
  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('video/')) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        // 生成视频封面
        const video = document.createElement('video');
        video.src = event.target.result;
        video.crossOrigin = 'anonymous';
        video.currentTime = 1;
        
        video.onloadeddata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          const cover = canvas.toDataURL('image/jpeg');
          
          setVideos(prev => [...prev, {
            url: event.target.result,
            cover: cover,
            name: file.name,
            size: file.size
          }]);
        };
      };
      reader.readAsDataURL(file);
    });
  };

  // 移除图片
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 移除视频
  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  // 格式化文件大小
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 选择里程碑
  const handleSelectMilestone = (m) => {
    if (milestone === m.id) {
      setMilestone('');
      setMilestoneLabel('');
      setMilestoneEmoji('');
    } else {
      setMilestone(m.id);
      setMilestoneLabel(m.label);
      setMilestoneEmoji(m.emoji);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!babyId) {
      showToast('请先选择宝宝', 'error');
      return;
    }
    
    // 验证
    if (type === 'photo' && photos.length === 0 && videos.length === 0) {
      showToast('请添加照片或视频', 'error');
      return;
    }
    
    if (!content.trim()) {
      showToast('请输入内容', 'error');
      return;
    }
    
    setSaving(true);
    
    try {
      const momentData = {
        id: moment?.id,
        babyId,
        type,
        content: content.trim(),
        photos,
        videos,
        audios,
        mood,
        weather,
        location,
        locationCoords,
        milestone,
        milestoneLabel,
        milestoneEmoji,
        date: new Date(date).toISOString(),
        createdAt: moment?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      await onSave(momentData);
    } catch (error) {
      showToast('保存失败', 'error');
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
      
      <div className="max-w-lg mx-auto">
        {/* 顶部大图上传区域 */}
        <div className="relative">
          {type === 'photo' && photos.length > 0 ? (
            <div className="relative aspect-square bg-gray-100">
              <img 
                src={photos[0]} 
                alt="上传的照片" 
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removePhoto(0)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              {photos.length > 1 && (
                <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 rounded-full text-white text-xs">
                  +{photos.length - 1}
                </div>
              )}
            </div>
          ) : type === 'video' && videos.length > 0 ? (
            <div className="relative aspect-square bg-gray-900">
              {videos[0].cover ? (
                <img src={videos[0].cover} alt="视频封面" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Video className="w-20 h-20 text-gray-500" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                  <div className="w-0 h-0 border-l-[20px] border-l-gray-800 border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-2" />
                </div>
              </div>
              <button
                onClick={() => removeVideo(0)}
                className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          ) : (
            <label className="block cursor-pointer">
              <div className="aspect-square bg-gradient-to-br from-primary-100 to-primary-200 dark:from-gray-700 dark:to-gray-800 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/30 flex items-center justify-center mb-4">
                  {type === 'photo' ? (
                    <Image className="w-10 h-10 text-primary-500" />
                  ) : type === 'video' ? (
                    <Video className="w-10 h-10 text-primary-500" />
                  ) : type === 'audio' ? (
                    <Mic className="w-10 h-10 text-primary-500" />
                  ) : (
                    <FileText className="w-10 h-10 text-primary-500" />
                  )}
                </div>
                <span className="text-primary-600 dark:text-primary-300 font-medium">
                  点击上传{type === 'photo' ? '照片' : type === 'video' ? '视频' : '媒体'}
                </span>
                <span className="text-primary-400 text-sm mt-1">
                  建议尺寸 1:1
                </span>
              </div>
              <input
                type="file"
                accept={type === 'photo' ? 'image/*' : type === 'video' ? 'video/*' : 'image/*,video/*'}
                onChange={type === 'photo' ? handlePhotoUpload : handleVideoUpload}
                className="hidden"
              />
            </label>
          )}
          
          {/* 类型切换 */}
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex gap-2 bg-white/90 dark:bg-gray-800/90 rounded-xl p-1.5 backdrop-blur-sm">
              <button
                onClick={() => setType('photo')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
                  type === 'photo' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>照片</span>
              </button>
              <button
                onClick={() => setType('video')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
                  type === 'video' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>视频</span>
              </button>
              <button
                onClick={() => setType('audio')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
                  type === 'audio' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>语音</span>
              </button>
              <button
                onClick={() => setType('diary')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-colors text-sm ${
                  type === 'diary' 
                    ? 'bg-primary-500 text-white' 
                    : 'text-gray-600 dark:text-gray-300'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>日记</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* 中间大文本输入框 */}
        <div className="p-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="记录这一刻的感受..."
            rows={5}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 resize-none text-gray-700 dark:text-gray-200 text-base"
          />
        </div>
        
        {/* 底部快捷标签栏 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-cream-200 dark:border-gray-700 safe-bottom">
          <div className="max-w-lg mx-auto p-4">
            {/* 心情选择 */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="w-4 h-4 text-pink-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">心情</span>
              </div>
              <div className="flex gap-2">
                {moodOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setMood(mood === option.value ? '' : option.value)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      mood === option.value
                        ? 'bg-pink-500 text-white'
                        : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {option.emoji} {option.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* 里程碑选择 */}
            {milestoneOptions.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">里程碑</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {milestoneOptions.map(m => (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMilestone(m)}
                      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                        milestone === m.id
                          ? 'bg-yellow-500 text-white'
                          : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {m.emoji} {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 定位和日期 */}
            <div className="flex gap-3 mb-3">
              {/* 位置 */}
              <button
                onClick={() => setShowLocationModal(true)}
                className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${
                  location
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'bg-cream-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span className="text-sm truncate flex-1 text-left">
                  {location || '添加位置'}
                </span>
              </button>
              
              {/* 日期 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-cream-100 dark:bg-gray-700 rounded-xl">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent text-sm text-gray-600 dark:text-gray-300"
                />
              </div>
            </div>
            
            {/* 附加媒体区域 */}
            {type === 'photo' && photos.length > 0 && (
              <div className="mb-3">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {photos.map((photo, index) => (
                    <div key={index} className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-gray-100">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="flex-shrink-0 w-16 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer">
                    <Image className="w-6 h-6 text-gray-400" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
            
            {type === 'video' && videos.length > 0 && (
              <div className="mb-3">
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {videos.map((video, index) => (
                    <div key={index} className="relative flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden bg-gray-800">
                      {video.cover ? (
                        <img src={video.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <button
                        onClick={() => removeVideo(index)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                  <label className="flex-shrink-0 w-24 h-16 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer">
                    <Video className="w-6 h-6 text-gray-400" />
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}
            
            {/* 语音日记 */}
            {type === 'audio' && (
              <div className="mb-3">
                {audios.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {audios.map((audio, index) => (
                      <div key={index} className="flex items-center gap-3 bg-cream-100 dark:bg-gray-700 rounded-xl p-3">
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
                        <div className="flex-1">
                          <div className="h-6 bg-primary-200 dark:bg-primary-700 rounded-full overflow-hidden flex items-end px-0.5">
                            {(audio.waveform || []).slice(-1)[0]?.map((val, i) => (
                              <div
                                key={i}
                                className="w-1 bg-primary-500 mx-px rounded-full"
                                style={{ height: `${Math.max(4, val / 4)}%` }}
                              />
                            )) || <div className="flex-1" />}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500">{formatTime2(audio.duration)}</span>
                        <button onClick={() => removeAudio(index)} className="p-1 text-gray-400 hover:text-red-500">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 transition-colors ${
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
              </div>
            )}
          </div>
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

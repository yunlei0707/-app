/**
 * 动态编辑表单组件
 * 简洁版：顶部大图上传 + 中间文本输入 + 底部快捷标签
 */

import { useState, useRef, useEffect } from 'react';
import { X, Camera, MapPin, Calendar, Smile, Star, Image as ImageIcon, Mic, Play, Square, ChevronDown } from 'lucide-react';
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
  const { getAllMilestones } = useApp();
  const [content, setContent] = useState(moment?.content || '');
  const [photos, setPhotos] = useState(moment?.photos || []);
  const [mood, setMood] = useState(moment?.mood || '');
  const [milestone, setMilestone] = useState(moment?.milestone || '');
  const [location, setLocation] = useState(moment?.location || '');
  const [date, setDate] = useState(
    moment?.date 
      ? new Date(moment.date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );
  const [saving, setSaving] = useState(false);

  // 录音相关状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const [audios, setAudios] = useState(moment?.audios || []);
  const [playingIndex, setPlayingIndex] = useState(null);
  const audioRef = useRef(null);

  // 快捷标签展开状态
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showMilestonePicker, setShowMilestonePicker] = useState(false);

  // 获取所有里程碑选项
  const milestoneOptions = getAllMilestones();

  // 清理录音资源
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 处理图片上传
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

  // 移除图片
  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
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
            waveform: []
          };
          setAudios(prev => [...prev, audioData]);
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 计时器
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 600) { // 10分钟限制
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error('录音失败:', error);
      alert('无法访问麦克风，请检查权限设置');
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  // 播放/暂停音频
  const togglePlayAudio = (index) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingIndex === index) {
      setPlayingIndex(null);
      return;
    }

    const audio = new Audio(audios[index].url);
    audio.onended = () => setPlayingIndex(null);
    audio.play();
    audioRef.current = audio;
    setPlayingIndex(index);
  };

  // 删除音频
  const removeAudio = (index) => {
    setAudios(prev => prev.filter((_, i) => i !== index));
  };

  // 获取定位
  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation(`纬度: ${position.coords.latitude.toFixed(4)}, 经度: ${position.coords.longitude.toFixed(4)}`);
        },
        (error) => {
          console.error('定位失败:', error);
          setLocation('定位失败');
        }
      );
    } else {
      setLocation('不支持定位');
    }
  };

  // 保存
  const handleSave = async () => {
    setSaving(true);
    try {
      const momentData = {
        babyId,
        type: photos.length > 0 ? 'photo' : 'text',
        content,
        photos,
        audios,
        mood,
        milestone,
        milestoneLabel: milestoneOptions.find(m => m.value === milestone)?.label || '',
        milestoneEmoji: milestoneOptions.find(m => m.value === milestone)?.emoji || '',
        location,
        date: new Date(date).toISOString(),
      };
      await onSave(momentData);
    } catch (error) {
      console.error('保存失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 safe-top">
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-lg font-medium text-gray-800">记录美好</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-1.5 bg-gradient-to-r from-primary-500 to-warm-500 text-white rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 overflow-y-auto">
        {/* 顶部大图上传区域 */}
        <div className="px-4 pt-4">
          {photos.length === 0 ? (
            <label className="block">
              <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/50 transition-all">
                <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                  <Camera className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-500 text-sm">点击添加照片</p>
                <p className="text-gray-400 text-xs mt-1">记录精彩瞬间</p>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          ) : (
            <div>
              {/* 已上传照片网格 */}
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden">
                    <img
                      src={photo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
                {/* 继续添加按钮 */}
                <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer hover:border-primary-300 transition-colors">
                  <ImageIcon className="w-6 h-6 text-gray-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>

        {/* 文本输入区域 */}
        <div className="px-4 pt-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写点什么..."
            rows={6}
            className="w-full text-lg text-gray-700 placeholder-gray-300 border-none outline-none resize-none"
            autoFocus
          />
        </div>

        {/* 录音区域 */}
        {(audios.length > 0 || isRecording) && (
          <div className="px-4 pt-4">
            {audios.length > 0 && (
              <div className="space-y-2 mb-3">
                {audios.map((audio, index) => (
                  <div key={index} className="flex items-center gap-3 bg-cream-50 rounded-xl p-3">
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
                      <div className="h-1 bg-primary-200 rounded-full" style={{ width: `${(audio.duration / 60) * 100}%`, maxWidth: '100%' }} />
                      <p className="text-xs text-gray-400 mt-1">{formatTime2(audio.duration)}</p>
                    </div>
                    <button
                      onClick={() => removeAudio(index)}
                      className="p-1 text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
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
                  : 'bg-cream-50 text-gray-600 hover:bg-cream-100'
              }`}
            >
              <Mic className="w-5 h-5" />
              {isRecording ? (
                <span>录音中 ({formatTime2(recordingTime)}) - 点击停止</span>
              ) : (
                <span>添加语音日记</span>
              )}
            </button>
          </div>
        )}

        {/* 快捷标签栏 */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex flex-wrap gap-2">
            {/* 心情选择 */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowMoodPicker(!showMoodPicker);
                  setShowMilestonePicker(false);
                }}
                className={`px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-colors ${
                  mood
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Smile className="w-4 h-4" />
                {mood ? moodOptions.find(m => m.value === mood)?.label : '心情'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showMoodPicker ? 'rotate-180' : ''}`} />
              </button>
              {showMoodPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-10 flex gap-1">
                  {moodOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setMood(mood === option.value ? '' : option.value);
                        setShowMoodPicker(false);
                      }}
                      className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                        mood === option.value
                          ? 'bg-primary-500 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {option.emoji} {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 里程碑选择 */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowMilestonePicker(!showMilestonePicker);
                  setShowMoodPicker(false);
                }}
                className={`px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-colors ${
                  milestone
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <Star className="w-4 h-4" />
                {milestone ? milestoneOptions.find(m => m.value === milestone)?.label : '里程碑'}
                <ChevronDown className={`w-4 h-4 transition-transform ${showMilestonePicker ? 'rotate-180' : ''}`} />
              </button>
              {showMilestonePicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-10 max-w-xs">
                  <div className="grid grid-cols-2 gap-1">
                    {milestoneOptions.map(option => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setMilestone(milestone === option.value ? '' : option.value);
                          setShowMilestonePicker(false);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          milestone === option.value
                            ? 'bg-purple-500 text-white'
                            : 'hover:bg-gray-100'
                        }`}
                      >
                        {option.emoji} {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 定位 */}
            <button
              onClick={getLocation}
              className={`px-4 py-2 rounded-full text-sm flex items-center gap-1.5 transition-colors ${
                location
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <MapPin className="w-4 h-4" />
              {location ? '已定位' : '定位'}
            </button>

            {/* 日期选择 */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 rounded-full text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-transparent outline-none w-28"
              />
            </div>
          </div>

          {/* 已选的位置信息展示 */}
          {location && (
            <div className="mt-3 px-3 py-2 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 点击外部关闭下拉 */}
      {(showMoodPicker || showMilestonePicker) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowMoodPicker(false);
            setShowMilestonePicker(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * BGM背景音乐管理器
 * 使用Web Audio API合成简约旋律
 * 支持三种场景：letter（读信）、blindbox（盲盒）、report（成长档案）
 */

// AudioContext 懒创建
let audioContext = null;
let masterGain = null;
let currentMelodyKey = null;
let isMuted = false;
let melodyTimeoutId = null;

// 音符频率映射（C大调）
const NOTE_FREQ = {
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'R': 0 // 休止符
};

// 旋律定义 - 约32个音符一段
const MELODIES = {
  // letter：温暖治愈，八音盒风格，正弦波，C大调，慢速
  letter: {
    tempo: 400, // 毫秒/拍
    notes: [
      'E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'E4', 'R',
      'E4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4',
      'A4', 'G4', 'E4', 'D4', 'E4', 'G4', 'A4', 'G4',
      'E4', 'D4', 'E4', 'R', 'E4', 'D4', 'C4', 'R'
    ]
  },
  
  // blindbox：轻快惊喜，三角波，稍快节奏
  blindbox: {
    tempo: 280,
    notes: [
      'C4', 'E4', 'G4', 'C5', 'G4', 'E4', 'C4', 'R',
      'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5',
      'D5', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4',
      'C4', 'E4', 'G4', 'C5', 'E5', 'D5', 'C5', 'R'
    ]
  },
  
  // report：回忆感钢琴，正弦波，低音域，慢速
  report: {
    tempo: 500,
    notes: [
      'C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4',
      'D3', 'F3', 'A3', 'D4', 'F4', 'A4', 'F4', 'D4',
      'E3', 'G3', 'B3', 'E4', 'G4', 'B4', 'G4', 'E4',
      'G3', 'B3', 'D4', 'G4', 'B4', 'G4', 'E4', 'C4'
    ]
  }
};

// 获取或创建AudioContext
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.3; // 默认30%音量
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
};

// 播放单个音符
const playNote = (freq, startTime, duration, oscillatorType = 'sine') => {
  if (freq === 0) return; // 休止符不播放
  
  const ctx = getAudioContext();
  
  // 创建振荡器
  const oscillator = ctx.createOscillator();
  oscillator.type = oscillatorType;
  oscillator.frequency.value = freq;
  
  // 创建音符增益（用于包络）
  const noteGain = ctx.createGain();
  noteGain.gain.value = 0;
  
  // 连接
  oscillator.connect(noteGain);
  noteGain.connect(masterGain);
  
  // 淡入淡出包络（避免爆音）
  const attackTime = 0.02;
  const decayTime = 0.05;
  const sustainLevel = 0.7;
  const releaseTime = 0.1;
  
  noteGain.gain.setValueAtTime(0, startTime);
  noteGain.gain.linearRampToValueAtTime(1, startTime + attackTime);
  noteGain.gain.linearRampToValueAtTime(sustainLevel, startTime + attackTime + decayTime);
  noteGain.gain.setValueAtTime(sustainLevel, startTime + duration - releaseTime);
  noteGain.gain.linearRampToValueAtTime(0, startTime + duration);
  
  // 启动和停止
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
};

// 播放一段旋律
const playMelody = (melodyKey) => {
  const melody = MELODIES[melodyKey];
  if (!melody) return;
  
  const ctx = getAudioContext();
  const { tempo, notes } = melody;
  const noteLength = tempo / 1000; // 秒
  const startTime = ctx.currentTime + 0.05;
  
  // 根据场景选择振荡器类型
  let oscillatorType = 'sine';
  if (melodyKey === 'blindbox') {
    oscillatorType = 'triangle'; // 三角波更清脆
  }
  
  // 播放所有音符
  notes.forEach((note, index) => {
    const freq = NOTE_FREQ[note] || 0;
    const noteStart = startTime + index * noteLength;
    playNote(freq, noteStart, noteLength * 0.9, oscillatorType);
  });
  
  // 计算总时长并安排循环
  const totalDuration = notes.length * noteLength * 1000;
  
  // 清除之前的定时器
  if (melodyTimeoutId) {
    clearTimeout(melodyTimeoutId);
  }
  
  // 循环播放
  melodyTimeoutId = setTimeout(() => {
    if (currentMelodyKey === melodyKey && !isMuted) {
      playMelody(melodyKey);
    }
  }, totalDuration);
};

/**
 * 播放BGM
 * @param {string} melodyKey - 'letter' | 'blindbox' | 'report'
 */
export const playBGM = (melodyKey) => {
  // 确保不重叠
  stopBGM();
  
  currentMelodyKey = melodyKey;
  
  // 如果已静音，仍然播放但音量由masterGain控制（为0）
  // 这样取消静音时能立即听到
  playMelody(melodyKey);
};

/**
 * 停止BGM
 */
export const stopBGM = () => {
  if (melodyTimeoutId) {
    clearTimeout(melodyTimeoutId);
    melodyTimeoutId = null;
  }
  currentMelodyKey = null;
};

/**
 * 切换静音状态
 * @returns {boolean} - 返回当前是否静音
 */
export const toggleMute = () => {
  isMuted = !isMuted;
  
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3;
  }
  
  // 保存偏好到localStorage
  localStorage.setItem('bgm_muted', isMuted ? 'true' : 'false');
  
  return isMuted;
};

/**
 * 获取当前静音状态
 * @returns {boolean}
 */
export const isBGMMuted = () => {
  return isMuted;
};

/**
 * 从localStorage加载静音偏好
 */
export const loadMutePreference = () => {
  const saved = localStorage.getItem('bgm_muted');
  isMuted = saved === 'true';
  
  if (masterGain) {
    masterGain.gain.value = isMuted ? 0 : 0.3;
  }
};

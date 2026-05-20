/**
 * 存储路径常量
 * 统一管理所有文件存储路径，避免硬编码散落在各处
 */

// 根目录
export const BASE_DIR = 'BabyTime';

// 子目录
export const VIDEO_DIR = `${BASE_DIR}/videos`;
export const PHOTO_DIR = `${BASE_DIR}/photos`;
export const AUDIO_DIR = `${BASE_DIR}/audio`;
export const BACKUP_DIR = `${BASE_DIR}/backups`;
export const TEMP_DIR = `${BASE_DIR}/temp`;

// 文件路径生成工具函数
export const getVideoPath = (filename) => `${VIDEO_DIR}/${filename}`;
export const getPhotoPath = (filename) => `${PHOTO_DIR}/${filename}`;
export const getAudioPath = (filename) => `${AUDIO_DIR}/${filename}`;
export const getBackupPath = (filename) => `${BACKUP_DIR}/${filename}`;

/**
 * 导入进度计算器 - 纯JavaScript，无任何外部依赖
 * 独立文件避免引入storageAdapter的Capacitor依赖
 */

export class ImportProgressCalculator {
  constructor(totalFiles = 0) {
    this.startTime = Date.now();
    this.totalFiles = totalFiles;
    this.completedFiles = 0;
    this.totalBytes = 0;
    this.completedBytes = 0;
    this.lastUpdateTime = this.startTime;
    this.lastUpdateBytes = 0;
  }

  /**
   * 更新单个文件进度
   * @param {number} fileSize 文件大小（字节）
   * @param {number} percent 完成百分比（0-100）
   */
  updateFileProgress(fileSize, percent) {
    const now = Date.now();
    const elapsedSinceLastUpdate = (now - this.lastUpdateTime) / 1000;
    
    // 只在至少过了500ms后才更新速度，避免抖动
    if (elapsedSinceLastUpdate > 0.5) {
      const bytesSinceLastUpdate = (fileSize * percent / 100) - this.lastUpdateBytes;
      this.lastUpdateTime = now;
      this.lastUpdateBytes = fileSize * percent / 100;
    }
    
    this.completedBytes = fileSize * percent / 100;
  }

  /**
   * 标记文件完成
   */
  markFileComplete(fileSize) {
    this.completedFiles++;
    this.completedBytes = fileSize;
    this.totalBytes += fileSize;
  }

  /**
   * 获取当前进度信息
   */
  getStats(currentFilename = '') {
    const elapsed = (Date.now() - this.startTime) / 1000;
    const avgSpeedMBs = elapsed > 0 ? (this.totalBytes / 1024 / 1024 / elapsed) : 0;
    
    // 估算剩余时间
    let remainingSeconds = 0;
    if (avgSpeedMBs > 0 && this.completedFiles < this.totalFiles) {
      const avgFileSize = this.totalBytes / Math.max(this.completedFiles, 1);
      const remainingFiles = this.totalFiles - this.completedFiles;
      const remainingBytes = remainingFiles * avgFileSize;
      remainingSeconds = Math.round(remainingBytes / 1024 / 1024 / avgSpeedMBs);
    }

    return {
      completedFiles: this.completedFiles,
      totalFiles: this.totalFiles,
      currentFilename,
      elapsedSeconds: Math.round(elapsed),
      avgSpeedMBs: avgSpeedMBs.toFixed(1),
      remainingSeconds,
      totalMB: (this.totalBytes / 1024 / 1024).toFixed(1),
      progressPercent: Math.round((this.completedFiles / Math.max(this.totalFiles, 1)) * 100),
    };
  }
}

export default ImportProgressCalculator;

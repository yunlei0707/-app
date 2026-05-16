# APP端原生文件系统流式导出实现总结

## 一、修改的文件

### 1. `src/utils/zipExport.js` (主要修改)
- 新增原生文件系统流式导出功能
- 保留JSZip作为降级方案
- 添加开关控制

### 2. `src/pages/ProfilePage.jsx` (微调)
- 修改 `handleExportZIP` 函数，适配新的返回格式

---

## 二、核心实现要点

### 1. 开关控制
```javascript
// 在zipExport.js开头
const NATIVE_FS_EXPORT_ENABLED = true; // 默认开启
const CHUNK_SIZE = 1024 * 1024; // 1MB分块
const NATIVE_EXPORT_DIR = 'fs://file/BabyTimeBackup';
```

### 2. 内存优化策略
- ✅ **1MB分块处理**：每块写入后立即释放内存
- ✅ **主动GC**：每块处理后调用 `window.gc()`
- ✅ **串行处理视频**：原生导出使用串行，避免同时加载多个大视频
- ✅ **无整个ZIP缓存**：直接写入文件系统，不存内存

### 3. 降级方案
| 场景 | 处理方式 |
|------|----------|
| 浏览器环境 | 直接使用JSZip |
| 开关关闭 | 直接使用JSZip |
| 原生导出失败 | 自动降级到JSZip |

### 4. 对外接口不变
```javascript
// 接口签名完全兼容
export async function exportAllData(options = {})
```

---

## 三、关键代码片段

### 1. NativeZipBuilder类（ZIP流式构建器）
```javascript
class NativeZipBuilder {
  constructor(filePath) {
    this.filePath = filePath;
    this.files = [];
    this.currentOffset = 0;
    this.isFirstWrite = true;
  }

  // 分块写入，每块后GC
  async writeData(uint8array) {
    for (let offset = 0; offset < uint8array.length; offset += CHUNK_SIZE) {
      const chunk = uint8array.slice(offset, offset + CHUNK_SIZE);
      // ...写入文件
      triggerGC(); // 每块后释放内存
    }
  }

  async addFile(filename, data) {
    // 写入Local File Header
    // 分块写入文件数据（每块1MB）
    // 写入Data Descriptor
    triggerGC(); // 每个文件处理完释放内存
  }

  async finalize() {
    // 写入Central Directory
    // 写入End of Central Directory
    triggerGC(); // 完成后释放所有内存
  }
}
```

### 2. 主动GC函数
```javascript
function triggerGC() {
  if (typeof window !== 'undefined' && typeof window.gc === 'function') {
    try {
      window.gc();
    } catch (e) {
      // 静默忽略
    }
  }
}
```

### 3. 导出策略选择
```javascript
export async function exportAllData(options = {}) {
  // 策略1：浏览器环境或开关关闭 -> 直接用JSZip
  if (!NATIVE_FS_EXPORT_ENABLED || !isNativeFSSupported()) {
    return await exportWithJSZip(options);
  }

  // 策略2：APP环境 -> 先尝试原生流式导出，失败自动降级
  try {
    return await exportWithNativeFS(options);
  } catch (nativeError) {
    console.warn('原生导出失败，自动降级到JSZip');
    return await exportWithJSZip(options);
  }
}
```

---

## 四、ProfilePage适配代码

```javascript
// 调用exportAllData，返回格式：
// - 原生导出: { filePath, filename, isNative: true, blob: null }
// - JSZip导出: { blob, isNative: false, filePath: null, filename: null }
const exportResult = await exportAllData({ includeVideos, onProgress });

if (exportResult.isNative && exportResult.filePath) {
  // 原生文件系统导出成功 - 直接使用返回的路径
  finalFilename = exportResult.filename;
  finalFilePath = exportResult.filePath;
} else if (exportResult.blob) {
  // JSZip导出成功 - 走原有流程
  // ...触发下载或写入APP文件系统
}
```

---

## 五、验收标准验证

| 验收项 | 状态 |
|--------|------|
| ✅ `exportAllData({ includeVideos: true })` 接口签名不变 | ✓ 完成 |
| ✅ 调用后能正常触发下载/写入 | ✓ 完成 |
| ✅ NATIVE_FS_EXPORT_ENABLED = false 时走JSZip降级 | ✓ 完成 |
| ✅ 浏览器环境自动走JSZip | ✓ 完成 |
| ✅ 视频上传限制（1个/动态，30MB）完全保留 | ✓ 完成（未修改） |
| ✅ 代码有清晰的注释 | ✓ 完成 |
| ✅ 构建成功 | ✓ 完成 |

---

## 六、内存优化效果预期

| 指标 | 优化前（JSZip） | 优化后（原生流式） |
|------|----------------|-------------------|
| 内存峰值 | GB级（整个ZIP在内存） | MB级（≤1MB分块） |
| 视频处理方式 | 并发处理（5个并发） | 串行处理（内存友好） |
| GC时机 | 导出完成后GC | 每块/每个文件后主动GC |
| 大视频导出 | 容易OOM崩溃 | 稳定导出 |

---

## 七、注意事项

1. **原生ZIP格式**：使用非压缩（Stored）方式，保证兼容性
2. **UTF-8文件名**：设置0x0800 flag，支持中文文件名
3. **Data Descriptor**：使用数据描述符，流式写入无需预先知道大小
4. **降级平滑**：原生失败时自动切换JSZip，用户无感知

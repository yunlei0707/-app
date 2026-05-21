/**
 * 🧠 Storage Adapter
 * 读取统一返回 Blob，写入 OPFS 优先，失败 fallback Filesystem
 */

let _fsCache = null, _fsLoaded = false;

export async function getVideoBlob(path) {
  if (!path) throw new Error('视频路径为空');

  let blob = null;

  try {
    blob = await readVideoFromOPFS(path);
    if (blob.size > 0) return blob;
  } catch {}

  try {
    const base64 = await readFromFilesystem(path);
    if (base64) return base64ToBlob(base64);
  } catch {}

  throw new Error(`视频读取失败: ${path}`);
}

async function readFromFilesystem(path) {
  const fs = await loadFilesystem();
  const result = await fs.Filesystem.readFile({
    path,
    directory: fs.Directory.Data
  });
  return result.data;
}

function base64ToBlob(base64, mime = 'video/mp4') {
  const clean = base64.split(',')[1] || base64;
  const bytes = atob(clean);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

async function readVideoFromOPFS(path) {
  if (!navigator.storage?.getDirectory) throw new Error('OPFS 不支持');
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(path);
  const file = await fileHandle.getFile();
  return file;
}

export async function saveVideoBlob(path, blob) {
  try {
    return await saveToOPFS(path, blob);
  } catch {
    return await saveToFilesystem(path, blob);
  }
}

async function saveToOPFS(path, blob) {
  if (!navigator.storage?.getDirectory) throw new Error('OPFS 不支持');
  const root = await navigator.storage.getDirectory();
  const parts = path.split('/');
  const filename = parts.pop();
  let dir = root;
  for (const p of parts) {
    dir = await dir.getDirectoryHandle(p, { create: true });
  }
  const fileHandle = await dir.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  return path;
}

async function saveToFilesystem(path, blob) {
  const fs = await loadFilesystem();
  const base64 = await blobToBase64(blob);
  await fs.Filesystem.writeFile({
    path,
    data: base64,
    directory: fs.Directory.Data,
    recursive: true
  });
  return path;
}

function blobToBase64(blob) {
  return new Promise((r, j) => {
    const f = new FileReader();
    f.onloadend = () => r(f.result);
    f.onerror = j;
    f.readAsDataURL(blob);
  });
}

async function loadFilesystem() {
  const mod = window.Capacitor?.Plugins?.Filesystem;
  const Filesystem = mod?.Filesystem || mod.default?.Filesystem || mod;
  const Directory = mod?.Directory || mod.default?.Directory || {
    Documents: 'DOCUMENTS',
    Data: 'DATA',
    Cache: 'CACHE'
  };
  return { Filesystem, Directory };
}

export default { getVideoBlob, saveVideoBlob };

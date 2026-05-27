import { isNativePlatform, writeFile } from './nativeApi';

function getBase64Payload(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    throw new Error('图片数据无效');
  }
  return dataUrl.split(',')[1] || '';
}

export async function saveDataUrlImage(dataUrl, filename) {
  const safeFilename = (filename || `babytime-${Date.now()}.png`)
    .replace(/[\\/:*?"<>|]/g, '_');

  if (isNativePlatform()) {
    const base64 = getBase64Payload(dataUrl);
    const path = `BabyTimeShares/${safeFilename}`;
    await writeFile(path, base64);
    return { native: true, path };
  }

  const link = document.createElement('a');
  link.download = safeFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { native: false, path: safeFilename };
}

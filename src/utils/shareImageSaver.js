import { registerPlugin } from '@capacitor/core';
import { isNativePlatform } from './nativeApi';

const GallerySaver = registerPlugin('GallerySaver');

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
    const result = await GallerySaver.saveImage({
      fileName: safeFilename,
      data: getBase64Payload(dataUrl)
    });
    return {
      native: true,
      path: result?.path || `Pictures/宝贝时光/${safeFilename}`,
      uri: result?.uri
    };
  }

  const link = document.createElement('a');
  link.download = safeFilename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return { native: false, path: safeFilename };
}

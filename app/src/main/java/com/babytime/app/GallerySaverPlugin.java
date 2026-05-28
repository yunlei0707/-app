package com.babytime.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "GallerySaver")
public class GallerySaverPlugin extends Plugin {
    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data", "");
        String fileName = call.getString("fileName", "babytime-share.png");

        if (data == null || data.trim().isEmpty()) {
            call.reject("图片数据为空");
            return;
        }

        try {
            byte[] bytes = decodeBase64Image(data);
            String safeFileName = sanitizeFileName(fileName);
            Uri uri = writeToPictures(bytes, safeFileName);

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("path", "Pictures/宝贝时光/" + safeFileName);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("保存图片失败: " + e.getMessage(), e);
        }
    }

    private byte[] decodeBase64Image(String data) {
        String payload = data;
        int commaIndex = payload.indexOf(',');
        if (payload.startsWith("data:image/") && commaIndex >= 0) {
            payload = payload.substring(commaIndex + 1);
        }
        return Base64.decode(payload, Base64.DEFAULT);
    }

    private String sanitizeFileName(String fileName) {
        String clean = fileName == null ? "babytime-share.png" : fileName;
        clean = clean.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (clean.isEmpty()) clean = "babytime-share.png";
        if (!clean.toLowerCase().endsWith(".png")) clean += ".png";
        return clean;
    }

    private Uri writeToPictures(byte[] bytes, String fileName) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/宝贝时光");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);

            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("无法创建相册文件");

            try (OutputStream stream = resolver.openOutputStream(uri)) {
                if (stream == null) throw new IllegalStateException("无法打开相册写入流");
                stream.write(bytes);
            }

            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return uri;
        }

        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "宝贝时光");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("无法创建相册目录");
        }

        File file = new File(dir, fileName);
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(bytes);
        }
        MediaScannerConnection.scanFile(getContext(), new String[]{file.getAbsolutePath()}, new String[]{"image/png"}, null);
        return Uri.fromFile(file);
    }
}

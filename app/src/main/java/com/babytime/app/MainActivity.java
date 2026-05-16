package com.babytime.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 延迟到 Bridge 完全初始化后再配置 WebView
        runOnUiThread(() -> {
            try {
                // 等待 Bridge 初始化
                Thread.sleep(100);
                configureWebView();
            } catch (InterruptedException e) {
                // 忽略
            }
        });
    }
    
    private void configureWebView() {
        try {
            WebView webView = getBridge().getWebView();
            if (webView == null) {
                // 重试一次
                webView = getBridge().getWebView();
                if (webView == null) {
                    return;
                }
            }
            
            WebSettings settings = webView.getSettings();
            
            // 启用调试模式（release包建议关闭）
            if (BuildConfig.DEBUG) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
            
            // 启用OPFS所需的所有权限
            settings.setAllowFileAccess(true);
            settings.setAllowContentAccess(true);
            settings.setDatabaseEnabled(true);
            settings.setDomStorageEnabled(true);
            
            // 注意：这些在Android 12+已默认禁用，启用有安全风险
            // settings.setAllowUniversalAccessFromFileURLs(true);
            // settings.setAllowFileAccessFromFileURLs(true);
            
            // 启用硬件加速
            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
            
            // 启用JavaScript（Capacitor默认已启用，这里再次确认）
            settings.setJavaScriptEnabled(true);
            
            // 视频播放相关配置
            settings.setMediaPlaybackRequiresUserGesture(false);
            
            // 缓存配置
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            
            // 允许混合内容（HTTP和HTTPS混合）
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
            }
            
            // 禁用 AppCache（Android 7.0+ 已废弃）
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
                settings.setAppCacheEnabled(true);
            }
            
        } catch (Exception e) {
            // WebView配置失败不影响APP启动，只是部分功能可能受限
            android.util.Log.w("MainActivity", "WebView配置失败: " + e.getMessage());
        }
    }
}

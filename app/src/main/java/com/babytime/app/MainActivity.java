package com.babytime.app;

import android.content.pm.ApplicationInfo;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import androidx.activity.OnBackPressedCallback;
import com.capacitorjs.plugins.app.AppPlugin;
import com.capacitorjs.plugins.camera.CameraPlugin;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import com.capacitorjs.plugins.share.SharePlugin;
import com.equimaps.capacitorblobwriter.BlobWriter;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BACK_EVENT_JS =
        "window.dispatchEvent(new CustomEvent('babytime:native-back'))";
    private static final long BACK_EVENT_DEBOUNCE_MS = 250L;
    private long lastNativeBackAt = 0L;
    private Object backInvokedCallback;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(AppPlugin.class);
        registerPlugin(CameraPlugin.class);
        registerPlugin(FilesystemPlugin.class);
        registerPlugin(SharePlugin.class);
        registerPlugin(BlobWriter.class);
        registerPlugin(GallerySaverPlugin.class);
        super.onCreate(savedInstanceState);
        setupBackGestureBridge();
        
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
            if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
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
            
        } catch (Exception e) {
            // WebView配置失败不影响APP启动，只是部分功能可能受限
            android.util.Log.w("MainActivity", "WebView配置失败: " + e.getMessage());
        }
    }

    private void setupBackGestureBridge() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                dispatchBackToWeb();
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = BackInvokedBridge.register(this, this::dispatchBackToWeb);
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        dispatchBackToWeb();
    }

    private void dispatchBackToWeb() {
        try {
            long now = System.currentTimeMillis();
            if (now - lastNativeBackAt < BACK_EVENT_DEBOUNCE_MS) {
                return;
            }
            lastNativeBackAt = now;

            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView == null) {
                return;
            }
            webView.post(() -> webView.evaluateJavascript(BACK_EVENT_JS, null));
        } catch (Exception e) {
            android.util.Log.w("MainActivity", "返回手势转发失败: " + e.getMessage());
        }
    }

    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backInvokedCallback != null) {
            BackInvokedBridge.unregister(this, backInvokedCallback);
            backInvokedCallback = null;
        }
        super.onDestroy();
    }

    private static final class BackInvokedBridge {
        private static Object register(MainActivity activity, Runnable onBack) {
            OnBackInvokedCallback callback = onBack::run;
            activity.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                callback
            );
            return callback;
        }

        private static void unregister(MainActivity activity, Object callback) {
            activity.getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback((OnBackInvokedCallback) callback);
        }
    }
}

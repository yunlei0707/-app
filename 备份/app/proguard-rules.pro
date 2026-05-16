# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ============================================
# Capacitor 混淆规则（必须添加！）
# ============================================

# Capacitor 核心类
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }

# 所有插件类
-keep class * extends com.getcapacitor.Plugin { *; }

# JS Bridge 接口
-keepattributes *JavascriptInterface*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Gson 序列化
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**

# 防止 WebView 相关类被混淆
-keep class android.webkit.** { *; }

# 文件提供者
-keep class androidx.core.content.FileProvider { *; }


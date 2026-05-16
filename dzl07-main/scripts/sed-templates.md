# 📝 Sed 常用修改模板

> 宝贝时光项目常用sed命令模板库

---

## 📍 常用文件路径
```
src/pages/TimelinePage.jsx      # 时光轴页面
src/pages/ProfilePage.jsx       # 个人中心
src/pages/VirtualTimePage.jsx # 虚拟时光
src/pages/InvitePage.jsx       # 邀约页面
src/store/AppContext.jsx       # 全局状态
src/components/MusicPlayer.jsx  # 播放器组件
```

---

## 🔍 查找/搜索

### 查找关键词
```bash
# 查找关键词
grep -n "关键词" 文件名
```

### 显示上下文
```bash
# 显示某行前后内容
sed -n '起始行,结束行p' 文件名
```

---

## ✏️ 替换修改

### 单行替换
```bash
# 替换第一次出现
sed -i 's/原内容/新内容/' 文件名

# 替换所有出现
sed -i 's/原内容/新内容/g' 文件名

# 带正则替换 (支持特殊字符)
sed -i 's|原内容|新内容|g' 文件名
```

### 指定行号替换
```bash
# 替换第100行内容
sed -i '100s/.*/新内容/' 文件名

# 替换第100-120行范围内的内容
sed -i '100,120s/原内容/新内容/' 文件名
```

### 删除指定行
```bash
# 删除第50行
sed -i '50d' 文件名

# 删除第50-60行
sed -i '50,60d' 文件名
```

### 在指定行后插入
```bash
# 在第50行后插入新内容
sed -i '50a\新内容' 文件名

# 在匹配行后插入
sed -i '/匹配内容/a\插入的新内容' 文件名
```

### 在指定行前插入
```bash
# 在第50行前插入
sed -i '50i\新内容' 文件名
```

---

## 📋 常用模板

### 1. 修改导入语句
```bash
# 添加导入组件
sed -i '/^import.*from/s/$/\nimport { 组件名 } from '../components/组件名';/ 文件名
```

### 2. 修改 className/Tailwind样式
```bash
# 修改某个元素的样式
sed -i 's/className="原来的样式"/className="新的样式"/' 文件名
```

### 3. 修改按钮文字
```bash
sed -i 's/>原按钮文字</>新按钮文字</' 文件名
```

### 4. 注释/取消注释代码
```bash
# 在某行前后加注释标记
sed -i '50s/^/\/\//' 文件名    # 注释第50行
sed -i '50s/^\/\///' 文件名  # 取消注释
```

---

## ⚠️ 注意事项

1. **sed不支持JSX跨行匹配！复杂修改建议用：
```bash
# 先查看上下文，确认行号
grep -n "关键词" 文件名

# 再按行号精确修改
sed -n '100,150p' 文件名
```

2. **修改前先备份！
```bash
# 备份文件
cp 文件名 文件名.bak
```

3. **Git 验证修改
```bash
# 查看修改差异
git diff 文件名
```

# 抱石互动小游戏

一个移动端优先的抱石（Bouldering）互动训练网页小游戏。

## 功能特点

### 第一阶段：创建线路（Route Creation）
✅ **已完成**

- 📷 **摄像头/图片上传**
  - 支持手机后置摄像头拍照
  - 支持从相册选择图片上传
  - 兼容 iOS Safari 和 Android Chrome

- ✏️ **手绘描摹岩点**
  - 画笔工具：按住并拖动绘制闭合区域
  - 支持撤销操作
  - 可调节画笔大小

- 🎨 **自动生成游戏岩点**
  - 平滑算法：使用 Douglas-Peucker 算法平滑路径
  - 多边形简化：自动减少顶点数
  - 形状增强：添加随机形变，避免规则形状
  - Neon 风格：荧光色调 + 发光效果

- 💾 **保存与导出**
  - 保存到浏览器本地存储
  - 导出为 JSON 文件

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite 5.x
- **样式**: TailwindCSS
- **Canvas**: HTML5 Canvas API
- **动画**: requestAnimationFrame
- **状态管理**: React Context + Hooks

## 浏览器兼容性

- iOS Safari 14+
- Android Chrome 90+
- Chrome/Edge 90+
- Firefox 88+

## 开发

### 安装依赖

```bash
npm install
```

### 运行开发服务器

```bash
npm run dev
```

打开 http://localhost:3000 查看应用

### 构建生产版本

```bash
npm run build
```

## 使用说明

### 1. 拍照/上传
- 打开后置摄像头，或上传抱石墙照片

### 2. 描摹岩点
- 使用画笔沿岩点边缘描摹来创建岩点
- 闭合路径后自动生成neon风格岩点
- 可以撤销或清空重新绘制

### 3. 预览保存
- 观看岩点生成动画
- 保存到本地或导出为JSON文件

## 文件结构

```
src/
├── components/          # React 组件
│   ├── CameraCapture    # 摄像头/上传组件
│   ├── CanvasEditor     # 岩点描摹编辑器
│   ├── Preview          # 预览保存组件
│   └── StageNav         # 进度导航
├── context/            # React Context
│   └── GameContext     # 全局状态管理
├── hooks/              # 自定义 Hooks
│   ├── useCanvas       # Canvas 管理
│   └── useAnimationFrame # RAF 动画
├── types/              # TypeScript 类型定义
│   ├── hold.ts         # 岩点类型
│   └── game.ts         # 游戏通用类型
└── utils/              # 工具函数
    ├── blobDetection   # 几何计算
    ├── canvasHelpers   # Canvas 辅助
    └── holdProcessor   # 岩点生成算法
```

## 岩点生成算法

1. **路径平滑**: Douglas-Peucker 算法减少冗余点
2. **多边形简化**: 自动简化顶点数（默认12个）
3. **方向修正**: 确保为逆时针方向
4. **形状增强**: 沿法线方向添加随机形变
5. **颜色生成**: 从荧光色调板随机选择
6. **发光效果**: Canvas shadowBlur 实现

## 性能优化

- 离屏 Canvas 缓存背景图片
- 请求动画帧（requestAnimationFrame）优化重绘
- 脏矩形更新
- 移动端触摸事件优化

## 已知限制

- 仅在 HTTPS 或 localhost 环境下可访问摄像头
- iOS Safari 需要手动授予摄像头权限
- 复杂形状可能导致性能下降

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

---

## 第二阶段计划（未来）

- 角色物理模拟
- 手势控制四肢攀爬
- 计时和评分系统
- 社交分享功能
- 在线线路库

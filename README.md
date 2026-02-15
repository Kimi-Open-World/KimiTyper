# KimiTyper - 打字背单词

[![React](https://img.shields.io/badge/React-18.2.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.8-purple)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.0-cyan)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

通过打字输入强化单词记忆的在线学习工具。采用间隔重复（Spaced Repetition）和主动回忆（Active Recall）原理，让背单词变得高效且有趣。

![KimiTyper Screenshot](./screenshots/home.png)

## ✨ 核心特性

### 1. 打字学习模式
- **即时反馈**：输入错误即时显示，帮助纠正拼写
- **发音辅助**：内置语音合成，支持单词朗读
- **例句展示**：每个单词配有例句，加深理解
- **进度追踪**：自动保存学习进度，随时继续

### 2. 复习系统
- **智能复习**：自动汇总错误单词，针对性练习
- **重点词汇**：标记难词，单独强化记忆
- **进度统计**：可视化展示学习数据

### 3. 个性化设置
- **主题切换**：支持浅色/深色/跟随系统
- **发音控制**：可选开启/关闭语音朗读
- **每日目标**：自定义每日学习目标
- **键盘音效**：可选打字音效

### 4. 数据持久化
- **IndexedDB**：使用浏览器本地数据库存储
- **数据安全**：所有数据保存在本地，保护隐私
- **离线可用**：无需联网即可使用

## 🛠️ 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 18.2.0 |
| 语言 | TypeScript | 5.2.2 |
| 构建工具 | Vite | 5.0.8 |
| 状态管理 | Zustand | 4.4.7 |
| 路由 | React Router DOM | 6.21.1 |
| 样式 | Tailwind CSS | 3.4.0 |
| 数据库 | IndexedDB (idb) | 8.0.0 |
| 图标 | Lucide React | 0.303.0 |

## 📁 项目结构

```
KimiTyper/
├── index.html              # 入口 HTML
├── package.json            # 项目依赖配置
├── vite.config.ts          # Vite 构建配置
├── tailwind.config.js      # Tailwind CSS 配置
├── tsconfig.json           # TypeScript 配置
├── postcss.config.js       # PostCSS 配置
├── src/
│   ├── main.tsx            # 应用入口
│   ├── App.tsx             # 根组件
│   ├── index.css           # 全局样式
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   ├── components/
│   │   └── Layout.tsx      # 布局组件
│   ├── pages/
│   │   ├── BookSelection.tsx   # 词书选择页
│   │   ├── TypingPractice.tsx  # 打字练习页
│   │   ├── ReviewPage.tsx      # 复习页面
│   │   ├── StatsPage.tsx       # 统计页面
│   │   ├── Settings.tsx        # 设置页面
│   │   └── KeyVocabulary.tsx   # 重点词汇页
│   ├── store/
│   │   └── index.ts        # Zustand 状态管理
│   ├── db/
│   │   └── index.ts        # IndexedDB 数据库操作
│   ├── data/
│   │   └── books.ts        # 内置词书数据
│   └── lib/
│       └── utils.ts        # 工具函数
└── public/
    └── logo.svg            # 应用图标
```

## 🚀 快速开始

### 环境要求
- Node.js 18.0 或更高版本
- npm 9.0 或更高版本

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
应用将在 http://localhost:3000 启动

### 构建生产版本
```bash
npm run build
```
构建产物将输出到 `dist/` 目录

### 预览生产版本
```bash
npm run preview
```

### 代码检查
```bash
npm run lint
```

## 📊 数据模型

### 单词 (Word)
```typescript
interface Word {
  id: number          // 单词唯一标识
  word: string        // 英文单词
  phonetic: string    // 音标
  meaning: string     // 中文释义
  example?: string    // 例句（可选）
  audioUrl?: string   // 音频URL（可选）
}
```

### 词书 (WordBook)
```typescript
interface WordBook {
  id: string          // 词书ID
  name: string        // 词书名称
  description: string // 词书描述
  wordCount: number   // 单词数量
  language: string    // 语言
  category: string    // 分类
  words: Word[]      // 单词列表
}
```

### 学习进度 (LearningProgress)
```typescript
interface LearningProgress {
  bookId: string      // 词书ID
  currentIndex: number // 当前学习位置
  completedWords: number[] // 已完成单词ID
  errorWords: number[] // 错误单词ID
  lastStudyDate: string // 最后学习日期
  totalStudyTime: number // 总学习时长（分钟）
}
```

### 用户统计 (UserStats)
```typescript
interface UserStats {
  totalWordsLearned: number // 已学单词总数
  totalStudyTime: number    // 总学习时长
  streakDays: number        // 连续学习天数
  lastStudyDate: string     // 最后学习日期
  dailyGoal: number         // 每日目标
  dailyProgress: number      // 今日进度
}
```

### 应用设置 (AppSettings)
```typescript
interface AppSettings {
  theme: 'light' | 'dark' | 'system'  // 主题
  pronunciation: boolean            // 是否朗读
  autoPlayAudio: boolean              // 自动播放音频
  showPhonetic: boolean               // 显示音标
  showExample: boolean                // 显示例句
  keyboardSound: boolean              // 键盘音效
  dailyGoal: number                   // 每日目标
}
```

## 🗄️ 数据库设计

### IndexedDB 架构
- **数据库名称**: `KimiTyperDB`
- **版本**: 1
- **存储对象**:
  - `books`: 存储词书数据
  - `progress`: 存储学习进度

### 数据库操作 API

```typescript
// 初始化数据库
await initDB()

// 获取所有词书
await getAllBooks(): Promise<WordBook[]>

// 获取指定词书
await getBook(id: string): Promise<WordBook | undefined>

// 保存词书
await saveBook(book: WordBook): Promise<void>

// 批量保存词书
await saveBooks(books: WordBook[]): Promise<void>

// 获取学习进度
await getProgress(bookId: string): Promise<LearningProgress | undefined>

// 保存学习进度
await saveProgress(progress: LearningProgress): Promise<void>

// 清空所有数据
await clearAllData(): Promise<void>
```

## 🎯 核心功能详解

### 1. 打字练习流程

```
用户进入学习页面 → 显示当前单词 → 用户输入 → 即时验证
    ↓
输入正确 → 标记完成 → 播发音 → 进入下一词
    ↓
输入错误 → 显示错误动画 → 允许重新输入 → 计入错误统计
```

### 2. 复习机制

- 自动收集打字练习中的错误单词
- 支持重点词汇的主动标记
- 提供专门的复习模式，针对性强化记忆

### 3. 统计系统

- **学习进度**: 当前词书完成百分比
- **错误分析**: 常见错误单词排行
- **学习时长**: 累计学习时间和每日分布
- **连续天数**: 鼓励每日学习的打卡机制

### 4. 状态管理

使用 Zustand 进行全局状态管理，支持持久化存储:

```typescript
// 核心状态
- currentBook: 当前选中的词书
- progress: 所有词书的学习进度
- stats: 用户统计数据
- settings: 应用设置
- keyVocabulary: 重点词汇列表
```

## 📝 内置词书

### CET-4 核心词汇
- **数量**: 20个核心单词
- **内容**: 大学英语四级考试核心词汇
- **示例**:
  - abandon /əˈbændən/ v. 放弃；抛弃
  - ability /əˈbɪləti/ n. 能力；才能
  - abundant /əˈbʌndənt/ adj. 丰富的；充裕的
  - accelerate /əkˈseləreɪt/ v. 加速；促进
  - ...

## 🎨 主题系统

支持三种主题模式：

| 模式 | 描述 |
|------|------|
| Light | 浅色主题，适合日间使用 |
| Dark | 深色主题，适合夜间使用 |
| System | 跟随系统主题自动切换 |

## 🔊 语音系统

使用 Web Speech API 的语音合成功能：

```typescript
const playWordAudio = (word: string) => {
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  utterance.rate = 0.8
  window.speechSynthesis.speak(utterance)
}
```

## 🛣️ 路由结构

| 路径 | 页面 | 描述 |
|------|------|------|
| `/` | 词书选择 | 首页，展示可用词书 |
| `/learn/:bookId` | 打字练习 | 单词学习主页面 |
| `/review` | 复习 | 错误单词和重点词汇复习 |
| `/key-vocabulary` | 重点词汇 | 管理重点词汇列表 |
| `/stats` | 统计 | 学习数据统计 |
| `/settings` | 设置 | 应用配置 |

## 🔧 开发配置

### Vite 配置
```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
```

### TypeScript 路径别名
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Tailwind 配置
- 支持自定义主题色
- 包含 Dark Mode 配置
- 自定义动画效果

## 📱 响应式设计

支持多设备访问，已针对以下尺寸优化：

| 设备 | 断点 | 布局 |
|------|------|------|
| 移动端 | < 640px | 单列布局，全宽输入 |
| 平板 | 640px - 1024px | 自适应布局 |
| 桌面 | > 1024px | 最优体验布局 |

## 🔒 隐私说明

- 所有数据存储在浏览器本地（IndexedDB）
- 不上传任何数据到服务器
- 无需登录即可使用全部功能
- 用户完全掌控自己的学习数据

## 🔄 版本历史

### v0.0.1 (2024-01)
- ✨ 初始版本发布
- ✨ 基础打字练习功能
- ✨ 词书管理系统
- ✨ 学习进度追踪
- ✨ 复习功能
- ✨ 统计页面
- ✨ 设置系统
- ✨ 重点词汇功能

## 📝 待办事项

- [ ] 支持更多词书导入
- [ ] 添加云端同步功能
- [ ] 实现更复杂的间隔重复算法
- [ ] 增加学习提醒功能
- [ ] 支持自定义单词本
- [ ] 添加多语言支持
- [ ] 实现 PWA 离线应用

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

[MIT](LICENSE) © 2024 KimiTyper

## 🙏 致谢

- [React](https://react.dev/) - 前端框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架
- [Zustand](https://github.com/pmndrs/zustand) - 状态管理
- [Lucide](https://lucide.dev/) - 图标库
- [idb](https://github.com/jakearchibald/idb) - IndexedDB 封装

---

Made with ❤️ for efficient vocabulary learning.

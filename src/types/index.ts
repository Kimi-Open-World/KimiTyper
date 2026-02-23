export interface Word {
  id: number
  word: string
  phonetic: string
  meaning: string
  example?: string
  exampleTranslation?: string // 例句的中文翻译
  audioUrl?: string
  // 词性（未来筛选/排序用）
  partOfSpeech?: string  // 'n.' | 'v.' | 'adj.' | 'adv.' 等
  // 难度分级（未来课程规划用）
  difficulty?: 1 | 2 | 3 | 4 | 5
  // 词源信息（详情页按需展示）
  prefix?: string        // 前缀，如 "ab-" (away)
  root?: string          // 词根，如 "-andon-" (permit)
  suffix?: string        // 后缀，如 "-dom" (state)
  etymology?: string     // 词源说明，如 "来自拉丁语 abandonare"
  wordFormation?: string // 构词法说明，如 "前缀 ab- (离开) + 词根 -andon- (允许)"
  cognates?: string[]    // 同源词，如 ["abandon", "bandon"]
}

export interface Chapter {
  id: string
  name: string
  description?: string
  words: Word[]
}

export interface WordBook {
  id: string
  name: string
  description: string
  wordCount: number
  language: string
  category: string
  chapters: Chapter[]
  // 兼容旧数据：如果 chapters 为空，使用 words
  words?: Word[]
  // 自定义词书标记
  isCustom?: boolean
  createdAt?: string
  updatedAt?: string
  // ── 未来按需加载准备 ──
  // 指向 /public/words/{bookId}.json，设置后词书数据将按需加载而非内嵌
  dataUrl?: string
  // 是否已将完整词条加载并缓存到 IndexedDB
  isLoaded?: boolean
  // 词书版本号，用于检测缓存是否需要更新
  version?: string
}

// SM2 间隔重复算法数据
export interface SM2Card {
  wordId: number
  bookId: string
  // SM2 核心字段
  interval: number      // 下次复习间隔（天）
  repetition: number    // 成功复习次数
  efFactor: number      // 难度因子 (1.3~2.5)
  nextReview: string    // 下次复习日期 ISO
  lastReview: string    // 上次复习日期 ISO
  grade: number         // 最近一次评分 (0-5)
}

export interface LearningProgress {
  bookId: string
  chapterId?: string  // 章节ID（可选）
  currentIndex: number
  completedWords: number[]
  errorWords: number[]
  errorCounts: Record<number, number>  // wordId → 累计错误次数
  lastStudyDate: string
  totalStudyTime: number // in minutes
}

export interface UserStats {
  totalWordsLearned: number
  totalStudyTime: number // in minutes
  streakDays: number
  lastStudyDate: string
  dailyGoal: number
  dailyProgress: number
  dailyDate: string  // 今日日期，用于重置 dailyProgress
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  pronunciation: boolean
  autoPlayAudio: boolean
  showPhonetic: boolean
  showExample: boolean
  keyboardSound: boolean
  dailyGoal: number
  language: 'zh' | 'en'   // 界面语言
  reminderEnabled: boolean  // 学习提醒
  reminderTime: string      // 提醒时间 "HH:MM"
}

// 多语言类型
export type Language = 'zh' | 'en'

export interface Translations {
  [key: string]: string
}

export interface Word {
  id: number
  word: string
  phonetic: string
  meaning: string
  example?: string
  audioUrl?: string
  // 词源信息
  prefix?: string      // 前缀，如 "ab-" (away)
  root?: string        // 词根，如 "-andon-" (permit)
  suffix?: string      // 后缀，如 "-dom" (state)
  etymology?: string   // 词源说明，如 "来自拉丁语 abandonare"
  wordFormation?: string // 构词法说明，如 "前缀 ab- (离开) + 词根 -andon- (允许)"
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
  chapters: Chapter[]  // 分章节的词汇列表
  // 兼容旧数据：如果 chapters 为空，使用 words
  words?: Word[]
}

export interface LearningProgress {
  bookId: string
  chapterId?: string  // 章节ID（可选）
  currentIndex: number
  completedWords: number[]
  errorWords: number[]
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
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  pronunciation: boolean
  autoPlayAudio: boolean
  showPhonetic: boolean
  showExample: boolean
  keyboardSound: boolean
  dailyGoal: number
}

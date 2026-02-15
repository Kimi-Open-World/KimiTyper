export interface Word {
  id: number
  word: string
  phonetic: string
  meaning: string
  example?: string
  audioUrl?: string
}

export interface WordBook {
  id: string
  name: string
  description: string
  wordCount: number
  language: string
  category: string
  words: Word[]
}

export interface LearningProgress {
  bookId: string
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

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WordBook, LearningProgress, UserStats, AppSettings, Word } from '@/types'

interface AppState {
  // 当前选中的词书
  currentBook: WordBook | null
  setCurrentBook: (book: WordBook | null) => void

  // 学习进度
  progress: Record<string, LearningProgress>
  updateProgress: (bookId: string, progress: Partial<LearningProgress>) => void
  getProgress: (bookId: string) => LearningProgress | null

  // 用户统计
  stats: UserStats
  updateStats: (stats: Partial<UserStats>) => void

  // 设置
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => void
  toggleTheme: () => void

  // 重点词汇
  keyVocabulary: Word[]
  addToKeyVocabulary: (word: Word) => void
  removeFromKeyVocabulary: (wordId: number) => void
  isInKeyVocabulary: (wordId: number) => boolean
}

const defaultSettings: AppSettings = {
  theme: 'system',
  pronunciation: true,
  autoPlayAudio: false,
  showPhonetic: true,
  showExample: true,
  keyboardSound: false,
  dailyGoal: 20,
}

const defaultStats: UserStats = {
  totalWordsLearned: 0,
  totalStudyTime: 0,
  streakDays: 0,
  lastStudyDate: '',
  dailyGoal: 20,
  dailyProgress: 0,
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      setCurrentBook: (book) => set({ currentBook: book }),

      progress: {},
      updateProgress: (bookId, progressUpdate) => {
        set((state) => ({
          progress: {
            ...state.progress,
            [bookId]: {
              ...state.progress[bookId],
              ...progressUpdate,
              bookId,
            } as LearningProgress,
          },
        }))
      },
      getProgress: (bookId) => get().progress[bookId] || null,

      stats: defaultStats,
      updateStats: (statsUpdate) => {
        set((state) => ({
          stats: { ...state.stats, ...statsUpdate },
        }))
      },

      settings: defaultSettings,
      updateSettings: (settingsUpdate) => {
        set((state) => ({
          settings: { ...state.settings, ...settingsUpdate },
        }))
      },
      toggleTheme: () => {
        set((state) => {
          const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
          const currentIndex = themes.indexOf(state.settings.theme)
          const nextTheme = themes[(currentIndex + 1) % themes.length]
          return {
            settings: { ...state.settings, theme: nextTheme },
          }
        })
      },

      // 重点词汇
      keyVocabulary: [],
      addToKeyVocabulary: (word) => {
        set((state) => {
          if (state.keyVocabulary.some((w) => w.id === word.id)) {
            return state
          }
          return {
            keyVocabulary: [...state.keyVocabulary, word],
          }
        })
      },
      removeFromKeyVocabulary: (wordId) => {
        set((state) => ({
          keyVocabulary: state.keyVocabulary.filter((w) => w.id !== wordId),
        }))
      },
      isInKeyVocabulary: (wordId) => {
        return get().keyVocabulary.some((w) => w.id === wordId)
      },
    }),
    {
      name: 'kimityper-storage',
      partialize: (state) => ({
        progress: state.progress,
        stats: state.stats,
        settings: state.settings,
        keyVocabulary: state.keyVocabulary,
      }),
    }
  )
)

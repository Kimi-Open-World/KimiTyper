import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WordBook, LearningProgress, UserStats, AppSettings, Word, SM2Card } from '@/types'
import type { SyncItem } from '@/lib/sync'

// 同步状态
export interface SyncStatus {
  isLoggedIn: boolean
  isSyncing: boolean
  lastSyncAt: string | null
  lastError: string | null
  user: { id: string; email: string; nickname: string } | null
}

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
  recordWordLearned: () => void
  addStudyTime: (minutes: number) => void

  // 设置
  settings: AppSettings
  updateSettings: (settings: Partial<AppSettings>) => void
  toggleTheme: () => void

  // 重点词汇
  keyVocabulary: Word[]
  addToKeyVocabulary: (word: Word) => void
  removeFromKeyVocabulary: (wordId: number) => void
  isInKeyVocabulary: (wordId: number) => boolean

  // SM2 Session（临时，不持久化）
  sm2Session: {
    cards: SM2Card[]
    currentIndex: number
    showAnswer: boolean
  }
  setSM2Session: (cards: SM2Card[]) => void
  advanceSM2: () => void
  toggleSM2Answer: () => void

  // 云端同步状态
  syncStatus: SyncStatus
  setSyncStatus: (update: Partial<SyncStatus>) => void

  /**
   * 将服务器返回的 SyncItem 列表合并到本地 Store（Last-Write-Wins）
   * 返回本地需要添加或更新的自定义词书 id 列表（供调用方写 IndexedDB）
   */
  applyServerItems: (items: SyncItem[]) => {
    customBooksToSave: WordBook[]
  }
}

const defaultSettings: AppSettings = {
  theme: 'system',
  pronunciation: true,
  autoPlayAudio: false,
  showPhonetic: true,
  showExample: true,
  keyboardSound: true,
  dailyGoal: 20,
  language: 'zh',
  reminderEnabled: false,
  reminderTime: '20:00',
}

const defaultStats: UserStats = {
  totalWordsLearned: 0,
  totalStudyTime: 0,
  streakDays: 0,
  lastStudyDate: '',
  dailyGoal: 20,
  dailyProgress: 0,
  dailyDate: '',
}

function getTodayStr() {
  return new Date().toDateString()
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      setCurrentBook: (book) => set({ currentBook: book }),

      progress: {},
      // progressKey 可能是 "bookId" 或 "bookId-chapterId"，不能直接当 bookId 使用
      updateProgress: (progressKey, progressUpdate) => {
        set((state) => ({
          progress: {
            ...state.progress,
            [progressKey]: {
              ...state.progress[progressKey],
              ...progressUpdate,
              // bookId 优先用 progressUpdate 里的真实值，fallback 才用 progressKey
              bookId: progressUpdate.bookId ?? state.progress[progressKey]?.bookId ?? progressKey,
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

      recordWordLearned: () => {
        set((state) => {
          const today = getTodayStr()
          const lastDate = state.stats.dailyDate
          const lastStudyDate = state.stats.lastStudyDate

          const isSameDay = lastDate === today
          const dailyProgress = isSameDay ? state.stats.dailyProgress + 1 : 1

          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          const isYesterday = lastStudyDate === yesterday.toDateString()
          const isTodayAlready = lastStudyDate === today
          let streakDays = state.stats.streakDays
          if (!isTodayAlready) {
            if (isYesterday || streakDays === 0) {
              streakDays = streakDays + 1
            } else {
              streakDays = 1
            }
          }

          return {
            stats: {
              ...state.stats,
              totalWordsLearned: state.stats.totalWordsLearned + 1,
              lastStudyDate: today,
              dailyDate: today,
              dailyProgress,
              streakDays,
            },
          }
        })
      },

      addStudyTime: (minutes) => {
        set((state) => ({
          stats: {
            ...state.stats,
            totalStudyTime: state.stats.totalStudyTime + minutes,
          },
        }))
      },

      settings: defaultSettings,
      updateSettings: (settingsUpdate) => {
        set((state) => ({
          settings: { ...state.settings, ...settingsUpdate },
        }))
        if (settingsUpdate.dailyGoal !== undefined) {
          set((state) => ({
            stats: { ...state.stats, dailyGoal: settingsUpdate.dailyGoal! },
          }))
        }
      },
      toggleTheme: () => {
        set((state) => {
          const themes: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
          const currentIndex = themes.indexOf(state.settings.theme)
          const nextTheme = themes[(currentIndex + 1) % themes.length]
          return { settings: { ...state.settings, theme: nextTheme } }
        })
      },

      keyVocabulary: [],
      addToKeyVocabulary: (word) => {
        set((state) => {
          if (state.keyVocabulary.some((w) => w.id === word.id)) return state
          return { keyVocabulary: [...state.keyVocabulary, word] }
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

      // SM2 Session
      sm2Session: { cards: [], currentIndex: 0, showAnswer: false },
      setSM2Session: (cards) =>
        set({ sm2Session: { cards, currentIndex: 0, showAnswer: false } }),
      advanceSM2: () =>
        set((state) => ({
          sm2Session: {
            ...state.sm2Session,
            currentIndex: state.sm2Session.currentIndex + 1,
            showAnswer: false,
          },
        })),
      toggleSM2Answer: () =>
        set((state) => ({
          sm2Session: {
            ...state.sm2Session,
            showAnswer: !state.sm2Session.showAnswer,
          },
        })),

      // 同步状态
      syncStatus: {
        isLoggedIn: false,
        isSyncing: false,
        lastSyncAt: null,
        lastError: null,
        user: null,
      },
      setSyncStatus: (update) =>
        set((state) => ({ syncStatus: { ...state.syncStatus, ...update } })),

      // 合并服务器 SyncItem 到本地
      applyServerItems: (items) => {
        const customBooksToSave: WordBook[] = []

        set((state) => {
          let newProgress = { ...state.progress }
          let newStats = { ...state.stats }
          let newSettings = { ...state.settings }
          let newKeyVocab = [...state.keyVocabulary]

          for (const item of items) {
            if (item.deleted) {
              // 软删除：移除本地数据
              if (item.dataType === 'progress') {
                delete newProgress[item.dataKey]
              }
              continue
            }

            switch (item.dataType) {
              case 'progress': {
                const serverProgress = item.dataValue as LearningProgress
                const local = newProgress[item.dataKey]
                // Last-Write-Wins：服务器更新时间戳更新则覆盖
                const localSyncedAt = (local as { _syncedAt?: string } | undefined)?._syncedAt ?? ''
                if (!local || item.updatedAt > localSyncedAt) {
                  newProgress[item.dataKey] = { ...serverProgress, bookId: item.dataKey }
                }
                break
              }
              case 'stats': {
                const serverStats = item.dataValue as UserStats
                // 合并统计：取较大值（避免覆盖更多的本地进度）
                newStats = {
                  ...serverStats,
                  totalWordsLearned: Math.max(
                    state.stats.totalWordsLearned,
                    serverStats.totalWordsLearned
                  ),
                  totalStudyTime: Math.max(
                    state.stats.totalStudyTime,
                    serverStats.totalStudyTime
                  ),
                  streakDays: Math.max(state.stats.streakDays, serverStats.streakDays),
                }
                break
              }
              case 'settings': {
                newSettings = { ...state.settings, ...(item.dataValue as Partial<AppSettings>) }
                break
              }
              case 'keyVocab': {
                newKeyVocab = item.dataValue as Word[]
                break
              }
              case 'book': {
                // 自定义词书，需要写入 IndexedDB
                customBooksToSave.push(item.dataValue as WordBook)
                break
              }
              // sm2card 由 IndexedDB 管理，不放在 store 里
            }
          }

          return {
            progress: newProgress,
            stats: newStats,
            settings: newSettings,
            keyVocabulary: newKeyVocab,
          }
        })

        return { customBooksToSave }
      },
    }),
    {
      name: 'kimityper-storage',
      partialize: (state) => ({
        progress: state.progress,
        stats: state.stats,
        settings: state.settings,
        keyVocabulary: state.keyVocabulary,
        syncStatus: {
          isLoggedIn: state.syncStatus.isLoggedIn,
          lastSyncAt: state.syncStatus.lastSyncAt,
          user: state.syncStatus.user,
          isSyncing: false,
          lastError: null,
        },
      }),
      // 数据迁移：修复旧版 bookId 写成 progressKey 的问题，同时确保新功能默认开启
      onRehydrateStorage: () => (state) => {
        if (!state) return

        // 1. 强制开启键盘音效（旧数据可能存的是 false）
        if (state.settings && state.settings.keyboardSound === false) {
          state.settings = { ...state.settings, keyboardSound: true }
        }

        // 2. 修复旧版 bookId 写成 progressKey 的问题
        const fixedProgress: Record<string, LearningProgress> = {}
        let needsFix = false

        for (const [progressKey, p] of Object.entries(state.progress)) {
          const prog = p as LearningProgress
          if (prog.bookId === progressKey && progressKey.includes('-')) {
            const chapterId = prog.chapterId
            let trueBookId = progressKey
            if (chapterId && progressKey.endsWith('-' + chapterId)) {
              trueBookId = progressKey.slice(0, progressKey.length - chapterId.length - 1)
            }
            fixedProgress[progressKey] = { ...prog, bookId: trueBookId, errorCounts: prog.errorCounts ?? {} }
            needsFix = true
          } else {
            fixedProgress[progressKey] = { ...prog, errorCounts: prog.errorCounts ?? {} }
          }
        }

        if (needsFix) {
          state.progress = fixedProgress
        }
      },
    }
  )
)

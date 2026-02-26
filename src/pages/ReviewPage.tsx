import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Trash2, Volume2, Brain, ChevronRight, Star, SkipForward, Check, List, X, ChevronLeft } from 'lucide-react'
import { useAppStore } from '@/store'
import { getAllBooks, getDueSM2Cards, saveSM2Card } from '@/db'
import { allBooks as defaultAllBooks } from '@/data/books'
import type { Word, SM2Card } from '@/types'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { sm2Update, formatNextReview } from '@/lib/sm2'
import { getWordDetailCached } from '@/lib/wordLoader'
import { WordDetailPanel } from '@/components/WordDetailPanel'
import { playWordPronunciation } from '@/lib/audio'
import type { WordDetail } from '@/db'

interface ErrorWordItem {
  word: Word
  bookId: string
  bookName: string
  progressKey: string
  errorCount: number
}

type Tab = 'error' | 'sm2'

export default function ReviewPage() {
  const { progress, updateProgress, settings, addToKeyVocabulary, isInKeyVocabulary, removeFromKeyVocabulary } = useAppStore()
  const t = createT(settings.language)
  const [activeTab, setActiveTab] = useState<Tab>('error')
  const [showList, setShowList] = useState(false)
  const activeWordRef = useRef<HTMLButtonElement>(null)

  // === Error Words Tab ===
  const [errorWords, setErrorWords] = useState<ErrorWordItem[]>([])
  const [errorIndex, setErrorIndex] = useState(0)
  const [errorInput, setErrorInput] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [inputState, setInputState] = useState<'idle' | 'correct' | 'error'>('idle')
  const inputRef = useRef<HTMLInputElement>(null)

  const [showDetail, setShowDetail] = useState(false)
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // === SM2 Tab ===
  const [sm2Cards, setSm2Cards] = useState<SM2Card[]>([])
  const [sm2Index, setSm2Index] = useState(0)
  const [sm2ShowWord, setSm2ShowWord] = useState(false)
  const [sm2WordMap, setSm2WordMap] = useState<Record<string, Word>>({})

  // ---- AudioContext (音效) ----
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    return () => {
      // 深度优化：退出组件时关闭音频上下文，彻底释放底层音频线程内存
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.warn)
      }
    }
  }, [])
  const getAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  const playCorrectSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const now = ctx.currentTime
      const osc1 = ctx.createOscillator(); const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now); osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
      gain1.gain.setValueAtTime(0.25, now); gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc1.connect(gain1); gain1.connect(ctx.destination); osc1.start(now); osc1.stop(now + 0.18)
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(660, now); osc2.frequency.exponentialRampToValueAtTime(880, now + 0.08)
      gain2.gain.setValueAtTime(0.12, now); gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc2.connect(gain2); gain2.connect(ctx.destination); osc2.start(now); osc2.stop(now + 0.15)
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  const playErrorSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const now = ctx.currentTime
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(120, now + 0.12)
      gain.gain.setValueAtTime(0.35, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.connect(gain); gain.connect(ctx.destination); osc.start(now); osc.stop(now + 0.2)
      const osc2 = ctx.createOscillator(); const gain2 = ctx.createGain()
      osc2.type = 'square'
      osc2.frequency.setValueAtTime(180, now); osc2.frequency.exponentialRampToValueAtTime(80, now + 0.08)
      gain2.gain.setValueAtTime(0.08, now); gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc2.connect(gain2); gain2.connect(ctx.destination); osc2.start(now); osc2.stop(now + 0.1)
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  const playCompleteSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.12
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t)
        gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        osc.connect(gain); gain.connect(ctx.destination); osc.start(t); osc.stop(t + 0.2)
      })
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  // ---- Load Error Words ----
  useEffect(() => {
    const loadErrorWords = async () => {
      const items: ErrorWordItem[] = []
      const dbBooks = await getAllBooks()
      const customBooks = dbBooks.filter(dbB => !defaultAllBooks.some(dA => dA.id === dbB.id))
      const books = [...defaultAllBooks, ...customBooks]

      for (const [progressKey, bookProgress] of Object.entries(progress)) {
        if (!bookProgress.errorWords?.length) continue

        let book = books.find((b) => b.id === bookProgress.bookId)
        if (!book) {
          const parts = progressKey.split('-')
          for (let i = parts.length - 1; i >= 1; i--) {
            const candidateId = parts.slice(0, i).join('-')
            book = books.find((b) => b.id === candidateId)
            if (book) break
          }
          if (!book) book = books.find((b) => b.id === progressKey)
        }
        if (!book) continue

        const bookId = book.id
        const chapterId = bookProgress.chapterId
        const allWords: Word[] = []
        if (book.chapters && book.chapters.length > 0) {
          if (chapterId) {
            const chapter = book.chapters.find((c) => c.id === chapterId)
            if (chapter) allWords.push(...chapter.words)
            else book.chapters.forEach((c) => allWords.push(...c.words))
          } else {
            book.chapters.forEach((c) => allWords.push(...c.words))
          }
        } else if (book.words) {
          allWords.push(...book.words)
        }

        for (const wordId of bookProgress.errorWords) {
          const word = allWords.find((w) => w.id === wordId)
          if (word && !items.some((i) => i.word.id === wordId && i.bookId === bookId)) {
            items.push({ word, bookId, bookName: book.name, progressKey, errorCount: bookProgress.errorCounts?.[wordId] ?? 1 })
          }
        }
      }

      items.sort((a, b) => b.errorCount - a.errorCount)
      setErrorWords(items)
    }
    loadErrorWords()
  }, [progress])

  // ---- Load SM2 Due Cards ----
  useEffect(() => {
    const loadSM2 = async () => {
      const dueCards = await getDueSM2Cards()
      setSm2Cards(dueCards)
      if (dueCards.length > 0) {
        const dbBooks = await getAllBooks()
        const customBooks = dbBooks.filter(dbB => !defaultAllBooks.some(dA => dA.id === dbB.id))
        const books = [...defaultAllBooks, ...customBooks]
        const wordMap: Record<string, Word> = {}
        for (const card of dueCards) {
          const book = books.find((b) => b.id === card.bookId)
          if (!book) continue
          const allWords: Word[] = []
          if (book.chapters?.length) book.chapters.forEach((c) => allWords.push(...c.words))
          else if (book.words) allWords.push(...book.words)
          const word = allWords.find((w) => w.id === card.wordId)
          if (word) wordMap[`${card.bookId}-${card.wordId}`] = word
        }
        setSm2WordMap(wordMap)
      }
    }
    loadSM2()
  }, [])

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [errorIndex, sm2Index, activeTab])

  // ---- Error Words Actions ----
  const currentErrorItem = errorWords[errorIndex]

  const goToNext = useCallback((nextIdx?: number) => {
    setErrorInput('')
    setShowAnswer(false)
    setInputState('idle')
    setShowDetail(false)
    setWordDetail(null)
    const next = nextIdx !== undefined ? nextIdx : (errorIndex < errorWords.length - 1 ? errorIndex + 1 : 0)
    setErrorIndex(next)
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [errorIndex, errorWords.length])

  const goToPrev = useCallback(() => {
    setErrorInput('')
    setShowAnswer(false)
    setInputState('idle')
    setShowDetail(false)
    setWordDetail(null)
    if (errorIndex > 0) {
      setErrorIndex(errorIndex - 1)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [errorIndex])

  const handleErrorInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentErrorItem) return
    const value = e.target.value
    const target = currentErrorItem.word.word.toLowerCase()
    let inputLower = value.toLowerCase()

    if (settings.spaceToSwitch && inputLower === target + ' ') {
      inputLower = target
    }

    if (inputLower === target) {
      // 正确！
      if (inputState !== 'correct') {
        setErrorInput(target)
        setInputState('correct')
        setShowAnswer(true)
        playCorrectSound()
        // 答对了，从错词本移除
        removeErrorWordFromProgress(currentErrorItem)
      }

      if (!settings.spaceToSwitch || value.endsWith(' ')) {
        const newList = errorWords.filter((_, i) => i !== errorIndex)
        const nextIdx = errorIndex >= newList.length ? Math.max(0, newList.length - 1) : errorIndex
        setTimeout(() => {
          if (newList.length === 0) {
            playCompleteSound()
            setErrorWords([])
          } else {
            setErrorWords(newList)
            goToNext(nextIdx)
          }
        }, settings.spaceToSwitch ? 0 : 600)
      } else {
        setErrorInput(target)
      }
    } else if (!target.startsWith(inputLower)) {
      // 输入错误的字符
      setErrorInput(value)
      setInputState('error')
      playErrorSound()
      setTimeout(() => {
        setInputState('idle')
        setErrorInput('')
      }, 300)
    } else {
      // 前缀匹配，继续输入
      setErrorInput(value)
      setInputState('idle')
    }
  }

  const skipWord = useCallback(() => {
    if (!currentErrorItem) return
    playErrorSound()
    goToNext()
  }, [currentErrorItem, goToNext, playErrorSound])

  const removeErrorWordFromProgress = (item: ErrorWordItem) => {
    const { progressKey, word } = item
    const currentProgress = progress[progressKey]
    if (currentProgress) {
      const newCounts = { ...currentProgress.errorCounts }
      delete newCounts[word.id]
      updateProgress(progressKey, {
        errorWords: currentProgress.errorWords.filter((id) => id !== word.id),
        errorCounts: newCounts,
      })
    }
  }

  const removeErrorWord = useCallback(() => {
    if (!currentErrorItem) return
    removeErrorWordFromProgress(currentErrorItem)
    const newList = errorWords.filter((_, i) => i !== errorIndex)
    setErrorWords(newList)
    const nextIdx = errorIndex >= newList.length ? Math.max(0, newList.length - 1) : errorIndex
    if (newList.length === 0) {
      setErrorIndex(0)
      setErrorInput('')
      setShowAnswer(false)
      setInputState('idle')
    } else {
      goToNext(nextIdx)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentErrorItem, errorIndex, errorWords, progress, updateProgress])

  const toggleKeyVocabulary = useCallback(() => {
    if (!currentErrorItem) return
    if (isInKeyVocabulary(currentErrorItem.word.id)) {
      removeFromKeyVocabulary(currentErrorItem.word.id)
    } else {
      addToKeyVocabulary(currentErrorItem.word)
    }
  }, [currentErrorItem, isInKeyVocabulary, addToKeyVocabulary, removeFromKeyVocabulary])

  // ---- SM2 Actions ----
  const currentSM2Card = sm2Cards[sm2Index]
  const currentSM2Word = currentSM2Card
    ? sm2WordMap[`${currentSM2Card.bookId}-${currentSM2Card.wordId}`]
    : undefined

  const handleSM2Grade = async (grade: number) => {
    if (!currentSM2Card) return
    const updated = sm2Update(currentSM2Card, grade)
    await saveSM2Card(updated)
    setSm2Cards((prev) => prev.map((c, i) => (i === sm2Index ? updated : c)))
    setSm2ShowWord(false)
    setShowDetail(false)
    setWordDetail(null)
    if (sm2Index < sm2Cards.length - 1) {
      setSm2Index((i) => i + 1)
    } else {
      setSm2Index(sm2Cards.length)
    }
  }

  const playSM2Audio = () => {
    if (!currentSM2Word || !settings.pronunciation) return
    playWordPronunciation(currentSM2Word.word)
  }

  const playAudio = (word: string) => {
    if (!settings.pronunciation) return
    playWordPronunciation(word)
  }

  const sm2Grades = [
    { grade: 0, label: t('review.sm2.grade0'), color: 'bg-red-500 hover:bg-red-600' },
    { grade: 2, label: t('review.sm2.grade2'), color: 'bg-orange-500 hover:bg-orange-600' },
    { grade: 3, label: t('review.sm2.grade3'), color: 'bg-yellow-500 hover:bg-yellow-600' },
    { grade: 5, label: t('review.sm2.grade5'), color: 'bg-green-500 hover:bg-green-600' },
  ]

  const isStarred = currentErrorItem ? isInKeyVocabulary(currentErrorItem.word.id) : false

  return (
    <div className="mx-auto max-w-[1280px] flex flex-col gap-8 w-full lg:mt-6 px-4">
      {/* ===== Left Sidebar: Word List Overlay ===== */}
      {showList && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={() => setShowList(false)}
        />
      )}
      <div
        className={cn(
          "fixed top-0 left-0 h-full w-80 bg-[#1E2028] text-gray-300 shadow-2xl z-50 transition-transform duration-300 flex flex-col rounded-r-2xl border-r border-white/5",
          showList ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-white/10 bg-black/20 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-base text-gray-100">{activeTab === 'error' ? t('review.title') : t('review.sm2.title')}</h3>
            <p className="text-xs text-gray-500 font-medium tracking-wide">TOTAL {activeTab === 'error' ? errorWords.length : sm2Cards.length} WORDS</p>
          </div>
          <button onClick={() => setShowList(false)} className="rounded p-2 hover:bg-white/10 transition-colors">
            <X className="h-4 w-4 text-gray-400 hover:text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {activeTab === 'error' ? errorWords.map((item, idx) => {
            const isActive = errorIndex === idx
            return (
              <button
                key={`${item.word.id}-${item.bookId}`}
                ref={isActive ? activeWordRef : null}
                onClick={() => {
                  if (idx !== errorIndex) {
                    setErrorIndex(idx)
                    setErrorInput('')
                    setShowAnswer(false)
                    setInputState('idle')
                    setShowList(false)
                  }
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl transition-all flex flex-col gap-1.5 group cursor-pointer border border-transparent",
                  isActive
                    ? 'bg-[#2A2D3A] border-[#3F4257] shadow-lg scale-[1.02]'
                    : 'hover:bg-[#2A2D3A]/50 hover:border-white/5'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn(
                    "font-mono text-lg tracking-wide",
                    isActive ? 'font-bold text-white' : 'font-medium text-gray-300'
                  )}>
                    {item.word.word}
                  </span>
                  <Volume2
                    className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      isActive ? "opacity-100 text-gray-400 hover:text-white" : "opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      playAudio(item.word.word);
                    }}
                  />
                </div>
                <span className={cn(
                  "text-xs leading-relaxed line-clamp-2",
                  isActive ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {item.word.meaning}
                </span>
              </button>
            )
          }) : sm2Cards.map((c, idx) => {
            const w = sm2WordMap[`${c.bookId}-${c.wordId}`]
            if (!w) return null;
            const isActive = sm2Index === idx
            return (
              <button
                key={`${c.bookId}-${c.wordId}`}
                ref={isActive ? activeWordRef : null}
                onClick={() => {
                  if (idx !== sm2Index) {
                    setSm2Index(idx)
                    setSm2ShowWord(false)
                    setShowList(false)
                    setShowDetail(false)
                    setWordDetail(null)
                  }
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl transition-all flex flex-col gap-1.5 group cursor-pointer border border-transparent",
                  isActive
                    ? 'bg-[#2A2D3A] border-[#3F4257] shadow-lg scale-[1.02]'
                    : 'hover:bg-[#2A2D3A]/50 hover:border-white/5'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn(
                    "font-mono text-lg tracking-wide",
                    isActive ? 'font-bold text-white' : 'font-medium text-gray-300'
                  )}>
                    {isActive || sm2ShowWord ? w.word : "????"}
                  </span>
                  <Volume2
                    className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      isActive ? "opacity-100 text-gray-400 hover:text-white" : "opacity-0 group-hover:opacity-100 text-gray-600 hover:text-gray-300",
                      (!isActive && !sm2ShowWord) ? "hidden" : ""
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      playAudio(w.word);
                    }}
                  />
                </div>
                <span className={cn(
                  "text-xs leading-relaxed line-clamp-2",
                  isActive ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {isActive || sm2ShowWord ? w.meaning : "????"}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowList(true)}
            className="rounded-lg p-2 hover:bg-accent transition-colors"
            title="词汇列表"
          >
            <List className="h-5 w-5" />
          </button>
          <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">{t('nav.review')}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 rounded-xl border bg-muted/30 p-1">
          <button
            onClick={() => setActiveTab('error')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              activeTab === 'error' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <RotateCcw className="h-4 w-4" />
            {t('review.title')}
            {errorWords.length > 0 && (
              <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] text-white">
                {errorWords.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sm2')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors',
              activeTab === 'sm2' ? 'bg-card shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Brain className="h-4 w-4" />
            {t('review.sm2.title')}
            {sm2Cards.length > 0 && (
              <span className="rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] text-white">
                {sm2Cards.length}
              </span>
            )}
          </button>
        </div>

        {/* === Error Words Tab === */}
        {activeTab === 'error' && (
          <>
            {errorWords.length === 0 ? (
              <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/20">
                  <RotateCcw className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-xl font-semibold">{settings.language === 'zh' ? '太棒了！' : 'Great!'}</h2>
                <p className="text-muted-foreground">{t('review.empty')}</p>
              </div>
            ) : (
              <>
                {/* Progress bar */}
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {errorIndex + 1} / {errorWords.length} · {t('review.from')} {currentErrorItem?.bookName}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const nextShowDetail = !showDetail
                        setShowDetail(nextShowDetail)
                        if (nextShowDetail && !wordDetail && currentErrorItem) {
                          setDetailLoading(true)
                          try {
                            const dbBooks = await getAllBooks()
                            const customBooks = dbBooks.filter(dbB => !defaultAllBooks.some(dA => dA.id === dbB.id))
                            const books = [...defaultAllBooks, ...customBooks]
                            const book = books.find(b => b.id === currentErrorItem.bookId)
                            if (book) {
                              const detail = await getWordDetailCached(currentErrorItem.word, book)
                              setWordDetail(detail)
                            }
                          } finally {
                            setDetailLoading(false)
                          }
                        }
                      }}
                      className={cn(
                        'rounded-full p-2 transition-colors',
                        showDetail ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                      )}
                      title={t('typing.etymologyPanel') || 'Detailed Info'}
                    >
                      <List className="h-4 w-4" />
                    </button>
                    <button
                      onClick={toggleKeyVocabulary}
                      title={isStarred
                        ? (settings.language === 'zh' ? '已加入重点词汇' : 'In Key Vocabulary')
                        : (settings.language === 'zh' ? '加入重点词汇' : 'Add to Key Vocabulary')}
                      className={cn(
                        'rounded-full p-2 transition-colors',
                        isStarred ? 'text-yellow-500 hover:text-yellow-600' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Star className={cn('h-5 w-5', isStarred && 'fill-current')} />
                    </button>
                  </div>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-destructive transition-all duration-300"
                    style={{ width: `${((errorIndex + 1) / errorWords.length) * 100}%` }}
                  />
                </div>

                {/* Word Card */}
                {currentErrorItem && (
                  <div className={cn(
                    'rounded-2xl border-2 bg-card p-8 text-center transition-all duration-150',
                    inputState === 'correct' && 'border-green-500 bg-green-50/30 dark:bg-green-950/20',
                    inputState === 'error' && 'border-destructive bg-red-50/30 dark:bg-red-950/20',
                    inputState === 'idle' && 'border-border',
                  )}>
                    {/* Word + Audio */}
                    <div className="mb-4">
                      <div className="flex items-center justify-center gap-3">
                        <h2 className="text-3xl font-bold tracking-wide">{currentErrorItem.word.word}</h2>
                        <button
                          onClick={() => playAudio(currentErrorItem.word.word)}
                          className="rounded-full p-2 hover:bg-accent transition-colors"
                        >
                          <Volume2 className="h-5 w-5" />
                        </button>
                      </div>
                      <p className="mt-1 text-muted-foreground">{currentErrorItem.word.phonetic}</p>
                      <ErrorCountBadge count={currentErrorItem.errorCount} lang={settings.language} />
                    </div>

                    {/* Meaning (show when answered or show answer clicked) */}
                    {showAnswer && (
                      <div className="mb-4 rounded-xl bg-muted/40 p-4 text-left">
                        <p className="text-lg font-medium">{currentErrorItem.word.meaning}</p>
                        {currentErrorItem.word.example && (
                          <p className="mt-2 text-sm text-muted-foreground italic">{currentErrorItem.word.example}</p>
                        )}
                      </div>
                    )}

                    {/* Word Detail Panel */}
                    {showDetail && wordDetail && (
                      <WordDetailPanel wordDetail={wordDetail} t={t} isLoading={detailLoading} className="mb-4" />
                    )}

                    {/* Input */}
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="text"
                        value={errorInput}
                        onChange={handleErrorInput}
                        className={cn(
                          'w-full rounded-xl border-2 bg-transparent px-4 py-3 text-center text-xl font-mono outline-none transition-all duration-150',
                          inputState === 'correct' && 'border-green-500 text-green-600',
                          inputState === 'error' && 'border-destructive text-destructive',
                          inputState === 'idle' && 'border-input focus:border-primary',
                        )}
                        placeholder={t('typing.inputPlaceholder')}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        autoFocus
                      />
                      {inputState === 'correct' && (
                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                      )}
                    </div>
                  </div>
                )}

                {/* Controls — 5 buttons like TypingPractice */}
                <div className="grid grid-cols-5 gap-2">
                  {/* Prev */}
                  <button
                    onClick={goToPrev}
                    disabled={errorIndex === 0}
                    className="col-span-1 flex flex-col items-center gap-1 rounded-xl border py-3 text-xs hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>{t('common.prev')}</span>
                  </button>

                  {/* Show/Hide Answer */}
                  <button
                    onClick={() => setShowAnswer(!showAnswer)}
                    className="col-span-1 flex flex-col items-center gap-1 rounded-xl border py-3 text-xs hover:bg-accent transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <span>{showAnswer ? (settings.language === 'zh' ? '隐藏' : 'Hide') : (settings.language === 'zh' ? '提示' : 'Hint')}</span>
                  </button>

                  {/* Skip */}
                  <button
                    onClick={skipWord}
                    className="col-span-1 flex flex-col items-center gap-1 rounded-xl border py-3 text-xs hover:bg-accent transition-colors"
                  >
                    <SkipForward className="h-4 w-4" />
                    <span>{settings.language === 'zh' ? '跳过' : 'Skip'}</span>
                  </button>

                  {/* Key Vocabulary */}
                  <button
                    onClick={toggleKeyVocabulary}
                    className={cn(
                      'col-span-1 flex flex-col items-center gap-1 rounded-xl border py-3 text-xs transition-colors',
                      isStarred
                        ? 'border-yellow-400 bg-yellow-50 text-yellow-600 dark:bg-yellow-950/30'
                        : 'hover:bg-accent'
                    )}
                  >
                    <Star className={cn('h-4 w-4', isStarred && 'fill-current text-yellow-500')} />
                    <span>{settings.language === 'zh' ? '重点' : 'Star'}</span>
                  </button>

                  {/* Delete */}
                  <button
                    onClick={removeErrorWord}
                    className="col-span-1 flex flex-col items-center gap-1 rounded-xl border border-destructive/40 py-3 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>{settings.language === 'zh' ? '删除' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* === SM2 Tab === */}
        {activeTab === 'sm2' && (
          <>
            <div className="rounded-xl border bg-blue-50/50 dark:bg-blue-900/10 p-4">
              <p className="text-sm text-muted-foreground">{t('review.sm2.subtitle')}</p>
            </div>

            {sm2Cards.length === 0 || sm2Index >= sm2Cards.length ? (
              <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
                <div className="rounded-full bg-blue-100 p-6 dark:bg-blue-900/20">
                  <Brain className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-semibold">
                  {sm2Index >= sm2Cards.length && sm2Cards.length > 0
                    ? (settings.language === 'zh' ? '今日复习完成！🎉' : 'Review Complete! 🎉')
                    : t('review.sm2.noCards')}
                </h2>
                {sm2Index >= sm2Cards.length && sm2Cards.length > 0 && (
                  <button
                    onClick={() => setSm2Index(0)}
                    className="mt-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent"
                  >
                    {settings.language === 'zh' ? '再复习一遍' : 'Review again'}
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{sm2Index + 1} / {sm2Cards.length}</span>
                  <span className="flex items-center gap-1">
                    <span>{t('review.sm2.nextReview')}:</span>
                    <span className="font-medium text-blue-600">
                      {formatNextReview(currentSM2Card, settings.language)}
                    </span>
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all"
                    style={{ width: `${(sm2Index / sm2Cards.length) * 100}%` }}
                  />
                </div>

                <div className="rounded-2xl border bg-card p-8 text-center">
                  {currentSM2Word ? (
                    <>
                      <p className="text-muted-foreground mb-4 text-sm">
                        {settings.language === 'zh' ? '你记得这个单词的意思吗？' : 'Do you remember this word?'}
                      </p>
                      <div className="mb-6">
                        <div className="flex items-center justify-center gap-3">
                          <h2 className="text-3xl font-bold">{currentSM2Word.word}</h2>
                          <button onClick={playSM2Audio} className="rounded-full p-2 hover:bg-accent">
                            <Volume2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={async () => {
                              const nextShowDetail = !showDetail
                              setShowDetail(nextShowDetail)
                              if (nextShowDetail && !wordDetail && currentSM2Word && currentSM2Card) {
                                setDetailLoading(true)
                                try {
                                  const dbBooks = await getAllBooks()
                                  const customBooks = dbBooks.filter(dbB => !defaultAllBooks.some(dA => dA.id === dbB.id))
                                  const books = [...defaultAllBooks, ...customBooks]
                                  const book = books.find(b => b.id === currentSM2Card.bookId)
                                  if (book) {
                                    const detail = await getWordDetailCached(currentSM2Word, book)
                                    setWordDetail(detail)
                                  }
                                } finally {
                                  setDetailLoading(false)
                                }
                              }
                            }}
                            className={cn(
                              'rounded-full p-2 hover:bg-accent transition-colors',
                              showDetail ? 'text-primary bg-accent' : 'text-muted-foreground'
                            )}
                            title={t('typing.etymologyPanel') || 'Detailed Info'}
                          >
                            <List className="h-5 w-5" />
                          </button>
                        </div>
                        <p className="mt-2 text-muted-foreground">{currentSM2Word.phonetic}</p>
                      </div>

                      {sm2ShowWord ? (
                        <>
                          <p className="text-xl mb-3">{currentSM2Word.meaning}</p>
                          {currentSM2Word.example && (
                            <p className="text-sm text-muted-foreground italic mb-4">{currentSM2Word.example}</p>
                          )}

                          {/* Word Detail Panel */}
                          {showDetail && wordDetail && (
                            <WordDetailPanel wordDetail={wordDetail} t={t} isLoading={detailLoading} className="mb-6" />
                          )}

                          <div className="grid grid-cols-2 gap-3 mt-4">
                            {sm2Grades.map(({ grade, label, color }) => (
                              <button
                                key={grade}
                                onClick={() => handleSM2Grade(grade)}
                                className={cn('rounded-xl py-3 text-sm font-medium text-white transition-colors', color)}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </>
                      ) : (
                        <button
                          onClick={() => setSm2ShowWord(true)}
                          className="flex items-center gap-2 mx-auto rounded-xl border px-6 py-3 text-sm font-medium hover:bg-accent transition-colors"
                        >
                          {t('review.sm2.showWord')}
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">{t('common.loading')}</p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ==================== 错误次数徽章组件 ====================
function ErrorCountBadge({ count, lang }: { count: number; lang: string }) {
  const color =
    count >= 10 ? 'bg-red-600 text-white' :
      count >= 5 ? 'bg-red-500 text-white' :
        count >= 3 ? 'bg-orange-500 text-white' :
          count >= 2 ? 'bg-amber-500 text-white' :
            'bg-amber-400 text-white'

  const label = lang === 'zh'
    ? `错误 ${count} 次`
    : `${count} mistake${count > 1 ? 's' : ''}`

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        {label}
      </span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 5, 10].map((threshold) => (
          <div
            key={threshold}
            className={`h-2 w-4 rounded-sm transition-all ${count >= threshold ? 'bg-red-500' : 'bg-muted'}`}
          />
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Volume2, ArrowLeft, RotateCcw, ChevronLeft, Check, X, Star, Info, Trophy } from 'lucide-react'
import { useAppStore } from '@/store'
import { getBook } from '@/db'
import { saveProgress } from '@/db'
import type { Word, WordBook, LearningProgress } from '@/types'
import type { WordDetail } from '@/db'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { getWordDetailCached } from '@/lib/wordLoader'

const renderHighlightedExample = (example: string, word: string) => {
  if (!example || !word) return <span>{example}</span>
  try {
    // Escape special characters and create a word boundary matching the base word
    // using [a-z]* to somewhat catch conjugated forms like '-s', '-ed', '-ing'.
    // Only replacing pure english words with a basic approach
    const escapedWord = word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    // Get root without trailing 'e' etc to roughly handle conjugation like 'achieve' -> 'achieving'
    // To keep it simple and safe: just match the exact word or very close suffix
    const baseWordForSearch = escapedWord.replace(/e$/, '')
    const baseRegex = `\\b${baseWordForSearch}[a-z]*\\b`
    const regex = new RegExp(`(${baseRegex})`, 'gi')

    const parts = example.split(regex)
    return (
      <span className="leading-relaxed">
        {parts.map((part, i) => {
          if (new RegExp(`^${baseRegex}$`, 'i').test(part)) {
            return (
              <span key={i} className="text-red-500 font-semibold not-italic">
                {part}
              </span>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </span>
    )
  } catch (e) {
    return <span>{example}</span>
  }
}

export default function TypingPractice() {
  const { bookId, chapterId } = useParams<{ bookId: string; chapterId?: string }>()
  const navigate = useNavigate()
  const {
    currentBook,
    setCurrentBook,
    progress,
    updateProgress,
    settings,
    addToKeyVocabulary,
    isInKeyVocabulary,
    removeFromKeyVocabulary,
    keyVocabulary,
    recordWordLearned,
    addStudyTime,
  } = useAppStore()

  const t = createT(settings.language)

  const [book, setBook] = useState<WordBook | null>(currentBook)
  const [currentChapter, setCurrentChapter] = useState<{ id: string; name: string; words: Word[] } | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showError, setShowError] = useState(false)
  const [completedWords, setCompletedWords] = useState<number[]>([])
  const [errorWords, setErrorWords] = useState<number[]>([])
  const [errorCounts, setErrorCounts] = useState<Record<number, number>>({}) // wordId → 错误次数
  const [showDetail, setShowDetail] = useState(false)
  const [wordDetail, setWordDetail] = useState<WordDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showComplete, setShowComplete] = useState(false)  // 替代 alert() 的完成弹窗
  const [completeMessage, setCompleteMessage] = useState('')

  // 学习时长追踪
  const startTimeRef = useRef<number>(Date.now())
  const inputRef = useRef<HTMLInputElement>(null)



  useEffect(() => {
    if (!bookId) return

    const loadBook = async () => {
      let bookData = currentBook

      if (bookId === 'key-vocabulary') {
        if (keyVocabulary.length === 0) {
          alert(t('typing.emptyKey'))
          navigate('/key-vocabulary')
          return
        }
        bookData = {
          id: 'key-vocabulary',
          name: t('keyVocab.title'),
          description: '',
          wordCount: keyVocabulary.length,
          language: 'en',
          category: '',
          chapters: [],
          words: keyVocabulary,
        }
        setCurrentBook(bookData)
        setCurrentChapter(null)
      } else if (!bookData || bookData.id !== bookId) {
        bookData = await getBook(bookId) || null
        if (bookData) {
          setCurrentBook(bookData)
          if (chapterId && bookData.chapters && bookData.chapters.length > 0) {
            const chapter = bookData.chapters.find((c) => c.id === chapterId)
            if (chapter) {
              setCurrentChapter(chapter)
            } else {
              navigate('/')
              return
            }
          } else if (bookData.chapters && bookData.chapters.length > 0) {
            setCurrentChapter(bookData.chapters[0])
          } else {
            setCurrentChapter(null)
          }
        }
      } else {
        if (chapterId && bookData.chapters && bookData.chapters.length > 0) {
          const chapter = bookData.chapters.find((c) => c.id === chapterId)
          if (chapter) setCurrentChapter(chapter)
        } else if (bookData.chapters && bookData.chapters.length > 0) {
          setCurrentChapter(bookData.chapters[0])
        }
      }
      setBook(bookData)

      const progressKey = chapterId ? `${bookId}-${chapterId}` : bookId
      const savedProgress = progress[progressKey]
      if (savedProgress) {
        setCurrentIndex(savedProgress.currentIndex || 0)
        setCompletedWords(savedProgress.completedWords || [])
        setErrorWords(savedProgress.errorWords || [])
        setErrorCounts(savedProgress.errorCounts || {})
      }
    }

    loadBook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, chapterId])

  // 记录开始时间
  useEffect(() => {
    startTimeRef.current = Date.now()
  }, [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIndex])

  const currentWord: Word | undefined = currentChapter
    ? currentChapter.words[currentIndex]
    : book?.words?.[currentIndex]

  const playWordAudio = useCallback(
    (word: string) => {
      if (!settings.pronunciation) return
      const utterance = new SpeechSynthesisUtterance(word)
      utterance.lang = 'en-US'
      utterance.rate = 0.8
      window.speechSynthesis.speak(utterance)
    },
    [settings.pronunciation]
  )

  const completedWordsRef = useRef(completedWords)
  const errorWordsRef = useRef(errorWords)
  const errorCountsRef = useRef(errorCounts)
  const currentIndexRef = useRef(currentIndex)

  useEffect(() => { completedWordsRef.current = completedWords }, [completedWords])
  useEffect(() => { errorWordsRef.current = errorWords }, [errorWords])
  useEffect(() => { errorCountsRef.current = errorCounts }, [errorCounts])
  useEffect(() => { currentIndexRef.current = currentIndex }, [currentIndex])

  // 保存学习时长
  const saveStudyTime = useCallback(() => {
    const elapsedMs = Date.now() - startTimeRef.current
    const elapsedMinutes = elapsedMs / 1000 / 60
    if (elapsedMinutes >= 0.1) {
      addStudyTime(Math.round(elapsedMinutes * 10) / 10)
    }
    startTimeRef.current = Date.now()
  }, [addStudyTime])

  const saveCurrentProgress = useCallback(
    async () => {
      if (!bookId) return
      const progressKey = chapterId ? `${bookId}-${chapterId}` : bookId
      const newProgress: LearningProgress = {
        bookId,
        chapterId,
        currentIndex: currentIndexRef.current,
        completedWords: completedWordsRef.current,
        errorWords: errorWordsRef.current,
        errorCounts: errorCountsRef.current,
        lastStudyDate: new Date().toISOString(),
        totalStudyTime: 0,
      }
      await saveProgress(newProgress)
      updateProgress(progressKey, newProgress)
    },
    [bookId, chapterId, updateProgress]
  )

  useEffect(() => {
    return () => {
      saveCurrentProgress()
      saveStudyTime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  useEffect(() => {
    const interval = setInterval(() => {
      saveCurrentProgress()
      saveStudyTime()
    }, 30000) // 每30秒保存一次（也保存时长）
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  // 音效 AudioContext 复用
  const audioCtxRef = useRef<AudioContext | null>(null)
  const getAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    // 浏览器自动播放策略：必须在用户交互后 resume()
    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume()
    }
    return audioCtxRef.current
  }, [])

  // 正确音：清脆的向上双音「叮～」
  const playCorrectSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const now = ctx.currentTime

      // 主音：正弦波，清脆高频
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, now)
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.08)
      gain1.gain.setValueAtTime(0.25, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.18)

      // 和声：稍低五度，给声音丰满感
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(660, now)
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.08)
      gain2.gain.setValueAtTime(0.12, now)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + 0.15)
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  // 错误音：短促下降撞击感「咚～」，明确警示但不刺耳
  const playErrorSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const now = ctx.currentTime

      // 主音：低频下降，撞击感
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.12)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.2)

      // 噪声色（用快速 LFO 模拟），增加撞击质感
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'square'
      osc2.frequency.setValueAtTime(180, now)
      osc2.frequency.exponentialRampToValueAtTime(80, now + 0.08)
      gain2.gain.setValueAtTime(0.08, now)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + 0.1)
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  // 完成章节音效：上行 arpeggio（C-E-G-C）
  const playCompleteSound = useCallback(async () => {
    if (!settings.keyboardSound) return
    try {
      const ctx = await getAudioCtx()
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5-E5-G5-C6
      notes.forEach((freq, i) => {
        const t = ctx.currentTime + i * 0.12
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, t)
        gain.gain.setValueAtTime(0.2, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(t)
        osc.stop(t + 0.2)
      })
    } catch { /* ignore */ }
  }, [settings.keyboardSound, getAudioCtx])

  const showCompletionScreen = useCallback((message: string) => {
    saveStudyTime()
    playCompleteSound()
    setCompleteMessage(message)
    setShowComplete(true)
  }, [saveStudyTime, playCompleteSound])

  const nextWord = useCallback(() => {
    if (!book) return
    const words = currentChapter ? currentChapter.words : book.words
    if (!words) return

    setShowDetail(false)
    setWordDetail(null)

    if (currentIndex < words.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)

      if (settings.pronunciation) {
        setTimeout(() => {
          const nextWordData = words[nextIndex]
          if (nextWordData) playWordAudio(nextWordData.word)
        }, 350)
      }
    } else {
      // 完成！保留本轮打错的单词，重置进度但不丢错词
      const progressKey = chapterId ? `${book.id}-${chapterId}` : book.id
      const currentErrors = errorWordsRef.current
      const currentErrorCounts = errorCountsRef.current
      const resetProgress: LearningProgress = {
        bookId: book.id,
        chapterId,
        currentIndex: 0,
        completedWords: [],
        // 保留错词和错误次数，下次复习页还能看到
        errorWords: currentErrors,
        errorCounts: currentErrorCounts,
        lastStudyDate: new Date().toISOString(),
        totalStudyTime: 0,
      }
      saveProgress(resetProgress)
      updateProgress(progressKey, resetProgress)

      if (chapterId) {
        showCompletionScreen(`${t('typing.complete')} ${currentChapter?.name || ''}`)
      } else if (bookId === 'key-vocabulary') {
        showCompletionScreen(t('typing.allComplete'))
      } else {
        showCompletionScreen(t('typing.allComplete'))
      }
    }
  }, [book, currentChapter, currentIndex, navigate, updateProgress, settings.pronunciation, chapterId, bookId, playWordAudio, showCompletionScreen, t])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setShowError(false)
    setShowDetail(false)

    if (!currentWord) return

    const target = currentWord.word.toLowerCase()
    const inputLower = value.toLowerCase()

    if (inputLower === target) {
      setIsCorrect(true)
      setCompletedWords((prev) => [...new Set([...prev, currentWord.id])])
      playCorrectSound()
      // 记录单词学习
      recordWordLearned()

      setTimeout(() => {
        setShowDetail(false)
        setWordDetail(null)
        nextWord()
      }, 300)
    } else if (!target.startsWith(inputLower)) {
      setShowError(true)
      // 1. 更新错词列表（去重）
      const newErrors = [...new Set([...errorWordsRef.current, currentWord.id])]
      errorWordsRef.current = newErrors
      setErrorWords(newErrors)
      // 2. 累加该词错误次数
      const newCounts = { ...errorCountsRef.current, [currentWord.id]: (errorCountsRef.current[currentWord.id] || 0) + 1 }
      errorCountsRef.current = newCounts
      setErrorCounts(newCounts)
      playErrorSound()
      // 3. 立即保存到 IndexedDB（不等30秒）
      if (bookId) {
        const progressKey = chapterId ? `${bookId}-${chapterId}` : bookId
        const immediateProgress: LearningProgress = {
          bookId,
          chapterId,
          currentIndex: currentIndexRef.current,
          completedWords: completedWordsRef.current,
          errorWords: newErrors,
          errorCounts: newCounts,
          lastStudyDate: new Date().toISOString(),
          totalStudyTime: 0,
        }
        saveProgress(immediateProgress)
        updateProgress(progressKey, immediateProgress)
      }
    }
  }

  const prevWord = useCallback(() => {
    if (!book) return
    const words = currentChapter ? currentChapter.words : book.words
    if (!words) return

    setShowDetail(false)
    setWordDetail(null)

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)

      if (settings.pronunciation) {
        setTimeout(() => {
          const prevWordData = words[prevIndex]
          if (prevWordData) playWordAudio(prevWordData.word)
        }, 350)
      }
    }
  }, [book, currentChapter, currentIndex, settings.pronunciation, playWordAudio])

  const skipWord = useCallback(() => {
    if (!currentWord || !book) return
    const words = currentChapter ? currentChapter.words : book.words
    if (!words) return

    setShowDetail(false)
    setWordDetail(null)

    // 先同步更新 ref，再 setState
    const newErrors = [...new Set([...errorWordsRef.current, currentWord.id])]
    errorWordsRef.current = newErrors
    setErrorWords(newErrors)
    // 跳过也计入错误次数
    const newCounts = { ...errorCountsRef.current, [currentWord.id]: (errorCountsRef.current[currentWord.id] || 0) + 1 }
    errorCountsRef.current = newCounts
    setErrorCounts(newCounts)

    if (currentIndex < words.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)

      if (settings.pronunciation) {
        setTimeout(() => {
          const nextWord = words[nextIndex]
          if (nextWord) playWordAudio(nextWord.word)
        }, 300)
      }
    } else {
      // 最后一词跳过：统一走 nextWord 的完成逻辑（里面会读 errorWordsRef.current）
      nextWord()
    }
  }, [
    currentWord, book, currentChapter, currentIndex,
    settings.pronunciation, playWordAudio,
    chapterId, bookId, showCompletionScreen, t, nextWord,
  ])

  const playAudio = useCallback(() => {
    if (!currentWord) return
    playWordAudio(currentWord.word)
  }, [currentWord, playWordAudio])

  // 完成弹窗
  if (showComplete) {
    const errorCount = errorWords.length
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="flex flex-col items-center gap-4 animate-bounce-once">
          <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 p-8">
            <Trophy className="h-16 w-16 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-center">{completeMessage}</h2>
          <div className="flex flex-col items-center gap-1 text-sm">
            <p className="text-muted-foreground">
              {settings.language === 'zh'
                ? `本次掌握 ${completedWords.length} 个单词`
                : `Mastered ${completedWords.length} words this session`}
            </p>
            {errorCount > 0 ? (
              <p className="text-amber-500 font-medium">
                {settings.language === 'zh'
                  ? `有 ${errorCount} 个单词进入错题本 📝`
                  : `${errorCount} word${errorCount > 1 ? 's' : ''} added to review 📝`}
              </p>
            ) : (
              <p className="text-green-500 font-medium">
                {settings.language === 'zh' ? '🎯 全部正确，完美！' : '🎯 Perfect! No errors!'}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 rounded-xl border px-6 py-3 font-medium hover:bg-accent transition-colors"
          >
            {t('nav.books')}
          </button>
          {bookId !== 'key-vocabulary' && (
            <button
              onClick={() => navigate('/review')}
              className={`flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-colors ${errorCount > 0
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border hover:bg-accent'
                }`}
            >
              {t('nav.review')}
              {errorCount > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                  {errorCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    )
  }

  if (!book || !currentWord) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </div>
    )
  }

  const words = currentChapter ? currentChapter.words : book.words
  const totalWords = words?.length || 0
  const progressPercent = Math.round(((currentIndex + 1) / totalWords) * 100)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(bookId === 'key-vocabulary' ? '/key-vocabulary' : '/')}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold">
            {book.name} {currentChapter && `- ${currentChapter.name}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} / {totalWords}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Word Card */}
      <div
        className={cn(
          'rounded-2xl border bg-card p-8 text-center transition-all',
          showError && 'shake-animation border-destructive',
          isCorrect && 'correct-animation border-green-500'
        )}
      >
        {/* Word Display */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-4xl font-bold">{currentWord.word}</h2>
            {settings.pronunciation && (
              <button
                onClick={playAudio}
                className="rounded-full p-2 hover:bg-accent transition-colors"
                title="播放发音"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={() => {
                if (isInKeyVocabulary(currentWord.id)) {
                  removeFromKeyVocabulary(currentWord.id)
                } else {
                  addToKeyVocabulary(currentWord)
                }
              }}
              className={cn(
                'rounded-full p-2 transition-colors',
                isInKeyVocabulary(currentWord.id)
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'hover:bg-accent text-muted-foreground hover:text-yellow-500'
              )}
              title={isInKeyVocabulary(currentWord.id) ? t('typing.removeFromKey') : t('typing.addToKey')}
            >
              <Star className={cn('h-5 w-5', isInKeyVocabulary(currentWord.id) && 'fill-current')} />
            </button>
            <button
              onClick={async () => {
                const next = !showDetail
                setShowDetail(next)
                if (next && !wordDetail && currentWord && book) {
                  setDetailLoading(true)
                  try {
                    const detail = await getWordDetailCached(currentWord, book)
                    setWordDetail(detail)
                  } finally {
                    setDetailLoading(false)
                  }
                }
              }}
              className={cn(
                'rounded-full p-2 transition-colors',
                showDetail
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'hover:bg-accent text-muted-foreground hover:text-blue-500'
              )}
              title={t('typing.viewDetail')}
            >
              <Info className="h-5 w-5" />
            </button>
          </div>

          {settings.showPhonetic && (
            <p className="mt-2 text-lg text-muted-foreground">{currentWord.phonetic}</p>
          )}
        </div>

        {/* Meaning */}
        <p className="mb-4 text-xl">{currentWord.meaning}</p>

        {settings.showExample && currentWord.example && (
          <div className="flex flex-col items-center gap-1.5 mt-2">
            <p className="text-sm text-muted-foreground italic">
              {renderHighlightedExample(currentWord.example, currentWord.word)}
            </p>
            {currentWord.exampleTranslation && (
              <p className="text-xs text-muted-foreground">
                {currentWord.exampleTranslation}
              </p>
            )}
          </div>
        )}

        {/* Word Detail Panel */}
        {showDetail && (
          <div className="mt-6 rounded-xl border bg-muted/50 p-4 text-left">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{t('typing.etymologyPanel')}</h3>
            {detailLoading ? (
              <p className="text-sm text-muted-foreground animate-pulse">加载词源中...</p>
            ) : wordDetail ? (
              <div className="space-y-2 text-sm">
                {wordDetail.wordFormation && (
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 text-muted-foreground">{t('typing.wordFormation')}:</span>
                    <span className="font-medium">{wordDetail.wordFormation}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {wordDetail.prefix && (
                    <div className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs dark:bg-blue-900/30">
                      <span className="text-muted-foreground">{t('typing.prefix')}</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400">{wordDetail.prefix}</span>
                    </div>
                  )}
                  {wordDetail.root && (
                    <div className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs dark:bg-green-900/30">
                      <span className="text-muted-foreground">{t('typing.root')}</span>
                      <span className="font-medium text-green-600 dark:text-green-400">{wordDetail.root}</span>
                    </div>
                  )}
                  {wordDetail.suffix && (
                    <div className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-xs dark:bg-purple-900/30">
                      <span className="text-muted-foreground">{t('typing.suffix')}</span>
                      <span className="font-medium text-purple-600 dark:text-purple-400">{wordDetail.suffix}</span>
                    </div>
                  )}
                </div>
                {wordDetail.etymology && (
                  <div className="pt-2 border-t mt-2 text-muted-foreground leading-relaxed">
                    <span className="font-medium text-foreground">{t('typing.etymology')}: </span>
                    {wordDetail.etymology}
                  </div>
                )}
                {wordDetail.cognates && wordDetail.cognates.length > 0 && (
                  <div className="pt-2 border-t mt-2 flex flex-wrap gap-1">
                    <span className="text-muted-foreground text-xs mr-1">同源词:</span>
                    {wordDetail.cognates.map((c) => (
                      <span key={c} className="rounded bg-muted px-2 py-0.5 text-xs font-mono">{c}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">暂无词源信息</p>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="mt-8">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={handleInputChange}
              className={cn(
                'w-full rounded-xl border-2 bg-transparent px-4 py-4 text-center text-2xl font-mono outline-none transition-all',
                showError
                  ? 'border-destructive text-destructive'
                  : isCorrect
                    ? 'border-green-500 text-green-500'
                    : 'border-input focus:border-primary'
              )}
              placeholder={t('typing.inputPlaceholder')}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {isCorrect ? (
                <Check className="h-6 w-6 text-green-500" />
              ) : showError ? (
                <X className="h-6 w-6 text-destructive" />
              ) : null}
            </div>
          </div>

          {/* Character indicators */}
          <div className="mt-4 flex justify-center gap-1">
            {currentWord.word.split('').map((char, idx) => {
              const inputChar = input[idx]
              const isCharCorrect = inputChar?.toLowerCase() === char.toLowerCase()
              const isWrong = inputChar && !isCharCorrect

              return (
                <div
                  key={idx}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border-2 font-mono text-lg font-bold transition-all',
                    isCharCorrect
                      ? 'border-green-500 bg-green-500/10 text-green-500'
                      : isWrong
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : idx === input.length
                          ? 'border-primary bg-primary/10'
                          : 'border-muted bg-muted'
                  )}
                >
                  {inputChar || ''}
                  {idx === input.length && !inputChar && (
                    <span className="absolute h-5 w-0.5 bg-primary cursor-blink" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={prevWord}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('common.prev')}
        </button>
        <button
          onClick={skipWord}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          {t('common.skip')}
        </button>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 text-sm text-muted-foreground">
        <span>{t('typing.mastered')}: {completedWords.length}</span>
        <span>{t('typing.toReview')}: {errorWords.length}</span>
        <span>{t('typing.remaining')}: {totalWords - currentIndex - 1}</span>
      </div>
    </div>
  )
}

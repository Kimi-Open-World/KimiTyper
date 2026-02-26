import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Volume2, ArrowLeft, RotateCcw, ChevronLeft, Check, X, Star, Info, List } from 'lucide-react'
import { useAppStore } from '@/store'
import { getBook } from '@/db'
import { saveProgress } from '@/db'
import type { Word, WordBook, LearningProgress } from '@/types'
import type { WordDetail } from '@/db'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { getWordDetailCached } from '@/lib/wordLoader'
import { WordDetailPanel } from '@/components/WordDetailPanel'
import { playWordPronunciation } from '@/lib/audio'

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
  const [showComplete, setShowComplete] = useState(false)
  const [showList, setShowList] = useState(false)

  // Typing stats
  const [sessionTime, setSessionTime] = useState(0)
  const [totalKeystrokes, setTotalKeystrokes] = useState(0)
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0)

  // session timer
  useEffect(() => {
    if (showComplete || !bookId) return
    const timer = setInterval(() => setSessionTime(s => s + 1), 1000)
    return () => clearInterval(timer)
  }, [showComplete, bookId])

  // 学习时长追踪
  const startTimeRef = useRef<number>(Date.now())
  const inputRef = useRef<HTMLInputElement>(null)
  const activeWordRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentIndex])

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
      playWordPronunciation(word)
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

  // 音效 AudioContext 复用与清理，防止硬件上下文数量超限泄漏内存
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

  const showCompletionScreen = useCallback(() => {
    saveStudyTime()
    playCompleteSound()
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
        showCompletionScreen()
      } else if (bookId === 'key-vocabulary') {
        showCompletionScreen()
      } else {
        showCompletionScreen()
      }
    }
  }, [book, currentChapter, currentIndex, navigate, updateProgress, settings.pronunciation, chapterId, bookId, playWordAudio, showCompletionScreen, t])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const prevInput = input
    setInput(value)
    setShowError(false)
    setShowDetail(false)

    if (!currentWord) return

    const target = currentWord.word.toLowerCase()
    let inputLower = value.toLowerCase()

    // track keystrokes
    if (value.length > prevInput.length) {
      const addedLen = value.length - prevInput.length
      setTotalKeystrokes((prev) => prev + addedLen)
      let correctChars = 0
      for (let i = prevInput.length; i < value.length; i++) {
        if (target[i] && value[i].toLowerCase() === target[i].toLowerCase()) {
          correctChars++
        }
      }
      if (correctChars > 0) setCorrectKeystrokes((prev) => prev + correctChars)
    }

    if (settings.spaceToSwitch && inputLower === target + ' ') {
      inputLower = target
    }

    if (inputLower === target) {
      if (!isCorrect) {
        setIsCorrect(true)
        setCompletedWords((prev) => [...new Set([...prev, currentWord.id])])
        playCorrectSound()
        // 记录单词学习
        recordWordLearned()
      }

      if (!settings.spaceToSwitch || value.endsWith(' ')) {
        setTimeout(() => {
          setShowDetail(false)
          setWordDetail(null)
          nextWord()
        }, settings.spaceToSwitch ? 0 : 300)
      } else {
        setInput(target)
      }
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
    const finalAccuracy = totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0
    const finalWPM = sessionTime > 0 ? Math.round((correctKeystrokes / 5) / (sessionTime / 60)) : 0
    const timeStr = `${Math.floor(sessionTime / 60).toString().padStart(2, '0')}:${Math.floor(sessionTime % 60).toString().padStart(2, '0')}`
    const circleCircumference = 2 * Math.PI * 56;
    const accuracyDashoffset = circleCircumference - (circleCircumference * finalAccuracy) / 100;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center font-sans">
        {/* Animated backdrop gradient overlay for more premium feel */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

        <div className="relative w-full max-w-[900px] bg-background/95 backdrop-blur-3xl rounded-[2rem] shadow-2xl flex flex-col sm:flex-row p-10 gap-10 overflow-hidden border border-border text-foreground">

          {/* Subtle glowing orb in background inside the card */}
          <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none dark:opacity-70 opacity-30" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-500/20 blur-[100px] rounded-full pointer-events-none dark:opacity-70 opacity-30" />

          {/* Left stats panel */}
          <div className="flex flex-col gap-8 w-full sm:w-[220px] shrink-0 items-center justify-center relative z-10 border-r border-border py-4 pr-6">

            {/* Accuracy ring */}
            <div className="relative w-36 h-36 flex flex-col items-center justify-center group duration-500">
              <svg className="absolute inset-0 w-full h-full -rotate-90 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]">
                <circle cx="50%" cy="50%" r="56" fill="transparent" stroke="currentColor" className="text-border" strokeWidth="8" />
                <circle cx="50%" cy="50%" r="56" fill="transparent" stroke="url(#accuracyGradient)" strokeWidth="8" strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                  style={{ strokeDasharray: circleCircumference, strokeDashoffset: accuracyDashoffset }}
                />
                <defs>
                  <linearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#c084fc" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground font-mono tracking-tighter">
                {finalAccuracy}%
              </span>
              <span className="text-xs text-indigo-500 dark:text-indigo-200/70 font-medium tracking-widest mt-1 uppercase">正确率</span>
            </div>

            {/* Time metric */}
            <div className="relative w-32 h-32 flex flex-col items-center justify-center rounded-full bg-card/60 border border-border shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
              <span className="text-2xl font-bold font-mono text-foreground tracking-wider">
                {timeStr}
              </span>
              <span className="text-xs text-muted-foreground font-medium tracking-widest mt-1 uppercase">章节耗时</span>
            </div>

            {/* WPM metric */}
            <div className="relative w-28 h-28 flex flex-col items-center justify-center rounded-full bg-card/60 border border-border shadow-[inset_0_2px_20px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]">
              <span className="text-3xl font-bold font-mono text-foreground">
                {finalWPM}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-widest mt-1 uppercase">WPM</span>
            </div>
          </div>

          {/* Right content panel */}
          <div className="flex-1 flex flex-col justify-between relative z-10 pl-2">

            {/* Header info */}
            <div className="mb-8 flex flex-col justify-start">
              <h2 className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted-foreground tracking-tight">
                {book?.name || ''}
              </h2>
              {currentChapter && (
                <p className="text-sm font-medium text-indigo-500 dark:text-indigo-300/80 tracking-wide mt-1 uppercase">
                  {currentChapter.name}
                </p>
              )}
            </div>

            {/* Words glass list */}
            <div className="flex-1 bg-muted/40 rounded-2xl p-6 shadow-2xl overflow-y-auto custom-scrollbar flex flex-col border border-border backdrop-blur-xl relative">
              <div className="flex flex-wrap gap-2 content-start flex-1 relative z-10">
                {(() => {
                  const displayIds = errorWords.length > 0 ? errorWords : completedWords;
                  const words = currentChapter ? currentChapter.words : book?.words;
                  const displayWords = words?.filter((w: any) => displayIds.includes(w.id)) || [];
                  return displayWords.map((w: any) => (
                    <div
                      key={w.id}
                      className="group relative bg-card/80 hover:bg-muted text-foreground px-4 py-2.5 rounded-lg font-mono text-[15px] cursor-default border border-border hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)] transition-all duration-300"
                    >
                      {w.word}
                    </div>
                  ))
                })()}
              </div>

              {/* Status footer bar */}
              <div className={cn(
                "mt-6 rounded-xl p-3.5 text-sm flex items-center justify-center gap-2 font-bold tracking-widest shadow-lg border border-transparent relative overflow-hidden z-10",
                errorWords.length > 0
                  ? "bg-gradient-to-r from-rose-500/80 to-pink-600/80 text-white"
                  : "bg-gradient-to-r from-teal-500/80 to-emerald-600/80 text-white"
              )}>
                {errorWords.length > 0 ? "⚠️ 发现弱项，再巩固一次？" : "✨ 完美过关，毫无破绽！"}
              </div>
            </div>

            {/* Premium Buttons */}
            <div className="mt-8 flex flex-wrap gap-4 font-medium justify-end">
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-all border border-border active:scale-95 shadow-sm"
              >
                默写当前章节
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground transition-all border border-border active:scale-95 shadow-sm"
              >
                重新复习此章
              </button>
              <button
                onClick={() => navigate('/')}
                className="px-8 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] active:scale-95"
              >
                继续下一章节
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => navigate('/')}
            className="absolute top-6 right-6 p-2 rounded-full bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
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
          "fixed top-0 left-0 h-full w-80 bg-background text-foreground shadow-2xl z-50 transition-transform duration-300 flex flex-col rounded-r-2xl border-r border-border",
          showList ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-5 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold text-base">{currentChapter ? currentChapter.name : book.name}</h3>
            <p className="text-xs text-muted-foreground font-medium tracking-wide">TOTAL {totalWords} WORDS</p>
          </div>
          <button onClick={() => setShowList(false)} className="rounded p-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {words?.map((w, idx) => {
            const isActive = currentIndex === idx
            return (
              <button
                key={w.id}
                ref={isActive ? activeWordRef : null}
                onClick={() => {
                  if (idx !== currentIndex) {
                    setCurrentIndex(idx)
                    setInput('')
                    setIsCorrect(null)
                    setShowError(false)
                    setShowDetail(false)
                  }
                }}
                className={cn(
                  "w-full text-left p-4 rounded-xl transition-all flex flex-col gap-1.5 group cursor-pointer border",
                  isActive
                    ? 'bg-card border-border shadow-md scale-[1.02]'
                    : 'bg-transparent border-transparent hover:bg-muted/50 hover:border-border'
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={cn(
                    "font-mono text-lg tracking-wide",
                    isActive ? 'font-bold text-foreground' : 'font-medium text-muted-foreground group-hover:text-foreground'
                  )}>
                    {w.word}
                  </span>
                  <Volume2
                    className={cn(
                      "h-4 w-4 shrink-0 transition-opacity",
                      isActive ? "opacity-100 text-muted-foreground hover:text-foreground" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      playWordAudio(w.word);
                    }}
                  />
                </div>
                <span className={cn(
                  "text-xs leading-relaxed line-clamp-2",
                  isActive ? 'text-gray-400' : 'text-gray-500'
                )}>
                  {w.meaning}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ===== Main Typing Area ===== */}
      <div className="flex-1 w-full max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowList(true)}
            className="rounded-lg p-2 hover:bg-accent transition-colors"
            title="单词列表"
          >
            <List className="h-5 w-5" />
          </button>
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
          {showDetail && wordDetail && (
            <WordDetailPanel wordDetail={wordDetail} t={t} isLoading={detailLoading} />
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
        <div className="mt-12 flex flex-wrap justify-center gap-4 sm:gap-12 text-center text-muted-foreground bg-accent/30 rounded-2xl p-6 px-10">
          <div className="flex flex-col gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-full after:max-w-[80px] after:h-px after:bg-foreground/10 pb-2 flex-1 min-w-[80px]">
            <span className="text-3xl font-bold font-mono text-foreground/90">
              {Math.floor(sessionTime / 60).toString().padStart(2, '0')}:{Math.floor(sessionTime % 60).toString().padStart(2, '0')}
            </span>
            <span className="text-xs uppercase tracking-wider">{t('typing.time') || '时间'}</span>
          </div>
          <div className="flex flex-col gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-full after:max-w-[80px] after:h-px after:bg-foreground/10 pb-2 flex-1 min-w-[80px]">
            <span className="text-3xl font-bold font-mono text-foreground/90">{totalKeystrokes}</span>
            <span className="text-xs uppercase tracking-wider">输入数</span>
          </div>
          <div className="flex flex-col gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-full after:max-w-[80px] after:h-px after:bg-foreground/10 pb-2 flex-1 min-w-[80px]">
            <span className="text-3xl font-bold font-mono text-foreground/90">
              {sessionTime > 0 ? Math.round((correctKeystrokes / 5) / (sessionTime / 60)) : 0}
            </span>
            <span className="text-xs uppercase tracking-wider">WPM</span>
          </div>
          <div className="flex flex-col gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-full after:max-w-[80px] after:h-px after:bg-foreground/10 pb-2 flex-1 min-w-[80px]">
            <span className="text-3xl font-bold font-mono text-foreground/90">{correctKeystrokes}</span>
            <span className="text-xs uppercase tracking-wider">正确数</span>
          </div>
          <div className="flex flex-col gap-2 relative after:content-[''] after:absolute after:-bottom-2 after:left-1/2 after:-translate-x-1/2 after:w-full after:max-w-[80px] after:h-px after:bg-foreground/10 pb-2 flex-1 min-w-[80px]">
            <span className="text-3xl font-bold font-mono text-foreground/90">
              {totalKeystrokes > 0 ? Math.round((correctKeystrokes / totalKeystrokes) * 100) : 0}%
            </span>
            <span className="text-xs uppercase tracking-wider">正确率</span>
          </div>
        </div>
      </div>
    </div>
  )
}

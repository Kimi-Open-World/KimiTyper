import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Volume2, ArrowLeft, RotateCcw, ChevronLeft, Check, X, Star } from 'lucide-react'
import { useAppStore } from '@/store'
import { getBook } from '@/db'
import { saveProgress } from '@/db'
import type { Word, WordBook, LearningProgress } from '@/types'
import { cn } from '@/lib/utils'

export default function TypingPractice() {
  const { bookId } = useParams<{ bookId: string }>()
  const navigate = useNavigate()
  const { currentBook, setCurrentBook, progress, updateProgress, settings, addToKeyVocabulary, isInKeyVocabulary } = useAppStore()
  
  const [book, setBook] = useState<WordBook | null>(currentBook)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showError, setShowError] = useState(false)
  const [completedWords, setCompletedWords] = useState<number[]>([])
  const [errorWords, setErrorWords] = useState<number[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Load book data - only run once on mount
  useEffect(() => {
    if (!bookId) return
    
    const loadBook = async () => {
      let bookData = currentBook
      if (!bookData || bookData.id !== bookId) {
        bookData = await getBook(bookId) || null
        if (bookData) setCurrentBook(bookData)
      }
      setBook(bookData)
      
      // Load progress only once on initial load
      const savedProgress = progress[bookId]
      if (savedProgress) {
        setCurrentIndex(savedProgress.currentIndex || 0)
        setCompletedWords(savedProgress.completedWords || [])
        setErrorWords(savedProgress.errorWords || [])
      }
    }
    
    loadBook()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]) // Only depend on bookId, not progress or currentBook

  // Auto focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [currentIndex])

  const currentWord: Word | undefined = book?.words[currentIndex]

  // Store the word that was just completed (for audio before transition)
  const justCompletedWord = useRef<string | null>(null)

  // Play audio for a specific word - defined early for use in effects
  const playWordAudio = useCallback((word: string) => {
    if (!settings.pronunciation) return
    
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }, [settings.pronunciation])

  // Use refs to track latest state for saving
  const completedWordsRef = useRef(completedWords)
  const errorWordsRef = useRef(errorWords)
  const currentIndexRef = useRef(currentIndex)
  
  useEffect(() => {
    completedWordsRef.current = completedWords
  }, [completedWords])
  
  useEffect(() => {
    errorWordsRef.current = errorWords
  }, [errorWords])
  
  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  const saveCurrentProgress = useCallback(async () => {
    if (!bookId) return
    
    const newProgress: LearningProgress = {
      bookId,
      currentIndex: currentIndexRef.current,
      completedWords: completedWordsRef.current,
      errorWords: errorWordsRef.current,
      lastStudyDate: new Date().toISOString(),
      totalStudyTime: 0,
    }
    
    await saveProgress(newProgress)
    updateProgress(bookId, newProgress)
  }, [bookId, updateProgress])

  // Save progress on unmount and when navigating away
  useEffect(() => {
    return () => {
      saveCurrentProgress()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])
  
  // Periodic save every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      saveCurrentProgress()
    }, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setShowError(false)
    
    if (!currentWord) return
    
    // Check if input matches so far
    const target = currentWord.word.toLowerCase()
    const inputLower = value.toLowerCase()
    
    if (inputLower === target) {
      // Word completed correctly
      setIsCorrect(true)
      setCompletedWords((prev) => [...new Set([...prev, currentWord.id])])
      
      // Play correct sound
      playCorrectSound()
      
      // Move to next word after a short delay
      setTimeout(() => {
        nextWord()
      }, 300)
    } else if (!target.startsWith(inputLower)) {
      // Wrong character typed
      setShowError(true)
      setErrorWords((prev) => [...new Set([...prev, currentWord.id])])
      
      // Play error sound
      playErrorSound()
    }
  }

  const nextWord = useCallback(() => {
    if (!book) return
    
    if (currentIndex < book.words.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)
      
      // Read the next word after a short delay
      if (settings.pronunciation) {
        setTimeout(() => {
          const nextWordData = book.words[nextIndex]
          if (nextWordData) {
            const utterance = new SpeechSynthesisUtterance(nextWordData.word)
            utterance.lang = 'en-US'
            utterance.rate = 0.8
            window.speechSynthesis.speak(utterance)
          }
        }, 350)
      }
    } else {
      // Finished all words - reset progress to start from beginning next time
      const resetProgress: LearningProgress = {
        bookId: book.id,
        currentIndex: 0,
        completedWords: [],
        errorWords: [],
        lastStudyDate: new Date().toISOString(),
        totalStudyTime: 0,
      }
      saveProgress(resetProgress)
      updateProgress(book.id, resetProgress)
      
      alert('恭喜你完成了这本词书！')
      navigate('/')
    }
  }, [book, currentIndex, navigate, updateProgress, settings.pronunciation, settings.autoPlayAudio])

  // Remove duplicate audio - only play in navigation functions (nextWord, prevWord, skipWord)

  const prevWord = useCallback(() => {
    if (!book) return
    
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1
      setCurrentIndex(prevIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)
      
      // Read the previous word after a short delay
      if (settings.pronunciation) {
        setTimeout(() => {
          const prevWordData = book.words[prevIndex]
          if (prevWordData) {
            const utterance = new SpeechSynthesisUtterance(prevWordData.word)
            utterance.lang = 'en-US'
            utterance.rate = 0.8
            window.speechSynthesis.speak(utterance)
          }
        }, 350)
      }
    }
  }, [book, currentIndex, settings.pronunciation])

  const skipWord = useCallback(() => {
    if (!currentWord || !book) return
    
    // Mark current word as error
    setErrorWords((prev) => [...new Set([...prev, currentWord.id])])
    
    // Move to next word first
    if (currentIndex < book.words.length - 1) {
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)
      setInput('')
      setIsCorrect(null)
      setShowError(false)
      
      // Read the next word after a small delay
      if (settings.pronunciation) {
        setTimeout(() => {
          const nextWord = book.words[nextIndex]
          if (nextWord) {
            playWordAudio(nextWord.word)
          }
        }, 300)
      }
    } else {
      // Last word - finish
      alert('恭喜你完成了这本词书！')
      navigate('/')
    }
  }, [currentWord, book, currentIndex, settings.pronunciation, playWordAudio, navigate])

  // Play audio for current word (manual button)
  const playAudio = useCallback(() => {
    if (!currentWord) return
    playWordAudio(currentWord.word)
  }, [currentWord, playWordAudio])

  // Play correct sound (pleasant beep)
  const playCorrectSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch {
      // Fallback: do nothing if audio context fails
    }
  }

  // Play error sound (low buzz)
  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.type = 'sawtooth'
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime)
      
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.15)
    } catch {
      // Fallback: do nothing if audio context fails
    }
  }

  if (!book || !currentWord) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  const progressPercent = Math.round(((currentIndex + 1) / book.words.length) * 100)

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg p-2 hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold">{book.name}</h1>
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} / {book.words.length}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Word Card */}
      <div className={cn(
        'rounded-2xl border bg-card p-8 text-center transition-all',
        showError && 'shake-animation border-destructive',
        isCorrect && 'correct-animation border-green-500'
      )}>
        {/* Word Display */}
        <div className="mb-6">
          <div className="flex items-center justify-center gap-3">
            <h2 className="text-4xl font-bold">{currentWord.word}</h2>
            {settings.pronunciation && (
              <button
                onClick={playAudio}
                className="rounded-full p-2 hover:bg-accent transition-colors"
              >
                <Volume2 className="h-5 w-5" />
              </button>
            )}
            {/* Add to Key Vocabulary Button */}
            <button
              onClick={() => addToKeyVocabulary(currentWord)}
              className={cn(
                'rounded-full p-2 transition-colors',
                isInKeyVocabulary(currentWord.id)
                  ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                  : 'hover:bg-accent text-muted-foreground hover:text-yellow-500'
              )}
              title={isInKeyVocabulary(currentWord.id) ? '已加入重点词汇' : '加入重点词汇'}
            >
              <Star className={cn('h-5 w-5', isInKeyVocabulary(currentWord.id) && 'fill-current')} />
            </button>
          </div>
          
          {settings.showPhonetic && (
            <p className="mt-2 text-lg text-muted-foreground">{currentWord.phonetic}</p>
          )}
        </div>

        {/* Meaning */}
        <p className="mb-4 text-xl">{currentWord.meaning}</p>
        
        {settings.showExample && currentWord.example && (
          <p className="text-sm text-muted-foreground italic">
            {currentWord.example}
          </p>
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
              placeholder="输入单词..."
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            
            {/* Status Icon */}
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
              const isCorrect = inputChar?.toLowerCase() === char.toLowerCase()
              const isWrong = inputChar && !isCorrect
              
              return (
                <div
                  key={idx}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg border-2 font-mono text-lg font-bold transition-all',
                    isCorrect 
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
          上一个
        </button>
        <button
          onClick={skipWord}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          跳过
        </button>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-8 text-sm text-muted-foreground">
        <span>已掌握: {completedWords.length}</span>
        <span>待复习: {errorWords.length}</span>
        <span>剩余: {book.words.length - currentIndex - 1}</span>
      </div>
    </div>
  )
}

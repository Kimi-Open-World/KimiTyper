import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, RotateCcw, Trash2, Volume2 } from 'lucide-react'
import { useAppStore } from '@/store'
import { getBook } from '@/db'
import type { Word } from '@/types'
import { cn } from '@/lib/utils'

interface ErrorWordItem {
  word: Word
  bookId: string
  bookName: string
}

export default function ReviewPage() {
  const { progress } = useAppStore()
  const [errorWords, setErrorWords] = useState<ErrorWordItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [input, setInput] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)

  // Load error words from all books
  useEffect(() => {
    const loadErrorWords = async () => {
      const items: ErrorWordItem[] = []
      
      for (const [bookId, bookProgress] of Object.entries(progress)) {
        if (bookProgress.errorWords?.length > 0) {
          const book = await getBook(bookId)
          if (book) {
            for (const wordId of bookProgress.errorWords) {
              const word = book.words.find((w) => w.id === wordId)
              if (word) {
                items.push({ word, bookId, bookName: book.name })
              }
            }
          }
        }
      }
      
      setErrorWords(items)
    }
    
    loadErrorWords()
  }, [progress])

  const currentItem = errorWords[currentIndex]

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    
    if (!currentItem) return
    
    if (value.toLowerCase() === currentItem.word.word.toLowerCase()) {
      // Correct! Remove from error words
      setTimeout(() => {
        nextWord()
      }, 500)
    }
  }

  const nextWord = () => {
    setInput('')
    setShowAnswer(false)
    if (currentIndex < errorWords.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCurrentIndex(0)
    }
  }

  const removeWord = () => {
    nextWord()
  }

  const playAudio = () => {
    if (!currentItem) return
    const utterance = new SpeechSynthesisUtterance(currentItem.word.word)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  if (errorWords.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold">错词本</h1>
        </div>
        
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-green-100 p-6 dark:bg-green-900/20">
            <RotateCcw className="h-12 w-12 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold">太棒了！</h2>
          <p className="text-muted-foreground">你没有错词，继续保持！</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">错词本</h1>
          <p className="text-sm text-muted-foreground">
            {currentIndex + 1} / {errorWords.length} · 来自 {currentItem?.bookName}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${((currentIndex + 1) / errorWords.length) * 100}%` }}
        />
      </div>

      {/* Word Card */}
      <div className="rounded-2xl border bg-card p-8 text-center">
        {currentItem && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-bold">{currentItem.word.word}</h2>
                <button
                  onClick={playAudio}
                  className="rounded-full p-2 hover:bg-accent transition-colors"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-lg text-muted-foreground">{currentItem.word.phonetic}</p>
            </div>

            {showAnswer ? (
              <>
                <p className="mb-4 text-xl">{currentItem.word.meaning}</p>
                {currentItem.word.example && (
                  <p className="text-sm text-muted-foreground italic">
                    {currentItem.word.example}
                  </p>
                )}
              </>
            ) : (
              <p className="mb-4 text-lg text-muted-foreground">输入单词查看释义</p>
            )}

            {/* Input */}
            <div className="mt-6">
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                className={cn(
                  'w-full rounded-xl border-2 bg-transparent px-4 py-3 text-center text-xl font-mono outline-none transition-all',
                  input.toLowerCase() === currentItem.word.word.toLowerCase()
                    ? 'border-green-500 text-green-500'
                    : 'border-input focus:border-primary'
                )}
                placeholder="输入单词..."
                autoComplete="off"
                autoFocus
              />
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-center gap-4">
        <button
          onClick={() => setShowAnswer(!showAnswer)}
          className="rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          {showAnswer ? '隐藏释义' : '显示释义'}
        </button>
        <button
          onClick={nextWord}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          下一个
        </button>
        <button
          onClick={removeWord}
          className="flex items-center gap-2 rounded-lg border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          移除
        </button>
      </div>
    </div>
  )
}

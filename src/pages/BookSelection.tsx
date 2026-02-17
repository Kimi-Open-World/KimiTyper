import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronRight, ChevronDown, Layers } from 'lucide-react'
import { useAppStore } from '@/store'
import { saveBooks } from '@/db'
import { allBooks } from '@/data/books'
import { cn } from '@/lib/utils'
import type { WordBook } from '@/types'

export default function BookSelection() {
  const navigate = useNavigate()
  const { progress, currentBook, setCurrentBook } = useAppStore()
  const [expandedBook, setExpandedBook] = useState<string | null>(null)

  // Initialize books on mount
  useEffect(() => {
    saveBooks(allBooks)
  }, [])

  const categories = [...new Set(allBooks.map((book) => book.category))]

  const handleBookClick = (book: WordBook) => {
    if (book.chapters && book.chapters.length > 0) {
      // Toggle chapter list
      setExpandedBook(expandedBook === book.id ? null : book.id)
    } else {
      // Legacy mode: direct navigation
      setCurrentBook(book)
      navigate(`/learn/${book.id}`)
    }
  }

  const handleChapterClick = (book: WordBook, chapterId: string) => {
    setCurrentBook(book)
    navigate(`/learn/${book.id}/${chapterId}`)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">选择词书</h1>
        <p className="text-muted-foreground">选择一本词书开始学习，通过打字输入强化记忆</p>
      </div>

      {categories.map((category) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {allBooks
              .filter((book) => book.category === category)
              .map((book) => {
                const bookProgress = progress[book.id]
                const completedCount = bookProgress?.completedWords?.length || 0
                const chapterCount = book.chapters?.length || 0
                const isExpanded = expandedBook === book.id

                return (
                  <div
                    key={book.id}
                    className={cn(
                      'relative overflow-hidden rounded-xl border bg-card transition-all',
                      currentBook?.id === book.id && 'border-primary ring-1 ring-primary'
                    )}
                  >
                    {/* Book Header */}
                    <button
                      onClick={() => handleBookClick(book)}
                      className="group w-full p-6 text-left hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-primary/10 p-3">
                            <BookOpen className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{book.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {chapterCount > 0 ? `${chapterCount} 章` : `${book.wordCount} 词`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {chapterCount > 0 && (
                            <Layers className="h-4 w-4 text-muted-foreground" />
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-sm text-muted-foreground">{book.description}</p>

                      {/* Progress bar */}
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">总进度</span>
                          <span className="font-medium">{Math.round((completedCount / book.wordCount) * 100)}%</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${Math.round((completedCount / book.wordCount) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </button>

                    {/* Chapter List */}
                    {isExpanded && book.chapters && book.chapters.length > 0 && (
                      <div className="border-t bg-muted/30">
                        <div className="p-2 space-y-1">
                          {book.chapters.map((chapter) => {
                            const chapterProgress = progress[`${book.id}-${chapter.id}`]
                            const chapterCompleted = chapterProgress?.completedWords?.length || 0
                            const chapterPercent = Math.round((chapterCompleted / chapter.words.length) * 100)

                            return (
                              <button
                                key={chapter.id}
                                onClick={() => handleChapterClick(book, chapter.id)}
                                className="w-full rounded-lg p-3 text-left hover:bg-card transition-colors"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{chapter.name}</p>
                                    <p className="text-xs text-muted-foreground">{chapter.words.length} 词 · {chapter.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium">{chapterPercent}%</span>
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary/70 transition-all"
                                    style={{ width: `${chapterPercent}%` }}
                                  />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

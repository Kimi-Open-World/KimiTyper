import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronRight } from 'lucide-react'
import { useAppStore } from '@/store'
import { saveBooks } from '@/db'
import { allSampleBooks } from '@/data/books'
import { cn } from '@/lib/utils'

export default function BookSelection() {
  const { progress, currentBook, setCurrentBook } = useAppStore()

  // Initialize sample books on mount
  useEffect(() => {
    saveBooks(allSampleBooks)
  }, [])

  const categories = [...new Set(allSampleBooks.map((book) => book.category))]

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
            {allSampleBooks
              .filter((book) => book.category === category)
              .map((book) => {
                const bookProgress = progress[book.id]
                const completedCount = bookProgress?.completedWords?.length || 0
                const progressPercent = Math.round((completedCount / book.wordCount) * 100)

                return (
                  <Link
                    key={book.id}
                    to={`/learn/${book.id}`}
                    onClick={() => setCurrentBook(book)}
                    className={cn(
                      'group relative overflow-hidden rounded-xl border bg-card p-6 transition-all hover:shadow-lg',
                      currentBook?.id === book.id && 'border-primary ring-1 ring-primary'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-primary/10 p-3">
                          <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{book.name}</h3>
                          <p className="text-sm text-muted-foreground">{book.wordCount} 词</p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">{book.description}</p>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">进度</span>
                        <span className="font-medium">{progressPercent}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        已掌握 {completedCount} / {book.wordCount} 词
                      </p>
                    </div>
                  </Link>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, Target, TrendingUp, Calendar } from 'lucide-react'
import { useAppStore } from '@/store'
import { getAllBooks } from '@/db'
import type { WordBook } from '@/types'

export default function StatsPage() {
  const { stats, progress } = useAppStore()
  const [books, setBooks] = useState<WordBook[]>([])

  useEffect(() => {
    getAllBooks().then(setBooks)
  }, [])

  // Calculate total progress
  const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0)
  const completedWords = Object.values(progress).reduce(
    (sum, p) => sum + (p.completedWords?.length || 0),
    0
  )
  const overallProgress = totalWords > 0 ? Math.round((completedWords / totalWords) * 100) : 0

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">学习统计</h1>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">已掌握单词</p>
              <p className="text-2xl font-bold">{completedWords}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">总词汇量</p>
              <p className="text-2xl font-bold">{totalWords}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">学习时长</p>
              <p className="text-2xl font-bold">{stats.totalStudyTime}m</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">连续打卡</p>
              <p className="text-2xl font-bold">{stats.streakDays}天</p>
            </div>
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">总进度</h2>
          <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          已掌握 {completedWords} / {totalWords} 个单词
        </p>
      </div>

      {/* Book Progress */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">词书进度</h2>
        {books.length === 0 ? (
          <p className="text-muted-foreground">暂无词书数据</p>
        ) : (
          <div className="space-y-3">
            {books.map((book) => {
              const bookProgress = progress[book.id]
              const completed = bookProgress?.completedWords?.length || 0
              const percent = Math.round((completed / book.wordCount) * 100)

              return (
                <div key={book.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{book.name}</span>
                    </div>
                    <span className="text-sm font-medium">{percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {completed} / {book.wordCount} 词 · {bookProgress?.errorWords?.length || 0} 个错词
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Daily Goal */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">今日目标</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {stats.dailyProgress} / {stats.dailyGoal} 词
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${Math.min((stats.dailyProgress / stats.dailyGoal) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

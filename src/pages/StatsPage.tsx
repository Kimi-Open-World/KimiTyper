import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BookOpen, Clock, Target, TrendingUp, Flame } from 'lucide-react'
import { useAppStore } from '@/store'
import { getAllBooks } from '@/db'
import type { WordBook } from '@/types'
import { createT } from '@/lib/i18n'

function formatStudyTime(minutes: number, lang: 'zh' | 'en'): string {
  if (minutes < 1) return lang === 'zh' ? '不足1分钟' : '<1 min'
  if (minutes < 60) return `${Math.round(minutes)}${lang === 'zh' ? '分钟' : ' min'}`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (lang === 'zh') return m > 0 ? `${h}小时${m}分钟` : `${h}小时`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function StatsPage() {
  const { stats, progress, settings } = useAppStore()
  const t = createT(settings.language)
  const [books, setBooks] = useState<WordBook[]>([])

  useEffect(() => {
    getAllBooks().then(setBooks)
  }, [])

  // 正确计算总词汇量（包含章节词书）
  const totalWords = books.reduce((sum, book) => sum + book.wordCount, 0)

  // 正确计算总掌握词汇（汇总所有章节）
  const completedWords = Object.values(progress).reduce(
    (sum, p) => sum + (p.completedWords?.length || 0),
    0
  )
  const overallProgress = totalWords > 0 ? Math.min(Math.round((completedWords / totalWords) * 100), 100) : 0

  const totalErrorWords = Object.values(progress).reduce(
    (sum, p) => sum + (p.errorWords?.length || 0),
    0
  )

  // 今日进度
  const todayPercent = stats.dailyGoal > 0
    ? Math.min(Math.round((stats.dailyProgress / stats.dailyGoal) * 100), 100)
    : 0

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t('stats.title')}</h1>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5 text-primary" />}
          label={t('stats.masteredWords')}
          value={String(completedWords)}
          color="primary"
        />
        <StatCard
          icon={<Target className="h-5 w-5 text-blue-500" />}
          label={t('stats.totalWords')}
          value={String(totalWords)}
          color="blue"
        />
        <StatCard
          icon={<Clock className="h-5 w-5 text-orange-500" />}
          label={t('stats.studyTime')}
          value={formatStudyTime(stats.totalStudyTime, settings.language)}
          color="orange"
        />
        <StatCard
          icon={<Flame className="h-5 w-5 text-red-500" />}
          label={t('stats.streakDays')}
          value={`${stats.streakDays} ${t('stats.days')}`}
          color="red"
        />
      </div>

      {/* Overall Progress */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('stats.totalProgress')}</h2>
          <span className="text-2xl font-bold text-primary">{overallProgress}%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {settings.language === 'zh'
            ? `已掌握 ${completedWords} / ${totalWords} 个单词 · ${totalErrorWords} 个错词待复习`
            : `Mastered ${completedWords} / ${totalWords} words · ${totalErrorWords} error words to review`}
        </p>
      </div>

      {/* Daily Goal */}
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <h2 className="text-lg font-semibold">{t('stats.dailyGoal')}</h2>
          </div>
          <span className="text-sm text-muted-foreground">
            {stats.dailyProgress} / {stats.dailyGoal} {settings.language === 'zh' ? '词' : 'words'}
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${todayPercent}%` }}
          />
        </div>
        {todayPercent >= 100 && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400 font-medium">
            {settings.language === 'zh' ? '🎉 今日目标已完成！' : '🎉 Daily goal achieved!'}
          </p>
        )}
      </div>

      {/* Calendar streak */}
      {stats.streakDays > 0 && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-100 dark:bg-orange-900/20 p-3">
              <Flame className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold">
                {settings.language === 'zh'
                  ? `连续学习 ${stats.streakDays} 天！🔥`
                  : `${stats.streakDays}-day streak! 🔥`}
              </p>
              <p className="text-sm text-muted-foreground">
                {settings.language === 'zh'
                  ? `最近学习日期：${stats.lastStudyDate}`
                  : `Last study: ${stats.lastStudyDate}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Book Progress */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('stats.bookProgress')}</h2>
        {books.length === 0 ? (
          <p className="text-muted-foreground">{t('common.empty')}</p>
        ) : (
          <div className="space-y-3">
            {books.map((book) => {
              // 正确汇总章节进度
              let completed = 0
              if (book.chapters?.length) {
                for (const ch of book.chapters) {
                  completed += progress[`${book.id}-${ch.id}`]?.completedWords?.length || 0
                }
              } else {
                completed = progress[book.id]?.completedWords?.length || 0
              }
              const percent = Math.min(Math.round((completed / (book.wordCount || 1)) * 100), 100)
              const errors = book.chapters?.length
                ? book.chapters.reduce(
                  (s, ch) => s + (progress[`${book.id}-${ch.id}`]?.errorWords?.length || 0),
                  0
                )
                : progress[book.id]?.errorWords?.length || 0

              return (
                <div key={book.id} className="rounded-xl border bg-card p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{book.name}</span>
                    </div>
                    <span className="text-sm font-medium text-primary">{percent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {completed} / {book.wordCount} {settings.language === 'zh' ? '词' : 'words'}
                    {errors > 0 && ` · ${errors} ${t('stats.errorWords')}`}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-${color === 'primary' ? 'primary' : color}-500/10 p-2`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  )
}

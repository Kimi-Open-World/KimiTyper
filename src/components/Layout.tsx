import { Outlet, Link, useLocation } from 'react-router-dom'
import { BookOpen, RotateCcw, BarChart3, Settings, Star, Cloud } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { useEffect } from 'react'
import { checkAndShowReminder } from '@/lib/reminder'

export default function Layout() {
  const location = useLocation()
  const { settings, keyVocabulary, syncStatus } = useAppStore()
  const t = createT(settings.language)

  // === 主题应用（含 system 跟随） ===
  useEffect(() => {
    const applyTheme = (theme: 'light' | 'dark' | 'system') => {
      const root = document.documentElement
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      } else {
        root.classList.toggle('dark', theme === 'dark')
      }
    }

    applyTheme(settings.theme)

    // 监听系统主题变化
    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => applyTheme('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [settings.theme])

  // === 学习提醒检查（每次打开页面时检查） ===
  useEffect(() => {
    if (settings.reminderEnabled) {
      checkAndShowReminder(
        settings.reminderEnabled,
        settings.reminderTime,
        t('reminder.title'),
        t('reminder.body')
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const navItems = [
    { path: '/', icon: BookOpen, label: t('nav.books') },
    {
      path: '/key-vocabulary',
      icon: Star,
      label: t('nav.keyVocab'),
      badge: keyVocabulary.length > 0 ? keyVocabulary.length : undefined,
    },
    { path: '/review', icon: RotateCcw, label: t('nav.review') },
    { path: '/stats', icon: BarChart3, label: t('nav.stats') },
    {
      path: '/sync',
      icon: Cloud,
      label: t('nav.sync'),
      dot: syncStatus.isLoggedIn,
    },
    { path: '/settings', icon: Settings, label: t('nav.settings') },
  ]

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Left Sidebar Navigation */}
      <nav className="flex w-20 flex-col items-center border-r bg-background/95 backdrop-blur-sm py-6 gap-1 shrink-0">
        {navItems.map(({ path, icon: Icon, label, badge, dot }) => {
          const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
          return (
            <Link
              key={path}
              to={path}
              className={cn(
                'relative flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-medium transition-colors w-16',
                isActive
                  ? 'text-primary bg-primary/8'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'fill-current opacity-20')} />
                <Icon className="h-5 w-5 absolute inset-0" />
                {badge !== undefined && (
                  <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                    {badge}
                  </span>
                )}
                {dot && badge === undefined && (
                  <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-green-500" />
                )}
              </div>
              <span className="text-center leading-tight">{label}</span>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { Outlet, Link, useLocation } from 'react-router-dom'
import { BookOpen, RotateCcw, BarChart3, Settings, Keyboard, Star } from 'lucide-react'
import { useAppStore } from '@/store'
import { cn } from '@/lib/utils'

export default function Layout() {
  const location = useLocation()
  const { settings, toggleTheme, keyVocabulary } = useAppStore()

  const navItems = [
    { path: '/', icon: BookOpen, label: '词书' },
    { path: '/key-vocabulary', icon: Star, label: '重点', badge: keyVocabulary.length > 0 ? keyVocabulary.length : undefined },
    { path: '/review', icon: RotateCcw, label: '复习' },
    { path: '/stats', icon: BarChart3, label: '统计' },
    { path: '/settings', icon: Settings, label: '设置' },
  ]

  const isDark = settings.theme === 'dark' || 
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  return (
    <div className={cn('min-h-screen transition-colors', isDark ? 'dark' : '')}>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-14 items-center px-4">
            <Link to="/" className="flex items-center gap-2 font-bold text-xl">
              <Keyboard className="h-6 w-6 text-primary" />
              <span>KimiTyper</span>
            </Link>
            <div className="flex-1" />
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 hover:bg-accent transition-colors"
              title="切换主题"
            >
              {isDark ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-6">
          <Outlet />
        </main>

        {/* Bottom Navigation - Mobile */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
          <div className="flex justify-around py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || 
                (item.path !== '/' && location.pathname.startsWith(item.path))
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors relative',
                    isActive 
                      ? 'text-primary bg-primary/10' 
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="relative">
                    <Icon className="h-5 w-5" />
                    {item.badge && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        {/* Side Navigation - Desktop */}
        <nav className="fixed left-4 top-20 hidden w-16 flex-col gap-2 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || 
              (item.path !== '/' && location.pathname.startsWith(item.path))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-xl p-3 transition-all relative',
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-lg' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                title={item.label}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Padding for mobile bottom nav */}
        <div className="h-16 md:hidden" />
      </div>
    </div>
  )
}

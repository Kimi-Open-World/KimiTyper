import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Volume2, Type, Moon, Zap, Trash2, AlertCircle, Bell, Globe } from 'lucide-react'
import { useAppStore } from '@/store'
import { clearAllData } from '@/db'
import { cn } from '@/lib/utils'
import { createT } from '@/lib/i18n'
import { requestNotificationPermission, formatReminderTime } from '@/lib/reminder'

export default function Settings() {
  const { settings, updateSettings, toggleTheme } = useAppStore()
  const t = createT(settings.language)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [reminderMsg, setReminderMsg] = useState('')

  const handleClearData = async () => {
    await clearAllData()
    window.location.reload()
  }

  const handleToggleReminder = async () => {
    const newEnabled = !settings.reminderEnabled
    if (newEnabled) {
      const permission = await requestNotificationPermission()
      if (permission !== 'granted') {
        setReminderMsg(t('reminder.permissionDenied'))
        return
      }
      setReminderMsg(t('reminder.enabled', { time: formatReminderTime(settings.reminderTime) }))
    } else {
      setReminderMsg('')
    }
    updateSettings({ reminderEnabled: newEnabled })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
      </div>

      {/* === 外观 === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <Moon className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('settings.appearance')}</h2>
        </div>
        <div className="divide-y">
          {/* Theme */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.theme')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.themeDesc')}</p>
            </div>
            <button
              onClick={toggleTheme}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              {settings.theme === 'light'
                ? t('settings.light')
                : settings.theme === 'dark'
                  ? t('settings.dark')
                  : t('settings.system')}
            </button>
          </div>

          {/* Language */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {t('settings.language')}
              </label>
              <p className="text-sm text-muted-foreground">{t('settings.languageDesc')}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updateSettings({ language: 'zh' })}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  settings.language === 'zh'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                )}
              >
                {t('settings.chinese')}
              </button>
              <button
                onClick={() => updateSettings({ language: 'en' })}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-sm transition-colors',
                  settings.language === 'en'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                )}
              >
                {t('settings.english')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === 学习 === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <Type className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('settings.learning')}</h2>
        </div>
        <div className="divide-y">
          {/* Show Phonetic */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.showPhonetic')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.showPhoneticDesc')}</p>
            </div>
            <Toggle
              value={settings.showPhonetic}
              onChange={() => updateSettings({ showPhonetic: !settings.showPhonetic })}
            />
          </div>
          {/* Show Example */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.showExample')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.showExampleDesc')}</p>
            </div>
            <Toggle
              value={settings.showExample}
              onChange={() => updateSettings({ showExample: !settings.showExample })}
            />
          </div>
          {/* Daily Goal */}
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.dailyGoal')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.dailyGoalDesc')}</p>
            </div>
            <input
              type="number"
              value={settings.dailyGoal}
              min={5}
              max={200}
              onChange={(e) => updateSettings({ dailyGoal: parseInt(e.target.value) || 20 })}
              className="w-20 rounded-lg border bg-background px-3 py-1 text-center outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      {/* === 发音 === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <Volume2 className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('settings.pronunciation')}</h2>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.enablePronunc')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.enablePronuncDesc')}</p>
            </div>
            <Toggle
              value={settings.pronunciation}
              onChange={() => updateSettings({ pronunciation: !settings.pronunciation })}
            />
          </div>
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.autoPlay')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.autoPlayDesc')}</p>
            </div>
            <Toggle
              value={settings.autoPlayAudio}
              onChange={() => updateSettings({ autoPlayAudio: !settings.autoPlayAudio })}
            />
          </div>
        </div>
      </div>

      {/* === 提醒 === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('settings.reminder')}</h2>
        </div>
        <div className="divide-y">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.reminderEnabled')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.reminderEnabledDesc')}</p>
            </div>
            <Toggle
              value={settings.reminderEnabled}
              onChange={handleToggleReminder}
            />
          </div>
          {settings.reminderEnabled && (
            <div className="flex items-center justify-between px-4 py-4">
              <div className="space-y-0.5">
                <label className="font-medium">{t('settings.reminderTime')}</label>
                <p className="text-sm text-muted-foreground">{t('settings.reminderTimeDesc')}</p>
              </div>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => updateSettings({ reminderTime: e.target.value })}
                className="rounded-lg border bg-background px-3 py-1 outline-none focus:border-primary"
              />
            </div>
          )}
          {reminderMsg && (
            <div className="px-4 pb-4">
              <p className={cn(
                'text-sm rounded-lg p-2',
                reminderMsg.includes('denied') || reminderMsg.includes('拒绝')
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              )}>
                {reminderMsg}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* === 高级 === */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{t('settings.advanced')}</h2>
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <label className="font-medium">{t('settings.keyboardSound')}</label>
              <p className="text-sm text-muted-foreground">{t('settings.keyboardSoundDesc')}</p>
            </div>
            <Toggle
              value={settings.keyboardSound}
              onChange={() => updateSettings({ keyboardSound: !settings.keyboardSound })}
            />
          </div>
        </div>
      </div>

      {/* === 数据管理 === */}
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-destructive/20 px-4 py-3">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-semibold text-destructive">{t('settings.data')}</h2>
        </div>
        <div className="p-4">
          <p className="mb-4 text-sm text-muted-foreground">{t('settings.clearDataDesc')}</p>

          {showClearConfirm ? (
            <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
              <span className="flex-1 text-sm">{t('settings.clearConfirm')}</span>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleClearData}
                className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                {t('common.confirm')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-full rounded-lg border border-destructive/50 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              {t('settings.clearData')}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>{t('settings.version', { version: '0.1.0' })}</p>
        <p className="mt-1">{t('settings.versionTagline')}</p>
      </div>
    </div>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors',
        value ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
          value && 'translate-x-5'
        )}
      />
    </button>
  )
}

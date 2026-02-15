import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Volume2, Type, Moon, Zap, Trash2, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store'
import { clearAllData } from '@/db'
import { cn } from '@/lib/utils'

export default function Settings() {
  const { settings, updateSettings, toggleTheme } = useAppStore()
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const handleClearData = async () => {
    await clearAllData()
    window.location.reload()
  }

  const settingGroups = [
    {
      title: '外观',
      icon: Moon,
      settings: [
        {
          label: '主题',
          description: '切换亮色/暗色/跟随系统',
          value: settings.theme,
          options: [
            { value: 'light', label: '亮色' },
            { value: 'dark', label: '暗色' },
            { value: 'system', label: '跟随系统' },
          ],
          onChange: toggleTheme,
        },
      ],
    },
    {
      title: '学习',
      icon: Type,
      settings: [
        {
          label: '显示音标',
          description: '在学习页面显示单词音标',
          type: 'toggle',
          value: settings.showPhonetic,
          onChange: () => updateSettings({ showPhonetic: !settings.showPhonetic }),
        },
        {
          label: '显示例句',
          description: '在学习页面显示单词例句',
          type: 'toggle',
          value: settings.showExample,
          onChange: () => updateSettings({ showExample: !settings.showExample }),
        },
        {
          label: '每日目标',
          description: '设置每天的学习目标（单词数）',
          type: 'number',
          value: settings.dailyGoal,
          min: 5,
          max: 100,
          onChange: (val: number) => updateSettings({ dailyGoal: val }),
        },
      ],
    },
    {
      title: '发音',
      icon: Volume2,
      settings: [
        {
          label: '启用发音',
          description: '显示发音按钮并使用语音合成',
          type: 'toggle',
          value: settings.pronunciation,
          onChange: () => updateSettings({ pronunciation: !settings.pronunciation }),
        },
        {
          label: '自动播放',
          description: '输入正确后自动播放单词发音',
          type: 'toggle',
          value: settings.autoPlayAudio,
          onChange: () => updateSettings({ autoPlayAudio: !settings.autoPlayAudio }),
        },
      ],
    },
    {
      title: '高级',
      icon: Zap,
      settings: [
        {
          label: '键盘音效',
          description: '打字时播放按键声音（暂未实现）',
          type: 'toggle',
          value: settings.keyboardSound,
          onChange: () => updateSettings({ keyboardSound: !settings.keyboardSound }),
          disabled: true,
        },
      ],
    },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      {/* Setting Groups */}
      <div className="space-y-6">
        {settingGroups.map((group) => (
          <div key={group.title} className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-3">
              <group.icon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">{group.title}</h2>
            </div>
            <div className="divide-y">
              {group.settings.map((setting) => (
                <div
                  key={setting.label}
                  className={cn(
                    'flex items-center justify-between px-4 py-4',
                    setting.disabled && 'opacity-50'
                  )}
                >
                  <div className="space-y-0.5">
                    <label className="font-medium">{setting.label}</label>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  
                  {setting.type === 'toggle' ? (
                    <button
                      onClick={setting.onChange}
                      disabled={setting.disabled}
                      className={cn(
                        'relative h-6 w-11 rounded-full transition-colors',
                        setting.value ? 'bg-primary' : 'bg-muted'
                      )}
                    >
                      <span
                        className={cn(
                          'absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform',
                          setting.value && 'translate-x-5'
                        )}
                      />
                    </button>
                  ) : setting.type === 'number' ? (
                    <input
                      type="number"
                      value={setting.value}
                      min={setting.min}
                      max={setting.max}
                      onChange={(e) => setting.onChange?.(parseInt(e.target.value))}
                      className="w-20 rounded-lg border bg-background px-3 py-1 text-center outline-none focus:border-primary"
                    />
                  ) : (
                    <button
                      onClick={setting.onChange}
                      className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    >
                      {setting.options?.find((opt) => opt.value === setting.value)?.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Clear Data */}
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-destructive/20 px-4 py-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <h2 className="font-semibold text-destructive">数据管理</h2>
          </div>
          <div className="p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              清除所有本地数据，包括学习进度、词书和设置。此操作不可撤销。
            </p>
            
            {showClearConfirm ? (
              <div className="flex items-center gap-3 rounded-lg bg-destructive/10 p-3">
                <AlertCircle className="h-5 w-5 text-destructive" />
                <span className="flex-1 text-sm">确定要清除所有数据吗？</span>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleClearData}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-sm text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  确认清除
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full rounded-lg border border-destructive/50 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
              >
                清除所有数据
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground">
        <p>KimiTyper v0.0.1</p>
        <p className="mt-1">通过打字输入强化单词记忆</p>
      </div>
    </div>
  )
}

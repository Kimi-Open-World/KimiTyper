import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
    ArrowLeft,
    Cloud,
    CloudOff,
    LogIn,
    LogOut,
    RefreshCw,
    User,
    Mail,
    Lock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    UserPlus,
    Upload,
    Download,
    Database,
} from 'lucide-react'
import { useAppStore } from '@/store'
import { createT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
    register,
    login,
    logout,
    fullSync,
    getSyncStatus,
    isLoggedIn,
    getUser,
    getLastSyncAt,
    serializeStoreToSyncItems,
    SyncError,
} from '@/lib/sync'
import { saveBook, getAllSM2Cards, getAllBooks } from '@/db'
import type { WordBook } from '@/types'

type Mode = 'status' | 'login' | 'register'

export default function SyncPage() {
    const { settings, syncStatus, setSyncStatus, progress, stats, keyVocabulary, applyServerItems } =
        useAppStore()
    const t = createT(settings.language)

    const [mode, setMode] = useState<Mode>('status')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [nickname, setNickname] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [serverStatus, setServerStatus] = useState<{
        serverTime: string
        lastUpdated: string | null
        dataCounts: Record<string, { total: number; active: number }>
    } | null>(null)

    // 初始化：从 localStorage 恢复登录状态
    useEffect(() => {
        const loggedIn = isLoggedIn()
        const user = getUser()
        if (loggedIn && user) {
            setSyncStatus({ isLoggedIn: true, user })
        } else {
            setSyncStatus({ isLoggedIn: false, user: null })
        }
    }, [])

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 5000)
    }

    // ==================== 登录 ====================
    const handleLogin = async () => {
        if (!email || !password) {
            showMsg('error', t('sync.emailPasswordRequired'))
            return
        }
        setLoading(true)
        try {
            const result = await login(email, password)
            setSyncStatus({ isLoggedIn: true, user: result.user, lastError: null })
            setMode('status')
            showMsg('success', t('sync.loginSuccess', { email: result.user.email }))
            // 登录成功后立刻全量同步
            handleSync()
        } catch (err) {
            showMsg('error', err instanceof SyncError ? err.message : t('sync.networkError'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== 注册 ====================
    const handleRegister = async () => {
        if (!email || !password || !nickname) {
            showMsg('error', t('sync.allFieldsRequired'))
            return
        }
        if (password !== confirmPassword) {
            showMsg('error', t('sync.passwordMismatch'))
            return
        }
        if (password.length < 6) {
            showMsg('error', t('sync.passwordTooShort'))
            return
        }
        setLoading(true)
        try {
            const result = await register(email, password, nickname)
            setSyncStatus({ isLoggedIn: true, user: result.user, lastError: null })
            setMode('status')
            showMsg('success', t('sync.registerSuccess'))
            handleSync()
        } catch (err) {
            showMsg('error', err instanceof SyncError ? err.message : t('sync.networkError'))
        } finally {
            setLoading(false)
        }
    }

    // ==================== 全量同步 ====================
    const handleSync = async () => {
        if (!isLoggedIn()) return
        setSyncStatus({ isSyncing: true, lastError: null })
        try {
            // 收集本地数据
            const sm2cards = await getAllSM2Cards()
            const allBooks = await getAllBooks()
            const customBooks: WordBook[] = allBooks.filter((b) => b.isCustom)

            const localItems = serializeStoreToSyncItems({
                progress,
                stats,
                settings,
                keyVocabulary,
                customBooks,
                sm2cards,
            })

            // 全量同步
            const result = await fullSync(localItems)

            // 把服务器数据合并回来
            const { customBooksToSave } = applyServerItems(result.serverItems)
            for (const book of customBooksToSave) {
                await saveBook(book)
            }

            setSyncStatus({
                isSyncing: false,
                lastSyncAt: result.serverTime,
                lastError: null,
            })
            showMsg(
                'success',
                t('sync.syncSuccess', {
                    pushed: result.pushedCount,
                    pulled: result.serverItems.length,
                })
            )

            // 刷新服务器状态
            loadServerStatus()
        } catch (err) {
            const msg = err instanceof SyncError ? err.message : t('sync.networkError')
            setSyncStatus({ isSyncing: false, lastError: msg })
            showMsg('error', msg)
        }
    }

    // ==================== 登出 ====================
    const handleLogout = async () => {
        await logout()
        setSyncStatus({ isLoggedIn: false, user: null, lastSyncAt: null, isSyncing: false })
        setServerStatus(null)
        showMsg('success', t('sync.logoutSuccess'))
    }

    // ==================== 加载服务器状态 ====================
    const loadServerStatus = async () => {
        if (!isLoggedIn()) return
        try {
            const status = await getSyncStatus()
            setServerStatus(status)
        } catch {
            // 忽略网络错误
        }
    }

    useEffect(() => {
        if (syncStatus.isLoggedIn) {
            loadServerStatus()
        }
    }, [syncStatus.isLoggedIn])

    const lastSync = syncStatus.lastSyncAt || getLastSyncAt()
    const isNeverSynced = !syncStatus.lastSyncAt || lastSync === '1970-01-01T00:00:00.000Z'

    // ==================== 渲染 ====================
    return (
        <div className="mx-auto max-w-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link to="/" className="rounded-lg p-2 hover:bg-accent transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Cloud className="h-6 w-6 text-primary" />
                        {t('sync.title')}
                    </h1>
                    <p className="text-sm text-muted-foreground">{t('sync.subtitle')}</p>
                </div>
            </div>

            {/* Message */}
            {message && (
                <div
                    className={cn(
                        'flex items-center gap-3 rounded-xl px-4 py-3 text-sm',
                        message.type === 'success'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-destructive/10 text-destructive'
                    )}
                >
                    {message.type === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    {message.text}
                </div>
            )}

            {/* ===== 未登录 ===== */}
            {!syncStatus.isLoggedIn && mode === 'status' && (
                <div className="rounded-xl border bg-card p-8 text-center space-y-4">
                    <div className="mx-auto w-fit rounded-full bg-muted p-6">
                        <CloudOff className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h2 className="text-xl font-semibold">{t('sync.notLoggedIn')}</h2>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">{t('sync.loginHint')}</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => setMode('login')}
                            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <LogIn className="h-4 w-4" />
                            {t('sync.login')}
                        </button>
                        <button
                            onClick={() => setMode('register')}
                            className="flex items-center justify-center gap-2 rounded-xl border px-6 py-2.5 font-medium hover:bg-accent transition-colors"
                        >
                            <UserPlus className="h-4 w-4" />
                            {t('sync.register')}
                        </button>
                    </div>
                </div>
            )}

            {/* ===== 登录表单 ===== */}
            {mode === 'login' && (
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b bg-muted/50 px-4 py-3 flex items-center gap-2">
                        <LogIn className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold">{t('sync.login')}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <FormField
                            icon={<Mail className="h-4 w-4" />}
                            label={t('sync.email')}
                            type="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="your@email.com"
                        />
                        <FormField
                            icon={<Lock className="h-4 w-4" />}
                            label={t('sync.password')}
                            type="password"
                            value={password}
                            onChange={setPassword}
                            placeholder="••••••"
                            onEnter={handleLogin}
                        />
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setMode('status')}
                                className="flex-1 rounded-xl border py-2.5 text-sm hover:bg-accent transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleLogin}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t('sync.login')}
                            </button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                            {t('sync.noAccount')}{' '}
                            <button
                                onClick={() => setMode('register')}
                                className="text-primary hover:underline"
                            >
                                {t('sync.registerNow')}
                            </button>
                        </p>
                    </div>
                </div>
            )}

            {/* ===== 注册表单 ===== */}
            {mode === 'register' && (
                <div className="rounded-xl border bg-card overflow-hidden">
                    <div className="border-b bg-muted/50 px-4 py-3 flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        <h2 className="font-semibold">{t('sync.register')}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <FormField
                            icon={<User className="h-4 w-4" />}
                            label={t('sync.nickname')}
                            type="text"
                            value={nickname}
                            onChange={setNickname}
                            placeholder={settings.language === 'zh' ? '你的昵称' : 'Your nickname'}
                        />
                        <FormField
                            icon={<Mail className="h-4 w-4" />}
                            label={t('sync.email')}
                            type="email"
                            value={email}
                            onChange={setEmail}
                            placeholder="your@email.com"
                        />
                        <FormField
                            icon={<Lock className="h-4 w-4" />}
                            label={t('sync.password')}
                            type="password"
                            value={password}
                            onChange={setPassword}
                            placeholder={settings.language === 'zh' ? '至少 6 位' : 'At least 6 characters'}
                        />
                        <FormField
                            icon={<Lock className="h-4 w-4" />}
                            label={t('sync.confirmPassword')}
                            type="password"
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            placeholder={settings.language === 'zh' ? '再次输入密码' : 'Repeat password'}
                            onEnter={handleRegister}
                        />
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setMode('status')}
                                className="flex-1 rounded-xl border py-2.5 text-sm hover:bg-accent transition-colors"
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleRegister}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                            >
                                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                                {t('sync.register')}
                            </button>
                        </div>
                        <p className="text-center text-xs text-muted-foreground">
                            {t('sync.hasAccount')}{' '}
                            <button onClick={() => setMode('login')} className="text-primary hover:underline">
                                {t('sync.loginNow')}
                            </button>
                        </p>
                    </div>
                </div>
            )}

            {/* ===== 已登录状态 ===== */}
            {syncStatus.isLoggedIn && mode === 'status' && (
                <>
                    {/* 用户信息 */}
                    <div className="rounded-xl border bg-card p-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{syncStatus.user?.nickname || syncStatus.user?.email}</p>
                            <p className="text-sm text-muted-foreground truncate">{syncStatus.user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                        >
                            <LogOut className="h-4 w-4" />
                            {t('sync.logout')}
                        </button>
                    </div>

                    {/* 同步状态 */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                        <div className="border-b bg-muted/50 px-4 py-3 flex items-center gap-2">
                            <Cloud className="h-5 w-5 text-primary" />
                            <h2 className="font-semibold">{t('sync.syncStatus')}</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {/* 上次同步时间 */}
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t('sync.lastSync')}</span>
                                <span className="font-medium">
                                    {isNeverSynced
                                        ? t('sync.neverSynced')
                                        : new Date(lastSync).toLocaleString(settings.language === 'zh' ? 'zh-CN' : 'en-US')}
                                </span>
                            </div>

                            {/* 同步错误 */}
                            {syncStatus.lastError && (
                                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {syncStatus.lastError}
                                </div>
                            )}

                            {/* 同步按钮 */}
                            <button
                                onClick={handleSync}
                                disabled={syncStatus.isSyncing}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                            >
                                {syncStatus.isSyncing ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-5 w-5" />
                                )}
                                {syncStatus.isSyncing ? t('sync.syncing') : t('sync.syncNow')}
                            </button>
                        </div>
                    </div>

                    {/* 服务器数据统计 */}
                    {serverStatus && (
                        <div className="rounded-xl border bg-card overflow-hidden">
                            <div className="border-b bg-muted/50 px-4 py-3 flex items-center gap-2">
                                <Database className="h-5 w-5 text-primary" />
                                <h2 className="font-semibold">{t('sync.cloudData')}</h2>
                            </div>
                            <div className="divide-y">
                                {Object.entries(serverStatus.dataCounts).map(([type, counts]) => (
                                    <div key={type} className="flex items-center justify-between px-4 py-3 text-sm">
                                        <span className="text-muted-foreground capitalize">{type}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Upload className="h-3.5 w-3.5 text-green-500" />
                                                {counts.active}
                                            </span>
                                            {counts.total !== counts.active && (
                                                <span className="text-xs text-muted-foreground">
                                                    ({counts.total} {t('sync.total')})
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {Object.keys(serverStatus.dataCounts).length === 0 && (
                                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                                        <Download className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        {t('sync.noCloudData')}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 说明 */}
                    <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">📖 {t('sync.howItWorks')}</p>
                        <p>• {t('sync.howItWorks1')}</p>
                        <p>• {t('sync.howItWorks2')}</p>
                        <p>• {t('sync.howItWorks3')}</p>
                    </div>
                </>
            )}
        </div>
    )
}

// ==================== 表单字段组件 ====================
function FormField({
    icon,
    label,
    type,
    value,
    onChange,
    placeholder,
    onEnter,
}: {
    icon: React.ReactNode
    label: string
    type: string
    value: string
    onChange: (v: string) => void
    placeholder?: string
    onEnter?: () => void
}) {
    return (
        <div className="space-y-1.5">
            <label className="text-sm font-medium">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {icon}
                </span>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
                    placeholder={placeholder}
                    className="w-full rounded-xl border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary transition-colors"
                />
            </div>
        </div>
    )
}

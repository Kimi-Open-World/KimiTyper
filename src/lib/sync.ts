/**
 * KimiTyper 云端同步服务
 * 策略：Last-Write-Wins（时间戳最新优先）
 *
 * 同步数据类型：
 *   progress   → LearningProgress  (key: bookId 或 bookId-chapterId)
 *   book       → WordBook (仅自定义词书)
 *   sm2card    → SM2Card
 *   stats      → UserStats (key: 'global')
 *   settings   → AppSettings (key: 'global')
 *   keyVocab   → Word[]    (key: 'list')
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export interface SyncItem {
    dataType: string
    dataKey: string
    dataValue: unknown
    updatedAt: string
    deleted?: boolean
}

export interface AuthTokens {
    accessToken: string
    refreshToken: string
    expiresAt: string
}

// ==================== Token 存储 ====================

const KEYS = {
    ACCESS_TOKEN: 'kt_access_token',
    REFRESH_TOKEN: 'kt_refresh_token',
    TOKEN_EXPIRES: 'kt_token_expires',
    USER: 'kt_user',
    LAST_SYNC: 'kt_last_sync',
}

export function getAccessToken(): string | null {
    return localStorage.getItem(KEYS.ACCESS_TOKEN)
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(KEYS.REFRESH_TOKEN)
}

export function isLoggedIn(): boolean {
    return !!getAccessToken()
}

export function getUser(): { id: string; email: string; nickname: string } | null {
    const raw = localStorage.getItem(KEYS.USER)
    return raw ? JSON.parse(raw) : null
}

export function getLastSyncAt(): string {
    return localStorage.getItem(KEYS.LAST_SYNC) || '1970-01-01T00:00:00.000Z'
}

function saveTokens(tokens: AuthTokens, user?: { id: string; email: string; nickname: string }) {
    localStorage.setItem(KEYS.ACCESS_TOKEN, tokens.accessToken)
    localStorage.setItem(KEYS.REFRESH_TOKEN, tokens.refreshToken)
    localStorage.setItem(KEYS.TOKEN_EXPIRES, tokens.expiresAt)
    if (user) localStorage.setItem(KEYS.USER, JSON.stringify(user))
}

export function clearAuth() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k))
}

// ==================== HTTP 请求封装（含 Token 自动刷新） ====================

async function apiFetch(
    path: string,
    options: RequestInit = {},
    isRetry = false
): Promise<Response> {
    const token = getAccessToken()
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    })

    // Access Token 过期，自动刷新
    if (response.status === 401 && !isRetry) {
        const body = await response.clone().json().catch(() => ({}))
        if (body.error === 'TokenExpired') {
            const refreshed = await tryRefreshToken()
            if (refreshed) {
                return apiFetch(path, options, true) // 重试
            }
        }
        clearAuth()
        throw new SyncError('UNAUTHORIZED', '未登录或 Token 已失效')
    }

    return response
}

async function tryRefreshToken(): Promise<boolean> {
    const refreshToken = getRefreshToken()
    if (!refreshToken) return false

    try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        })

        if (!res.ok) return false

        const data = await res.json()
        saveTokens(data)
        return true
    } catch {
        return false
    }
}

// ==================== 错误类型 ====================

export class SyncError extends Error {
    constructor(
        public code: string,
        message: string
    ) {
        super(message)
        this.name = 'SyncError'
    }
}

// ==================== 认证 API ====================

export async function register(
    email: string,
    password: string,
    nickname = ''
): Promise<{ user: { id: string; email: string; nickname: string } }> {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, nickname }),
    })

    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)

    saveTokens(data, data.user)
    return data
}

export async function login(
    email: string,
    password: string
): Promise<{ user: { id: string; email: string; nickname: string } }> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    })

    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)

    saveTokens(data, data.user)
    return data
}

export async function logout(): Promise<void> {
    const refreshToken = getRefreshToken()
    try {
        await apiFetch('/api/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        })
    } catch {
        // 即使请求失败，也清除本地登录状态
    }
    clearAuth()
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const res = await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ oldPassword, newPassword }),
    })
    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)
    clearAuth()
}

// ==================== 同步 API ====================

/**
 * 全量双向同步（首次登录或手动同步）
 * 返回服务器端新于 lastSyncAt 的条目
 */
export async function fullSync(localItems: SyncItem[]): Promise<{
    serverItems: SyncItem[]
    pushedCount: number
    serverTime: string
}> {
    const lastSyncAt = getLastSyncAt()
    const res = await apiFetch('/api/sync/full', {
        method: 'POST',
        body: JSON.stringify({ localData: localItems, lastSyncAt }),
    })

    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)

    localStorage.setItem(KEYS.LAST_SYNC, data.serverTime)
    return data
}

/**
 * 增量推送（有本地修改时）
 */
export async function pushItems(items: SyncItem[]): Promise<{ updatedCount: number }> {
    if (items.length === 0) return { updatedCount: 0 }

    const res = await apiFetch('/api/sync/push', {
        method: 'POST',
        body: JSON.stringify({ items }),
    })

    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)
    return data
}

/**
 * 增量拉取（定时拉取服务器更新）
 */
export async function pullItems(
    types?: string[]
): Promise<{ items: SyncItem[]; serverTime: string }> {
    const lastSyncAt = getLastSyncAt()
    const params = new URLSearchParams({ since: lastSyncAt })
    if (types?.length) params.set('types', types.join(','))

    const res = await apiFetch(`/api/sync/pull?${params}`)
    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)

    localStorage.setItem(KEYS.LAST_SYNC, data.serverTime)
    return data
}

/**
 * 查询同步状态
 */
export async function getSyncStatus(): Promise<{
    serverTime: string
    lastUpdated: string | null
    dataCounts: Record<string, { total: number; active: number }>
}> {
    const res = await apiFetch('/api/sync/status')
    const data = await res.json()
    if (!res.ok) throw new SyncError(data.error, data.message)
    return data
}

// ==================== 数据序列化辅助 ====================

import type { LearningProgress, UserStats, AppSettings, SM2Card, Word, WordBook } from '@/types'

type AppSettingsForSync = Omit<AppSettings, 'reminderEnabled' | 'reminderTime'> & {
    reminderEnabled?: boolean
    reminderTime?: string
}

/**
 * 把前端 Store 状态序列化为可同步的 SyncItem 列表
 */
export function serializeStoreToSyncItems(data: {
    progress: Record<string, LearningProgress>
    stats: UserStats
    settings: AppSettingsForSync
    keyVocabulary: Word[]
    customBooks: WordBook[]
    sm2cards?: SM2Card[]
}): SyncItem[] {
    const now = new Date().toISOString()
    const items: SyncItem[] = []

    // 进度
    for (const [key, val] of Object.entries(data.progress)) {
        items.push({ dataType: 'progress', dataKey: key, dataValue: val, updatedAt: now })
    }

    // 统计
    items.push({ dataType: 'stats', dataKey: 'global', dataValue: data.stats, updatedAt: now })

    // 设置
    items.push({
        dataType: 'settings',
        dataKey: 'global',
        dataValue: data.settings,
        updatedAt: now,
    })

    // 重点词汇
    items.push({
        dataType: 'keyVocab',
        dataKey: 'list',
        dataValue: data.keyVocabulary,
        updatedAt: now,
    })

    // 自定义词书
    for (const book of data.customBooks) {
        items.push({ dataType: 'book', dataKey: book.id, dataValue: book, updatedAt: now })
    }

    // SM2 卡片
    for (const card of data.sm2cards || []) {
        items.push({
            dataType: 'sm2card',
            dataKey: `${card.bookId}-${card.wordId}`,
            dataValue: card,
            updatedAt: card.nextReview || now,
        })
    }

    return items
}

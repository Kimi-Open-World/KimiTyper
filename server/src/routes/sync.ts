import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db'
import { authMiddleware } from '../middleware/auth'

const router = Router()

// 所有同步路由都需要认证
router.use(authMiddleware)

/**
 * 同步数据结构：
 * {
 *   dataType: string,
 *   dataKey: string,
 *   dataValue: any,
 *   updatedAt: string (ISO),
 *   deleted?: boolean
 * }
 */
interface SyncItem {
    dataType: string
    dataKey: string
    dataValue: unknown
    updatedAt: string
    deleted?: boolean
}

// ==================== 推送数据（上传） ====================
// POST /api/sync/push
// Body: { items: SyncItem[] }
router.post('/push', (req: Request, res: Response): void => {
    const { items } = req.body as { items: SyncItem[] }
    const userId = req.user!.userId

    if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'BadRequest', message: 'items 不能为空' })
        return
    }

    if (items.length > 1000) {
        res.status(400).json({ error: 'BadRequest', message: '单次最多同步 1000 条' })
        return
    }

    const upsert = db.prepare(`
    INSERT INTO sync_data (id, user_id, data_type, data_key, data_value, updated_at, deleted)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, data_type, data_key) DO UPDATE SET
      data_value = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.data_value ELSE sync_data.data_value END,
      updated_at = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.updated_at ELSE sync_data.updated_at END,
      deleted    = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.deleted    ELSE sync_data.deleted    END
  `)

    const pushMany = db.transaction((syncItems: SyncItem[]) => {
        let updated = 0
        for (const item of syncItems) {
            const existing = db.prepare(`
        SELECT updated_at FROM sync_data WHERE user_id = ? AND data_type = ? AND data_key = ?
      `).get(userId, item.dataType, item.dataKey) as { updated_at: string } | undefined

            // 仅当客户端数据更新时才覆盖（Last-Write-Wins）
            if (!existing || item.updatedAt > existing.updated_at) {
                upsert.run(
                    uuidv4(),
                    userId,
                    item.dataType,
                    item.dataKey,
                    JSON.stringify(item.dataValue),
                    item.updatedAt,
                    item.deleted ? 1 : 0
                )
                updated++
            }
        }
        return updated
    })

    try {
        const updatedCount = pushMany(items)
        res.json({
            message: '数据已同步',
            updatedCount,
            totalReceived: items.length,
        })
    } catch (err) {
        console.error('Push error:', err)
        res.status(500).json({ error: 'InternalError', message: '同步失败' })
    }
})

// ==================== 拉取数据（下载） ====================
// GET /api/sync/pull?since=ISO_DATE&types=progress,book,...
router.get('/pull', (req: Request, res: Response): void => {
    const userId = req.user!.userId
    const since = (req.query.since as string) || '1970-01-01T00:00:00.000Z'
    const typesParam = req.query.types as string | undefined
    const types = typesParam ? typesParam.split(',') : null

    let query: string
    let params: unknown[]

    if (types && types.length > 0) {
        const placeholders = types.map(() => '?').join(',')
        query = `
      SELECT data_type, data_key, data_value, updated_at, deleted
      FROM sync_data
      WHERE user_id = ? AND updated_at > ? AND data_type IN (${placeholders})
      ORDER BY updated_at ASC
      LIMIT 5000
    `
        params = [userId, since, ...types]
    } else {
        query = `
      SELECT data_type, data_key, data_value, updated_at, deleted
      FROM sync_data
      WHERE user_id = ? AND updated_at > ?
      ORDER BY updated_at ASC
      LIMIT 5000
    `
        params = [userId, since]
    }

    try {
        const rows = db.prepare(query).all(...params) as Array<{
            data_type: string
            data_key: string
            data_value: string
            updated_at: string
            deleted: number
        }>

        const items: SyncItem[] = rows.map((row) => ({
            dataType: row.data_type,
            dataKey: row.data_key,
            dataValue: JSON.parse(row.data_value),
            updatedAt: row.updated_at,
            deleted: Boolean(row.deleted),
        }))

        res.json({
            items,
            count: items.length,
            serverTime: new Date().toISOString(),
        })
    } catch (err) {
        console.error('Pull error:', err)
        res.status(500).json({ error: 'InternalError', message: '拉取数据失败' })
    }
})

// ==================== 全量同步（首次登录 / 重新同步） ====================
// POST /api/sync/full
// Body: { localData: SyncItem[], lastSyncAt: string }
// 返回：需要覆盖到客户端的数据 + 服务器更新计数
router.post('/full', (req: Request, res: Response): void => {
    const userId = req.user!.userId
    const { localData, lastSyncAt } = req.body as {
        localData: SyncItem[]
        lastSyncAt: string
    }

    const sinceDate = lastSyncAt || '1970-01-01T00:00:00.000Z'

    try {
        // 1. 将本地数据推送到服务器（Last-Write-Wins）
        const upsert = db.prepare(`
      INSERT INTO sync_data (id, user_id, data_type, data_key, data_value, updated_at, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, data_type, data_key) DO UPDATE SET
        data_value = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.data_value ELSE sync_data.data_value END,
        updated_at = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.updated_at ELSE sync_data.updated_at END,
        deleted    = CASE WHEN excluded.updated_at > sync_data.updated_at THEN excluded.deleted    ELSE sync_data.deleted    END
    `)

        const doSync = db.transaction(() => {
            const serverTime = new Date().toISOString()
            let pushed = 0

            if (Array.isArray(localData)) {
                for (const item of localData) {
                    const existing = db.prepare(`
            SELECT updated_at FROM sync_data WHERE user_id = ? AND data_type = ? AND data_key = ?
          `).get(userId, item.dataType, item.dataKey) as { updated_at: string } | undefined

                    if (!existing || item.updatedAt > existing.updated_at) {
                        upsert.run(
                            uuidv4(),
                            userId,
                            item.dataType,
                            item.dataKey,
                            JSON.stringify(item.dataValue),
                            item.updatedAt,
                            item.deleted ? 1 : 0
                        )
                        pushed++
                    }
                }
            }

            // 2. 返回服务器上比 lastSyncAt 更新的数据
            const serverItems = db.prepare(`
        SELECT data_type, data_key, data_value, updated_at, deleted
        FROM sync_data
        WHERE user_id = ? AND updated_at > ?
        ORDER BY updated_at ASC
        LIMIT 10000
      `).all(userId, sinceDate) as Array<{
                data_type: string
                data_key: string
                data_value: string
                updated_at: string
                deleted: number
            }>

            return {
                pushed,
                serverItems: serverItems.map((row) => ({
                    dataType: row.data_type,
                    dataKey: row.data_key,
                    dataValue: JSON.parse(row.data_value),
                    updatedAt: row.updated_at,
                    deleted: Boolean(row.deleted),
                })),
                serverTime,
            }
        })

        const result = doSync()
        res.json({
            message: '全量同步完成',
            pushedCount: result.pushed,
            serverItems: result.serverItems,
            serverTime: result.serverTime,
        })
    } catch (err) {
        console.error('Full sync error:', err)
        res.status(500).json({ error: 'InternalError', message: '全量同步失败' })
    }
})

// ==================== 删除条目（软删除） ====================
// DELETE /api/sync/:dataType/:dataKey
router.delete('/:dataType/:dataKey', (req: Request, res: Response): void => {
    const userId = req.user!.userId
    const { dataType, dataKey } = req.params
    const now = new Date().toISOString()

    db.prepare(`
    INSERT INTO sync_data (id, user_id, data_type, data_key, data_value, updated_at, deleted)
    VALUES (?, ?, ?, ?, '{}', ?, 1)
    ON CONFLICT(user_id, data_type, data_key) DO UPDATE SET
      deleted = 1,
      updated_at = excluded.updated_at
  `).run(uuidv4(), userId, dataType, dataKey, now)

    res.json({ message: '已标记删除' })
})

// ==================== 获取同步状态 ====================
// GET /api/sync/status
router.get('/status', (req: Request, res: Response): void => {
    const userId = req.user!.userId

    const counts = db.prepare(`
    SELECT data_type, COUNT(*) as total, COUNT(CASE WHEN deleted = 0 THEN 1 END) as active
    FROM sync_data
    WHERE user_id = ?
    GROUP BY data_type
  `).all(userId) as Array<{ data_type: string; total: number; active: number }>

    const lastSync = db.prepare(`
    SELECT MAX(updated_at) as last_updated FROM sync_data WHERE user_id = ?
  `).get(userId) as { last_updated: string | null }

    res.json({
        serverTime: new Date().toISOString(),
        lastUpdated: lastSync.last_updated,
        dataCounts: counts.reduce((acc, row) => {
            acc[row.data_type] = { total: row.total, active: row.active }
            return acc
        }, {} as Record<string, { total: number; active: number }>),
    })
})

export default router

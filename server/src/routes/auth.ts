import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import db from '../db'
import { authMiddleware } from '../middleware/auth'

const router = Router()

const JWT_SECRET = () => process.env.JWT_SECRET || 'dev_secret'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d'
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || '90')

function generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign({ userId, email }, JWT_SECRET(), {
        expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    })

    const refreshToken = uuidv4()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS)

    db.prepare(`
    INSERT INTO refresh_tokens (token, user_id, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).run(refreshToken, userId, expiresAt.toISOString(), new Date().toISOString())

    return { accessToken, refreshToken, expiresAt: expiresAt.toISOString() }
}

// ==================== 注册 ====================
router.post('/register', (req: Request, res: Response): void => {
    const { email, password, nickname } = req.body

    if (!email || !password) {
        res.status(400).json({ error: 'BadRequest', message: '邮箱和密码不能为空' })
        return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'BadRequest', message: '邮箱格式不正确' })
        return
    }

    if (password.length < 6) {
        res.status(400).json({ error: 'BadRequest', message: '密码至少 6 位' })
        return
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
        res.status(409).json({ error: 'Conflict', message: '该邮箱已被注册' })
        return
    }

    const passwordHash = bcrypt.hashSync(password, 10)
    const userId = uuidv4()
    const now = new Date().toISOString()

    db.prepare(`
    INSERT INTO users (id, email, password_hash, nickname, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email.toLowerCase(), passwordHash, nickname || '', now, now)

    const tokens = generateTokens(userId, email)

    res.status(201).json({
        message: '注册成功',
        user: { id: userId, email, nickname: nickname || '' },
        ...tokens,
    })
})

// ==================== 登录 ====================
router.post('/login', (req: Request, res: Response): void => {
    const { email, password } = req.body

    if (!email || !password) {
        res.status(400).json({ error: 'BadRequest', message: '邮箱和密码不能为空' })
        return
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) as
        | { id: string; email: string; password_hash: string; nickname: string }
        | undefined

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        res.status(401).json({ error: 'Unauthorized', message: '邮箱或密码错误' })
        return
    }

    const tokens = generateTokens(user.id, user.email)

    res.json({
        message: '登录成功',
        user: { id: user.id, email: user.email, nickname: user.nickname },
        ...tokens,
    })
})

// ==================== 刷新 Token ====================
router.post('/refresh', (req: Request, res: Response): void => {
    const { refreshToken } = req.body

    if (!refreshToken) {
        res.status(400).json({ error: 'BadRequest', message: 'refreshToken 不能为空' })
        return
    }

    const record = db.prepare(`
    SELECT rt.*, u.email FROM refresh_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ?
  `).get(refreshToken) as { user_id: string; email: string; expires_at: string } | undefined

    if (!record) {
        res.status(401).json({ error: 'InvalidToken', message: 'Refresh Token 无效' })
        return
    }

    if (new Date(record.expires_at) < new Date()) {
        db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken)
        res.status(401).json({ error: 'TokenExpired', message: 'Refresh Token 已过期，请重新登录' })
        return
    }

    // 删除旧 refresh token（Rolling Refresh）
    db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(refreshToken)

    const tokens = generateTokens(record.user_id, record.email)

    res.json({ message: '刷新成功', ...tokens })
})

// ==================== 登出 ====================
router.post('/logout', authMiddleware, (req: Request, res: Response): void => {
    const { refreshToken } = req.body
    if (refreshToken) {
        db.prepare('DELETE FROM refresh_tokens WHERE token = ? AND user_id = ?').run(
            refreshToken,
            req.user!.userId
        )
    }
    res.json({ message: '已退出登录' })
})

// ==================== 获取当前用户信息 ====================
router.get('/me', authMiddleware, (req: Request, res: Response): void => {
    const user = db
        .prepare('SELECT id, email, nickname, created_at FROM users WHERE id = ?')
        .get(req.user!.userId) as { id: string; email: string; nickname: string; created_at: string } | undefined

    if (!user) {
        res.status(404).json({ error: 'NotFound', message: '用户不存在' })
        return
    }

    res.json({ user })
})

// ==================== 修改密码 ====================
router.put('/password', authMiddleware, (req: Request, res: Response): void => {
    const { oldPassword, newPassword } = req.body

    if (!oldPassword || !newPassword) {
        res.status(400).json({ error: 'BadRequest', message: '旧密码和新密码不能为空' })
        return
    }

    if (newPassword.length < 6) {
        res.status(400).json({ error: 'BadRequest', message: '新密码至少 6 位' })
        return
    }

    const user = db
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .get(req.user!.userId) as { password_hash: string } | undefined

    if (!user || !bcrypt.compareSync(oldPassword, user.password_hash)) {
        res.status(401).json({ error: 'Unauthorized', message: '旧密码错误' })
        return
    }

    const newHash = bcrypt.hashSync(newPassword, 10)
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        newHash,
        new Date().toISOString(),
        req.user!.userId
    )

    // 注销所有 refresh tokens（强制重新登录）
    db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(req.user!.userId)

    res.json({ message: '密码修改成功，请重新登录' })
})

export default router

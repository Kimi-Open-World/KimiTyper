import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface JWTPayload {
    userId: string
    email: string
}

// 扩展 Express Request，附加 user 信息
declare global {
    namespace Express {
        interface Request {
            user?: JWTPayload
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized', message: '请先登录' })
        return
    }

    const token = authHeader.slice(7)
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || '') as JWTPayload
        req.user = payload
        next()
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'TokenExpired', message: 'Token 已过期，请刷新' })
        } else {
            res.status(401).json({ error: 'InvalidToken', message: '无效的 Token' })
        }
    }
}

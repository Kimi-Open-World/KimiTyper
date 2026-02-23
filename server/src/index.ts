import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initDB } from './db'
import authRouter from './routes/auth'
import syncRouter from './routes/sync'

const app = express()
const PORT = parseInt(process.env.PORT || '3001')

// ==================== 中间件 ====================
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())

app.use(
    cors({
        origin: corsOrigins,
        credentials: true,
    })
)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// 请求日志（简单版）
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
})

// ==================== 路由 ====================
app.use('/api/auth', authRouter)
app.use('/api/sync', syncRouter)

// 健康检查
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        version: '1.0.0',
        time: new Date().toISOString(),
    })
})

// API 文档（简要）
app.get('/api', (_req, res) => {
    res.json({
        name: 'KimiTyper Sync API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/register': '注册新用户',
                'POST /api/auth/login': '登录',
                'POST /api/auth/refresh': '刷新 Access Token',
                'POST /api/auth/logout': '登出（需 Bearer Token）',
                'GET  /api/auth/me': '获取当前用户信息（需 Bearer Token）',
                'PUT  /api/auth/password': '修改密码（需 Bearer Token）',
            },
            sync: {
                'POST /api/sync/push': '推送本地数据到服务器',
                'GET  /api/sync/pull?since=ISO&types=progress,book': '拉取服务器数据',
                'POST /api/sync/full': '全量双向同步（首次登录）',
                'GET  /api/sync/status': '查看同步状态',
                'DELETE /api/sync/:dataType/:dataKey': '软删除条目',
            },
        },
    })
})

// 404 处理
app.use((_req, res) => {
    res.status(404).json({ error: 'NotFound', message: '接口不存在' })
})

// 全局错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', err)
    res.status(500).json({ error: 'InternalError', message: '服务器内部错误' })
})

// ==================== 启动 ====================
initDB()

app.listen(PORT, () => {
    console.log(`\n🚀 KimiTyper Sync Server`)
    console.log(`   - 地址: http://localhost:${PORT}`)
    console.log(`   - API文档: http://localhost:${PORT}/api`)
    console.log(`   - 健康检查: http://localhost:${PORT}/health`)
    console.log(`   - 环境: ${process.env.NODE_ENV || 'development'}`)
    console.log(`   - 允许跨域: ${corsOrigins.join(', ')}\n`)
})

export default app

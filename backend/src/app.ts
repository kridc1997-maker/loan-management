import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import apiRouter from './routes'
import { notFound, errorHandler } from './middleware/errorHandler'

const app = express()
const PORT = Number(process.env.PORT ?? 3001)
const isProd = process.env.NODE_ENV === 'production'

// ─── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }))
if (!isProd) {
  app.use(cors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    credentials: true,
  }))
}
app.use(morgan(isProd ? 'combined' : 'dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', apiRouter)

// ─── Serve Frontend (production only) ────────────────────────────────────────
if (isProd) {
  const frontendDist = path.join(__dirname, '../../frontend/dist')
  app.use(express.static(frontendDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'))
  })
} else {
  // ─── Error Handlers (dev only — prod uses catch-all above) ─────────────────
  app.use(notFound)
}

app.use(errorHandler)

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Loan Management API`)
  console.log(`   Server  : http://localhost:${PORT}`)
  console.log(`   Health  : http://localhost:${PORT}/api/v1/health`)
  console.log(`   Mode    : ${process.env.NODE_ENV ?? 'development'}\n`)
})

export default app

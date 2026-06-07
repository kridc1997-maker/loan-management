import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authService } from '../services/authService'
import type { AuthRequest } from '../types'

const loginSchema = z.object({
  username: z.string().min(1, 'กรุณากรอกชื่อผู้ใช้'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const body = loginSchema.parse(req.body)
      const result = await authService.login(body.username, body.password)
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body
      if (!refreshToken) return res.status(400).json({ success: false, message: 'กรุณาส่ง refreshToken' })
      const result = await authService.refresh(refreshToken)
      res.json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async me(req: AuthRequest, res: Response) {
    res.json({ success: true, data: req.user })
  },
}

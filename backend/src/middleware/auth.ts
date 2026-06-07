import type { Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { AuthRequest, JwtPayload } from '../types'

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.user = payload
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' })
  }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' })
    return
  }
  next()
}

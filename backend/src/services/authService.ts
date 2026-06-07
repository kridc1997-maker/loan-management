import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import db from '../db/connection'
import { AppError } from '../middleware/errorHandler'
import type { JwtPayload } from '../types'

export const authService = {
  async login(username: string, password: string) {
    const user = await db('users as u')
      .select('u.*', 'r.name as role_name')
      .join('roles as r', 'r.id', 'u.role_id')
      .where('u.username', username)
      .where('u.is_active', true)
      .first()

    if (!user) throw new AppError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) throw new AppError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')

    await db('users').where({ id: user.id }).update({ last_login_at: new Date() })

    const payload: JwtPayload = { userId: user.id, username: user.username, role: user.role_name }
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' } as jwt.SignOptions)
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d' } as jwt.SignOptions)

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role_name },
    }
  },

  async refresh(refreshToken: string) {
    try {
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as JwtPayload
      const newPayload: JwtPayload = { userId: payload.userId, username: payload.username, role: payload.role }
      const accessToken = jwt.sign(newPayload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' } as jwt.SignOptions)
      return { accessToken }
    } catch {
      throw new AppError(401, 'Refresh token ไม่ถูกต้องหรือหมดอายุ')
    }
  },
}

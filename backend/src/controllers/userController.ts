import type { Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import db from '../db/connection'
import { AppError } from '../middleware/errorHandler'
import { logAudit } from '../utils/auditLog'
import type { AuthRequest } from '../types'

const createSchema = z.object({
  username: z.string().min(3, 'username ต้องมีอย่างน้อย 3 ตัวอักษร').max(50),
  password: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
  fullName: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล').max(100),
  role: z.enum(['admin', 'staff']),
})

const updateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'staff']).optional(),
  isActive: z.boolean().optional(),
})

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'),
})

function camelize(u: any) {
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    role: u.role_name ?? u.role,
    isActive: u.is_active,
    lastLoginAt: u.last_login_at,
    createdAt: u.created_at,
  }
}

export const userController = {
  async list(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('users as u')
        .select('u.id', 'u.username', 'u.full_name', 'u.is_active', 'u.last_login_at', 'u.created_at', 'r.name as role_name')
        .join('roles as r', 'r.id', 'u.role_id')
        .orderBy('u.created_at', 'asc')
      res.json({ success: true, data: rows.map(camelize) })
    } catch (err) { next(err) }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = createSchema.parse(req.body)

      const exists = await db('users').where({ username: body.username }).first()
      if (exists) throw new AppError(409, `username "${body.username}" ถูกใช้งานแล้ว`)

      const role = await db('roles').where({ name: body.role }).first()
      if (!role) throw new AppError(400, `ไม่พบ role: ${body.role}`)

      const hash = await bcrypt.hash(body.password, 10)
      const [user] = await db('users')
        .insert({ role_id: role.id, username: body.username, password_hash: hash, full_name: body.fullName, is_active: true, created_at: new Date(), updated_at: new Date() })
        .returning(['id', 'username', 'full_name', 'is_active', 'created_at'])

      await logAudit({
        userId: req.user?.userId,
        action: 'CREATE_USER',
        entityType: 'user',
        entityId: user.id,
        newData: { username: body.username, fullName: body.fullName, role: body.role },
      })

      res.status(201).json({ success: true, data: { ...camelize(user), role: body.role } })
    } catch (err) { next(err) }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const body = updateSchema.parse(req.body)

      const current = await db('users').where({ id }).first()
      if (!current) throw new AppError(404, 'ไม่พบผู้ใช้งาน')

      // prevent deactivating own account
      if (body.isActive === false && req.user?.userId === id) {
        throw new AppError(400, 'ไม่สามารถปิดใช้งานบัญชีของตัวเองได้')
      }

      const updates: Record<string, any> = { updated_at: new Date() }
      if (body.fullName !== undefined) updates.full_name = body.fullName
      if (body.isActive !== undefined) updates.is_active = body.isActive
      if (body.role !== undefined) {
        const role = await db('roles').where({ name: body.role }).first()
        if (!role) throw new AppError(400, `ไม่พบ role: ${body.role}`)
        updates.role_id = role.id
      }

      await db('users').where({ id }).update(updates)
      const updated = await db('users as u').select('u.*', 'r.name as role_name').join('roles as r', 'r.id', 'u.role_id').where('u.id', id).first()

      await logAudit({
        userId: req.user?.userId,
        action: 'UPDATE_USER',
        entityType: 'user',
        entityId: id,
        oldData: { fullName: current.full_name, isActive: current.is_active },
        newData: body,
      })

      res.json({ success: true, data: camelize(updated) })
    } catch (err) { next(err) }
  },

  async resetPassword(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const { newPassword } = passwordSchema.parse(req.body)

      const user = await db('users').where({ id }).first()
      if (!user) throw new AppError(404, 'ไม่พบผู้ใช้งาน')

      const hash = await bcrypt.hash(newPassword, 10)
      await db('users').where({ id }).update({ password_hash: hash, updated_at: new Date() })

      await logAudit({
        userId: req.user?.userId,
        action: 'RESET_PASSWORD',
        entityType: 'user',
        entityId: id,
      })

      res.json({ success: true, data: { message: 'เปลี่ยนรหัสผ่านเรียบร้อย' } })
    } catch (err) { next(err) }
  },

  async remove(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      if (req.user?.userId === id) throw new AppError(400, 'ไม่สามารถลบบัญชีของตัวเองได้')

      const user = await db('users').where({ id }).first()
      if (!user) throw new AppError(404, 'ไม่พบผู้ใช้งาน')

      await db('users').where({ id }).delete()

      await logAudit({
        userId: req.user?.userId,
        action: 'DELETE_USER',
        entityType: 'user',
        entityId: id,
        oldData: { username: user.username, fullName: user.full_name },
      })

      res.json({ success: true, data: { message: 'ลบผู้ใช้งานเรียบร้อย' } })
    } catch (err) { next(err) }
  },
}

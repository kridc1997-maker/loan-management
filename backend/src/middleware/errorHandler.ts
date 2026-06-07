import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ success: false, message: 'ไม่พบ API endpoint นี้' })
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (err instanceof ZodError) {
    const errors: Record<string, string[]> = {}
    err.errors.forEach((e) => {
      const key = e.path.join('.')
      if (!errors[key]) errors[key] = []
      errors[key].push(e.message)
    })
    res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง', errors })
    return
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, message: err.message, code: err.code })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' })
}

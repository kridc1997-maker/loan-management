import type { Response, NextFunction } from 'express'
import db from '../db/connection'
import { AppError } from '../middleware/errorHandler'
import { logAudit } from '../utils/auditLog'
import type { AuthRequest } from '../types'

export const badDebtController = {
  async list(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await db('bad_debts as bd')
        .select(
          'bd.*',
          db.raw("c.first_name || ' ' || c.last_name AS customer_name"),
          'c.phone AS customer_phone',
          'l.loan_number',
        )
        .join('customers as c', 'c.id', 'bd.customer_id')
        .join('loans as l', 'l.id', 'bd.loan_id')
        .orderBy('bd.marked_date', 'desc')

      res.json({ success: true, data: rows.map(camelize) })
    } catch (err) {
      next(err)
    }
  },

  async recover(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { recoveredAmount } = req.body
      const id = Number(req.params.id)
      const row = await db('bad_debts').where({ id }).first()
      if (!row) throw new AppError(404, 'ไม่พบรายการหนี้เสีย')
      if (row.is_recovered) throw new AppError(400, 'กู้คืนแล้ว')

      const [updated] = await db('bad_debts').where({ id }).update({
        is_recovered: true,
        recovered_amount: recoveredAmount ?? row.total_lost,
        recovered_date: new Date().toISOString().split('T')[0],
        updated_at: new Date(),
      }).returning('*')

      // Update loan status to written_off
      await db('loans').where({ id: row.loan_id }).update({ status: 'written_off', updated_at: new Date() })

      await logAudit({
        userId: req.user?.userId,
        action: 'RECOVER_BAD_DEBT',
        entityType: 'bad_debt',
        entityId: id,
        oldData: { isRecovered: false },
        newData: camelize(updated),
      })

      res.json({ success: true, data: camelize(updated) })
    } catch (err) {
      next(err)
    }
  },
}

function camelize(r: any) {
  return {
    id: r.id, loanId: r.loan_id, loanNumber: r.loan_number,
    customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone,
    principalLost: Number(r.principal_lost), interestLost: Number(r.interest_lost), totalLost: Number(r.total_lost),
    markedDate: r.marked_date, reason: r.reason,
    isRecovered: r.is_recovered, recoveredAmount: r.recovered_amount ? Number(r.recovered_amount) : null,
    recoveredDate: r.recovered_date, createdAt: r.created_at,
  }
}

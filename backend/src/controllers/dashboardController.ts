import type { Response, NextFunction } from 'express'
import { dashboardRepo } from '../repositories/dashboardRepository'
import { loanRepo } from '../repositories/loanRepository'
import { getCreditLabel } from '../repositories/customerRepository'
import type { AuthRequest } from '../types'

export const dashboardController = {
  async summary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await loanRepo.markOverdue()
      const data = await dashboardRepo.getSummary()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  async cashFlow(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const days = Number(req.query.days ?? 30)
      const data = await dashboardRepo.getCashFlow(days)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  async dueToday(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await loanRepo.dueToday()
      const data = rows.map((r: any) => ({
        loanId: r.loan_id,
        loanNumber: r.loan_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        loanType: r.loan_type,
        status: r.status,
        installmentNo: r.installment_no,
        totalInstallments: r.total_installments,
        amountDue: Number(r.amount_due),
        dueDate: String(r.due_date).split('T')[0],
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  async topCustomers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit ?? 10)
      const rows = await dashboardRepo.getTopCustomers(limit)
      const data = rows.map((r: any) => {
        const creditScore = r.credit_score !== null && r.credit_score !== undefined
          ? Number(r.credit_score) : null
        return {
          customerId: r.customer_id,
          customerName: r.customer_name,
          loanCount: Number(r.loan_count),
          closedLoansCount: Number(r.closed_loans_count ?? 0),
          totalBorrowed: Number(r.total_borrowed),
          totalInterestPaid: Number(r.total_interest_paid),
          creditScore,
          creditLabel: getCreditLabel(creditScore),
        }
      })
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  async overdueSummary(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const data = await dashboardRepo.getOverdueSummary()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },
}

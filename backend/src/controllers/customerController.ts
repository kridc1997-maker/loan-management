import type { Response, NextFunction } from 'express'
import { z } from 'zod'
import { customerRepo, getCreditLabel } from '../repositories/customerRepository'
import { generateCustomerCode, generatePortalToken } from '../utils/helpers'
import { AppError } from '../middleware/errorHandler'
import { logAudit } from '../utils/auditLog'
import type { AuthRequest } from '../types'

const createSchema = z.object({
  firstName: z.string().min(1, 'กรุณากรอกชื่อ'),
  lastName: z.string().min(1, 'กรุณากรอกนามสกุล'),
  phone: z.string().min(9, 'เบอร์โทรไม่ถูกต้อง'),
  idCard: z.string().optional(),
  address: z.string().optional(),
  occupation: z.string().optional(),
  lineId: z.string().optional(),
  note: z.string().optional(),
  riskLevel: z.enum(['low', 'normal', 'high', 'blacklist']).optional(),
})

export const customerController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const page = Number(req.query.page ?? 1)
      const limit = Number(req.query.limit ?? 20)
      const { rows, total } = await customerRepo.findAll({
        search: req.query.search as string,
        riskLevel: req.query.riskLevel as any,
        page,
        limit,
      })

      res.json({
        success: true,
        data: rows.map(camelizeCustomer),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      next(err)
    }
  },

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const customer = await customerRepo.findById(Number(req.params.id))
      if (!customer) throw new AppError(404, 'ไม่พบลูกค้า')
      res.json({ success: true, data: camelizeCustomer(customer) })
    } catch (err) {
      next(err)
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = createSchema.parse(req.body)
      const code = await generateCustomerCode()
      const row = await customerRepo.create({
        code,
        first_name: body.firstName,
        last_name: body.lastName,
        phone: body.phone,
        id_card: body.idCard,
        address: body.address,
        occupation: body.occupation,
        line_id: body.lineId,
        note: body.note,
        risk_level: (body.riskLevel as any) ?? 'normal',
        created_by: req.user?.userId,
      })

      await logAudit({
        userId: req.user?.userId,
        action: 'CREATE_CUSTOMER',
        entityType: 'customer',
        entityId: row.id,
        newData: camelizeCustomer(row),
      })

      res.status(201).json({ success: true, data: camelizeCustomer(row) })
    } catch (err) {
      next(err)
    }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const body = createSchema.partial().parse(req.body)
      const before = await customerRepo.findById(id)
      if (!before) throw new AppError(404, 'ไม่พบลูกค้า')
      await customerRepo.update(id, {
        first_name: body.firstName,
        last_name: body.lastName,
        phone: body.phone,
        id_card: body.idCard,
        address: body.address,
        occupation: body.occupation,
        line_id: body.lineId,
        note: body.note,
        risk_level: body.riskLevel as any,
      })
      const full = await customerRepo.findById(id)
      if (!full) throw new AppError(404, 'ไม่พบลูกค้า')

      await logAudit({
        userId: req.user?.userId,
        action: 'UPDATE_CUSTOMER',
        entityType: 'customer',
        entityId: id,
        oldData: camelizeCustomer(before),
        newData: camelizeCustomer(full),
      })

      res.json({ success: true, data: camelizeCustomer(full) })
    } catch (err) {
      next(err)
    }
  },

  async loans(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const loans = await customerRepo.getLoanHistory(Number(req.params.id))
      res.json({ success: true, data: loans.map(camelizeLoan) })
    } catch (err) {
      next(err)
    }
  },

  async generatePortalLink(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id)
      const existing = await customerRepo.findById(id)
      if (!existing) throw new AppError(404, 'ไม่พบลูกค้า')

      const token = generatePortalToken()
      await customerRepo.update(id, { portal_token: token })

      await logAudit({
        userId: req.user?.userId,
        action: 'GENERATE_PORTAL_LINK',
        entityType: 'customer',
        entityId: id,
      })

      res.json({ success: true, data: { portalToken: token } })
    } catch (err) {
      next(err)
    }
  },

  async paymentStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await customerRepo.getPaymentStats(Number(req.params.id))
      const data = {
        totalDue: stats.totalDue,
        totalPaid: stats.totalPaid,
        lateCount: stats.lateCount,
        avgDaysLate: stats.avgDaysLate,
        collectionRate: stats.collectionRate,
        creditScore: stats.creditScore,
        creditLabel: stats.creditLabel,
        latePayments: stats.latePayments.map((lp: any) => ({
          id: lp.id,
          loanNumber: lp.loan_number,
          loanType: lp.loan_type,
          loanId: lp.loan_id,
          installmentNo: lp.installment_no,
          dueDate: lp.due_date,
          paidDate: lp.paid_date,
          daysLate: Number(lp.days_late),
          amountDue: Number(lp.amount_due),
          paidAmount: Number(lp.paid_amount),
        })),
      }
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },
}

function camelizeLoan(r: any) {
  return {
    id: r.id, loanNumber: r.loan_number,
    customerId: r.customer_id,
    parentLoanId: r.parent_loan_id ?? null,
    isRolledOver: Boolean(r.is_rolled_over),
    totalPaidInterest: Number(r.total_paid_interest ?? 0),
    rolloverCount: Number(r.rollover_count ?? 0),
    principalAmount: Number(r.principal_amount),
    totalAmount: Number(r.total_amount),
    interestAmount: Number(r.interest_amount ?? (Number(r.total_amount) - Number(r.principal_amount))),
    interestRate: Number(r.interest_rate),
    loanType: r.loan_type,
    totalInstallments: r.total_installments,
    paidInstallments: r.paid_installments,
    paidPrincipal: Number(r.paid_principal),
    paidInterest: Number(r.paid_interest),
    issuedDate: r.issued_date,
    dueDate: r.due_date,
    closedDate: r.closed_date ?? null,
    status: r.status, note: r.note,
    createdAt: r.created_at,
  }
}

function camelizeCustomer(r: any) {
  const creditScore = r.credit_score != null ? Number(r.credit_score) : null
  return {
    id: r.id, code: r.code,
    firstName: r.first_name, lastName: r.last_name,
    phone: r.phone, idCard: r.id_card,
    address: r.address, occupation: r.occupation,
    lineId: r.line_id, riskLevel: r.risk_level,
    note: r.note, isActive: r.is_active,
    portalToken: r.portal_token ?? null,
    activeLoansCount: Number(r.active_loans_count ?? 0),
    totalOutstanding: Number(r.total_outstanding ?? 0),
    creditScore,
    creditLabel: getCreditLabel(creditScore),
    createdAt: r.created_at, updatedAt: r.updated_at,
  }
}

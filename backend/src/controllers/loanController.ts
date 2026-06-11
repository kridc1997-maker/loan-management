import type { Response, NextFunction } from 'express'
import { z } from 'zod'
import { loanRepo } from '../repositories/loanRepository'
import { loanService } from '../services/loanService'
import { AppError } from '../middleware/errorHandler'
import type { AuthRequest } from '../types'

const createLoanSchema = z.object({
  customerId: z.number().int().positive(),
  principalAmount: z.number().positive('เงินต้นต้องมากกว่า 0'),
  totalAmount: z.number().positive('ยอดรวมต้องมากกว่า 0'),
  loanType: z.enum(['single', 'installment', 'flexible', 'daily']),
  totalInstallments: z.number().int().min(0).default(1),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  paidInstallmentsCount: z.number().int().min(0).default(0).optional(),
})

const paymentSchema = z.object({
  installmentId: z.number().int().optional(),
  amount: z.number().positive('ยอดชำระต้องมากกว่า 0'),
  finePaid: z.number().min(0).default(0).optional(),
  paymentType: z.enum(['normal', 'partial', 'rollover', 'full', 'bad_debt_recover']),
  paymentMethod: z.enum(['cash', 'transfer', 'other']).default('cash'),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
  newDueDate: z.string().optional(),
})

const adjustAmountsSchema = z.object({
  principalAmount: z.number().positive('เงินต้นต้องมากกว่า 0'),
  totalAmount: z.number().positive('ยอดรวมต้องมากกว่า 0'),
})

const rolloverSchema = z.object({
  interestCollected: z.number().positive(),
  newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().optional(),
})

export const loanController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await loanRepo.markOverdue()
      const { rows, total } = await loanRepo.findAll({
        status: req.query.status as any,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        search: req.query.search as string,
        page: Number(req.query.page ?? 1),
        limit: Number(req.query.limit ?? 20),
        dueDateFrom: req.query.dueDateFrom as string,
        dueDateTo: req.query.dueDateTo as string,
      })
      const page = Number(req.query.page ?? 1)
      const limit = Number(req.query.limit ?? 20)
      res.json({
        success: true,
        data: rows.map(camelize),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      })
    } catch (err) {
      next(err)
    }
  },

  async get(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const loan = await loanRepo.findById(Number(req.params.id))
      if (!loan) throw new AppError(404, 'ไม่พบสัญญา')
      const installments = await loanRepo.getInstallments(loan.id)
      res.json({ success: true, data: { ...camelize(loan), installments } })
    } catch (err) {
      next(err)
    }
  },

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = createLoanSchema.parse(req.body)
      const loan = await loanService.createLoan({ ...body, paidInstallmentsCount: body.paidInstallmentsCount ?? 0, createdBy: req.user?.userId })
      res.status(201).json({ success: true, data: camelize(loan) })
    } catch (err) {
      next(err)
    }
  },

  async getInstallments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const rows = await loanRepo.getInstallments(Number(req.params.id))
      res.json({ success: true, data: rows.map(camelizeInstallment) })
    } catch (err) {
      next(err)
    }
  },

  async receivePayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = paymentSchema.parse(req.body)
      const result = await loanService.receivePayment({
        loanId: Number(req.params.id),
        ...body,
        createdBy: req.user?.userId,
      })
      res.status(201).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async rollover(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = rolloverSchema.parse(req.body)
      const result = await loanService.receivePayment({
        loanId: Number(req.params.id),
        amount: body.interestCollected,
        paymentType: 'rollover',
        paymentMethod: 'cash',
        paymentDate: new Date().toISOString().split('T')[0],
        newDueDate: body.newDueDate,
        note: body.note,
        createdBy: req.user?.userId,
      })
      res.status(201).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async updateDueDate(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { newDueDate } = z.object({
        newDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'รูปแบบวันที่ไม่ถูกต้อง'),
      }).parse(req.body)
      const result = await loanService.updateDueDate(Number(req.params.id), newDueDate, req.user?.userId)
      res.json({ success: true, data: camelize(result) })
    } catch (err) {
      next(err)
    }
  },

  async convertToFlexible(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await loanService.convertToFlexible(Number(req.params.id), req.user?.userId)
      res.json({ success: true, data: camelize(result) })
    } catch (err) {
      next(err)
    }
  },

  async markBadDebt(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { reason } = req.body
      const result = await loanService.markAsBadDebt(Number(req.params.id), reason ?? '', req.user?.userId)
      res.status(201).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },

  async adjustAmounts(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const body = adjustAmountsSchema.parse(req.body)
      const result = await loanService.adjustLoanAmounts(
        Number(req.params.id),
        body.principalAmount,
        body.totalAmount,
        req.user?.userId,
      )
      res.json({ success: true, data: camelize(result) })
    } catch (err) {
      next(err)
    }
  },
}

function camelizeInstallment(r: any) {
  return {
    id: r.id, loanId: r.loan_id,
    installmentNo: r.installment_no,
    dueDate: String(r.due_date).split('T')[0],
    amountDue: Number(r.amount_due),
    principalPortion: Number(r.principal_portion),
    interestPortion: Number(r.interest_portion),
    paidAmount: Number(r.paid_amount),
    paidDate: r.paid_date ?? null,
    status: r.status,
  }
}

function camelize(r: any) {
  return {
    id: r.id, loanNumber: r.loan_number,
    customerId: r.customer_id, customerName: r.customer_name, customerPhone: r.customer_phone,
    parentLoanId: r.parent_loan_id,
    principalAmount: Number(r.principal_amount),
    totalAmount: Number(r.total_amount),
    interestAmount: Number(r.interest_amount ?? (Number(r.total_amount) - Number(r.principal_amount))),
    interestRate: Number(r.interest_rate),
    loanType: r.loan_type,
    totalInstallments: r.total_installments,
    installmentAmount: r.installment_amount ? Number(r.installment_amount) : null,
    paidInstallments: r.paid_installments,
    paidPrincipal: Number(r.paid_principal),
    paidInterest: Number(r.paid_interest),
    issuedDate: r.issued_date, dueDate: r.due_date, closedDate: r.closed_date,
    status: r.status, note: r.note,
    installments: r.installments,
    createdAt: r.created_at,
  }
}

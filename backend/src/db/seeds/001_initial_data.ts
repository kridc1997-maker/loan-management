import type { Knex } from 'knex'
import bcrypt from 'bcryptjs'

export async function seed(knex: Knex): Promise<void> {
  // Clear in reverse FK order
  await knex('audit_logs').del()
  await knex('settings').del()
  await knex('bad_debts').del()
  await knex('loan_rollovers').del()
  await knex('cash_transactions').del()
  await knex('payments').del()
  await knex('loan_installments').del()
  await knex('loans').del()
  await knex('customers').del()
  await knex('users').del()
  await knex('roles').del()

  // Roles
  await knex('roles').insert([
    { id: 1, name: 'admin', permissions: JSON.stringify({ all: true }) },
    { id: 2, name: 'staff', permissions: JSON.stringify({ view: true, create: true }) },
  ])

  // Users
  const hash = await bcrypt.hash('password123', 10)
  await knex('users').insert([
    { id: 1, role_id: 1, username: 'admin', password_hash: hash, full_name: 'ผู้ดูแลระบบ', is_active: true },
    { id: 2, role_id: 2, username: 'staff', password_hash: hash, full_name: 'พนักงาน', is_active: true },
  ])

  // Customers
  await knex('customers').insert([
    { id: 1, code: 'CUS-0001', first_name: 'สมชาย', last_name: 'ใจดี', phone: '081-234-5678', id_card: '1234567890123', address: 'บ้านเลขที่ 123 แขวงบางรัก กทม.', occupation: 'รับจ้าง', line_id: '@somchai', risk_level: 'normal', created_by: 1 },
    { id: 2, code: 'CUS-0002', first_name: 'มาลี', last_name: 'สวยงาม', phone: '082-345-6789', id_card: '2345678901234', address: '456 ถนนสุขุมวิท กทม.', occupation: 'แม่บ้าน', risk_level: 'low', note: 'ชำระตรงเวลาทุกครั้ง', created_by: 1 },
    { id: 3, code: 'CUS-0003', first_name: 'วิชัย', last_name: 'มาดี', phone: '083-456-7890', id_card: '3456789012345', address: '789 ถ.รัชดา กทม.', occupation: 'ค้าขาย', risk_level: 'high', note: 'เคยค้างชำระ 15 วัน', created_by: 1 },
    { id: 4, code: 'CUS-0004', first_name: 'สมศรี', last_name: 'ดีงาม', phone: '084-567-8901', risk_level: 'normal', created_by: 1 },
    { id: 5, code: 'CUS-0005', first_name: 'ประหยัด', last_name: 'น้อยใจ', phone: '085-678-9012', risk_level: 'high', note: 'ค้างชำระ 15 วัน', created_by: 1 },
  ])

  // Loans
  const today = new Date().toISOString().split('T')[0]
  const d = (n: number) => {
    const dt = new Date()
    dt.setDate(dt.getDate() + n)
    return dt.toISOString().split('T')[0]
  }

  await knex('loans').insert([
    // Active installment loan (สมชาย)
    {
      id: 1, loan_number: 'LN-20240607-001', customer_id: 1,
      principal_amount: 4000, total_amount: 5000, interest_rate: 0.25,
      loan_type: 'installment', total_installments: 4, installment_amount: 1250,
      issued_date: d(-2), due_date: d(4),
      paid_principal: 2000, paid_interest: 500, paid_installments: 2,
      status: 'active', created_by: 1,
    },
    // Completed single loan (สมชาย)
    {
      id: 2, loan_number: 'LN-20240520-002', customer_id: 1,
      principal_amount: 3000, total_amount: 3600, interest_rate: 0.20,
      loan_type: 'single', total_installments: 1,
      issued_date: d(-18), due_date: d(-13),
      paid_principal: 3000, paid_interest: 600, paid_installments: 1,
      closed_date: d(-13), status: 'completed', created_by: 1,
    },
    // Overdue single loan (สมศรี)
    {
      id: 3, loan_number: 'LN-20240601-003', customer_id: 4,
      principal_amount: 5000, total_amount: 6250, interest_rate: 0.25,
      loan_type: 'single', total_installments: 1,
      issued_date: d(-8), due_date: d(-1),
      paid_principal: 0, paid_interest: 0, paid_installments: 0,
      status: 'overdue', created_by: 1,
    },
    // Very overdue loan (ประหยัด)
    {
      id: 4, loan_number: 'LN-20240515-004', customer_id: 5,
      principal_amount: 8000, total_amount: 10000, interest_rate: 0.25,
      loan_type: 'single', total_installments: 1,
      issued_date: d(-23), due_date: d(-16),
      paid_principal: 0, paid_interest: 0, paid_installments: 0,
      status: 'overdue', created_by: 1,
    },
    // Active installment (วิชัย)
    {
      id: 5, loan_number: 'LN-20240605-005', customer_id: 3,
      principal_amount: 4000, total_amount: 5000, interest_rate: 0.25,
      loan_type: 'installment', total_installments: 4, installment_amount: 1250,
      issued_date: d(-4), due_date: d(0),
      paid_principal: 1000, paid_interest: 250, paid_installments: 1,
      status: 'active', created_by: 1,
    },
    // มาลี completed
    {
      id: 6, loan_number: 'LN-20240528-006', customer_id: 2,
      principal_amount: 2000, total_amount: 2500, interest_rate: 0.25,
      loan_type: 'single', total_installments: 1,
      issued_date: d(-11), due_date: d(-4),
      paid_principal: 2000, paid_interest: 500, paid_installments: 1,
      closed_date: d(-4), status: 'completed', created_by: 1,
    },
  ])

  // Installments for loan 1
  await knex('loan_installments').insert([
    { loan_id: 1, installment_no: 1, due_date: d(-1), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 1250, paid_date: d(-1), status: 'paid' },
    { loan_id: 1, installment_no: 2, due_date: d(0), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 1250, paid_date: today, status: 'paid' },
    { loan_id: 1, installment_no: 3, due_date: d(1), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 0, status: 'pending' },
    { loan_id: 1, installment_no: 4, due_date: d(2), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 0, status: 'pending' },
    // Installments for loan 5
    { loan_id: 5, installment_no: 1, due_date: d(-3), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 1250, paid_date: d(-3), status: 'paid' },
    { loan_id: 5, installment_no: 2, due_date: d(-2), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 0, status: 'pending' },
    { loan_id: 5, installment_no: 3, due_date: d(-1), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 0, status: 'overdue' },
    { loan_id: 5, installment_no: 4, due_date: d(0), amount_due: 1250, principal_portion: 1000, interest_portion: 250, paid_amount: 0, status: 'overdue' },
  ])

  // Payments
  await knex('payments').insert([
    { payment_number: 'PAY-001', loan_id: 1, installment_id: 1, amount: 1250, principal_paid: 1000, interest_paid: 250, over_payment: 0, payment_date: d(-1), payment_type: 'normal', payment_method: 'cash', created_by: 1 },
    { payment_number: 'PAY-002', loan_id: 1, installment_id: 2, amount: 1250, principal_paid: 1000, interest_paid: 250, over_payment: 0, payment_date: today, payment_type: 'normal', payment_method: 'cash', created_by: 1 },
    { payment_number: 'PAY-003', loan_id: 2, amount: 3600, principal_paid: 3000, interest_paid: 600, over_payment: 0, payment_date: d(-13), payment_type: 'full', payment_method: 'cash', created_by: 1 },
    { payment_number: 'PAY-004', loan_id: 5, installment_id: 5, amount: 1250, principal_paid: 1000, interest_paid: 250, over_payment: 0, payment_date: d(-3), payment_type: 'normal', payment_method: 'cash', created_by: 1 },
    { payment_number: 'PAY-005', loan_id: 6, amount: 2500, principal_paid: 2000, interest_paid: 500, over_payment: 0, payment_date: d(-4), payment_type: 'full', payment_method: 'cash', created_by: 1 },
  ])

  // Cash transactions (initial capital + loan disbursements + collections)
  let balance = 50000
  const cashTxns = [
    { txn_type: 'capital_in', direction: 'in', amount: 50000, description: 'ทุนเริ่มต้น', txn_date: d(-30) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 6, amount: 2000, description: 'ปล่อยกู้ มาลี', txn_date: d(-11) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 2, amount: 3000, description: 'ปล่อยกู้ สมชาย', txn_date: d(-18) },
    { txn_type: 'principal_in', direction: 'in', loan_id: 2, payment_id: 3, amount: 3000, description: 'คืนต้น สมชาย LN-002', txn_date: d(-13) },
    { txn_type: 'interest_in', direction: 'in', loan_id: 2, payment_id: 3, amount: 600, description: 'ดอก สมชาย LN-002', txn_date: d(-13) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 3, amount: 5000, description: 'ปล่อยกู้ สมศรี', txn_date: d(-8) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 4, amount: 8000, description: 'ปล่อยกู้ ประหยัด', txn_date: d(-23) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 5, amount: 4000, description: 'ปล่อยกู้ วิชัย', txn_date: d(-4) },
    { txn_type: 'principal_in', direction: 'in', loan_id: 5, payment_id: 4, amount: 1000, description: 'คืนต้น วิชัย LN-005 งวด1', txn_date: d(-3) },
    { txn_type: 'interest_in', direction: 'in', loan_id: 5, payment_id: 4, amount: 250, description: 'ดอก วิชัย LN-005 งวด1', txn_date: d(-3) },
    { txn_type: 'loan_out', direction: 'out', loan_id: 1, amount: 4000, description: 'ปล่อยกู้ สมชาย', txn_date: d(-2) },
    { txn_type: 'principal_in', direction: 'in', loan_id: 6, payment_id: 5, amount: 2000, description: 'คืนต้น มาลี LN-006', txn_date: d(-4) },
    { txn_type: 'interest_in', direction: 'in', loan_id: 6, payment_id: 5, amount: 500, description: 'ดอก มาลี LN-006', txn_date: d(-4) },
    { txn_type: 'interest_in', direction: 'in', loan_id: 1, payment_id: 1, amount: 250, description: 'ดอก สมชาย LN-001 งวด1', txn_date: d(-1) },
    { txn_type: 'principal_in', direction: 'in', loan_id: 1, payment_id: 1, amount: 1000, description: 'คืนต้น สมชาย LN-001 งวด1', txn_date: d(-1) },
    { txn_type: 'interest_in', direction: 'in', loan_id: 1, payment_id: 2, amount: 250, description: 'ดอก สมชาย LN-001 งวด2', txn_date: today },
    { txn_type: 'principal_in', direction: 'in', loan_id: 1, payment_id: 2, amount: 1000, description: 'คืนต้น สมชาย LN-001 งวด2', txn_date: today },
  ]

  for (let i = 0; i < cashTxns.length; i++) {
    const t = cashTxns[i]
    balance += t.direction === 'in' ? t.amount : -t.amount
    const num = `CTX-${String(i + 1).padStart(4, '0')}`
    await knex('cash_transactions').insert({
      txn_number: num,
      txn_type: t.txn_type,
      direction: t.direction,
      amount: t.amount,
      balance_after: balance,
      loan_id: (t as any).loan_id ?? null,
      payment_id: (t as any).payment_id ?? null,
      description: t.description,
      txn_date: t.txn_date,
      created_by: 1,
    })
  }

  // Settings
  await knex('settings').insert([
    { key: 'business_name', value: 'My Loan Business', description: 'ชื่อธุรกิจ' },
    { key: 'default_interest_rate', value: '0.25', description: 'อัตราดอกเบี้ยเริ่มต้น' },
    { key: 'overdue_threshold_days', value: '1', description: 'จำนวนวันก่อนถือว่าค้างชำระ' },
    { key: 'bad_debt_threshold_days', value: '90', description: 'จำนวนวันค้างก่อนตัดหนี้สูญ' },
    { key: 'currency', value: 'THB', description: 'สกุลเงิน' },
  ])
}

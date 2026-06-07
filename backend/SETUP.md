# Backend Setup Guide

## Prerequisites

1. **PostgreSQL** ต้องติดตั้งและรันบน localhost:5432
   - Download: https://www.postgresql.org/download/windows/
   - หรือใช้ Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres`

2. **Node.js** v18+

## Quick Start

### 1. สร้าง Database

เปิด psql หรือ pgAdmin แล้วรัน:
```sql
CREATE DATABASE loan_management;
```

### 2. ตั้งค่า Environment
```bash
# แก้ไข .env ให้ตรงกับ PostgreSQL ของคุณ
DB_HOST=localhost
DB_PORT=5432
DB_NAME=loan_management
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Run Migrations + Seed

```bash
cd backend

# Run migrations (สร้างตาราง)
npm run migrate

# Seed ข้อมูลตัวอย่าง
npm run seed
```

### 4. Start Backend

```bash
npm run dev
```

Server จะรันที่: http://localhost:3001

### 5. Start Frontend

```bash
cd ../frontend
npm run dev
```

Frontend จะรันที่: http://localhost:5173

## Default Login

- Username: `admin`
- Password: `password123`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | เข้าสู่ระบบ |
| GET | /api/v1/dashboard/summary | KPI Dashboard |
| GET | /api/v1/customers | รายชื่อลูกค้า |
| POST | /api/v1/customers | เพิ่มลูกค้า |
| GET | /api/v1/loans | รายการสัญญา |
| POST | /api/v1/loans | สร้างสัญญา |
| POST | /api/v1/loans/:id/payment | รับชำระ |
| POST | /api/v1/loans/:id/rollover | ต่อดอก |
| POST | /api/v1/loans/:id/mark-bad-debt | ตัดหนี้เสีย |
| GET | /api/v1/dashboard/cash-flow | Cash Flow |
| GET | /api/v1/bad-debts | รายการหนี้เสีย |
| GET | /api/v1/health | Health Check |

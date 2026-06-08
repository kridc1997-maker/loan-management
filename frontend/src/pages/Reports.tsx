import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { formatCurrency, formatPercent } from '../utils/financial'
import { reportApi, dashboardApi } from '../api/endpoints'

const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

interface MonthStat {
  month_key: string
  interest_collected: number
  principal_collected: number
  loans_issued: number
}

export default function Reports() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [stats, setStats] = useState<MonthStat[]>([])
  const [collectionRate, setCollectionRate] = useState(0)
  const [badDebtAmount, setBadDebtAmount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      reportApi.monthlyStats(year),
      dashboardApi.summary(),
    ]).then(([statsRes, summaryRes]) => {
      setStats(statsRes.data.data)
      const d = summaryRes.data.data
      setCollectionRate(d.collectionRate ?? 0)
      setBadDebtAmount(d.badDebtAmount ?? 0)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [year])

  const chartData = stats.map((s) => {
    const monthIdx = parseInt(s.month_key.split('-')[1]) - 1
    return {
      month: THAI_MONTHS[monthIdx],
      profit: s.interest_collected,
      loansOut: s.loans_issued,
      collected: s.interest_collected + s.principal_collected,
    }
  })

  const totalProfit = stats.reduce((s, d) => s + d.interest_collected, 0)
  const totalLoansOut = stats.reduce((s, d) => s + d.loans_issued, 0)
  const avgROI = totalLoansOut > 0 ? totalProfit / totalLoansOut : 0
  const badDebtRatio = totalLoansOut > 0 ? badDebtAmount / totalLoansOut : 0
  const buddhistYear = year + 543

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">สรุปผลประกอบการ ปี {buddhistYear}</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>{y + 543}</option>
            ))}
          </select>
          <button className="btn-secondary">
            <Download size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'กำไรสะสม', value: formatCurrency(totalProfit), color: 'text-green-600' },
          { label: 'Collection Rate', value: formatPercent(collectionRate), color: 'text-blue-600' },
          { label: 'Bad Debt Ratio', value: formatPercent(badDebtRatio), color: 'text-red-600' },
          { label: 'ROI เฉลี่ย/เดือน', value: formatPercent(avgROI), color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {loading && (
        <div className="card text-center py-10 text-gray-400 text-sm">กำลังโหลดข้อมูล...</div>
      )}

      {!loading && chartData.length === 0 && (
        <div className="card text-center py-10 text-gray-400 text-sm">ไม่มีข้อมูลในปี {buddhistYear}</div>
      )}

      {!loading && chartData.length > 0 && (
        <>
          {/* Profit Chart */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">กำไรรายเดือน</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                <Bar dataKey="profit" name="กำไร" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Volume Chart */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">ยอดปล่อยกู้ vs ยอดเก็บได้</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: unknown) => formatCurrency(Number(v))} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="loansOut" name="ปล่อยกู้" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="collected" name="เก็บได้" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Detail Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">ตารางรายเดือน</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="table-header">เดือน</th>
                    <th className="table-header text-right">ปล่อยกู้</th>
                    <th className="table-header text-right">เก็บได้</th>
                    <th className="table-header text-right">กำไร</th>
                    <th className="table-header text-right">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((d) => {
                    const monthIdx = parseInt(d.month_key.split('-')[1]) - 1
                    const totalCollected = d.interest_collected + d.principal_collected
                    const roi = d.loans_issued > 0 ? d.interest_collected / d.loans_issued : 0
                    return (
                      <tr key={d.month_key} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="table-cell font-medium text-gray-900">{THAI_MONTHS[monthIdx]} {buddhistYear}</td>
                        <td className="table-cell text-right text-blue-600">{formatCurrency(d.loans_issued)}</td>
                        <td className="table-cell text-right text-gray-700">{formatCurrency(totalCollected)}</td>
                        <td className="table-cell text-right font-bold text-green-600">{formatCurrency(d.interest_collected)}</td>
                        <td className="table-cell text-right font-semibold text-purple-600">{formatPercent(roi, 1)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

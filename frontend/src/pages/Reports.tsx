import { Download } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { formatCurrency, formatPercent } from '../utils/financial'

const monthlyData = [
  { month: 'ม.ค.', profit: 12000, loansOut: 45000, collected: 52000, badDebt: 0 },
  { month: 'ก.พ.', profit: 14500, loansOut: 52000, collected: 58000, badDebt: 2500 },
  { month: 'มี.ค.', profit: 16000, loansOut: 58000, collected: 64000, badDebt: 0 },
  { month: 'เม.ย.', profit: 13200, loansOut: 48000, collected: 55000, badDebt: 3750 },
  { month: 'พ.ค.', profit: 17800, loansOut: 65000, collected: 71000, badDebt: 0 },
  { month: 'มิ.ย.', profit: 18500, loansOut: 70000, collected: 76000, badDebt: 0 },
]

export default function Reports() {
  const totalProfit = monthlyData.reduce((s, d) => s + d.profit, 0)
  const avgCollectionRate = 0.876

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">รายงาน</h1>
          <p className="text-sm text-gray-500 mt-0.5">สรุปผลประกอบการ 6 เดือนล่าสุด</p>
        </div>
        <button className="btn-secondary">
          <Download size={15} /> Export Excel
        </button>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'กำไรสะสม', value: formatCurrency(totalProfit), color: 'text-green-600' },
          { label: 'Collection Rate', value: formatPercent(avgCollectionRate), color: 'text-blue-600' },
          { label: 'Bad Debt Ratio', value: '2.1%', color: 'text-red-600' },
          { label: 'ROI เฉลี่ย/เดือน', value: '11.8%', color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card text-center py-4">
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Profit Chart */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">กำไรรายเดือน</h2>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData}>
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
          <LineChart data={monthlyData}>
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
                <th className="table-header text-right">หนี้เสีย</th>
                <th className="table-header text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((d) => (
                <tr key={d.month} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="table-cell font-medium text-gray-900">{d.month} 2567</td>
                  <td className="table-cell text-right text-blue-600">{formatCurrency(d.loansOut)}</td>
                  <td className="table-cell text-right text-gray-700">{formatCurrency(d.collected)}</td>
                  <td className="table-cell text-right font-bold text-green-600">{formatCurrency(d.profit)}</td>
                  <td className="table-cell text-right text-red-500">{d.badDebt > 0 ? formatCurrency(d.badDebt) : '-'}</td>
                  <td className="table-cell text-right font-semibold text-purple-600">
                    {formatPercent(d.profit / d.loansOut, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

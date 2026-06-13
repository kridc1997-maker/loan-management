import type { ReactNode } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import ToastContainer from '../ui/Toast'

interface Props {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-900 p-6">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}

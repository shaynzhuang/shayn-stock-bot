import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '股票记账',
  description: '个人股票投资记账系统',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className={inter.className}>
        <nav className="border-b px-6 py-3 flex gap-6 text-sm font-medium">
          <Link href="/" className="hover:text-blue-600">持仓总览</Link>
          <Link href="/trades" className="hover:text-blue-600">交易记录</Link>
          <Link href="/trades/new" className="hover:text-blue-600">补录交易</Link>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}

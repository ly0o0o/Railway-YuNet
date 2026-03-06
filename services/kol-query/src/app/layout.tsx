import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KOL Query Studio',
  description: 'YouTube KOL 数据检索与筛选平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

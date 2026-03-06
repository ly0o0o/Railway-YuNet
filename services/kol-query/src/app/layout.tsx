import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KOL Explorer',
  description: 'YouTube KOL 数据查询平台',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

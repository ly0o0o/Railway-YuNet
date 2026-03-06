'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  page: number
  totalPages: number
  onPage: (p: number) => void
}

export default function Pagination({ page, totalPages, onPage }: Props) {
  if (totalPages <= 1) return null

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  const btnBase = 'w-9 h-9 rounded-lg text-sm flex items-center justify-center transition-all duration-200'

  return (
    <div className="surface-panel flex items-center justify-center gap-1 py-4 px-2" style={{ borderRadius: 16 }}>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className={`${btnBase} disabled:opacity-35`}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <ChevronLeft size={15} />
      </button>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dot-${i}`} className="w-9 h-9 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p as number)}
            className={btnBase}
            style={
              p === page
                ? {
                    background: 'var(--accent)',
                    color: '#fff',
                    border: '1px solid var(--accent)',
                    boxShadow: '0 8px 16px rgba(15,118,110,.22)',
                  }
                : {
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-secondary)',
                  }
            }
          >
            {p}
          </button>
        ),
      )}

      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className={`${btnBase} disabled:opacity-35`}
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
      >
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

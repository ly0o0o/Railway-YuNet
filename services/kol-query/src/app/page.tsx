'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, X, ChevronDown, BarChart3, ArrowUpDown } from 'lucide-react'
import FilterSidebar from '@/components/FilterSidebar'
import KolCard from '@/components/KolCard'
import KolDetailModal from '@/components/KolDetailModal'
import Pagination from '@/components/Pagination'
import type { KolProfile, KolQueryResult } from '@/lib/types'

// Mirror FilterState from FilterSidebar (strings for inputs, arrays for multi-select)
interface FilterState {
  primaryTags: string[]
  gender: string[]
  skinTone: string[]
  tones: string[]
  region: string[]
  language: string[]
  minFollowers: string
  maxFollowers: string
}

const EMPTY_FILTERS: FilterState = {
  primaryTags: [], gender: [], skinTone: [], tones: [],
  region: [], language: [], minFollowers: '', maxFollowers: '',
}

const SORT_OPTIONS = [
  { value: 'follower_count', label: '粉丝数' },
  { value: 'average_play_count', label: '平均播放' },
  { value: 'average_like_count', label: '平均点赞' },
  { value: 'created_at', label: '入库时间' },
]

interface StatsData {
  regions: { value: string; count: number }[]
  languages: { value: string; count: number }[]
  statusCounts: Record<string, number>
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="h-36" style={{ background: 'var(--bg-base)' }} />
      <div className="p-3 space-y-2">
        <div className="h-4 rounded w-3/4" style={{ background: 'var(--border)' }} />
        <div className="h-3 rounded w-1/2" style={{ background: 'var(--border)' }} />
        <div className="flex gap-2 mt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-3 rounded flex-1" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function countActive(f: FilterState): number {
  return (
    f.primaryTags.length + f.gender.length + f.skinTone.length + f.tones.length +
    f.region.length + f.language.length +
    (f.minFollowers ? 1 : 0) + (f.maxFollowers ? 1 : 0)
  )
}

export default function HomePage() {
  const [result, setResult] = useState<KolQueryResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState('follower_count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [selectedKol, setSelectedKol] = useState<KolProfile | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState<StatsData | null>(null)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  // Fetch stats once on mount
  useEffect(() => {
    fetch('/api/kols/stats')
      .then(r => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => {})
  }, [])

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 400)
    return () => clearTimeout(t)
  }, [search])

  // Close sort dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSortMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const fetchKols = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('pageSize', '24')
    qs.set('sort', sort)
    qs.set('sortDir', sortDir)
    if (debouncedSearch) qs.set('search', debouncedSearch)
    filters.primaryTags.forEach(v => qs.append('primaryTag', v))
    filters.gender.forEach(v => qs.append('gender', v))
    filters.region.forEach(v => qs.append('region', v))
    filters.language.forEach(v => qs.append('language', v))
    filters.skinTone.forEach(v => qs.append('skinTone', v))
    filters.tones.forEach(v => qs.append('tone', v))
    if (filters.minFollowers) qs.set('minFollowers', filters.minFollowers)
    if (filters.maxFollowers) qs.set('maxFollowers', filters.maxFollowers)

    try {
      const res = await fetch(`/api/kols?${qs}`)
      const json: KolQueryResult = await res.json()
      setResult(json)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [filters, page, sort, sortDir, debouncedSearch])

  useEffect(() => { fetchKols() }, [fetchKols])

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f); setPage(1)
  }, [])

  const activeCount = countActive(filters)
  const sortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? '粉丝数'

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 px-4 py-3" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-screen-xl mx-auto flex items-center gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #ff7e7e, #e84040)', boxShadow: '0 2px 12px rgba(232,64,64,.35)' }}>
              <BarChart3 size={16} color="#fff" />
            </div>
            <span className="font-bold text-base hidden sm:block" style={{ color: 'var(--text-primary)' }}>KOL Hub</span>
          </div>

          {/* Search bar */}
          <div className="flex-1 relative max-w-xl">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索昵称、账号..."
              className="w-full pl-9 pr-9 py-2 rounded-xl text-sm outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Sort */}
          <div ref={sortRef} className="relative flex-shrink-0">
            <button
              onClick={() => setShowSortMenu(s => !s)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl whitespace-nowrap"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            >
              <ArrowUpDown size={13} /> {sortLabel}
              <ChevronDown size={12} style={{ transform: showSortMenu ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {showSortMenu && (
              <div className="absolute right-0 top-full mt-1 rounded-xl py-1 z-50 w-36 shadow-xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (sort === opt.value) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                      else { setSort(opt.value); setSortDir('desc') }
                      setShowSortMenu(false)
                    }}
                    className="w-full text-left px-3 py-2 text-sm flex items-center justify-between"
                    style={{
                      color: sort === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                      background: sort === opt.value ? 'var(--accent-dim)' : 'transparent',
                    }}
                  >
                    {opt.label}
                    {sort === opt.value && <span className="text-xs">{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mobile filter toggle */}
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="flex-shrink-0 flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl lg:hidden relative"
            style={{
              background: activeCount > 0 ? 'var(--accent-dim)' : 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: activeCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
            }}
          >
            <SlidersHorizontal size={14} />
            筛选
            {activeCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                style={{ background: 'var(--accent)', color: '#fff' }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto flex gap-0 lg:gap-6 px-4 py-6">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block flex-shrink-0 w-60">
          <div className="sticky top-[65px]">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              totalActive={activeCount}
              regions={stats?.regions ?? []}
              languages={stats?.languages ?? []}
            />
          </div>
        </aside>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,.5)' }}
              onClick={() => setSidebarOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-72 z-50 overflow-y-auto lg:hidden"
              style={{ background: 'var(--bg-base)', borderRight: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-4 pt-4 mb-2">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>筛选条件</span>
                <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>
              <FilterSidebar
                filters={filters}
                totalActive={activeCount}
                onChange={(f) => { handleFilterChange(f); setSidebarOpen(false) }}
                regions={stats?.regions ?? []}
                languages={stats?.languages ?? []}
              />
            </div>
          </>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0">
          {/* Result bar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {loading ? '加载中...' : result ? (
                <span>
                  共 <strong style={{ color: 'var(--text-primary)' }}>{result.total.toLocaleString()}</strong> 位 KOL
                  {result.total > 0 && ` · 第 ${page}/${result.totalPages} 页`}
                </span>
              ) : '暂无数据'}
            </p>
            {activeCount > 0 && (
              <button
                onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                <X size={11} /> 清除 {activeCount} 个筛选
              </button>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : result && result.data.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {result.data.map(kol => (
                <KolCard key={kol.userId} kol={kol} onClick={() => setSelectedKol(kol)} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="text-5xl opacity-20">🔍</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>没有找到匹配的 KOL，试试调整筛选条件</p>
              {activeCount > 0 && (
                <button onClick={() => { setFilters(EMPTY_FILTERS); setPage(1) }}
                  className="text-sm px-4 py-2 rounded-xl mt-1"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  清除所有筛选
                </button>
              )}
            </div>
          )}

          {/* Pagination */}
          {result && result.totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                page={page}
                totalPages={result.totalPages}
                onPage={(p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              />
            </div>
          )}
        </main>
      </div>

      {/* Detail modal */}
      {selectedKol && (
        <KolDetailModal kol={selectedKol} onClose={() => setSelectedKol(null)} />
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  BarChart3,
  ArrowUpDown,
  Sparkles,
  Layers3,
  UsersRound,
} from 'lucide-react'
import FilterSidebar from '@/components/FilterSidebar'
import KolCard from '@/components/KolCard'
import KolDetailModal from '@/components/KolDetailModal'
import Pagination from '@/components/Pagination'
import type { KolProfile, KolQueryResult } from '@/lib/types'

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
  primaryTags: [],
  gender: [],
  skinTone: [],
  tones: [],
  region: [],
  language: [],
  minFollowers: '',
  maxFollowers: '',
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
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}
    >
      <div className="h-36" style={{ background: 'var(--bg-card-hover)' }} />
      <div className="p-3 space-y-2.5">
        <div className="h-4 rounded w-3/4" style={{ background: 'var(--border)' }} />
        <div className="h-3 rounded w-1/2" style={{ background: 'var(--border)' }} />
        <div className="flex gap-2 mt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-3 rounded flex-1" style={{ background: 'var(--border)' }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function countActive(f: FilterState): number {
  return (
    f.primaryTags.length +
    f.gender.length +
    f.skinTone.length +
    f.tones.length +
    f.region.length +
    f.language.length +
    (f.minFollowers ? 1 : 0) +
    (f.maxFollowers ? 1 : 0)
  )
}

function SummaryTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: string
  icon: React.ReactNode
}) {
  return (
    <div
      className="surface-panel px-4 py-3 fade-up"
      style={{ borderRadius: 16, boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {label}
          </p>
          <p className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {value}
          </p>
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          {icon}
        </div>
      </div>
      <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
        {hint}
      </p>
    </div>
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

  useEffect(() => {
    fetch('/api/kols/stats')
      .then((r) => r.json())
      .then((d: StatsData) => setStats(d))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false)
      }
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
    filters.primaryTags.forEach((v) => qs.append('primaryTag', v))
    filters.gender.forEach((v) => qs.append('gender', v))
    filters.region.forEach((v) => qs.append('region', v))
    filters.language.forEach((v) => qs.append('language', v))
    filters.skinTone.forEach((v) => qs.append('skinTone', v))
    filters.tones.forEach((v) => qs.append('tone', v))
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

  useEffect(() => {
    fetchKols()
  }, [fetchKols])

  const handleFilterChange = useCallback((f: FilterState) => {
    setFilters(f)
    setPage(1)
  }, [])

  const activeCount = countActive(filters)
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '粉丝数'

  const activeFilterBadges = useMemo(() => {
    const out: string[] = []
    out.push(...filters.primaryTags.map((v) => `分类:${v}`))
    out.push(...filters.gender.map((v) => `性别:${v}`))
    out.push(...filters.skinTone.map((v) => `肤色:${v}`))
    out.push(...filters.tones.map((v) => `调性:${v}`))
    out.push(...filters.region.map((v) => `地区:${v}`))
    out.push(...filters.language.map((v) => `语言:${v}`))
    if (filters.minFollowers) out.push(`最小粉丝:${filters.minFollowers}`)
    if (filters.maxFollowers) out.push(`最大粉丝:${filters.maxFollowers}`)
    return out
  }, [filters])

  const statusCount = stats?.statusCounts ?? {}
  const analyzed = Object.values(statusCount).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen pb-12">
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          borderColor: 'var(--border)',
          backdropFilter: 'blur(10px)',
          background: 'rgba(255, 252, 246, 0.88)',
        }}
      >
        <div className="max-w-[1400px] mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #0f766e 0%, #d97706 100%)',
                  boxShadow: '0 10px 24px rgba(15,118,110,0.28)',
                }}
              >
                <BarChart3 size={18} color="#fff" />
              </div>
              <div className="hidden sm:block">
                <p className="font-semibold leading-tight tracking-tight" style={{ color: 'var(--text-primary)' }}>
                  KOL Query Studio
                </p>
                <p className="text-[11px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                  智能筛选与画像检索
                </p>
              </div>
            </div>

            <div className="flex-1 relative max-w-2xl">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索昵称、账号、标签..."
                className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-card)',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="清空搜索"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div ref={sortRef} className="relative shrink-0">
              <button
                onClick={() => setShowSortMenu((s) => !s)}
                className="flex items-center gap-1.5 text-sm px-3.5 py-2.5 rounded-xl whitespace-nowrap"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <ArrowUpDown size={13} />
                <span className="hidden md:inline">排序</span>
                {sortLabel}
                <ChevronDown
                  size={12}
                  style={{ transform: showSortMenu ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                />
              </button>
              {showSortMenu && (
                <div
                  className="absolute right-0 top-full mt-1 rounded-xl py-1 z-50 w-40 shadow-xl fade-up"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (sort === opt.value) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
                        else {
                          setSort(opt.value)
                          setSortDir('desc')
                        }
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

            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="shrink-0 flex items-center gap-1.5 text-sm px-3 py-2.5 rounded-xl lg:hidden relative"
              style={{
                background: activeCount > 0 ? 'var(--accent-dim)' : 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: activeCount > 0 ? 'var(--accent)' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              <SlidersHorizontal size={14} />
              筛选
              {activeCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full text-[10px] flex items-center justify-center font-semibold"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {activeFilterBadges.length > 0 && (
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {activeFilterBadges.slice(0, 12).map((item) => (
                <span
                  key={item}
                  className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  {item}
                </span>
              ))}
              {activeFilterBadges.length > 12 && (
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                  +{activeFilterBadges.length - 12}
                </span>
              )}
              <button
                onClick={() => {
                  setFilters(EMPTY_FILTERS)
                  setPage(1)
                }}
                className="text-xs px-2.5 py-1 rounded-full"
                style={{ border: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}
              >
                清空筛选
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto flex gap-6 px-4 py-6">
        <aside className="hidden lg:block shrink-0 w-[290px]">
          <div className="sticky top-[84px]">
            <FilterSidebar
              filters={filters}
              onChange={handleFilterChange}
              totalActive={activeCount}
              regions={stats?.regions ?? []}
              languages={stats?.languages ?? []}
            />
          </div>
        </aside>

        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: 'rgba(32, 24, 12, 0.45)' }}
              onClick={() => setSidebarOpen(false)}
            />
            <div
              className="fixed inset-y-0 left-0 w-[86vw] max-w-[360px] z-50 overflow-y-auto lg:hidden fade-up"
              style={{ background: 'var(--bg-shell)', borderRight: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}
            >
              <div className="flex items-center justify-between px-4 pt-4 mb-2">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  筛选条件
                </span>
                <button onClick={() => setSidebarOpen(false)} style={{ color: 'var(--text-muted)' }} aria-label="关闭筛选">
                  <X size={18} />
                </button>
              </div>
              <FilterSidebar
                filters={filters}
                totalActive={activeCount}
                onChange={(f) => {
                  handleFilterChange(f)
                  setSidebarOpen(false)
                }}
                regions={stats?.regions ?? []}
                languages={stats?.languages ?? []}
              />
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 space-y-4">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <SummaryTile
              label="匹配结果"
              value={loading ? '...' : `${result?.total?.toLocaleString() ?? 0}`}
              hint={result ? `第 ${page}/${result.totalPages} 页` : '等待查询结果'}
              icon={<UsersRound size={16} />}
            />
            <SummaryTile
              label="数据覆盖"
              value={stats ? `${stats.regions.length} 地区 / ${stats.languages.length} 语言` : '...'}
              hint="用于筛选统计分布"
              icon={<Layers3 size={16} />}
            />
            <SummaryTile
              label="AI状态样本"
              value={analyzed > 0 ? analyzed.toLocaleString() : '...'}
              hint="统计来自当前数据库状态"
              icon={<Sparkles size={16} />}
            />
          </section>

          <section className="surface-panel px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {loading
                  ? '正在检索 KOL 数据...'
                  : result
                    ? `共 ${result.total.toLocaleString()} 位 KOL，当前展示 ${result.data.length} 条`
                    : '暂无数据'}
              </p>
              {activeCount > 0 && (
                <button
                  onClick={() => {
                    setFilters(EMPTY_FILTERS)
                    setPage(1)
                  }}
                  className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg"
                  style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}
                >
                  <X size={11} /> 清除 {activeCount} 个筛选
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : result && result.data.length > 0 ? (
            <div className="grid grid-cols-1 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {result.data.map((kol) => (
                <KolCard key={kol.userId} kol={kol} onClick={() => setSelectedKol(kol)} />
              ))}
            </div>
          ) : (
            <section className="surface-panel flex flex-col items-center justify-center py-20 gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
                <Search size={28} style={{ color: 'var(--accent)' }} />
              </div>
              <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
                没有找到匹配的 KOL
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                尝试放宽筛选条件，或使用更短的关键词。
              </p>
              {activeCount > 0 && (
                <button
                  onClick={() => {
                    setFilters(EMPTY_FILTERS)
                    setPage(1)
                  }}
                  className="text-sm px-4 py-2 rounded-xl mt-1"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                >
                  重置筛选并重试
                </button>
              )}
            </section>
          )}

          {result && result.totalPages > 1 && (
            <div className="mt-2">
              <Pagination
                page={page}
                totalPages={result.totalPages}
                onPage={(p: number) => {
                  setPage(p)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              />
            </div>
          )}
        </main>
      </div>

      {selectedKol && <KolDetailModal kol={selectedKol} onClose={() => setSelectedKol(null)} />}
    </div>
  )
}

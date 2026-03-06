'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react'
import { PRIMARY_TAGS, GENDERS, SKIN_TONES, TONES } from '@/lib/types'
import clsx from 'clsx'

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

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  regions: { value: string; count: number }[]
  languages: { value: string; count: number }[]
  totalActive: number
}

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-3 px-4 text-sm font-medium transition-colors"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="px-4 pb-4 space-y-2">{children}</div>}
    </div>
  )
}

function CheckItem({
  label,
  checked,
  onChange,
  count,
}: {
  label: string
  checked: boolean
  onChange: () => void
  count?: number
}) {
  return (
    <label
      className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 transition-colors"
      style={{ background: checked ? 'var(--accent-dim)' : 'transparent' }}
    >
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span className="text-sm flex-1" style={{ color: checked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
          {count}
        </span>
      )}
    </label>
  )
}

function toggle(arr: string[], val: string) {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

export default function FilterSidebar({ filters, onChange, regions, languages, totalActive }: Props) {
  return (
    <aside
      className="h-full overflow-y-auto surface-panel"
      style={{ background: 'var(--bg-sidebar)', borderRadius: 20, boxShadow: 'var(--shadow-card)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-4 sticky top-0 z-10"
        style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          >
            <SlidersHorizontal size={14} />
          </div>
          <span className="font-semibold text-sm">筛选条件</span>
        </div>
        {totalActive > 0 && (
          <button
            onClick={() =>
              onChange({
                primaryTags: [],
                gender: [],
                skinTone: [],
                tones: [],
                region: [],
                language: [],
                minFollowers: '',
                maxFollowers: '',
              })
            }
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors"
            style={{ color: 'var(--accent)', background: 'var(--accent-dim)' }}
          >
            <X size={11} /> 清除({totalActive})
          </button>
        )}
      </div>

      <Section title="内容分类">
        <div className="grid grid-cols-2 gap-1.5">
          {PRIMARY_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => onChange({ ...filters, primaryTags: toggle(filters.primaryTags, tag) })}
              className={clsx('text-xs py-1.5 px-2 rounded-lg text-center transition-all duration-200', {
                'font-medium': filters.primaryTags.includes(tag),
              })}
              style={
                filters.primaryTags.includes(tag)
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 8px 16px rgba(15,118,110,0.22)' }
                  : { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
              }
            >
              {tag}
            </button>
          ))}
        </div>
      </Section>

      <Section title="性别">
        {GENDERS.map((g) => (
          <CheckItem
            key={g}
            label={g === '男' ? '男性' : g === '女' ? '女性' : '未知'}
            checked={filters.gender.includes(g)}
            onChange={() => onChange({ ...filters, gender: toggle(filters.gender, g) })}
          />
        ))}
      </Section>

      <Section title="肤色" defaultOpen={false}>
        {SKIN_TONES.map((s) => (
          <CheckItem
            key={s}
            label={s}
            checked={filters.skinTone.includes(s)}
            onChange={() => onChange({ ...filters, skinTone: toggle(filters.skinTone, s) })}
          />
        ))}
      </Section>

      <Section title="调性" defaultOpen={false}>
        {TONES.map((t) => (
          <CheckItem
            key={t}
            label={t}
            checked={filters.tones.includes(t)}
            onChange={() => onChange({ ...filters, tones: toggle(filters.tones, t) })}
          />
        ))}
      </Section>

      {regions.length > 0 && (
        <Section title="地区" defaultOpen={false}>
          {regions.slice(0, 20).map((r) => (
            <CheckItem
              key={r.value}
              label={r.value}
              count={r.count}
              checked={filters.region.includes(r.value)}
              onChange={() => onChange({ ...filters, region: toggle(filters.region, r.value) })}
            />
          ))}
        </Section>
      )}

      {languages.length > 0 && (
        <Section title="语言" defaultOpen={false}>
          {languages.slice(0, 20).map((l) => (
            <CheckItem
              key={l.value}
              label={l.value}
              count={l.count}
              checked={filters.language.includes(l.value)}
              onChange={() => onChange({ ...filters, language: toggle(filters.language, l.value) })}
            />
          ))}
        </Section>
      )}

      <Section title="粉丝数范围" defaultOpen={false}>
        <div className="space-y-2.5">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              最小粉丝数
            </label>
            <input
              type="number"
              placeholder="例如 10000"
              value={filters.minFollowers}
              onChange={(e) => onChange({ ...filters, minFollowers: e.target.value })}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              最大粉丝数
            </label>
            <input
              type="number"
              placeholder="例如 1000000"
              value={filters.maxFollowers}
              onChange={(e) => onChange({ ...filters, maxFollowers: e.target.value })}
              className="w-full text-sm px-3 py-2 rounded-lg outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      </Section>
    </aside>
  )
}

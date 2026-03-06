'use client'

import { useState } from 'react'
import { Users, Play, Heart, MapPin, Globe, Tag, ChevronRight } from 'lucide-react'
import type { KolProfile } from '@/lib/types'
import KolDetailModal from './KolDetailModal'

function fmt(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const TAG_COLORS: Record<string, string> = {
  '科技': '#6366f1', '时尚': '#ec4899', '美妆护肤': '#f472b6', '家居': '#84cc16',
  '实体产品测评': '#f59e0b', '人物关系': '#e879f9', '宠物': '#fb923c', '生活方式': '#34d399',
  '运动': '#38bdf8', '户外': '#4ade80', '旅行': '#2dd4bf', '美食': '#fb7185',
  'DIY': '#a78bfa', '娱乐': '#facc15', '游戏': '#60a5fa', '喜剧': '#fbbf24',
  '艺术': '#c084fc', '学习': '#5eead4', '画面创作': '#818cf8', '知识': '#67e8f9',
  '专业领域': '#94a3b8', '金融': '#4ade80', 'AI': '#6366f1', '音乐': '#f472b6',
}

const GENDER_ICON: Record<string, string> = { '男': '♂', '女': '♀', '未知': '?' }

export default function KolCard({ kol, onClick }: { kol: KolProfile; onClick?: () => void }) {
  const [open, setOpen] = useState(false)
  const tagColor = kol.primaryTag ? (TAG_COLORS[kol.primaryTag] || '#6366f1') : '#6366f1'
  const cover = kol.processedVideos?.[0]?.coverUrl

  return (
    <>
      <article
        onClick={() => onClick ? onClick() : setOpen(true)}
        className="rounded-xl overflow-hidden cursor-pointer group transition-all duration-200"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-light)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,.4)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
          ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
        }}
      >
        {/* Cover strip */}
        <div className="relative h-32 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={kol.nickname || kol.account}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: `${tagColor}10` }}>
              <span className="opacity-30">🎬</span>
            </div>
          )}
          {/* Badge overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          {kol.primaryTag && (
            <span
              className="absolute top-2 left-2 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: tagColor, color: '#fff' }}
            >
              {kol.primaryTag}
            </span>
          )}
          {kol.gender && (
            <span
              className="absolute top-2 right-2 text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold"
              style={{ background: 'rgba(0,0,0,.6)', color: kol.gender === '男' ? '#60a5fa' : kol.gender === '女' ? '#f472b6' : '#94a3b8' }}
            >
              {GENDER_ICON[kol.gender] || '?'}
            </span>
          )}
          {/* Confidence bar */}
          {kol.aiConfidence !== null && (
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(0,0,0,.4)' }}>
              <div
                className="h-full transition-all"
                style={{
                  width: `${(kol.aiConfidence || 0) * 100}%`,
                  background: (kol.aiConfidence || 0) >= 0.8 ? '#22c55e' : (kol.aiConfidence || 0) >= 0.6 ? '#f59e0b' : '#ef4444',
                }}
              />
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3 space-y-2.5">
          {/* Name */}
          <div>
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {kol.nickname || kol.account}
            </p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>@{kol.account}</p>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="flex items-center gap-1">
              <Users size={11} />
              {fmt(kol.followerCount)}
            </span>
            <span className="flex items-center gap-1">
              <Play size={11} />
              {fmt(kol.averagePlayCount)}
            </span>
            <span className="flex items-center gap-1">
              <Heart size={11} />
              {fmt(kol.averageLikeCount)}
            </span>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-1">
            {kol.region && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                <MapPin size={9} />{kol.region}
              </span>
            )}
            {kol.language && (
              <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                <Globe size={9} />{kol.language}
              </span>
            )}
            {kol.skinTone && (
              <span className="text-xs px-1.5 py-0.5 rounded"
                style={{ background: 'var(--border)', color: 'var(--text-secondary)' }}>
                {kol.skinTone}
              </span>
            )}
          </div>

          {/* Secondary tags */}
          {kol.secondaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {kol.secondaryTags.slice(0, 3).map(t => (
                <span key={t} className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: `${tagColor}20`, color: tagColor }}>
                  <Tag size={8} className="inline mr-0.5" />{t}
                </span>
              ))}
              {kol.secondaryTags.length > 3 && (
                <span className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                  +{kol.secondaryTags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-1">
            <span className="text-xs flex items-center gap-0.5 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              查看详情 <ChevronRight size={11} />
            </span>
          </div>
        </div>
      </article>

      {open && <KolDetailModal kol={kol} onClose={() => setOpen(false)} />}
    </>
  )
}

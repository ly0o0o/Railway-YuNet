'use client'

import { Users, Play, Heart, MapPin, Globe, Tag, ChevronRight } from 'lucide-react'
import type { KolProfile } from '@/lib/types'

function fmt(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const TAG_COLORS: Record<string, string> = {
  科技: '#0f766e',
  时尚: '#dc2626',
  美妆护肤: '#db2777',
  家居: '#65a30d',
  实体产品测评: '#d97706',
  人物关系: '#9333ea',
  宠物: '#ea580c',
  生活方式: '#0d9488',
  运动: '#0284c7',
  户外: '#16a34a',
  旅行: '#0891b2',
  美食: '#e11d48',
  DIY: '#7c3aed',
  娱乐: '#ca8a04',
  游戏: '#2563eb',
  喜剧: '#c2410c',
  艺术: '#7e22ce',
  学习: '#0e7490',
  画面创作: '#0369a1',
  知识: '#0f766e',
  专业领域: '#475569',
  金融: '#047857',
  AI: '#155e75',
  音乐: '#be123c',
}

const GENDER_ICON: Record<string, string> = { 男: '♂', 女: '♀', 未知: '?' }

export default function KolCard({ kol, onClick }: { kol: KolProfile; onClick?: () => void }) {
  const tagColor = kol.primaryTag ? (TAG_COLORS[kol.primaryTag] || '#0f766e') : '#0f766e'
  const cover = kol.processedVideos?.[0]?.coverUrl

  return (
    <article
      onClick={onClick}
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="relative h-36 overflow-hidden" style={{ background: 'var(--bg-card-hover)' }}>
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={kol.nickname || kol.account}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl" style={{ background: `${tagColor}1a` }}>
            <span className="opacity-40">🎬</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        {kol.primaryTag && (
          <span
            className="absolute top-2 left-2 text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: tagColor, color: '#fff' }}
          >
            {kol.primaryTag}
          </span>
        )}

        {kol.gender && (
          <span
            className="absolute top-2 right-2 text-xs w-6 h-6 rounded-full flex items-center justify-center font-semibold"
            style={{ background: 'rgba(15, 15, 15, 0.58)', color: '#fff' }}
          >
            {GENDER_ICON[kol.gender] || '?'}
          </span>
        )}

        {kol.aiConfidence !== null && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(0,0,0,.28)' }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${(kol.aiConfidence || 0) * 100}%`,
                background:
                  (kol.aiConfidence || 0) >= 0.8
                    ? 'var(--success)'
                    : (kol.aiConfidence || 0) >= 0.6
                      ? 'var(--warning)'
                      : 'var(--danger)',
              }}
            />
          </div>
        )}
      </div>

      <div className="p-3.5 space-y-2.5">
        <div>
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {kol.nickname || kol.account}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            @{kol.account}
          </p>
        </div>

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

        <div className="flex flex-wrap gap-1.5">
          {kol.region && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <MapPin size={10} />
              {kol.region}
            </span>
          )}
          {kol.language && (
            <span
              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <Globe size={10} />
              {kol.language}
            </span>
          )}
          {kol.skinTone && (
            <span
              className="text-[11px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              {kol.skinTone}
            </span>
          )}
        </div>

        {kol.secondaryTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {kol.secondaryTags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[11px] px-1.5 py-0.5 rounded inline-flex items-center gap-1"
                style={{ background: `${tagColor}1f`, color: tagColor }}
              >
                <Tag size={9} />
                {t}
              </span>
            ))}
            {kol.secondaryTags.length > 3 && (
              <span
                className="text-[11px] px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
              >
                +{kol.secondaryTags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <span className="text-xs flex items-center gap-0.5" style={{ color: 'var(--text-muted)' }}>
            查看详情 <ChevronRight size={11} />
          </span>
        </div>
      </div>
    </article>
  )
}

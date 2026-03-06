'use client'

import { X, Users, Play, Heart, MapPin, Globe, Tag, Calendar, ExternalLink, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { KolProfile } from '@/lib/types'

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

function fmt(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl text-center" style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
      <div className="flex justify-center mb-1" style={{ color: 'var(--accent)' }}>
        {icon}
      </div>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
    </div>
  )
}

export default function KolDetailModal({ kol, onClose }: { kol: KolProfile; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const tagColor = kol.primaryTag ? (TAG_COLORS[kol.primaryTag] || '#0f766e') : '#0f766e'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const ytUrl = `https://youtube.com/channel/${kol.userId}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(33, 26, 15, 0.55)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl fade-up"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,.92)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          aria-label="关闭详情"
        >
          <X size={16} />
        </button>

        <div className="relative h-52 overflow-hidden rounded-t-3xl" style={{ background: `${tagColor}14` }}>
          {kol.processedVideos && kol.processedVideos.length > 0 ? (
            <div className="flex gap-1 h-full">
              {kol.processedVideos.slice(0, 4).map((v, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={v.videoId}
                  src={v.coverUrl}
                  alt={v.title || `video ${i + 1}`}
                  className="flex-1 object-cover h-full"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-20">🎬</div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

          {kol.primaryTag && (
            <div className="absolute bottom-4 left-5">
              <span className="text-sm font-semibold px-3 py-1.5 rounded-full" style={{ background: tagColor, color: '#fff' }}>
                {kol.primaryTag}
              </span>
            </div>
          )}

          {kol.aiConfidence !== null && (
            <div className="absolute bottom-4 right-5">
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: (kol.aiConfidence || 0) >= 0.8 ? 'rgba(22,163,74,.2)' : 'rgba(217,119,6,.2)',
                  color: (kol.aiConfidence || 0) >= 0.8 ? 'var(--success)' : 'var(--warning)',
                  border:
                    (kol.aiConfidence || 0) >= 0.8
                      ? '1px solid rgba(22,163,74,.42)'
                      : '1px solid rgba(217,119,6,.42)',
                }}
              >
                AI置信度 {((kol.aiConfidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {kol.nickname || kol.account}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                @{kol.account}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <a
                href={ytUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: '#dc2626', color: '#fff' }}
              >
                <ExternalLink size={12} /> YouTube
              </a>
              <button
                onClick={() => copy(kol.email || kol.userId)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {kol.email ? '复制邮箱' : '复制ID'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<Users size={16} />} label="粉丝数" value={fmt(kol.followerCount)} />
            <StatBox icon={<Play size={16} />} label="平均播放" value={fmt(kol.averagePlayCount)} />
            <StatBox icon={<Heart size={16} />} label="平均点赞" value={fmt(kol.averageLikeCount)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {kol.gender && (
              <span
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {kol.gender === '男' ? '♂' : kol.gender === '女' ? '♀' : '?'} {kol.gender}
              </span>
            )}
            {kol.skinTone && (
              <span
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                {kol.skinTone}
              </span>
            )}
            {kol.region && (
              <span
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                <MapPin size={13} /> {kol.region}
              </span>
            )}
            {kol.language && (
              <span
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                <Globe size={13} /> {kol.language}
              </span>
            )}
          </div>

          {kol.tones.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                调性标签
              </p>
              <div className="flex flex-wrap gap-2">
                {kol.tones.map((t) => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {kol.secondaryTags.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                细分标签
              </p>
              <div className="flex flex-wrap gap-2">
                {kol.secondaryTags.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: `${tagColor}18`, color: tagColor }}
                  >
                    <Tag size={10} />
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {kol.aiReason && (
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>
                AI 分析依据
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {kol.aiReason}
              </p>
            </div>
          )}

          {kol.processedVideos && kol.processedVideos.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                近期视频
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kol.processedVideos.slice(0, 6).map((v) => (
                  <a
                    key={v.videoId}
                    href={`https://youtube.com/watch?v=${v.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg overflow-hidden group relative aspect-video block"
                    style={{ background: 'var(--bg-card-hover)' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={v.coverUrl}
                      alt={v.title || ''}
                      className="w-full h-full object-cover group-hover:opacity-85 transition-opacity"
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    {v.title && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-all flex items-end">
                        <p className="text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2" style={{ color: '#fff' }}>
                          {v.title}
                        </p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between items-center pt-2 flex-wrap gap-1" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={11} /> 更新于 {new Date(kol.updatedAt).toLocaleDateString('zh-CN')}
            </span>
            {kol.email && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>邮箱: {kol.email}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { X, Users, Play, Heart, MapPin, Globe, Tag, Calendar, ExternalLink, Copy, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { KolProfile } from '@/lib/types'

const TAG_COLORS: Record<string, string> = {
  '科技': '#6366f1', '时尚': '#ec4899', '美妆护肤': '#f472b6', '家居': '#84cc16',
  '实体产品测评': '#f59e0b', '人物关系': '#e879f9', '宠物': '#fb923c', '生活方式': '#34d399',
  '运动': '#38bdf8', '户外': '#4ade80', '旅行': '#2dd4bf', '美食': '#fb7185',
  'DIY': '#a78bfa', '娱乐': '#facc15', '游戏': '#60a5fa', '喜剧': '#fbbf24',
  '艺术': '#c084fc', '学习': '#5eead4', '画面创作': '#818cf8', '知识': '#67e8f9',
  '专业领域': '#94a3b8', '金融': '#4ade80', 'AI': '#6366f1', '音乐': '#f472b6',
}

function fmt(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg text-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex justify-center mb-1" style={{ color: 'var(--accent)' }}>{icon}</div>
      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

export default function KolDetailModal({ kol, onClose }: { kol: KolProfile; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const tagColor = kol.primaryTag ? (TAG_COLORS[kol.primaryTag] || '#6366f1') : '#6366f1'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const ytUrl = `https://youtube.com/channel/${kol.userId}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}
        >
          <X size={16} />
        </button>

        {/* Header with covers */}
        <div className="relative h-44 overflow-hidden rounded-t-2xl" style={{ background: `${tagColor}15` }}>
          {kol.processedVideos && kol.processedVideos.length > 0 ? (
            <div className="flex gap-1 h-full">
              {kol.processedVideos.slice(0, 4).map((v, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={v.videoId} src={v.coverUrl} alt={v.title || `video ${i + 1}`}
                  className="flex-1 object-cover h-full"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                  style={{ opacity: 1 - i * 0.12 }}
                />
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl opacity-10">🎬</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Primary tag on cover */}
          {kol.primaryTag && (
            <div className="absolute bottom-4 left-5">
              <span className="text-sm font-bold px-3 py-1.5 rounded-full"
                style={{ background: tagColor, color: '#fff' }}>
                {kol.primaryTag}
              </span>
            </div>
          )}

          {/* Confidence badge */}
          {kol.aiConfidence !== null && (
            <div className="absolute bottom-4 right-5">
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: (kol.aiConfidence || 0) >= 0.8 ? '#22c55e20' : '#f59e0b20',
                  color: (kol.aiConfidence || 0) >= 0.8 ? '#22c55e' : '#f59e0b',
                  border: `1px solid ${(kol.aiConfidence || 0) >= 0.8 ? '#22c55e40' : '#f59e0b40'}`
                }}>
                AI置信度 {((kol.aiConfidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-5">
          {/* Name + account row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {kol.nickname || kol.account}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{kol.account}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <a href={ytUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#ff0000', color: '#fff' }}>
                <ExternalLink size={12} /> YouTube
              </a>
              <button
                onClick={() => copy(kol.email || kol.userId)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {kol.email ? 'Copy Email' : 'Copy ID'}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<Users size={16} />} label="粉丝数" value={fmt(kol.followerCount)} />
            <StatBox icon={<Play size={16} />} label="平均播放" value={fmt(kol.averagePlayCount)} />
            <StatBox icon={<Heart size={16} />} label="平均点赞" value={fmt(kol.averageLikeCount)} />
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {kol.gender && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium"
                style={{
                  background: kol.gender === '男' ? '#60a5fa20' : kol.gender === '女' ? '#f472b620' : '#94a3b820',
                  color: kol.gender === '男' ? '#60a5fa' : kol.gender === '女' ? '#f472b6' : '#94a3b8',
                }}>
                {kol.gender === '男' ? '♂' : kol.gender === '女' ? '♀' : '?'} {kol.gender}
              </span>
            )}
            {kol.skinTone && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                🎨 {kol.skinTone}
              </span>
            )}
            {kol.region && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <MapPin size={13} /> {kol.region}
              </span>
            )}
            {kol.language && (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full"
                style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <Globe size={13} /> {kol.language}
              </span>
            )}
          </div>

          {/* Tones */}
          {kol.tones.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>调性标签</p>
              <div className="flex flex-wrap gap-2">
                {kol.tones.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Secondary tags */}
          {kol.secondaryTags.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>细分标签</p>
              <div className="flex flex-wrap gap-2">
                {kol.secondaryTags.map(t => (
                  <span key={t} className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                    style={{ background: `${tagColor}15`, color: tagColor }}>
                    <Tag size={10} />{t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* AI Reason */}
          {kol.aiReason && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--accent)' }}>AI 分析依据</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{kol.aiReason}</p>
            </div>
          )}

          {/* Recent videos */}
          {kol.processedVideos && kol.processedVideos.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>近期视频</p>
              <div className="grid grid-cols-3 gap-2">
                {kol.processedVideos.slice(0, 6).map(v => (
                  <a key={v.videoId} href={`https://youtube.com/watch?v=${v.videoId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="rounded-lg overflow-hidden group relative aspect-video block"
                    style={{ background: 'var(--bg-base)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.coverUrl} alt={v.title || ''} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    {v.title && (
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-end">
                        <p className="text-xs p-1.5 opacity-0 group-hover:opacity-100 transition-opacity line-clamp-2"
                          style={{ color: '#fff' }}>{v.title}</p>
                      </div>
                    )}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
              <Calendar size={11} />
              更新于 {new Date(kol.updatedAt).toLocaleDateString('zh-CN')}
            </span>
            {kol.email && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                📧 {kol.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

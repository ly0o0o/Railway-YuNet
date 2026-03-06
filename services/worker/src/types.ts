// ─── Milvus 原始字段 ────────────────────────────────────────────────────────
export type KolPlatform = 'TIKTOK' | 'INSTAGRAM' | 'YOUTUBE'

export interface VideoMixedVectorMilvusData {
  id?: string
  videoId: string
  userId: string
  account: string
  platform: KolPlatform
  nickname?: string
  followerCount?: number
  averagePlayCount?: number
  averageLikeCount?: number
  lastPublishedTime?: number
  region?: string
  signature?: string
  email?: string
  language?: string
  title?: string
  description?: string
  cover?: string
  publishedAt?: number
  createdAt?: number
  updatedAt?: number
}

// ─── 聚合后的博主数据（内存中使用）────────────────────────────────────────────
export interface KolWithVideos {
  // 博主级别信息
  userId: string
  account: string
  platform: KolPlatform
  nickname?: string
  email?: string
  region?: string
  language?: string
  signature?: string
  followerCount?: number
  averagePlayCount?: number
  averageLikeCount?: number
  lastPublishedTime?: number
  // 最近 6 条视频
  videos: VideoItem[]
}

export interface VideoItem {
  videoId: string
  title?: string
  publishedAt?: number
  coverUrl: string // 拼接后的 easykol URL
}

// ─── AI 分析结果 ─────────────────────────────────────────────────────────────
export type SkinTone = '亚裔' | '黑人' | '拉丁裔' | '印度裔' | '白人' | '其他'
export type Tone = '奢侈' | '可爱' | '低俗擦边' | '高颜值' | '普通人'
export type Gender = '男' | '女' | '未知'

export type PrimaryTag =
  | '科技' | '时尚' | '美妆护肤' | '家居' | '实体产品测评'
  | '人物关系' | '宠物' | '生活方式' | '运动' | '户外'
  | '旅行' | '美食' | 'DIY' | '娱乐' | '游戏'
  | '喜剧' | '艺术' | '学习' | '画面创作' | '知识'
  | '专业领域' | '金融' | 'AI' | '音乐'

export interface AIAnalysisResult {
  skinTone: SkinTone
  tones: Tone[]
  gender: Gender
  primaryTag: PrimaryTag
  secondaryTags: string[]
  confidence: number
  reason: string
}

// ─── Worker 状态 ──────────────────────────────────────────────────────────────
export type AiStatus = 'pending' | 'done' | 'error' | 'no_image'

// ─── PostgreSQL 写入结构 ──────────────────────────────────────────────────────
export interface KolProfileRow {
  userId: string
  account: string
  platform: string
  nickname?: string
  email?: string
  region?: string
  language?: string
  signature?: string
  followerCount?: number
  averagePlayCount?: number
  averageLikeCount?: number
  lastPublishedTime?: number
  skinTone?: string
  tones?: string[]
  gender?: string
  primaryTag?: string
  secondaryTags?: string[]
  aiStatus: AiStatus
  aiConfidence?: number
  aiReason?: string
  processedVideos?: VideoItem[]
}

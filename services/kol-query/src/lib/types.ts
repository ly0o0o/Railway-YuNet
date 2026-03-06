export interface KolProfile {
  id: number
  userId: string
  account: string
  platform: string
  nickname: string | null
  email: string | null
  region: string | null
  language: string | null
  signature: string | null
  followerCount: number | null
  averagePlayCount: number | null
  averageLikeCount: number | null
  lastPublishedTime: number | null
  skinTone: string | null
  tones: string[]
  gender: string | null
  primaryTag: string | null
  secondaryTags: string[]
  aiStatus: string
  aiConfidence: number | null
  aiReason: string | null
  processedVideos: VideoItem[] | null
  createdAt: string
  updatedAt: string
}

export interface VideoItem {
  videoId: string
  title?: string
  publishedAt?: number
  coverUrl: string
}

export interface KolQueryParams {
  page: number
  pageSize: number
  search: string
  primaryTags: string[]
  gender: string[]
  region: string[]
  language: string[]
  skinTone: string[]
  tones: string[]
  secondaryTags: string[]
  minFollowers?: number
  maxFollowers?: number
  sort: 'follower_count' | 'average_play_count' | 'average_like_count' | 'last_published_time' | 'created_at'
  sortDir: 'asc' | 'desc'
}

export interface KolQueryResult {
  data: KolProfile[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const PRIMARY_TAGS = [
  '科技', '时尚', '美妆护肤', '家居', '实体产品测评',
  '人物关系', '宠物', '生活方式', '运动', '户外',
  '旅行', '美食', 'DIY', '娱乐', '游戏',
  '喜剧', '艺术', '学习', '画面创作', '知识',
  '专业领域', '金融', 'AI', '音乐',
] as const

export const GENDERS = ['男', '女', '未知'] as const
export const SKIN_TONES = ['亚裔', '黑人', '拉丁裔', '印度裔', '白人', '其他'] as const
export const TONES = ['奢侈', '可爱', '低俗擦边', '高颜值', '普通人'] as const

import { createVertex } from '@ai-sdk/google-vertex'
import { generateObject } from 'ai'
import { z } from 'zod'
import { config } from './config.js'
import type { AIAnalysisResult, VideoItem } from './types.js'

// ─── Vertex AI 客户端 ────────────────────────────────────────────────────────
const vertexProvider = createVertex({
  project:  config.vertex.projectId,
  location: 'us-central1',
  googleAuthOptions: {
    credentials: {
      client_email: config.vertex.clientEmail,
      private_key:  config.vertex.privateKey,
    },
  },
})

const model = vertexProvider('gemini-2.0-flash-001')

// ─── Zod Schema（强制 AI 输出结构化 JSON）───────────────────────────────────
const AIResultSchema = z.object({
  skinTone: z.enum(['亚裔', '黑人', '拉丁裔', '印度裔', '白人', '其他']),
  tones: z.array(z.enum(['奢侈', '可爱', '低俗擦边', '高颜值', '普通人'])).min(0).max(5),
  gender: z.enum(['男', '女', '未知']),
  primaryTag: z.enum([
    '科技', '时尚', '美妆护肤', '家居', '实体产品测评',
    '人物关系', '宠物', '生活方式', '运动', '户外',
    '旅行', '美食', 'DIY', '娱乐', '游戏',
    '喜剧', '艺术', '学习', '画面创作', '知识',
    '专业领域', '金融', 'AI',
  ]),
  secondaryTags: z.array(z.string()).min(0).max(10),
  confidence: z.number().min(0).max(1),
  reason: z.string().max(200),
})

// ─── 检测图片是否可访问（HEAD 请求）─────────────────────────────────────────
async function isImageAccessible(url: string): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), config.worker.imageTimeoutMs)
    const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

// ─── 构建发给 AI 的 message content ─────────────────────────────────────────
async function buildImageContent(
  videos: VideoItem[]
): Promise<{ availableVideos: VideoItem[]; parts: object[] }> {
  const availableVideos: VideoItem[] = []

  for (const v of videos) {
    const ok = await isImageAccessible(v.coverUrl)
    if (ok) availableVideos.push(v)
    else console.log(`[ai] Image not accessible, skipping: ${v.coverUrl}`)
  }

  const parts: object[] = [
    {
      type: 'text',
      text: [
        '以下是一位 YouTube 博主最近发布的视频封面图和对应标题。',
        '请根据这些内容分析该博主的整体风格和内容方向。',
        '',
        availableVideos.map((v, i) =>
          `视频 ${i + 1}：${v.title ?? '（无标题）'}`
        ).join('\n'),
      ].join('\n'),
    },
    ...availableVideos.map(v => ({
      type: 'image',
      image: v.coverUrl,
    })),
  ]

  return { availableVideos, parts }
}

// ─── 核心：分析单个博主 ─────────────────────────────────────────────────────
export async function analyzeKol(
  videos: VideoItem[],
  retryCount = 0
): Promise<AIAnalysisResult | null> {
  const { availableVideos, parts } = await buildImageContent(videos)

  if (availableVideos.length === 0) {
    return null // 调用方处理 no_image
  }

  const SYSTEM_PROMPT = `你是一位专业的社交媒体博主内容分析师。
根据提供的视频封面图和标题，综合判断博主的内容方向与风格。

判断规则：
- 肤色/调性/性别：基于封面中出现的主要人物；若无人物，肤色填"其他"，性别填"未知"
- primaryTag：选择最贴合博主整体内容方向的一个一级标签
- secondaryTags：可选多个最匹配的二级标签（跨一级标签也可以）
- confidence：你对本次判断的置信度，0-1 之间
- reason：用简短中文（100字以内）说明判断依据`

  try {
    const { object } = await generateObject({
      model,
      schema: AIResultSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: parts as any,
        },
      ],
    })

    return object as AIAnalysisResult
  } catch (err) {
    if (retryCount < config.worker.aiMaxRetries) {
      const delay = Math.pow(2, retryCount) * 1000
      console.warn(`[ai] Retry ${retryCount + 1} after ${delay}ms. Error: ${err}`)
      await new Promise(r => setTimeout(r, delay))
      return analyzeKol(videos, retryCount + 1)
    }
    console.error(`[ai] Max retries reached:`, err)
    return null
  }
}

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

const model = vertexProvider(config.vertex.model)

// ─── Zod Schema（强制 AI 输出结构化 JSON）───────────────────────────────────
const AIResultSchema = z.object({
  skinTone:     z.enum(['亚裔', '黑人', '拉丁裔', '印度裔', '白人', '其他']),
  tones:        z.array(z.enum(['奢侈', '可爱', '低俗擦边', '高颜值', '普通人'])).min(0).max(5),
  gender:       z.enum(['男', '女', '未知']),
  primaryTag:   z.enum([
    '科技', '时尚', '美妆护肤', '家居', '实体产品测评',
    '人物关系', '宠物', '生活方式', '运动', '户外',
    '旅行', '美食', 'DIY', '娱乐', '游戏',
    '喜剧', '艺术', '学习', '画面创作', '知识',
    '专业领域', '金融', 'AI', '音乐',
  ]),
  secondaryTags: z.array(z.string()).min(0).max(10),
  confidence:   z.number().min(0).max(1),
  reason:       z.string().max(200),
})

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
你是一位专业的社交媒体博主内容分析师。我会提供同一位 YouTube 博主最近发布的多张视频封面图及对应标题，请综合所有内容做出统一判断。

### 核心规则
1. 只返回一个 JSON 对象，不允许返回数组。
2. 综合所有图片和标题做整体判断，不要逐图分析。
3. 若封面出现多人，聚焦画面中心或出现最频繁的主要人物。
4. 只输出纯 JSON，不加 Markdown 代码块，不加任何解释文字。

### 字段说明与取值规范

**skinTone**（肤色）：从以下枚举中选一个：亚裔 | 黑人 | 拉丁裔 | 印度裔 | 白人 | 其他
若封面中无人物出现，填"其他"。

**tones**（调性）：数组，可多选：奢侈 | 可爱 | 低俗擦边 | 高颜值 | 普通人
若均不适用，返回空数组 []。

**gender**（性别）：男 | 女 | 未知
若封面无人物或无法判断，填"未知"。

**primaryTag**（一级标签）：选择最贴合的一个：
科技 | 时尚 | 美妆护肤 | 家居 | 实体产品测评 | 人物关系 | 宠物 |
生活方式 | 运动 | 户外 | 旅行 | 美食 | DIY | 娱乐 | 游戏 |
喜剧 | 艺术 | 学习 | 画面创作 | 知识 | 专业领域 | 金融 | AI | 音乐

**secondaryTags**（二级标签）：数组，可多选，仅从以下映射中选取：
科技 → 手机3C/PC硬件/智能穿戴/绿色能源-储能/智能家居与安全/数码桌搭/科技DIY/科技资讯
时尚 → 穿搭带货/泛时尚/街拍/模特/奢侈品
美妆护肤 → 美妆/护肤/美发/美甲
家居 → 软装美学/硬核家装DIY/室内设计/清洁收纳/园艺/家具制作翻修
实体产品测评 → 家居好物/超市购物/折扣信息/家用电器/开箱/淘二手/户外设备/运动装备/摄影器材/电脑软件推荐/手机软件推荐
人物关系 → 情侣/亲子/婴儿/家长/情感/LGBTQ
宠物 → 宠物猫/宠物狗/爬宠
生活方式 → 生活VLOG/精致生活/居家生活/居家办公/农场生活/奢华生活/第一视角POV
运动 → 健身/瑜伽/跳舞/骑行/hiking/其他户外运动/专业运动员
户外 → 房车/露营/野外生存/小木屋/钓鱼/海上航行/公路旅行
旅行 → 城市旅行/户外大自然/跨国旅行
美食 → 吃播/美食探店/烹饪/健康饮食/减脂餐/厨艺教授
DIY → 小手工/木工/模型/道具制作/3D打印/科学发明/家用工具箱
娱乐 → 挑战/整蛊/小游戏/街头采访/Cosplay/影视/动漫/创意视频/ASMR
游戏 → 电脑游戏/手游/主机游戏/游戏桌搭
喜剧 → 搞笑段子/小剧场/脱口秀
艺术 → 手绘/数字绘画/设计师/歌手/乐器/专业舞蹈/街头艺术
学习 → 学习VLOG/学习考试升学技巧/学生-校园生活
画面创作 → 摄影教程/视频特效教程/图片处理教程
知识 → 科普教育/人文历史/自然-气候-灾防/书籍分享/手机软件分享/生活妙招/趣味知识/新闻
专业领域 → 软件开发/UX-UI设计/法律-合规/移民-留学政策/税务筹划/职场tips/医生/农业
金融 → 个人理财/投资交易/Web3-加密货币/商业科普
AI → AI新闻资讯/AI生产力工具/AI创作-绘画/AI软件推荐/AI硬件-芯片/AI教程-科普
音乐 → 纯音乐/歌曲翻唱/音乐制作/乐器演奏/音乐评测/歌单推荐/音乐人vlog

**confidence**（置信度）：0~1 的小数，反映判断把握程度。

**reason**（判断依据）：100字以内中文，说明主要判断依据。

### 输出示例
{
  "skinTone": "亚裔",
  "tones": ["高颜值", "普通人"],
  "gender": "女",
  "primaryTag": "美妆护肤",
  "secondaryTags": ["美妆", "护肤", "美发"],
  "confidence": 0.92,
  "reason": "封面均为女性近景妆容展示，标题含化妆教程和护肤测评关键词，判断方向明确。"
}
`.trim()

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
  // 并行检测所有图片可访问性（S1 修复：原为串行，最坏 6 张 * 3s = 18s）
  const checks = await Promise.all(
    videos.map(async v => ({ v, ok: await isImageAccessible(v.coverUrl) }))
  )
  const availableVideos = checks.filter(c => c.ok).map(c => c.v)

  checks
    .filter(c => !c.ok)
    .forEach(c => console.log(`[ai] Image not accessible, skipping: ${c.v.coverUrl}`))

  const titleList = availableVideos
    .map((v, i) => `视频 ${i + 1}：${v.title ?? '（无标题）'}`)
    .join('\n')

  const parts: object[] = [
    {
      type: 'text',
      text: [
        `以下是该博主最近 ${availableVideos.length} 个视频的封面图和对应标题，请综合分析：`,
        '',
        titleList,
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

  try {
    const { object } = await generateObject({
      model,
      schema:      AIResultSchema,
      system:      SYSTEM_PROMPT,
      temperature: 0.1,
      messages: [
        {
          role:    'user',
          content: parts as any,
        },
      ],
    })

    console.log(
      `[ai] done | ${object.primaryTag} | [${object.secondaryTags.join(', ')}] | gender=${object.gender} | skinTone=${object.skinTone} | confidence=${object.confidence.toFixed(2)}`
    )

    return object as AIAnalysisResult
  } catch (err) {
    if (retryCount < config.worker.aiMaxRetries) {
      const delay = Math.pow(2, retryCount) * 1000
      console.warn(`[ai] Retry ${retryCount + 1} after ${delay}ms. Error: ${err}`)
      await new Promise(r => setTimeout(r, delay))
      return analyzeKol(videos, retryCount + 1)
    }
    console.error(`[ai] Max retries reached:`, err)
    throw err  // 抛出让 worker catch 正确标记 error（S0 修复）
  }
}

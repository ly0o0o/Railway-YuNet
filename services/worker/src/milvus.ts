import { MilvusClient } from '@zilliz/milvus2-sdk-node'
import { config } from './config.js'
import type { VideoMixedVectorMilvusData, KolWithVideos, VideoItem } from './types.js'

let client: MilvusClient | null = null

export function createMilvusClient(): MilvusClient {
  if (!client) {
    client = new MilvusClient({
      address: config.milvus.address,
      token:   config.milvus.token,
    })
    console.log('[milvus] Client instance created')
  }
  return client
}

function getClient(): MilvusClient {
  if (!client) throw new Error('[milvus] Client not initialized. Call createMilvusClient() first.')
  return client
}

// ─── 带退避重试的 query ───────────────────────────────────────────────────────
async function queryWithRetry(
  params: Parameters<MilvusClient['query']>[0],
  retries = config.milvus.retries,
  delayMs = config.milvus.retryDelay,
): Promise<ReturnType<MilvusClient['query']>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await getClient().query({ ...params, timeout: config.milvus.timeout })
    if ((res as any).status?.code === 0 || !(res as any).status) {
      return res
    }
    const errMsg = `Milvus query failed: code=${(res as any).status?.code}, reason=${(res as any).status?.reason}`
    if (attempt === retries) throw new Error(errMsg)
    const wait = delayMs * Math.pow(1.5, attempt)
    console.warn(`[milvus] query retry ${attempt + 1}/${retries} after ${wait}ms — ${errMsg}`)
    await new Promise(r => setTimeout(r, wait))
  }
  throw new Error('[milvus] unreachable')
}

// ─── 优雅关闭 ─────────────────────────────────────────────────────────────────
export async function closeMilvusClient(): Promise<void> {
  if (client) {
    try {
      await client.closeConnection()
      console.log('[milvus] Connection closed gracefully')
    } catch (err) {
      console.error('[milvus] Error closing connection:', err)
    } finally {
      client = null
    }
  }
}

const OUTPUT_FIELDS = [
  'videoId', 'userId', 'account', 'platform',
  'nickname', 'followerCount', 'averagePlayCount', 'averageLikeCount',
  'lastPublishedTime', 'region', 'signature', 'email', 'language',
  'title', 'publishedAt',
] as const

// ─── 拼接封面图 URL ──────────────────────────────────────────────────────────
function buildCoverUrl(userId: string, videoId: string): string {
  return `${config.image.baseUrl}/cover/youtube/${userId}/${videoId}.jpg`
}

// ─── 将原始记录 Map 聚合为 KolWithVideos 数组 ────────────────────────────────
function buildKolsFromMap(grouped: Map<string, VideoMixedVectorMilvusData[]>): KolWithVideos[] {
  const kols: KolWithVideos[] = []

  for (const [userId, records] of grouped) {
    const latest = records.reduce((a, b) =>
      (b.publishedAt ?? 0) > (a.publishedAt ?? 0) ? b : a
    )
    const top6 = [...records]
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0))
      .slice(0, 6)

    kols.push({
      userId,
      account:           latest.account,
      platform:          latest.platform,
      nickname:          latest.nickname,
      email:             latest.email,
      region:            latest.region,
      language:          latest.language,
      signature:         latest.signature,
      followerCount:     latest.followerCount,
      averagePlayCount:  latest.averagePlayCount,
      averageLikeCount:  latest.averageLikeCount,
      lastPublishedTime: latest.lastPublishedTime,
      videos: top6.map(r => ({
        videoId:     r.videoId,
        title:       r.title,
        publishedAt: r.publishedAt,
        coverUrl:    buildCoverUrl(userId, r.videoId),
      })),
    })
  }

  return kols
}

/**
 * 两阶段批量拉取：
 *   阶段 1 — offset=0 拉一批记录，提取本批新出现的 userId
 *   阶段 2 — 用 userId in [...] 反查完整视频数据
 *
 * 核心优势：offset 永远为 0，彻底规避 Zilliz Cloud offset+limit<=16384 限制。
 * 排除已处理 userId 靠过滤表达式，集合数据自然「缩小」，下一批总能拿到新数据。
 */
export async function fetchKolBatch(
  excludeUserIds: Set<string>,
  batchSize = config.milvus.pageSize,
): Promise<KolWithVideos[]> {
  const collection = config.milvus.collection

  // ── 阶段 1：拉一批样本，找出本批 userId ──────────────────────────────────
  const excludeList = [...excludeUserIds]
  const baseFilter  = 'platform == "YOUTUBE"'
  const filter = excludeList.length > 0
    ? `${baseFilter} and userId not in [${excludeList.map(id => `"${id}"`).join(',')}]`
    : baseFilter

  const sampleRes = await queryWithRetry({
    collection_name: collection,
    filter,
    output_fields:   ['userId'],
    limit:           batchSize,
    offset:          0,
  })

  const sampleRows = (sampleRes.data ?? []) as { userId: string }[]
  if (sampleRows.length === 0) return []

  const uniqueUserIds = [...new Set(
    sampleRows.map(r => r.userId).filter(Boolean)
  )]

  console.log(
    `[milvus] Phase-1: ${sampleRows.length} records → ${uniqueUserIds.length} new KOLs`
  )

  // ── 阶段 2：反查这批 userId 的完整视频数据 ────────────────────────────────
  const videoFilter = `userId in [${uniqueUserIds.map(id => `"${id}"`).join(',')}]`
  const videosRes   = await queryWithRetry({
    collection_name: collection,
    filter:          videoFilter,
    output_fields:   OUTPUT_FIELDS as unknown as string[],
    limit:           uniqueUserIds.length * 10, // 每人最多 10 条，取 top-6
    offset:          0,
  })

  const videoRows = (videosRes.data ?? []) as VideoMixedVectorMilvusData[]

  // ── 按 userId 分组 → 聚合为 KolWithVideos ────────────────────────────────
  const grouped = new Map<string, VideoMixedVectorMilvusData[]>()
  for (const row of videoRows) {
    if (!row.userId) continue
    const bucket = grouped.get(row.userId) ?? []
    bucket.push(row)
    grouped.set(row.userId, bucket)
  }

  const kols = buildKolsFromMap(grouped)
  console.log(`[milvus] Phase-2: fetched videos for ${kols.length} KOLs`)
  return kols
}

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

// ─── 拼接封面图 URL ──────────────────────────────────────────────────────────
function buildCoverUrl(userId: string, videoId: string): string {
  return `${config.image.baseUrl}/cover/youtube/${userId}/${videoId}.jpg`
}

// ─── 从 Milvus 分页拉取所有 YouTube 记录，聚合为博主维度 ─────────────────────
export async function fetchKolsFromMilvus(
  targetCount: number
): Promise<KolWithVideos[]> {
  const collection = config.milvus.collection
  const pageSize   = config.milvus.pageSize

  // 按 userId 在内存中聚合: userId → 原始记录列表
  const grouped = new Map<string, VideoMixedVectorMilvusData[]>()

  let offset = 0
  let totalFetched = 0

  console.log(`[milvus] Start fetching from collection: ${collection}`)

  while (grouped.size < targetCount) {
    const res = await queryWithRetry({
      collection_name: collection,
      filter:          'platform == "YOUTUBE"',
      output_fields:   [
        'videoId', 'userId', 'account', 'platform',
        'nickname', 'followerCount', 'averagePlayCount', 'averageLikeCount',
        'lastPublishedTime', 'region', 'signature', 'email', 'language',
        'title', 'publishedAt', 'createdAt', 'updatedAt',
      ],
      limit:  pageSize,
      offset,
    })

    const rows = (res.data ?? []) as VideoMixedVectorMilvusData[]
    if (rows.length === 0) {
      console.log('[milvus] No more records, stopping pagination.')
      break
    }

    for (const row of rows) {
      if (!row.userId) continue
      const bucket = grouped.get(row.userId) ?? []
      bucket.push(row)
      grouped.set(row.userId, bucket)
    }

    totalFetched += rows.length
    offset       += rows.length

    console.log(
      `[milvus] Fetched ${totalFetched} raw records | unique KOLs so far: ${grouped.size}`
    )

    if (rows.length < pageSize) {
      // 已到末尾
      break
    }
  }

  // ─── 聚合：每个博主取最近 6 条，按 publishedAt 降序 ────────────────────
  const kols: KolWithVideos[] = []

  for (const [userId, records] of grouped) {
    // 取博主信息（用最新一条记录）
    const latest = records.reduce((a, b) =>
      (b.publishedAt ?? 0) > (a.publishedAt ?? 0) ? b : a
    )

    const sorted = [...records].sort(
      (a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0)
    )
    const top6 = sorted.slice(0, 6)

    const videos: VideoItem[] = top6.map(r => ({
      videoId:     r.videoId,
      title:       r.title,
      publishedAt: r.publishedAt,
      coverUrl:    buildCoverUrl(userId, r.videoId),
    }))

    kols.push({
      userId,
      account:            latest.account,
      platform:           latest.platform,
      nickname:           latest.nickname,
      email:              latest.email,
      region:             latest.region,
      language:           latest.language,
      signature:          latest.signature,
      followerCount:      latest.followerCount,
      averagePlayCount:   latest.averagePlayCount,
      averageLikeCount:   latest.averageLikeCount,
      lastPublishedTime:  latest.lastPublishedTime,
      videos,
    })

    if (kols.length >= targetCount) break
  }

  console.log(`[milvus] Aggregated ${kols.length} KOLs (target: ${targetCount})`)
  return kols
}

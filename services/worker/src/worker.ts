import 'dotenv/config'
import pLimit from 'p-limit'
import { config } from './config.js'
import { createPool, initSchema, fetchDoneUserIds, upsertKolProfile } from './db.js'
import { createMilvusClient, closeMilvusClient, fetchKolsFromMilvus } from './milvus.js'
import { analyzeKol } from './ai.js'
import type { KolWithVideos, KolProfileRow } from './types.js'

// ─── 处理单个博主：AI 分析 + 写 PostgreSQL ──────────────────────────────────
async function processKol(kol: KolWithVideos): Promise<void> {
  const label = `[worker][${kol.userId}]`

  let row: KolProfileRow = {
    userId:           kol.userId,
    account:          kol.account,
    platform:         kol.platform,
    nickname:         kol.nickname,
    email:            kol.email,
    region:           kol.region,
    language:         kol.language,
    signature:        kol.signature,
    followerCount:    kol.followerCount,
    averagePlayCount: kol.averagePlayCount,
    averageLikeCount: kol.averageLikeCount,
    lastPublishedTime:kol.lastPublishedTime,
    aiStatus:         'pending',
    processedVideos:  kol.videos,
  }

  try {
    const result = await analyzeKol(kol.videos)

    if (result === null) {
      // 所有图片不可访问
      console.log(`${label} no_image`)
      row.aiStatus = 'no_image'
    } else {
      row = {
        ...row,
        skinTone:      result.skinTone,
        tones:         result.tones,
        gender:        result.gender,
        primaryTag:    result.primaryTag,
        secondaryTags: result.secondaryTags,
        aiStatus:      'done',
        aiConfidence:  result.confidence,
        aiReason:      result.reason,
      }
      console.log(
        `${label} done | ${result.primaryTag} | ${result.secondaryTags.join(',')} | confidence=${result.confidence.toFixed(2)}`
      )
    }
  } catch (err) {
    console.error(`${label} error:`, err)
    row.aiStatus = 'error'
    row.aiReason = String(err).slice(0, 200)
  }

  await upsertKolProfile(row)
}

// ─── 主入口 ──────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log('=== KOL Worker Starting ===')
  console.log(`Target: ${config.worker.targetKolCount} KOLs | Concurrency: ${config.worker.concurrency}`)

  // 1. 初始化连接
  createPool()
  createMilvusClient()

  // 2. 确保 PG 表和索引存在
  await initSchema()

  // 3. 查询已完成的 userId（跳过重复处理）
  const doneIds = await fetchDoneUserIds()
  console.log(`[worker] Already done: ${doneIds.size} KOLs`)

  // 4. 从 Milvus 拉取数据（多拉一些，去掉已处理的后还够 target）
  const fetchTarget = config.worker.targetKolCount + doneIds.size
  const allKols = await fetchKolsFromMilvus(fetchTarget)

  // 5. 过滤掉已处理完成的
  const pending = allKols.filter(k => !doneIds.has(k.userId))
  const remaining = Math.max(0, config.worker.targetKolCount - doneIds.size)
  const toProcess = pending.slice(0, remaining)

  if (toProcess.length === 0) {
    console.log('[worker] Nothing to process. All done!')
    process.exit(0)
  }

  console.log(`[worker] Processing ${toProcess.length} KOLs...`)

  // 6. 并发处理
  const limit = pLimit(config.worker.concurrency)
  let finished = 0

  await Promise.all(
    toProcess.map(kol =>
      limit(async () => {
        await processKol(kol)
        finished++
        if (finished % 100 === 0 || finished === toProcess.length) {
          console.log(`[worker] Progress: ${finished} / ${toProcess.length}`)
        }
      })
    )
  )

  console.log(`=== KOL Worker Finished: ${finished} KOLs processed ===`)
  await closeMilvusClient()
  process.exit(0)
}

main().catch(async err => {
  console.error('[worker] Fatal error:', err)
  await closeMilvusClient().catch(() => {})
  process.exit(1)
})

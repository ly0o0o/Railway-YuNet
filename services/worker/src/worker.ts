import 'dotenv/config'
import pLimit from 'p-limit'
import { config } from './config.js'
import { createPool, initSchema, fetchDoneUserIds, upsertKolProfile } from './db.js'
import { createMilvusClient, closeMilvusClient, fetchKolBatch } from './milvus.js'
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
  const { targetKolCount, concurrency } = config.worker
  console.log('=== KOL Worker Starting ===')
  console.log(`Target: ${targetKolCount} KOLs | Concurrency: ${concurrency}`)

  // 1. 初始化连接
  createPool()
  createMilvusClient()

  // 2. 确保 PG 表和索引存在
  await initSchema()

  // 3. 加载已完成的 userId，作为本次运行的排除集合
  const processedIds = await fetchDoneUserIds()
  console.log(`[worker] Already done: ${processedIds.size} KOLs`)

  const limit     = pLimit(concurrency)
  let totalDone   = processedIds.size
  let batchNo     = 0

  // 4. 流式批处理主循环
  //    每轮：拉一批新 KOL → 并发处理 → 加入排除集 → 继续
  //    offset 永远为 0，靠 userId not in [...] 推进，彻底规避 Zilliz 16384 限制
  while (totalDone < targetKolCount) {
    batchNo++
    const remaining = targetKolCount - totalDone
    console.log(`\n[worker] === Batch #${batchNo} | remaining: ${remaining} ===`)

    const kols = await fetchKolBatch(processedIds, config.milvus.pageSize)

    if (kols.length === 0) {
      console.log('[worker] No more KOLs available in Milvus. Stopping.')
      break
    }

    // 只取本批里还缺的数量，避免超额处理
    const toProcess = kols.slice(0, remaining)

    let batchDone = 0
    await Promise.all(
      toProcess.map(kol =>
        limit(async () => {
          await processKol(kol)
          processedIds.add(kol.userId)
          totalDone++
          batchDone++
        })
      )
    )

    console.log(
      `[worker] Batch #${batchNo} done: +${batchDone} KOLs | total: ${totalDone} / ${targetKolCount}`
    )
  }

  console.log(`\n=== KOL Worker Finished: ${totalDone} KOLs processed ===`)
  await closeMilvusClient()
  process.exit(0)
}

main().catch(async err => {
  console.error('[worker] Fatal error:', err)
  await closeMilvusClient().catch(() => {})
  process.exit(1)
})

import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { KolQueryResult } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams

  const page     = Math.max(1, parseInt(sp.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') || '24')))
  const search       = sp.get('search') || ''
  const primaryTags  = sp.getAll('primaryTag')
  const genders      = sp.getAll('gender')
  const regions      = sp.getAll('region')
  const languages    = sp.getAll('language')
  const skinTones    = sp.getAll('skinTone')
  const tones        = sp.getAll('tone')
  const secondaryTags = sp.getAll('secondaryTag')
  const minFollowers = sp.get('minFollowers') ? parseInt(sp.get('minFollowers')!) : undefined
  const maxFollowers = sp.get('maxFollowers') ? parseInt(sp.get('maxFollowers')!) : undefined
  const sortRaw  = sp.get('sort') || 'follower_count'
  const sortDir  = sp.get('sortDir') === 'asc' ? 'ASC' : 'DESC'

  const ALLOWED_SORT = ['follower_count', 'average_play_count', 'average_like_count', 'last_published_time', 'created_at']
  const sort = ALLOWED_SORT.includes(sortRaw) ? sortRaw : 'follower_count'

  const conditions: string[] = ["ai_status = 'done'"]
  const params: unknown[] = []
  let p = 1

  if (search) {
    conditions.push(`(nickname ILIKE $${p} OR account ILIKE $${p})`)
    params.push(`%${search}%`)
    p++
  }
  if (primaryTags.length) {
    conditions.push(`primary_tag = ANY($${p}::text[])`)
    params.push(primaryTags); p++
  }
  if (genders.length) {
    conditions.push(`gender = ANY($${p}::text[])`)
    params.push(genders); p++
  }
  if (regions.length) {
    conditions.push(`region = ANY($${p}::text[])`)
    params.push(regions); p++
  }
  if (languages.length) {
    conditions.push(`language = ANY($${p}::text[])`)
    params.push(languages); p++
  }
  if (skinTones.length) {
    conditions.push(`skin_tone = ANY($${p}::text[])`)
    params.push(skinTones); p++
  }
  if (tones.length) {
    conditions.push(`tones && $${p}::text[]`)
    params.push(tones); p++
  }
  if (secondaryTags.length) {
    conditions.push(`secondary_tags && $${p}::text[]`)
    params.push(secondaryTags); p++
  }
  if (minFollowers !== undefined) {
    conditions.push(`follower_count >= $${p}`)
    params.push(minFollowers); p++
  }
  if (maxFollowers !== undefined) {
    conditions.push(`follower_count <= $${p}`)
    params.push(maxFollowers); p++
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize

  try {
    const pool = getPool()
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT
           id, user_id, account, platform, nickname, email, region, language, signature,
           follower_count, average_play_count, average_like_count, last_published_time,
           skin_tone, tones, gender, primary_tag, secondary_tags,
           ai_status, ai_confidence, ai_reason, processed_videos,
           created_at, updated_at
         FROM kol_profiles
         ${where}
         ORDER BY ${sort} ${sortDir} NULLS LAST
         LIMIT ${pageSize} OFFSET ${offset}`,
        params
      ),
      pool.query(`SELECT COUNT(*) FROM kol_profiles ${where}`, params),
    ])

    const total = parseInt(countRes.rows[0].count)
    const data = dataRes.rows.map(r => ({
      id:               r.id,
      userId:           r.user_id,
      account:          r.account,
      platform:         r.platform,
      nickname:         r.nickname,
      email:            r.email,
      region:           r.region,
      language:         r.language,
      signature:        r.signature,
      followerCount:    r.follower_count ? Number(r.follower_count) : null,
      averagePlayCount: r.average_play_count ? Number(r.average_play_count) : null,
      averageLikeCount: r.average_like_count ? Number(r.average_like_count) : null,
      lastPublishedTime:r.last_published_time ? Number(r.last_published_time) : null,
      skinTone:         r.skin_tone,
      tones:            r.tones || [],
      gender:           r.gender,
      primaryTag:       r.primary_tag,
      secondaryTags:    r.secondary_tags || [],
      aiStatus:         r.ai_status,
      aiConfidence:     r.ai_confidence ? Number(r.ai_confidence) : null,
      aiReason:         r.ai_reason,
      processedVideos:  r.processed_videos,
      createdAt:        r.created_at,
      updatedAt:        r.updated_at,
    }))

    return NextResponse.json({ data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) } satisfies KolQueryResult)
  } catch (err) {
    console.error('[api/kols]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

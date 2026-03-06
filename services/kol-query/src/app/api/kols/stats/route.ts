import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const pool = getPool()
    const [regions, languages, counts] = await Promise.all([
      pool.query<{ region: string; cnt: string }>(
        `SELECT region, COUNT(*) as cnt FROM kol_profiles
         WHERE ai_status='done' AND region IS NOT NULL AND region != ''
         GROUP BY region ORDER BY cnt DESC LIMIT 50`
      ),
      pool.query<{ language: string; cnt: string }>(
        `SELECT language, COUNT(*) as cnt FROM kol_profiles
         WHERE ai_status='done' AND language IS NOT NULL AND language != ''
         GROUP BY language ORDER BY cnt DESC LIMIT 50`
      ),
      pool.query<{ ai_status: string; cnt: string }>(
        `SELECT ai_status, COUNT(*) as cnt FROM kol_profiles GROUP BY ai_status`
      ),
    ])

    return NextResponse.json({
      regions:   regions.rows.map(r => ({ value: r.region, count: parseInt(r.cnt) })),
      languages: languages.rows.map(r => ({ value: r.language, count: parseInt(r.cnt) })),
      statusCounts: Object.fromEntries(counts.rows.map(r => [r.ai_status, parseInt(r.cnt)])),
    })
  } catch (err) {
    console.error('[api/kols/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

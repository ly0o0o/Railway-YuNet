import { Pool } from 'pg'
import { config } from './config.js'
import type { KolProfileRow } from './types.js'

let pool: Pool | null = null

export function createPool(): Pool {
  pool = new Pool({ connectionString: config.pg.connectionString })
  pool.on('error', (err) => console.error('[db] Unexpected pool error:', err))
  return pool
}

function getPool(): Pool {
  if (!pool) throw new Error('[db] Pool not initialized. Call createPool() first.')
  return pool
}

// ─── 建表 + 索引（幂等） ────────────────────────────────────────────────────
export async function initSchema(): Promise<void> {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS kol_profiles (
      id                    BIGSERIAL PRIMARY KEY,

      user_id               TEXT        NOT NULL,
      account               TEXT        NOT NULL,
      platform              TEXT        NOT NULL DEFAULT 'YOUTUBE',
      nickname              TEXT,
      email                 TEXT,
      region                TEXT,
      language              TEXT,
      signature             TEXT,

      follower_count        BIGINT,
      average_play_count    BIGINT,
      average_like_count    BIGINT,
      last_published_time   BIGINT,

      skin_tone             TEXT,
      tones                 TEXT[],
      gender                TEXT,
      primary_tag           TEXT,
      secondary_tags        TEXT[],

      ai_status             TEXT        NOT NULL DEFAULT 'pending',
      ai_confidence         REAL,
      ai_reason             TEXT,

      processed_videos      JSONB,

      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // 唯一约束（幂等）
  await getPool().query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_kol_profiles_user_id'
      ) THEN
        ALTER TABLE kol_profiles ADD CONSTRAINT uq_kol_profiles_user_id UNIQUE (user_id);
      END IF;
    END $$
  `)

  // 精确查询索引
  const simpleIndexes: [string, string][] = [
    ['idx_kol_platform',         'platform'],
    ['idx_kol_region',           'region'],
    ['idx_kol_language',         'language'],
    ['idx_kol_gender',           'gender'],
    ['idx_kol_skin_tone',        'skin_tone'],
    ['idx_kol_primary_tag',      'primary_tag'],
    ['idx_kol_ai_status',        'ai_status'],
    ['idx_kol_follower_count',   'follower_count'],
    ['idx_kol_avg_play_count',   'average_play_count'],
    ['idx_kol_last_published',   'last_published_time'],
  ]

  for (const [name, col] of simpleIndexes) {
    await getPool().query(
      `CREATE INDEX IF NOT EXISTS ${name} ON kol_profiles (${col})`
    )
  }

  // GIN 数组索引
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS idx_kol_secondary_tags
      ON kol_profiles USING GIN (secondary_tags)
  `)
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS idx_kol_tones
      ON kol_profiles USING GIN (tones)
  `)

  // 组合索引
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS idx_kol_platform_primary_tag
      ON kol_profiles (platform, primary_tag)
  `)
  await getPool().query(`
    CREATE INDEX IF NOT EXISTS idx_kol_platform_region
      ON kol_profiles (platform, region)
  `)

  console.log('[db] Schema ready.')
}

// ─── 查询已处理的 userId 集合 ────────────────────────────────────────────────
export async function fetchDoneUserIds(): Promise<Set<string>> {
  const res = await getPool().query<{ user_id: string }>(

    `SELECT user_id FROM kol_profiles WHERE ai_status = 'done'`
  )
  return new Set(res.rows.map(r => r.user_id))
}

// ─── Upsert 单条博主数据 ─────────────────────────────────────────────────────
export async function upsertKolProfile(row: KolProfileRow): Promise<void> {
  await getPool().query(
    `
    INSERT INTO kol_profiles (
      user_id, account, platform, nickname, email, region, language, signature,
      follower_count, average_play_count, average_like_count, last_published_time,
      skin_tone, tones, gender, primary_tag, secondary_tags,
      ai_status, ai_confidence, ai_reason, processed_videos,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12,
      $13, $14, $15, $16, $17,
      $18, $19, $20, $21,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      account              = EXCLUDED.account,
      platform             = EXCLUDED.platform,
      nickname             = EXCLUDED.nickname,
      email                = EXCLUDED.email,
      region               = EXCLUDED.region,
      language             = EXCLUDED.language,
      signature            = EXCLUDED.signature,
      follower_count       = EXCLUDED.follower_count,
      average_play_count   = EXCLUDED.average_play_count,
      average_like_count   = EXCLUDED.average_like_count,
      last_published_time  = EXCLUDED.last_published_time,
      skin_tone            = EXCLUDED.skin_tone,
      tones                = EXCLUDED.tones,
      gender               = EXCLUDED.gender,
      primary_tag          = EXCLUDED.primary_tag,
      secondary_tags       = EXCLUDED.secondary_tags,
      ai_status            = EXCLUDED.ai_status,
      ai_confidence        = EXCLUDED.ai_confidence,
      ai_reason            = EXCLUDED.ai_reason,
      processed_videos     = EXCLUDED.processed_videos,
      updated_at           = NOW()
    `,
    [
      row.userId, row.account, row.platform, row.nickname ?? null,
      row.email ?? null, row.region ?? null, row.language ?? null,
      row.signature ?? null,
      row.followerCount ?? null, row.averagePlayCount ?? null,
      row.averageLikeCount ?? null, row.lastPublishedTime ?? null,
      row.skinTone ?? null,
      row.tones ?? null,
      row.gender ?? null,
      row.primaryTag ?? null,
      row.secondaryTags ?? null,
      row.aiStatus,
      row.aiConfidence ?? null,
      row.aiReason ?? null,
      row.processedVideos ? JSON.stringify(row.processedVideos) : null,
    ]
  )
}

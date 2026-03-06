import 'dotenv/config'

function required(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required env var: ${key}`)
  return val
}

function optionalInt(key: string, defaultVal: number): number {
  const val = process.env[key]
  if (!val) return defaultVal
  const parsed = parseInt(val, 10)
  if (isNaN(parsed)) throw new Error(`Env var ${key} is not a valid integer: "${val}"`)
  return parsed
}

export const config = {
  milvus: {
    address:    required('MILVUS_ADDRESS'),
    token:      required('MILVUS_TOKEN'),
    collection: required('MILVUS_COLLECTION'),
    pageSize:   optionalInt('MILVUS_PAGE_SIZE', 500),
    timeout:    optionalInt('MILVUS_TIMEOUT', 30000),
    retries:    optionalInt('MILVUS_RETRIES', 2),
    retryDelay: optionalInt('MILVUS_RETRY_DELAY', 1000),
  },
  pg: {
    connectionString: required('DATABASE_URL'),
  },
  vertex: {
    projectId:    required('VERTEX_AI_PROJECT_ID'),
    clientEmail:  required('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL'),
    privateKey:   required('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY').replace(/\\n/g, '\n'),
  },
  worker: {
    concurrency:      optionalInt('CONCURRENCY', 5),
    targetKolCount:   optionalInt('TARGET_KOL_COUNT', 10000),
    imageTimeoutMs:   optionalInt('IMAGE_TIMEOUT_MS', 3000),
    aiMaxRetries:     optionalInt('AI_MAX_RETRIES', 2),
  },
  image: {
    baseUrl: 'https://image.easykol.com',
  },
} as const

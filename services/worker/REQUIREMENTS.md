# Worker 服务需求文档

> 版本：v1.0 | 日期：2026-03-06  
> 语言：Node.js (TypeScript)  
> 服务目录：`services/worker/`

---

## 一、背景与目标

从 Milvus 集合中读取 YouTube 博主数据（每博主最近 6 条视频），通过 Google Vertex AI（Gemini 模型）分析博主的内容调性、肤色、性别及内容标签，将结果与博主基础信息一起写入 PostgreSQL，为后续查询和过滤提供结构化数据支撑。

**核心约束：**
- 对 Milvus **只读**，绝对不写入、不修改任何数据。
- 处理 **1 万名**博主（~6 万条视频记录）。
- 以 `userId` 为唯一键，支持幂等 upsert（重跑不产生重复数据）。

---

## 二、整体数据流

```
Milvus 集合
  │
  │ 1. 按 userId 分组，取最近 6 条（按 publishedAt 降序）
  ↓
拼接封面图 URL
  │  https://image.easykol.com/cover/youtube/{channelId}/{videoId}.jpg
  │  channelId = userId（UC 开头）
  ↓
Google Vertex AI (Gemini)
  │  输入：6 张图片 + 对应标题
  │  输出：肤色 / 调性 / 性别 / 一级 tag / 二级 tags（结构化 JSON）
  ↓
PostgreSQL
  │  upsert into kol_profiles (on conflict userId do update)
  ↓
下一批博主 → 循环直到 1 万条处理完毕
```

---

## 三、Milvus 查询策略

### 3.1 集合字段参考

```typescript
interface VideoMixedVectorMilvusData {
  id?: string
  videoId: string
  userId: string         // YouTube channelId（UC 开头）
  account: string
  platform: KolPlatform  // 仅处理 YOUTUBE
  nickname?: string
  followerCount?: number
  averagePlayCount?: number
  averageLikeCount?: number
  lastPublishedTime?: number
  region?: string
  signature?: string
  email?: string
  language?: string
  title?: string
  description?: string
  cover?: string         // Milvus 存的 URL 已过期，需重新拼接
  publishedAt?: number
  denseVector: number[]
  sparseVector?: SparseFloatVector
  meta?: Record<string, any>
  createdAt?: number
  updatedAt?: number
}
```

### 3.2 查询方式

由于 Milvus 不支持 GROUP BY，采用以下策略：

1. **第一步**：`query()` 过滤 `platform == "YOUTUBE"`，仅返回 `["userId", "videoId", "publishedAt", ...]` 轻量字段，分页拉取所有记录（或直到凑满 1 万个不重复 userId）。
2. **第二步**：在内存中按 `userId` 分组，每组取 `publishedAt` 最大的 6 条记录。
3. **输出**：每个博主一个对象，包含博主级别信息 + 最近 6 条视频的 `videoId` 和 `title`。

> ⚠️ 不使用向量搜索（`search()`），只使用标量过滤查询（`query()`）。

---

## 四、图片 URL 拼接规则

```
格式：https://image.easykol.com/cover/youtube/{channelId}/{videoId}.jpg
参数：
  channelId = userId（即 UC 开头的 YouTube Channel ID）
  videoId   = 每条记录的 videoId 字段

示例：
  userId  = "UCxxxxxx"
  videoId = "dQw4w9WgXcQ"
  URL     = https://image.easykol.com/cover/youtube/UCxxxxxx/dQw4w9WgXcQ.jpg
```

每个博主最多发 6 张图，如某张返回 4xx/5xx 则跳过该图，其余继续发给 AI。

---

## 五、AI 分析

### 5.1 服务配置

```typescript
// Google Vertex AI — Gemini
import { createVertex } from '@ai-sdk/google-vertex'

const vertexProvider = createVertex({
  project: process.env.VERTEX_AI_PROJECT_ID,
  location: 'us-central1',
  googleAuthOptions: {
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      private_key:  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
  },
})
```

### 5.2 Prompt 设计

**输入：**
- 最多 6 张封面图（image/jpeg，URL inline 或 base64）
- 每张图对应的视频标题

**要求 AI 输出（JSON Schema，关闭 markdown 包裹）：**

```typescript
interface AIAnalysisResult {
  skinTone:      '亚裔' | '黑人' | '拉丁裔' | '印度裔' | '白人' | '其他'
  tone:          ('奢侈' | '可爱' | '低俗擦边' | '高颜值' | '普通人')[]  // 可多选
  gender:        '男' | '女' | '未知'
  primaryTag:    PrimaryTag          // 见第六节
  secondaryTags: string[]            // 二级标签，可多个，见第六节
  confidence:    number              // 0~1，AI 自评置信度
  reason:        string              // 简短中文说明（<=100字）
}
```

**System Prompt 要点：**
- 你是一位专业的社交媒体博主内容分析师
- 根据提供的视频封面图和标题，判断博主的内容方向
- 肤色/调性/性别基于封面中出现的主要人物
- 若封面无人物出现，肤色填"其他"，性别填"未知"
- 严格返回合法 JSON，不加 markdown 代码块

### 5.3 错误处理

| 情况 | 处理方式 |
|------|---------|
| AI 返回非 JSON | 重试最多 2 次，仍失败则记录 `ai_status = 'error'` |
| 所有图片加载失败 | 跳过 AI，仅写入博主基础信息，`ai_status = 'no_image'` |
| 图片部分失败 | 用剩余图片继续请求 AI |
| Vertex AI 限流 | 指数退避重试（1s → 2s → 4s），最多 3 次 |

---

## 六、标签体系

### 6.1 一级标签（primaryTag）

```
科技 | 时尚 | 美妆护肤 | 家居 | 实体产品测评 | 人物关系 | 宠物 |
生活方式 | 运动 | 户外 | 旅行 | 美食 | DIY | 娱乐 | 游戏 |
喜剧 | 艺术 | 学习 | 画面创作 | 知识 | 专业领域 | 金融 | AI
```

### 6.2 二级标签映射

| 一级 | 二级标签 |
|------|---------|
| 科技 | 手机3C、PC硬件、智能穿戴、绿色能源/储能、智能家居与安全、数码桌搭、科技DIY、科技资讯、其他 |
| 时尚 | 穿搭带货、泛时尚、街拍、模特、奢侈品、其他 |
| 美妆护肤 | 美妆、护肤、美发、美甲、其他 |
| 家居 | 软装美学、硬核家装DIY、室内设计、清洁收纳、园艺、家具制作翻修、其他 |
| 实体产品测评 | 家居好物、超市购物、折扣信息、家用电器、开箱、淘二手、户外设备、运动装备、摄影器材、电脑软件推荐、手机软件推荐、其他 |
| 人物关系 | 情侣、亲子、婴儿、家长、情感、LGBTQ、其他 |
| 宠物 | 宠物猫、宠物狗、爬宠、其他 |
| 生活方式 | 生活VLOG、精致生活、居家生活、居家办公、农场生活、奢华生活、第一视角POV、其他 |
| 运动 | 健身、瑜伽、跳舞、骑行、hiking、其他户外运动、专业运动员、其他 |
| 户外 | 房车、露营、野外生存、小木屋、钓鱼、海上航行、公路旅行、其他 |
| 旅行 | 城市旅行、户外大自然、跨国旅行、其他 |
| 美食 | 吃播、美食探店、烹饪、健康饮食、减脂餐、厨艺教授、其他 |
| DIY | 小手工、木工、模型、道具制作、3D打印、科学发明、家用工具箱、其他 |
| 娱乐 | 挑战、整蛊、小游戏、街头采访、Cosplay、影视、动漫、创意视频、ASMR、其他 |
| 游戏 | 电脑游戏、手游、主机游戏、游戏桌搭、其他 |
| 喜剧 | 搞笑段子、小剧场、脱口秀、其他 |
| 艺术 | 手绘、数字绘画、设计师、歌手、乐器、专业舞蹈、街头艺术、其他 |
| 学习 | 学习VLOG、学习考试升学技巧、学生/校园生活、其他 |
| 画面创作 | 摄影教程、视频特效教程、图片处理教程 |
| 知识 | 科普教育、人文历史、自然/气候/灾防、书籍分享、手机软件分享、生活妙招、趣味知识、新闻、其他 |
| 专业领域 | 软件开发、UX/UI设计、法律/合规、移民/留学政策、税务筹划、职场tips、医生、农业、其他 |
| 金融 | 个人理财、投资交易、Web3/加密货币、商业科普、其他 |
| AI | AI新闻资讯、AI生产力工具、AI创作/绘画、AI软件推荐、AI硬件/芯片、AI教程/科普、其他 |

---

## 七、PostgreSQL 表设计

### 7.1 主表：kol_profiles

```sql
CREATE TABLE kol_profiles (
  -- 主键
  id                BIGSERIAL PRIMARY KEY,

  -- 博主核心身份（来自 Milvus）
  user_id           TEXT        NOT NULL,
  account           TEXT        NOT NULL,
  platform          TEXT        NOT NULL DEFAULT 'YOUTUBE',
  nickname          TEXT,
  email             TEXT,
  region            TEXT,
  language          TEXT,
  signature         TEXT,

  -- 博主统计数据（来自 Milvus，取最新视频所在记录）
  follower_count        BIGINT,
  average_play_count    BIGINT,
  average_like_count    BIGINT,
  last_published_time   BIGINT,   -- Unix 时间戳(ms)

  -- AI 分析结果
  skin_tone         TEXT,         -- 亚裔/黑人/拉丁裔/印度裔/白人/其他
  tones             TEXT[],       -- 调性（可多个）：奢侈/可爱/低俗擦边/高颜值/普通人
  gender            TEXT,         -- 男/女/未知
  primary_tag       TEXT,         -- 一级标签（单个）
  secondary_tags    TEXT[],       -- 二级标签（多个）

  -- AI 处理状态
  ai_status         TEXT        NOT NULL DEFAULT 'pending',
                                -- pending | done | error | no_image
  ai_confidence     REAL,        -- 0~1
  ai_reason         TEXT,        -- AI 简短说明

  -- 最近处理的视频快照（JSON 数组，便于 debug）
  processed_videos  JSONB,
  -- 格式: [{ videoId, title, coverUrl, publishedAt }]

  -- 时间戳
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.2 唯一约束

```sql
ALTER TABLE kol_profiles
  ADD CONSTRAINT uq_kol_profiles_user_id UNIQUE (user_id);
```

### 7.3 索引设计

```sql
-- 精确查询类
CREATE INDEX idx_kol_platform        ON kol_profiles (platform);
CREATE INDEX idx_kol_region          ON kol_profiles (region);
CREATE INDEX idx_kol_language        ON kol_profiles (language);
CREATE INDEX idx_kol_gender          ON kol_profiles (gender);
CREATE INDEX idx_kol_skin_tone       ON kol_profiles (skin_tone);
CREATE INDEX idx_kol_primary_tag     ON kol_profiles (primary_tag);
CREATE INDEX idx_kol_ai_status       ON kol_profiles (ai_status);

-- 数组类型（GIN — 支持 @> 包含查询）
CREATE INDEX idx_kol_secondary_tags  ON kol_profiles USING GIN (secondary_tags);
CREATE INDEX idx_kol_tones           ON kol_profiles USING GIN (tones);

-- 数值范围查询
CREATE INDEX idx_kol_follower_count      ON kol_profiles (follower_count);
CREATE INDEX idx_kol_avg_play_count      ON kol_profiles (average_play_count);
CREATE INDEX idx_kol_last_published_time ON kol_profiles (last_published_time);

-- 组合查询（高频过滤组合）
CREATE INDEX idx_kol_platform_primary_tag ON kol_profiles (platform, primary_tag);
CREATE INDEX idx_kol_platform_region      ON kol_profiles (platform, region);
```

### 7.4 典型查询示例

```sql
-- 查某一级 tag 下的所有博主
SELECT * FROM kol_profiles WHERE primary_tag = '科技';

-- 查包含特定二级 tag 的博主（GIN）
SELECT * FROM kol_profiles WHERE secondary_tags @> ARRAY['AI教程/科普'];

-- 多条件过滤
SELECT * FROM kol_profiles
WHERE platform = 'YOUTUBE'
  AND primary_tag = '美妆护肤'
  AND gender = '女'
  AND follower_count > 100000
ORDER BY follower_count DESC;
```

---

## 八、Worker 主流程

```
main()
  │
  ├─ 1. 连接 Milvus + PostgreSQL
  ├─ 2. 确保 kol_profiles 表存在（init schema）
  │
  └─ while loop（处理直到 1 万个博主完成）
       │
       ├─ A. 从 Milvus 分页拉取一批记录（pageSize=500 条原始记录）
       │     过滤：platform == "YOUTUBE"
       │     字段：userId, videoId, title, publishedAt, followerCount,
       │           averagePlayCount, nickname, region, language, ...
       │
       ├─ B. 内存分组：按 userId 聚合，取 publishedAt 最大的 6 条
       │
       ├─ C. 跳过已写入 PostgreSQL 的 userId（去重）
       │
       ├─ D. 并发处理（concurrency=5）：
       │     对每个博主：
       │       1. 拼接 6 个封面 URL
       │       2. 检测图片可用性（HEAD 请求，超时 3s）
       │       3. 调用 Vertex AI Gemini，传图片 + 标题
       │       4. 解析 AI JSON 输出
       │       5. upsert into kol_profiles
       │
       ├─ E. 记录进度日志（已处理 N / 10000）
       │
       └─ F. 当已处理 userId 总数 >= 10000，退出循环

main() 结束，进程正常退出（exit 0）
```

---

## 九、并发与性能参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `MILVUS_PAGE_SIZE` | 500 | 每次 Milvus query 拉取的原始记录数 |
| `CONCURRENCY` | 5 | 同时处理的博主数量 |
| `TARGET_KOL_COUNT` | 10000 | 目标处理博主数 |
| `IMAGE_TIMEOUT_MS` | 3000 | 图片 HEAD 检测超时 |
| `AI_MAX_RETRIES` | 2 | AI 调用失败最大重试 |
| `AI_RETRY_DELAY_MS` | 1000 | 重试初始等待（指数退避） |

---

## 十、环境变量

```env
# Milvus
MILVUS_ADDRESS=          # e.g. your-cluster.zillizcloud.com:19530
MILVUS_TOKEN=            # API Key 或 user:password
MILVUS_COLLECTION=       # 集合名称

# PostgreSQL（Railway 自动注入）
DATABASE_URL=            # postgresql://...@postgres.railway.internal:5432/railway

# Google Vertex AI
VERTEX_AI_PROJECT_ID=
GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# Worker 参数（可选，有默认值）
CONCURRENCY=5
TARGET_KOL_COUNT=10000
MILVUS_PAGE_SIZE=500
```

---

## 十一、依赖包

```json
{
  "@zilliz/milvus2-sdk-node": "^2.x",
  "@ai-sdk/google-vertex": "^1.x",
  "ai": "^4.x",
  "pg": "^8.x",
  "zod": "^3.x",
  "p-limit": "^6.x",
  "dotenv": "^16.x"
}
```

---

## 十二、Railway 部署配置

在 Railway 控制台为 worker 服务设置：
- **Root Directory**：`services/worker`
- **Start Command**：`node dist/worker.js`（或 `npx ts-node src/worker.ts` 开发模式）
- PostgreSQL 的 `DATABASE_URL` 由 Railway 项目自动注入，无需手动填写

---

## 十三、验收标准

- [ ] Worker 启动后能成功连接 Milvus 并拉取到数据
- [ ] 对单个博主能正确拼接 6 张封面 URL
- [ ] AI 返回合法 JSON，字段值在枚举范围内
- [ ] `kol_profiles` 表成功写入数据，二次运行 upsert 不产生重复
- [ ] `secondary_tags` GIN 索引支持 `@>` 查询
- [ ] 1 万条博主处理完毕后进程正常退出
- [ ] 失败的博主记录 `ai_status = 'error'` 且不中断整体流程

# Railway YuNet — Monorepo

三个服务共享一个 PostgreSQL，部署在同一个 Railway 项目里。

## 架构

```
┌─────────────────────────── Railway Project ───────────────────────────────┐
│                                                                            │
│  services/face-api        services/worker         services/backend-api    │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐ │
│  │  YuNet Face API  │    │  Detection Worker │    │   Query API          │ │
│  │  POST /detect    │◄───│  轮询 jobs 表    │    │  GET  /jobs          │ │
│  │  POST /detect-   │    │  调用 face-api   │    │  POST /jobs          │ │
│  │       batch      │    │  写入检测结果    │    │  GET  /jobs/:id      │ │
│  │  POST /detect-url│    └────────┬─────────┘    └──────────┬───────────┘ │
│  └──────────────────┘             │  内网                    │  内网       │
│                                   ▼                          ▼             │
│                          ┌──────────────────────────────────────────────┐ │
│                          │              PostgreSQL                       │ │
│                          │         detection_jobs table                  │ │
│                          └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────── ┘
```

## 项目结构

```text
services/
├── face-api/          # YuNet ONNX 人脸检测服务（已部署）
│   ├── main.py
│   ├── face_detector.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── railway.toml
│   └── models/
│       └── face_detection_yunet_2023mar.onnx
├── worker/            # 后台刷数据 Worker（待开发 - Node.js）
└── backend-api/       # 查询接口 API（待开发 - Node.js）
```

## Railway Monorepo 配置

每个服务在 Railway 里独立部署，指向同一个 GitHub 仓库，但 **Root Directory** 不同：

| Railway 服务 | Root Directory |
|-------------|---------------|
| face-api | `services/face-api` |
| worker | `services/worker` |
| backend-api | `services/backend-api` |

**添加新服务步骤：**
1. Railway 项目 → New Service → GitHub Repo → 选本仓库
2. Settings → Source → Root Directory → 填对应路径
3. Railway 自动识别该目录下的 `Dockerfile`

## 服务说明

### face-api（`https://yunet-ek-production.up.railway.app`）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/detect` | 单图上传检测 |
| POST | `/detect-batch` | 多图批量检测 |
| POST | `/detect-url` | 传 URL 检测 |

### backend-api（待开发 - Node.js）

查询任务结果的 REST API，直连 PostgreSQL。

### worker（待开发 - Node.js）

后台长驻进程，定时轮询任务队列，调用 face-api 完成检测并写回结果。

## 环境变量

Railway 同项目内所有服务自动获得：
```
DATABASE_URL=postgresql://...@postgres.railway.internal:5432/railway
```

face-api 可选：
```
API_SECRET=your_secret
SCORE_THRESHOLD=0.6
MAX_SIZE=1024
```

## 本地开发

```bash
cd services/face-api && pip install -r requirements.txt
uvicorn main:app --reload
```

## 1. 原项目结构（已迁移）

```text
.
├── Dockerfile
├── railway.toml
├── requirements.txt
├── main.py
├── face_detector.py
└── models/
    └── face_detection_yunet_2023mar.onnx
```

## 2. 接口

### `GET /health`

返回服务和模型状态：

```json
{
  "status": "ok",
  "model_loaded": true
}
```

### `POST /detect`

- `multipart/form-data`，字段名 `file`
- 或 `application/octet-stream` 直接传图片字节

成功响应：

```json
{
  "has_face": true,
  "confidence": 0.9234,
  "error": null
}
```

### `POST /detect-url`

请求体：

```json
{
  "url": "https://example.com/demo.jpg"
}
```

## 3. 鉴权

- 如果设置了 `API_SECRET`，除 `/health` 外都要求：
  - `Authorization: Bearer <API_SECRET>`
- 未设置 `API_SECRET` 时，不鉴权（开发模式）。

## 4. 环境变量

- `MODEL_PATH`：默认 `models/face_detection_yunet_2023mar.onnx`
- `SCORE_THRESHOLD`：默认 `0.6`
- `MAX_SIZE`：默认 `1024`
- `NMS_THRESHOLD`：默认 `0.3`
- `TOP_K`：默认 `5000`
- `API_SECRET`：默认空
- `PORT`：Railway 自动注入

## 5. 本地运行

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 6. Docker 运行

```bash
docker build -t yunet-face-api .
docker run --rm -p 8000:8000 \
  -e API_SECRET=your_secret \
  yunet-face-api
```

## 7. Railway 部署

1. 新建 Railway 项目，连接此仓库。
2. Railway 会读取 `Dockerfile` + `railway.toml` 自动部署。
3. 在 Railway Variables 里设置：
   - `API_SECRET`（建议）
   - `MODEL_PATH`（若使用默认可不填）
   - `SCORE_THRESHOLD`（可选）
4. 确认健康检查路径 `/health` 返回 200。

## 8. 调用示例（Cloudflare Worker / Node）

```ts
const res = await fetch("https://your-service.railway.app/detect-url", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${env.FACE_API_SECRET}`
  },
  body: JSON.stringify({ url: imageUrl })
});

const result = await res.json();
// { has_face, confidence, error }
```

## 9. 验收清单

1. `GET /health` 返回 200 且 `model_loaded=true`。
2. 人脸图片 -> `has_face=true`。
3. 无人脸图片 -> `has_face=false`。
4. 无效 URL -> `200` 且 `error` 非空。
5. 配置 `API_SECRET` 后，无 token 请求返回 `401`。

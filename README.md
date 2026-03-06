# YuNet Face API (Railway)

一个独立的 YuNet 人脸检测 HTTP 微服务，适合给 Cloudflare Worker / Node 服务调用。

## 1. 项目结构

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

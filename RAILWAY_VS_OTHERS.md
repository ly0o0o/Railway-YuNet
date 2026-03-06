# Railway vs Vercel vs Cloudflare — 平台对比

> 写于 2026-03-06，基于当前各平台公开文档与实际使用经验整理。

---

## 一句话定位

| 平台 | 核心定位 |
|------|---------|
| **Railway** | 面向后端的全栈云平台，容器原生，有状态服务友好 |
| **Vercel** | 前端 / Serverless 函数的极致体验，Next.js 官方归宿 |
| **Cloudflare Workers / Pages** | 边缘计算，超低延迟，全球 300+ PoP，轻量无状态 |

---

## Railway 的核心优势

### 1. 真实容器，长驻进程

Railway 部署的是完整的 Docker 容器，进程**持续运行**，不会在请求结束后销毁。

- 可以在内存中缓存模型（如本项目的 YuNet ONNX）
- 支持 WebSocket、gRPC、长连接
- 定时任务（cron）、后台 worker 可以稳定运行

Vercel / CF Workers 是 **Serverless / Edge Function**，函数冷启动后执行完即销毁，无法在进程内持久缓存状态，也不适合 CPU 密集型任务。

---

### 2. 任意语言 + 任意依赖

只要能写进 `Dockerfile` 或被 Nixpacks 识别，就能部署。

```
Python + OpenCV + ONNX Runtime  ✅ Railway
Node.js + native addon           ✅ Railway
Go / Rust / Java / Ruby          ✅ Railway
```

- **Vercel**：Python 支持有限，不能安装系统级依赖（如 `libGL`），函数包大小限制 250MB，不适合 CV / ML 服务
- **CF Workers**：只支持 JS / Wasm，Python 处于实验阶段，无法运行 OpenCV、PyTorch 等原生库

---

### 3. 有状态服务原生支持

Railway 提供一键托管数据库，与应用服务在同一私有网络内通信：

- PostgreSQL
- MySQL
- Redis
- MongoDB

注入方式：环境变量自动注入连接字符串，零配置互通。

Vercel 和 CF 本身不托管数据库，需要外接第三方服务，且往往需要走公网。

---

### 4. 持久化存储（Volume）

Railway 支持挂载持久化磁盘卷，容器重启数据不丢失，适合：

- 上传文件临时存储
- SQLite 持久化
- 模型文件缓存

CF Workers 无文件系统，Vercel 函数也无法写持久文件。

---

### 5. 部署流程简单，接近"裸服务器"体验

```bash
# 关联 GitHub 仓库后，每次 push 自动触发构建部署
git push origin main   # → Railway 自动 CI/CD
```

- 支持 **Dockerfile**（完全自定义构建）
- 支持 **Nixpacks**（零配置自动检测语言和依赖）
- 支持多服务（一个项目内同时跑 API + Worker + DB）
- PR 自动创建预览环境（Preview Deployments）

---

### 6. 私有网络 & 服务间通信

同一 Railway 项目下的服务通过内网（`railway.internal` 域）互通，不走公网，低延迟且安全。

对于微服务架构（API Gateway + 多个后端服务）非常友好。

---

### 7. 资源规格可调，没有函数时长限制

| 项目 | Railway | Vercel (Hobby) | CF Workers (Free) |
|------|---------|----------------|-------------------|
| CPU | 最高 32 vCPU | 无独立 CPU | 10ms CPU / 请求 |
| 内存 | 最高 32 GB | 1 GB | 128 MB |
| 请求时长 | 无限制 | 10s（Hobby）/ 300s（Pro） | 30s |
| 并发 | 无限制 | 函数实例自动扩缩 | 无限制（Edge） |

---

## 各平台适用场景对比

| 场景 | 最佳选择 | 原因 |
|------|---------|------|
| Next.js / React 前端 + API Routes | **Vercel** | 原生支持，DX 极佳 |
| 全球超低延迟 CDN / 边缘逻辑 | **Cloudflare** | 边缘节点最多，延迟最低 |
| ML 推理 / CV 服务 | **Railway** | 长驻进程 + 可装系统依赖 + 大内存 |
| 后端 REST / gRPC API | **Railway** | 真实容器，行为可预期 |
| PostgreSQL / Redis + API 一体 | **Railway** | 同平台托管，私网互通 |
| 定时任务 / 爬虫 / 队列 Worker | **Railway** | 长驻进程，支持后台任务 |
| 静态网站 | **Cloudflare Pages / Vercel** | 免费且极快 |

---

## Railway 的局限

- **冷启动**：免费计划闲置后服务会休眠（Hobby 及以上无此限制）
- **价格**：相比 CF Workers 免费额度，长期运行的容器有持续费用（按使用量计费，$5/月起）
- **边缘延迟**：部署在单一 Region，无法像 CF 那样全球 300+ 节点分发
- **前端支持**：不如 Vercel 对 Next.js / Astro 等框架的优化深

---

## 总结

> Railway 更像是一个**简化版的 AWS ECS / Heroku 继任者**，而不是 Serverless 平台。

如果你的服务需要：
- 加载大型模型或原生库（OpenCV、FFmpeg、ONNX…）
- 维护进程内状态 / 缓存
- 配套数据库、Redis 且希望私网互通
- 避免 Serverless 的冷启动和执行时间限制

那 Railway 是目前 DX（开发者体验）最好的选择之一。

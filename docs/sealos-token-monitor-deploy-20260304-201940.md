# Sealos 部署改造说明（Token 监控与配额冻结）

更新时间：2026-03-04 20:19:40

## 1. 目标

本次改造目标：

- 所有 AI 请求统一经过后端代理，后端可统计每个用户 token 用量
- 按调用环节（`chat` / `enrich` / `resume` / `jd` / `clean` / `asr`）分开统计
- 支持管理员设置每个用户配额（`quota_tokens`）
- 超额后自动冻结账号（`frozen=true`），并可在后台手动冻结/解冻
- 支持用 `License Key` 识别用户（不依赖登录 token）

---

## 2. 代码改动清单（需要部署）

### 后端 `user-management`

- `user-management/src/db/migrate.js`
  - `users` 表新增：
    - `quota_tokens BIGINT NOT NULL DEFAULT 1000000`
    - `frozen BOOLEAN NOT NULL DEFAULT FALSE`
  - 新增 `token_usage` 表（记录每次调用 token 消耗）
- `user-management/src/routes/ai-proxy.js`（新增）
  - 新增代理接口：
    - `POST /api/ai/chat`
    - `POST /api/ai/enrich`
    - `POST /api/ai/resume`
    - `POST /api/ai/jd`
    - `POST /api/ai/clean`
    - `POST /api/ai/asr`
  - 每次请求前检查配额/冻结状态
  - 请求后写入 `token_usage`
  - 流式接口支持解析 usage
  - 支持通过 `x-license-key` 鉴权并按 license 对应用户记账
- `user-management/src/routes/usage.js`（新增）
  - 新增管理员用量接口：
    - `GET /api/admin/usage/summary`
    - `GET /api/admin/usage/detail/:userId`
    - `PUT /api/admin/usage/quota/:userId`
    - `PUT /api/admin/usage/freeze/:userId`
- `user-management/src/routes/admin.js`
  - 管理员统计增加 token 相关字段
- `user-management/src/index.js`
  - 挂载：
    - `app.use('/api/ai', aiProxyRoutes);`
    - `app.use('/api/admin/usage', usageRoutes);`
- `user-management/src/config.js`
  - 新增配置：
    - `AI_API_BASE`
    - `AI_API_KEY`
    - `AI_ASR_API_BASE`

### 客户端 `src/index.js`

- 登录态/LicenseKey 场景优先走后端代理 `POST {userApiBase}/api/ai/*`
- 后端返回 `quota_exceeded` / `account_frozen` 时，UI 给出明确提示
- 若已配置 License Key 但未配置 `userApiBase`，会提示先配置后端地址（避免绕过计量）

### 管理后台页面

- `user-management/web/admin.html`
  - 新增总 token 统计卡片
  - 用户表新增：已用/配额、冻结状态、操作按钮（改配额、冻结/解冻）
  - 新增用户用量明细弹窗（按天、按环节图表）

---

## 3. Sealos 端部署步骤

## 3.1 拉取最新代码并构建

在 Sealos 后端容器/服务对应仓库目录执行：

```bash
git pull
cd user-management
npm install
```

## 3.2 执行数据库迁移（必须）

```bash
cd user-management
npm run migrate
```

若迁移成功会看到 `Migration completed`。

## 3.3 配置环境变量

至少需要：

- `DATABASE_URL`
- `JWT_SECRET`
- `AI_API_KEY`（上游模型 key）

建议同时配置：

- `AI_API_BASE`（默认 `https://dashscope.aliyuncs.com/compatible-mode/v1`）
- `AI_ASR_API_BASE`（默认 `https://dashscope.aliyuncs.com/api/v1`）
- `ADMIN_EMAILS`（管理员邮箱白名单）

## 3.4 重启服务

按 Sealos 的发布流程重启 `user-management` 服务（滚动发布或重启实例）。

---

## 4. 上线后验收（5 分钟）

按顺序执行：

1. 健康检查
   - `GET /healthz` 返回 200
2. 新路由检查
   - `POST /api/ai/jd` 不应再返回 `Cannot POST /api/ai/jd`
3. 管理接口检查
   - `GET /api/admin/usage/summary` 返回 `totals` 和 `users`
4. 真实调用检查
   - 客户端触发一次 AI 调用（如 JD 解析）
   - 再查 `/api/admin/usage/summary`，对应用户 `usedTokens` 增加
5. 配额冻结检查
   - 把某用户 `quota_tokens` 调到比当前 `usedTokens` 更低
   - 继续调用 AI，接口应返回 `quota_exceeded`
   - 用户状态变为 `frozen=true`

---

## 5. 关键注意事项

- 当前线上若出现 `/api/ai/*` 404，说明部署的还是旧版本后端
- 仅改前端不改后端不会生效（必须后端+迁移一起上）
- `AI_API_KEY` 不要输出到日志，不要下发前端
- 若要严格“一人一 key”，可继续在后端把 `AI_API_KEY` 作为兜底去掉，仅允许 LicenseKey 解密结果调用上游

---

## 6. 回滚方案（紧急）

若上线后异常：

1. 回滚到上一版本镜像/提交
2. 保留数据库新增字段与表（向后兼容，不影响旧版本运行）
3. 关闭客户端代理入口（旧逻辑仍可直连）

> 注：本次迁移为新增字段/表，不涉及删字段或重命名，回滚风险较低。


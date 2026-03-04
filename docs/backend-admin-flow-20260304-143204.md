# 后端管理界面实现说明

> 文档生成时间：2026-03-04 14:32:04  
> 覆盖范围：`user-management/` 目录下的 Node.js 后端服务与 Web 管理界面  
> 面向读者：开发者、运维人员、管理员

---

## 一、系统定位与技术栈

后端服务承担三大职责：**用户账号管理**、**AI 调用代理与计费**、**运营管理界面托管**。桌面软件的 License 验证、AI 请求转发、用量限额控制全部经过本服务。

| 层次 | 技术 |
|---|---|
| 运行时 | Node.js（`user-management/src/index.js`） |
| Web 框架 | Express.js |
| 认证 | JWT（`jsonwebtoken`，有效期 7 天） |
| 密码加密 | bcrypt |
| 数据库驱动 | `pg`（PostgreSQL） |
| 文件上传 | multer |
| 管理界面 | 原生 HTML + CSS + Vanilla JS |
| API 前端层 | `web/js/api.js`（统一请求封装） |
| 部署平台 | Sealos 容器化部署 |

---

## 二、服务总体架构

```mermaid
flowchart TD
    subgraph clientLayer [客户端]
        Desktop[桌面软件\nElectron App]
        Browser[浏览器\n管理界面]
    end

    subgraph serverEntry [入口层]
        IndexJS[user-management/src/index.js\n挂载全部路由\n静态托管 web/]
        Healthz[GET /healthz\n健康检查]
    end

    subgraph middlewareLayer [中间件层]
        AuthMW[middleware/auth.js\nauthRequired\nauthJwtAndLicense]
        AdminMW[middleware/admin.js\nadminRequired]
    end

    subgraph routeLayer [路由层]
        AuthRoute[routes/auth.js\n认证与账号]
        UserRoute[routes/user.js\n用户兼容接口]
        ProfileRoute[routes/profile.js\n用户资料]
        ResumeRoute[routes/resume.js\n简历管理]
        VoiceRoute[routes/voice.js\n录音管理]
        SessionRoute[routes/sessions.js\n面试会话]
        AdminRoute[routes/admin.js\n管理后台]
        UsageRoute[routes/usage.js\n用量与配额]
        AiProxyRoute[routes/ai-proxy.js\nAI代理与计费]
    end

    subgraph dbLayer [数据库层]
        Pool[db/pool.js\nPostgreSQL 连接池]
    end

    clientLayer --> serverEntry
    serverEntry --> middlewareLayer
    middlewareLayer --> routeLayer
    routeLayer --> dbLayer
```

---

## 三、API 接口全览

### 3.1 认证与账号（`routes/auth.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| POST | `/auth/register` | 无 | 邮箱密码注册 |
| POST | `/auth/login` | 无 | 邮箱密码登录 |
| POST | `/auth/license` | 无 | License Key 登录/自动创建账号 |
| POST | `/auth/admin-register` | 无（需白名单邮箱） | 管理员注册 |
| POST | `/auth/admin-login` | 无 | 管理员登录（需 role=admin） |
| POST | `/auth/change-password` | JWT | 修改密码 |
| GET | `/auth/me` | JWT | 获取当前登录用户信息 |

> **兼容性设计**：认证路由同时挂载在 `/auth/*`、`/api/auth/*`、`/v1/auth/*`、`/*` 多个前缀下，兼容不同版本客户端与反向代理路径。

### 3.2 用户资料（`routes/profile.js` + `routes/user.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| GET | `/api/profile` | JWT | 读取用户资料 |
| PUT | `/api/profile` | JWT | 更新 displayName/avatar/bio |
| GET | `/api/user/resume-context` | JWT | 兼容接口，固定返回空（简历已迁本地） |

### 3.3 简历管理（`routes/resume.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| POST | `/api/resume/upload` | JWT | 上传简历文件（PDF/DOCX） |
| POST | `/api/resume/upload-meta` | JWT | 仅写入简历元信息 |
| GET | `/api/resume/list` | JWT | 获取当前用户简历列表 |
| GET | `/api/resume/item/:id` | JWT | 获取单条简历详情 |
| PUT | `/api/resume/item/:id` | JWT | 更新 analyzed_content |
| DELETE | `/api/resume/item/:id` | JWT | 删除简历及物理文件 |

### 3.4 录音管理（`routes/voice.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| POST | `/api/voice/upload` | JWT | 上传录音（wav/mp3/webm/m4a） |
| GET | `/api/voice/list` | JWT | 录音列表 |
| GET | `/api/voice/:id/file` | JWT | 音频流（在线播放） |
| DELETE | `/api/voice/:id` | JWT | 删除录音 |

### 3.5 面试会话（`routes/sessions.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| POST | `/api/sessions` | JWT | 创建面试会话 |
| PUT | `/api/sessions/:id` | JWT | 更新状态/轮次/结束时间 |
| POST | `/api/sessions/:id/responses` | JWT | 新增问答回合 |
| GET | `/api/sessions` | JWT | 会话列表 |
| GET | `/api/sessions/:id` | JWT | 会话详情（含全部问答） |

### 3.6 管理后台（`routes/admin.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| GET | `/api/admin/stats` | JWT + Admin | 全局统计数据 |
| GET | `/api/admin/users` | JWT + Admin | 用户列表（含计数/配额/冻结态） |
| POST | `/api/admin/users` | JWT + Admin | 管理员创建用户 |
| DELETE | `/api/admin/users/:userId` | JWT + Admin | 删除用户 |
| GET | `/api/admin/audit-logs` | JWT + Admin | 管理员审计日志 |

### 3.7 用量与配额（`routes/usage.js`）

| 方法 | 路径 | 鉴权 | 功能 |
|---|---|---|---|
| GET | `/api/admin/usage/summary` | JWT + Admin | Token 总量与用户维度汇总 |
| GET | `/api/admin/usage/detail/:userId` | JWT + Admin | 按日/按类型明细 |
| PUT | `/api/admin/usage/quota/:userId` | JWT + Admin | 修改用户配额 |
| PUT | `/api/admin/usage/freeze/:userId` | JWT + Admin | 冻结/解冻用户 |

### 3.8 AI 代理与计费（`routes/ai-proxy.js`）

| 方法 | 路径 | 鉴权 | 响应形式 | 功能 |
|---|---|---|---|---|
| POST | `/api/ai/chat` | JWT + License | SSE | 主对话流式 |
| POST | `/api/ai/enrich` | JWT + License | SSE | 追问补充流式 |
| POST | `/api/ai/resume` | JWT + License | JSON | 简历分析 |
| POST | `/api/ai/jd` | JWT + License | JSON | JD 解析 |
| POST | `/api/ai/clean` | JWT + License | JSON | 转写文本清洗 |
| POST | `/api/ai/asr` | JWT + License | JSON | 语音转写 |

---

## 四、鉴权体系详解

### 4.1 整体流程

```mermaid
flowchart TD
    Request[HTTP 请求] --> HasToken{携带 Authorization\nBearer token?}
    HasToken -- No --> Return401[返回 401]
    HasToken -- Yes --> VerifyJWT[authRequired\nJWT 验签 + 注入 req.user.id]
    VerifyJWT -- 失败 --> Return401
    VerifyJWT -- 成功 --> IsAdminRoute{访问管理接口?}
    IsAdminRoute -- No --> BusinessLogic[执行业务逻辑]
    IsAdminRoute -- Yes --> CheckRole[adminRequired\n查 users 表 role 字段]
    CheckRole -- 非 admin --> Return403[返回 403]
    CheckRole -- admin --> BusinessLogic

    subgraph aiProxyPath [AI 代理专属路径]
        CheckLicense[authJwtAndLicense\nJWT 验证 + x-license-key 解密 API Key]
        CheckQuota[检查配额/冻结状态]
        CallUpstream[调用上游 AI API]
        RecordUsage[写入 token_usage]
        AutoFreeze[超额自动冻结用户]
        CheckLicense --> CheckQuota --> CallUpstream --> RecordUsage
        RecordUsage --> AutoFreeze
    end
```

### 4.2 JWT 生命周期

1. 登录/注册成功：后端生成 JWT（payload 含 `uid`，有效期 7 天），返回给前端
2. 前端存储：`WebApi.setToken(token)` → `localStorage.userToken`
3. 每次请求：`WebApi.apiRequest` 自动附加 `Authorization: Bearer <token>`
4. 失效处理：后端返回 401 → 前端清除 token → 自动跳回 `index.html`

### 4.3 管理员注册约束

- `POST /auth/admin-register` 校验请求邮箱是否在服务端 `ADMIN_EMAILS` 白名单中（从环境变量 `ADMIN_EMAILS` 解析）
- 不在白名单的邮箱注册返回 403，防止任意人注册管理员账号

### 4.4 AI 代理双重验证

桌面软件请求 AI 接口时需同时提供：
- `Authorization: Bearer <JWT>` — 用户身份
- `x-license-key: <License Key>` — 授权凭证（后端解密出上游 API Key）

此设计确保：即使 JWT 泄露，无 License Key 也无法调用上游 AI API。

---

## 五、管理界面页面详解

### 5.1 前端统一请求层（`web/js/api.js`）

所有页面通过 `WebApi` 发起请求，核心能力：

```
WebApi.apiRequest(path, options)
  ├── 自动注入 Authorization: Bearer <token>
  ├── JSON 序列化请求体
  ├── 统一错误处理（mapErrorToUserMessage 错误码→中文提示）
  └── 401 自动清 token 并跳转 index.html

WebApi.ensureLoggedIn()
  └── GET /auth/me → 验证 token 有效性（页面加载时调用）
```

---

### 5.2 `index.html` — 管理员登录/注册页

**怎么用**

打开管理后台入口，切换 Tab 选择"登录"或"注册"；注册时需使用 `ADMIN_EMAILS` 中的邮箱。

**调用链**

```
点击提交
  → WebApi.apiRequest('/auth/admin-login' 或 '/auth/admin-register', { requireAuth: false })
  → routes/auth.js
  → 成功：WebApi.setToken(token) → 跳转 dashboard.html
  → 失败：显示中文错误提示
```

---

### 5.3 `dashboard.html` — 数据总览

**怎么用**

登录后的首页，展示当前管理员账号下的简历数量、录音数量、会话数量概览。

**调用链**

```
页面加载
  → ensureLoggedIn() → GET /auth/me
  → 并发三个请求：
      GET /api/resume/list → routes/resume.js
      GET /api/voice/list  → routes/voice.js
      GET /api/sessions    → routes/sessions.js
  → 渲染统计卡片
```

---

### 5.4 `admin.html` — 管理员中心（核心管理页）

**怎么用**

全局系统治理页面，含以下功能模块：
- **全局统计**：用户总数、简历总数、录音总数、会话总数、总 Token 消耗
- **用户管理**：查看所有用户列表，包含简历数/录音数/会话数/已用 Token/配额/冻结状态
- **用量图表**：按用户维度的 Token 消耗汇总与趋势
- **配额管理**：修改指定用户的 Token 配额上限
- **冻结控制**：一键冻结/解冻用户（冻结后该用户无法调用 AI）
- **用户创建**：直接在后台创建新用户账号
- **删除用户**：删除指定用户（不能删除自身和其他管理员）
- **审计日志**：查看最近 100 条管理操作记录，含操作人/被操作对象/时间戳

**调用链（页面加载）**

```
进入 admin.html → ensureLoggedIn()
  ├── GET /api/admin/stats          → routes/admin.js  → 全局统计卡片
  ├── GET /api/admin/users          → routes/admin.js  → 用户列表表格
  ├── GET /api/admin/usage/summary  → routes/usage.js  → 用量图表
  └── GET /api/admin/audit-logs?limit=100 → routes/admin.js → 审计日志列表
    每 10 秒自动刷新以上请求
```

**调用链（操作）**

| 操作 | 调用 |
|---|---|
| 创建用户 | POST `/api/admin/users` → `routes/admin.js` |
| 删除用户 | DELETE `/api/admin/users/:id` → `routes/admin.js` |
| 修改配额 | PUT `/api/admin/usage/quota/:id` → `routes/usage.js` |
| 冻结/解冻 | PUT `/api/admin/usage/freeze/:id` → `routes/usage.js` |
| 查看用量详情 | GET `/api/admin/usage/detail/:id` → `routes/usage.js` |

---

### 5.5 `resumes.html` — 历史简历管理

**怎么用**

> 注意：当前版本简历的新建、分析流程已迁移到桌面端本地完成，本页面仅供查看和管理历史数据。

- 查看历史上传的简历列表（文件名、上传时间）
- 点击查看解析内容（`analyzed_content` 字段）
- 支持编辑解析内容（弹窗编辑后保存）
- 支持删除（同时删除服务器物理文件）

**调用链**

```
页面加载 → GET /api/resume/list → routes/resume.js
点击查看 → GET /api/resume/item/:id → routes/resume.js
编辑保存 → PUT /api/resume/item/:id → routes/resume.js
删除     → DELETE /api/resume/item/:id → routes/resume.js（同时删除 file_path 物理文件）
```

---

### 5.6 `voices.html` — 录音管理

**怎么用**

- 上传录音文件（支持 wav/mp3/webm/m4a）
- 查看录音列表（文件名、时长、来源、上传时间）
- 在线播放录音（HTML5 `<audio>` 元素直接流式播放）
- 删除录音（同时删除服务器物理文件）

**调用链**

```
页面加载 → GET /api/voice/list → routes/voice.js
上传录音 → POST /api/voice/upload (FormData) → routes/voice.js（multer 处理）
在线播放 → <audio src="/api/voice/:id/file"> → routes/voice.js（流式返回文件）
删除     → DELETE /api/voice/:id → routes/voice.js（删 DB 记录 + 物理文件）
```

---

### 5.7 `sessions.html` — 会话记录

**怎么用**

- 查看历史面试会话列表（标题、状态、语言、开始时间、轮次数）
- 点击会话查看详情，包含全部问答回合（问题 + 回答 + 截图路径）
- 手动创建新会话

**调用链**

```
页面加载 → GET /api/sessions → routes/sessions.js
查看详情 → GET /api/sessions/:id → routes/sessions.js（含 interview_responses 联查）
创建会话 → POST /api/sessions → routes/sessions.js
```

---

## 六、AI 代理计费闭环

```mermaid
sequenceDiagram
    participant Desktop as 桌面软件
    participant AiProxy as ai-proxy.js
    participant DB as PostgreSQL
    participant AI as 上游 AI API

    Desktop->>AiProxy: POST /api/ai/chat\n携带 JWT + x-license-key
    AiProxy->>AiProxy: authJwtAndLicense 验证
    AiProxy->>DB: 查 users + token_usage 聚合\n获取配额/已用量/冻结态
    alt 已冻结或超额
        AiProxy-->>Desktop: 403 超出配额
    else 正常
        AiProxy->>AI: 携带解密后的上游 API Key 发起请求
        AI-->>AiProxy: 流式/JSON 响应
        AiProxy-->>Desktop: 转发响应（SSE 或 JSON）
        AiProxy->>DB: INSERT token_usage（实际消耗 token 数）
        AiProxy->>DB: 若总用量超额 → UPDATE users SET frozen=TRUE
    end
```

**call_type 枚举**：`chat` / `enrich` / `resume` / `jd` / `clean` / `asr`

---

## 七、部署与运维说明

### 启动方式

```bash
cd user-management
npm install
npm run migrate   # 首次部署或升级时执行数据库迁移
npm start         # 启动后端服务（默认端口 8787）
```

### 环境变量（`.env`）

| 变量 | 说明 | 示例 |
|---|---|---|
| `DATABASE_URL` | PostgreSQL 连接串 | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT 签名密钥 | 随机长字符串 |
| `ADMIN_EMAILS` | 允许注册管理员的邮箱（逗号分隔） | `admin@example.com` |
| `PORT` | 服务监听端口 | `8787` |
| `MAX_UPLOAD_MB` | 文件上传大小限制 | `10` |
| `UPLOAD_DIR` | 文件上传目录 | `uploads/` |

### 健康检查

- `GET /healthz` → 执行 `SELECT 1` 验证数据库连接，返回 `200 OK`
- 建议在容器编排（Kubernetes/Sealos）中配置此接口作为 liveness probe

---

## 八、审计日志说明

所有管理员敏感操作均写入 `admin_audit_logs` 表，包含：

| 字段 | 内容 |
|---|---|
| `admin_user_id` | 执行操作的管理员 ID |
| `admin_email` | 管理员邮箱 |
| `action` | 操作类型（如 `create_user`、`delete_user`、`freeze_user`、`update_quota`） |
| `target_user_id` | 被操作用户 ID |
| `target_email` | 被操作用户邮箱 |
| `detail` | 操作详情（JSONB，含前后值对比等） |
| `created_at` | 操作时间（带时区） |

可在 `admin.html` 的"审计日志"Tab 中查看最近 100 条记录。

---

## 九、关键实现细节补充

### 9.1 License Key 解密算法

桌面软件请求 AI 接口时携带 `x-license-key`，服务端解密出真正的上游 API Key。整个过程在 `ai-proxy.js` 的 `decryptLicenseKeyToApiKey()` 中完成：

```
License Key 格式：CD-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX（Base64 + 分隔符）

解密步骤：
① 去掉前缀 CD- 并去除所有 - 符号，得到纯 Base64 字符串
② Base64 decode → 密文字节数组
③ 固定密钥派生：
   crypto.scryptSync(
     'CheatingDaddy-2024-Secret-Key-JuliusJu-Version-572',
     'salt',
     32
   )  → 32 字节 AES 密钥
④ IV = 16 字节全零（Buffer.alloc(16, 0)）
⑤ AES-256-CBC 解密（setAutoPadding(false) 关闭自动 padding）
⑥ 手动 PKCS7 padding 校验：
   - 最后一字节 pad 必须在 1~16 范围内
   - 最后 pad 个字节必须全等于 pad
   - 校验失败抛出 'invalid license padding' 错误
⑦ 去掉 padding，UTF-8 解码，trim()
⑧ 长度 < 10 则视为无效密钥
```

**安全含义**：上游 AI API Key 从不在客户端明文存储，通过 License Key 每次请求时在服务端实时解密，客户端只持有加密后的 License Key。

---

### 9.2 `adminRequired` 中间件每次查数据库

`authRequired`（JWT 验证）只解析 token payload，不查数据库，速度快。但 `adminRequired` 在 JWT 验证之后**还要查一次数据库**：

```javascript
// middleware/admin.js
async function adminRequired(req, res, next) {
    // 此时 req.user.id 已由 authRequired 注入
    const result = await pool.query(
        `SELECT id, email, COALESCE(role, 'user') AS role FROM users WHERE id = $1 LIMIT 1`,
        [req.user.id]
    );
    const user = result.rows[0];
    if (!user || user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin only' });
    }
    req.user.role = user.role;
    req.user.email = user.email;  // ← 注入 email，供后续写审计日志使用
    return next();
}
```

**为什么不把 role 放进 JWT？**  
JWT 一旦签发就无法撤销（7 天有效）。如果管理员权限被降级，若 role 存在 JWT 里，降级后 7 天内该 token 仍然有效。查数据库确保权限变更实时生效。

**副作用**：`adminRequired` 同时把 `req.user.email` 注入，后续 `writeAdminAuditLog` 调用时可以直接使用 `req.user.email`，无需再查一次。

---

### 9.3 `GET /auth/me` 不使用 `authRequired` 中间件

其他受保护接口用 `authRequired` 中间件做验证，但 `/auth/me` 是自己实现的 token 解析：

```javascript
router.get('/me', async (req, res) => {
    const token = req.headers.authorization?.slice('Bearer '.length).trim();
    if (!token) return fail(res, 401, 'Missing bearer token', 'AUTH_TOKEN_MISSING');
    const payload = jwt.verify(token, config.jwtSecret);  // 失败直接抛异常
    const result = await pool.query(
        `SELECT id, email, license_key, created_at, COALESCE(role, 'user') AS role
         FROM users WHERE id = $1 LIMIT 1`,
        [payload.uid]
    );
    // ...
});
```

这样设计是因为 `/auth/me` 作为前端"会话恢复"的入口（`ensureLoggedIn()` 调用），需要返回完整的用户信息（含 `licenseKey`、`role`），而 `authRequired` 只注入 `req.user.id`，不够用。

---

### 9.4 结构化错误响应与 `retryable` 字段

`ai-proxy.js` 的错误响应格式比其他路由更丰富，专为客户端重试逻辑设计：

```javascript
function fail(res, status, error, code, extras = {}) {
    return res.status(status).json({
        success: false,
        status,
        error,      // 用户可见的错误描述（中文）
        code,       // 机器可读的错误码，如 'quota_exceeded'、'LICENSE_INVALID'
        reason: extras.reason || '',      // 更细的原因，如 'auto_frozen_quota_exceeded'
        retryable: Boolean(extras.retryable),  // 客户端是否应该重试
        requestId: extras.requestId || '',     // 请求追踪 ID（每次请求随机 UUID）
    });
}
```

`retryable` 字段的设置规则：
- 上游 5xx 错误 → `retryable: true`（服务端临时故障，可重试）
- 上游 429（限流）→ `retryable: true`（稍后可重试）
- 配额不足 / 账号冻结 → `retryable: false`（需充值，重试没用）
- 网络错误 → `retryable: true`

每次请求生成唯一 `requestId`（`crypto.randomUUID()`），便于日志关联和问题排查。

---

### 9.5 用量详情接口返回两套独立维度

`GET /api/admin/usage/detail/:userId` 在一次请求里**并发执行两条查询**，返回两套数据：

```javascript
const [dailyRes, byTypeRes] = await Promise.all([
    // 查询 1：按日汇总（最近 60 天）
    pool.query(`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
        FROM token_usage
        WHERE user_id = $1
        GROUP BY date_trunc('day', created_at)
        ORDER BY day DESC
        LIMIT 60
    `, [userId]),

    // 查询 2：按 call_type 汇总（无时间限制，全量）
    pool.query(`
        SELECT call_type,
               COALESCE(SUM(prompt_tokens), 0)::bigint AS prompt_tokens,
               COALESCE(SUM(completion_tokens), 0)::bigint AS completion_tokens,
               COALESCE(SUM(total_tokens), 0)::bigint AS total_tokens
        FROM token_usage
        WHERE user_id = $1
        GROUP BY call_type
        ORDER BY total_tokens DESC
    `, [userId]),
]);
```

| 数据 | 用途 |
|---|---|
| `daily`（按日，最近 60 天） | 用量趋势折线图 |
| `byType`（按 call_type，全量） | 各功能 token 占比饼图 |

`call_type` 可能的值：`chat`（主对话）、`enrich`（追问补充）、`resume`（简历分析）、`jd`（JD 解析）、`clean`（转写清洗）、`asr`（语音转写）。

---

### 9.6 管理员用户列表使用相关子查询

`GET /api/admin/users` 使用了 4 个相关子查询（correlated subquery），而非 JOIN，在用户数量较少时可接受，量大时需注意性能：

```sql
SELECT u.id, u.email, u.license_key, u.created_at,
       COALESCE(u.role, 'user') AS role,
       COALESCE(u.quota_tokens, 1000000)::bigint AS quota_tokens,
       COALESCE(u.frozen, FALSE) AS frozen,
       -- 以下 4 个均为相关子查询，每行都会单独执行一次
       (SELECT COUNT(*)::int FROM resumes r WHERE r.user_id = u.id) AS resume_count,
       (SELECT COUNT(*)::int FROM voice_recordings v WHERE v.user_id = u.id) AS voice_count,
       (SELECT COUNT(*)::int FROM interview_sessions s WHERE s.user_id = u.id) AS session_count,
       (SELECT COALESCE(SUM(tu.total_tokens), 0)::bigint
        FROM token_usage tu WHERE tu.user_id = u.id) AS used_tokens
FROM users u
ORDER BY u.created_at DESC
```

**注意**：`license_key` 在返回前端前被替换为 `***`，不暴露原始值：
```javascript
licenseKey: r.license_key ? '***' : '-',
```

---

### 9.7 bcrypt 轮数不一致（已知问题）

代码中存在 bcrypt 加密轮数不统一的情况：

| 位置 | 轮数 | 说明 |
|---|---|---|
| `auth.js`（普通用户注册） | `bcrypt.hash(password, 8)` | 8 轮 |
| `admin.js`（管理员创建用户） | `bcrypt.hash(password, 8)` | 8 轮 |
| `auth.js`（修改密码） | `bcrypt.hash(newPassword, 10)` | 10 轮 |

这是一个已知的代码不一致问题，不影响功能（bcrypt 验证时会从 hash 本身读取轮数），但在安全审计时会被提出。建议统一为 10 轮或以 `BCRYPT_ROUNDS` 环境变量配置。

---

### 9.8 资源所有权校验（user_id 隔离）

所有涉及用户数据的接口都采用 **SQL 级 user_id 校验**，确保用户只能访问自己的资源，不依赖前端传参：

| 路由 | 校验方式 |
|---|---|
| `resume` item/get/put/delete | `WHERE id = $1 AND user_id = $2`（`$2` 来自 `req.user.id`） |
| `voice` list/get/delete | `WHERE user_id = $1` 或 `WHERE id = $1 AND user_id = $2` |
| `sessions` list/get/put | `WHERE user_id = $1` 或 `WHERE id = $1 AND user_id = $2` |
| `sessions` POST responses | 先 `SELECT id FROM interview_sessions WHERE id=$1 AND user_id=$2` 校验归属，再 INSERT |
| `profile` get/put | 始终用 `req.user.id` 查/写，无跨用户可能 |

**关键点**：即使攻击者篡改 URL 中的 `id` 参数，只要 `user_id` 不匹配，查询返回 0 行，接口返回 404。这是多租户隔离的核心实现。

---

### 9.9 路由挂载顺序（必须遵守）

`user-management/src/index.js` 中路由挂载顺序有明确约束：

```
① auth 路由挂载到多个前缀：/auth、/api/auth、/v1/auth、/（兼容老客户端）
② 业务路由：/api/user、/api/resume、/api/profile、/api/voice、/api/sessions
③ usage 必须在 admin 之前：app.use('/api/admin/usage', usageRoutes)
   app.use('/api/admin', adminRoutes)
   → 否则 /api/admin/usage/summary 会被 admin 前缀匹配，导致 404
④ AI 代理：/api/ai
⑤ 静态文件最后挂载：app.use('/', express.static(webRoot))
   → 未匹配的请求才走静态文件，API 优先
```

---

### 9.10 文件上传安全策略（multer）

| 策略 | resume | voice |
|---|---|---|
| 文件名生成 | `resume_${Date.now()}_${random}.pdf` | `voice_${Date.now()}_${random}.wav` |
| 扩展名校验 | 白名单 `.pdf`、`.docx`（不信任 mimetype） | 白名单 `.wav`、`.mp3`、`.webm`、`.m4a` |
| 中文文件名 | `fixFilenameEncoding`：Buffer(name, 'latin1').toString('utf8') | 无特殊处理 |
| 存储路径 | `uploadDirAbs` | `uploadDirAbs/voice/` 子目录 |
| 大小限制 | `config.maxUploadBytes`（默认 10MB） | 同上 |

---

### 9.11 简历上传时的 License 计费链路

`POST /api/resume/upload` 会从 `users` 表读取当前用户的 `license_key`，用 `utils/decryptLicense.js` 解密得到 API Key，传给 `createResume` 作为 `modelApiKey`。这样简历 AI 解析走的是**用户自己的上游 API Key**，计费算在用户侧，而非服务端。若用户无 license_key，则使用 `config.modelApiKey`（环境变量）作为备用。

---

### 9.12 录音文件流式返回

`GET /api/voice/:id/file` 使用 `fs.createReadStream(row.file_path).pipe(res)` 流式返回，避免大文件一次性读入内存。同时设置 `Content-Type`（来自 `mimetype`）和 `Content-Disposition: inline; filename="..."`，支持浏览器内嵌播放。

---

### 9.13 删除资源时的物理文件清理

resume 和 voice 的 DELETE 接口在数据库 `DELETE ... RETURNING file_path` 后，会尝试 `fs.unlinkSync(filePath)` 删除物理文件。删除逻辑包裹在 `try { ... } catch (_) {}` 中**静默失败**——若文件已被手动删除或路径异常，不影响接口返回成功，避免因物理文件缺失导致整体失败。

---

### 9.14 简历解析不走 ai-proxy，不计入 token_usage

`POST /api/resume/upload` 的 AI 解析链路与 ai-proxy **完全独立**：

```
resume.js (upload) → resumeService.createResume → resumeAnalyzer.analyzeResume
  → 直接 fetch(config.modelApiBase + '/chat/completions')
  → 不经过 /api/ai/*，不调用 authJwtAndLicense，不检查配额，不写入 token_usage
```

- 简历解析使用 `config.modelApiBase`、`config.modelApiKey`（或用户 License 解密后的 apiKey）
- ai-proxy 使用 `config.aiApiBase`，两者可配置不同上游
- **业务含义**：简历解析的 token 消耗**不计入用户配额**，也不受冻结影响；若需统一计费，需将简历解析迁入 ai-proxy 或单独记录

---

### 9.15 事务使用 pool.connect() 获取独立连接

配额修改、冻结、创建用户、删除用户等需事务保护的操作，使用 `pool.connect()` 获取**独立连接**，确保 `BEGIN`/`COMMIT`/`ROLLBACK` 在同一连接上执行：

```javascript
let client = null;
try {
    client = await pool.connect();   // 从连接池取出一个连接
    await client.query('BEGIN');
    // ... 业务 SQL 全部用 client.query，不用 pool.query
    await client.query('COMMIT');
} catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (_e) {}
    // ...
} finally {
    if (client) client.release();    // 必须归还连接，否则连接泄漏
}
```

若用 `pool.query` 执行事务，每次 query 可能从池中取不同连接，事务会失效。

---

### 9.16 前端 api.js 的同域部署要求

`web/js/api.js` 中 `getBaseUrl()` 返回 `window.location.origin`，即 API 请求发往**当前页面所在域名**：

```javascript
function getBaseUrl() {
    return window.location.origin.replace(/\/$/, '');
}
// fetch(`${getBaseUrl()}${path}`)  → 例如 https://example.com/api/resume/list
```

**含义**：管理界面（`/admin.html` 等）与后端 API（`/api/*`）必须**同域部署**。若前后端分离（如 admin 在 `admin.example.com`，API 在 `api.example.com`），需配置反向代理将两者统一到同一 origin，或修改 api.js 支持可配置的 `API_BASE_URL`。

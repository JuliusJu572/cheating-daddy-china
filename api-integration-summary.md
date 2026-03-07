# API Integration Summary (Focused)

本文档仅聚焦于**用户认证**与**计费风控**（Token 记录、用户冻结、配额超限）的核心交互逻辑。

## 1. 全局配置 (Global Configuration)

### 1.1 Base URLs
| 配置项 | 默认值 | 描述 |
| :--- | :--- | :--- |
| `userApiBase` | `https://muwadxphkifm.sealoshzh.site` | 用户服务 API 地址 |
| `PROXY_API_BASE` | 同 `userApiBase` | AI 代理服务地址（负责计费） |

### 1.2 认证机制
- **Token**: `Authorization: Bearer {token}`
- **存储**: 本地 `config.json` 中的 `userAuthToken` 字段。

---

## 2. 核心请求封装与拦截 (Core Request Wrappers)

### 2.1 用户业务请求 (`userApiRequest`)
用于常规业务接口（如登录）。

- **401 拦截**: 若响应状态码为 `401`，触发 `notifyUserAuthExpired`，前端将自动清除本地 Token 并提示用户重新登录。

### 2.2 AI 计费请求 (`callUserAiProxyJson`)
用于所有需要消耗 Token 的 AI 代理接口。**这是计费与风控的核心入口。**

- **机制**:
    - 所有 AI 请求均通过此函数发送到 `PROXY_API_BASE`。
    - 后端在此处进行 Token 扣费统计。
- **关键异常处理**:
    - 检测响应中的错误码，拦截以下两种特定状态：
        1.  **`quota_exceeded`**: 配额超限（Token 用尽）。
        2.  **`account_frozen`**: 账户已被冻结。
    - 抛出 `createAccountLimitError` 异常对象，供上层 UI 捕获并展示对应弹窗或提示。

---

## 3. 关键 API 接口 (Key API Endpoints)

### 3.1 用户认证 (Authentication)

| 接口名称 | 方法 | 路径 | 鉴权 | 描述 |
| :--- | :--- | :--- | :--- | :--- |
| **登录** | POST | `/auth/login` | 否 | 获取 Token 的主要途径。 |
| **获取信息** | GET | `/auth/me` | 是 | 验证 Token 有效性并获取当前用户状态。 |

#### 接口详情

**1. 登录 (Login)**

- **URL**: `/auth/login`
- **Method**: `POST`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "your_password"
  }
  ```
- **Response Data** (Success 200):
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 12345,
      "email": "user@example.com"
    }
  }
  ```

**2. 获取用户信息 (Get Profile)**

- **URL**: `/auth/me`
- **Method**: `GET`
- **Response Data** (Success 200):
  ```json
  {
    "user": {
      "id": 12345,
      "email": "user@example.com"
    }
  }
  ```

### 3.2 AI 代理与计费 (AI Proxy & Billing)

所有 AI 功能（简历分析、对话、转写等）均通过 POST 请求发送至 `/api/ai/*` 路径。虽业务参数不同，但**计费逻辑一致**：

- **通用路径模式**: `POST /api/ai/{service_name}`
- **响应头/体包含计费信息**:
    - 后端在处理这些请求时会自动记录 Token Usage。
    - 如果用户余额不足或账户异常，接口将直接返回 4xx/5xx 错误及特定错误码（见下文）。

---

## 4. 风控与计费状态处理 (Risk Control & Billing Handling)

前端通过统一的错误处理机制来响应后端的计费状态。

### 4.1 错误码对照表

| 错误码 (Error Code) | 含义 | 前端行为 |
| :--- | :--- | :--- |
| `quota_exceeded` | **配额超限** | 抛出特定异常，前端识别后提示用户“余额不足”或“请充值”。 |
| `account_frozen` | **账户冻结** | 抛出特定异常，前端识别后强制阻断操作并提示“账户已被冻结”。 |
| `401 Unauthorized` | **登录过期** | 触发登出流程，清除本地 Token。 |

### 4.2 实现逻辑示例
在 `callUserAiProxyJson` (src/index.js) 中：

```javascript
const res = await fetch(url, ...);
const data = await res.json();

if (!res.ok) {
    // 核心风控拦截
    if (data?.code === 'quota_exceeded' || data?.code === 'account_frozen') {
        throw createAccountLimitError(res.status, data, `Error: ${data.code}`);
    }
    // 其他错误
    throw new Error(...);
}
// 成功，后端已自动计费
return data;
```
## 测试账号

正常
juliusju572@qq.com
12345678

冻结
test6@qq.com
12345678

无配额
12345@qq.com
12345678
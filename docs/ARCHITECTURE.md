# 作弊老铁 - 系统逻辑结构图

> 生成时间：2026-03-03

---

## 1. 整体架构

```mermaid
flowchart TB
    subgraph Electron["🖥️ Electron 桌面应用"]
        direction TB
        App[CheatingDaddyApp]
        App --> Onboarding[OnboardingView<br/>首次引导]
        App --> Auth[AuthView<br/>登录/注册]
        App --> Main[MainView<br/>主界面]
        App --> Customize[CustomizeView<br/>定制/简历管理]
        App --> Advanced[AdvancedView<br/>高级设置]
        App --> Assistant[AssistantView<br/>AI 对话]
        App --> History[HistoryView]
        App --> Help[HelpView]
    end

    subgraph MainProcess["⚙️ 主进程 (src/index.js)"]
        IPC[IPC Handlers]
        Config[本地配置]
        Session[AI Session<br/>Qwen/Gemini]
    end

    subgraph Backend["🔧 user-management 后端"]
        API[Express API]
        API --> AuthAPI[/auth]
        API --> ResumeAPI[/api/resume]
        API --> UserAPI[/api/user]
        API --> VoiceAPI[/api/voice]
        API --> SessionsAPI[/api/sessions]
        API --> AdminAPI[/api/admin]
    end

    subgraph DB[(PostgreSQL)]
        Users[users]
        Resumes[resumes]
        Voices[voice_recordings]
        Sessions[interview_sessions]
    end

    Electron <-->|IPC| MainProcess
    MainProcess <-->|HTTP| Backend
    Backend <--> DB
```

---

## 2. 应用入口流程

```mermaid
stateDiagram-v2
    [*] --> Onboarding: 首次启动
    Onboarding --> Auth: 完成引导
    Onboarding --> Main: 跳过引导
    Auth --> Main: 登录成功 / 跳过
    Auth --> Main: 401 时返回
    Main --> Customize: 点击定制
    Main --> Advanced: 点击高级
    Main --> Assistant: 开始会话
```

---

## 3. 认证与用户流程

```mermaid
flowchart LR
    subgraph 客户端
        A1[AuthView<br/>邮箱+密码]
        A2[Web 管理后台<br/>License Key]
        A3[AdvancedView<br/>配置 userApiBase]
    end

    subgraph 主进程
        S1[set-user-auth]
        S2[get-user-auth]
        S3[user-login]
        S4[user-register]
        S5[user-license-login]
        S6[user-logout]
    end

    subgraph 后端 auth
        B1[POST /auth/login]
        B2[POST /auth/register]
        B3[POST /auth/license]
        B4[GET /auth/me]
    end

    A1 --> S3
    A1 --> S4
    A2 --> B3
    S3 --> B1
    S4 --> B2
    S5 --> B3
    S1 --> |token| Config
    S2 --> Config
    B1 --> |token| S1
    B2 --> |token| S1
    B3 --> |token| S1
```

**当前状态**：
- 软件内：使用 `/auth/license` 登录（所有人共用同一 License Key）
- Web 管理后台：使用 `/auth/admin-login`（邮箱 + 密码），仅 `ADMIN_EMAILS` 中配置的邮箱可注册/登录，且需 role=admin

---

## 4. 简历管理流程

```mermaid
flowchart TB
    subgraph 软件内 CustomizeView
        U1[上传简历]
        U2[简历列表]
        U3[编辑解析内容]
    end

    subgraph IPC
        P1[user-upload-resume]
        P2[user-list-resumes]
        P3[user-get-resume]
        P4[user-update-resume]
    end

    subgraph 后端 API
        R1[POST /api/resume/upload]
        R2[GET /api/resume/list]
        R3[GET /api/resume/item/:id]
        R4[PUT /api/resume/item/:id]
    end

    subgraph 服务层
        S1[resumeService.createResume]
        S2[resumeAnalyzer.analyzeResume]
    end

    subgraph 数据库
        T[(resumes 表)]
    end

    U1 --> P1 --> R1 --> S1 --> S2
    S1 --> T
    U2 --> P2 --> R2 --> T
    U3 --> P3 --> R3 --> T
    U3 --> P4 --> R4 --> T
```

**简历解析**：上传 → 提取文本(PDF/DOCX) → 大模型分析 → 存入 `analyzed_content` → 可编辑

---

## 5. 面试会话与简历上下文注入

```mermaid
flowchart TB
    subgraph 启动会话
        I1[initialize-model]
        I2[fetchResumeContext]
        I3[mergeCustomPrompt]
        I4[getSystemPrompt]
    end

    subgraph 数据来源
        RC[GET /api/user/resume-context]
        DB[(最新简历<br/>analyzed_content)]
    end

    subgraph 系统提示
        SP[profile intro + format + content]
        UC[User-provided context<br/>-----]
        RC2[resumeContext]
        CP[customPrompt]
    end

    subgraph AI
        QW[Qwen Session]
        GM[Gemini Session]
    end

    I1 --> I2 --> RC --> DB
    I1 --> I3
    I3 --> |left| RC2
    I3 --> |right| CP
    I3 --> |merged| I4
    I4 --> SP
    I4 --> UC
    UC --> RC2
    I4 --> QW
    I4 --> GM
```

**关键**：`analyzed_content` 作为「用户提供的上下文」注入面试 AI 的系统提示，用于面试辅导、模拟面试。

---

## 6. Web 管理门户结构（仅管理员）

```mermaid
flowchart TB
    subgraph 静态页面
        W1[index.html<br/>管理员 License Key]
        W2[dashboard.html]
        W3[resumes.html]
        W4[voices.html]
        W5[sessions.html]
        W6[admin.html]
    end

    subgraph 导航
        W2 --> W3
        W2 --> W4
        W2 --> W5
        W2 --> W6
    end

    W1 --> |/auth/admin-login<br/>邮箱+密码，ADMIN_EMAILS| W2
    W6 --> |仅 admin role| 管理员统计
```

**说明**：软件内不展示 Web 管理后台入口，用户所有操作在软件内完成。Web 端仅管理员通过配置的 License Key 登录。

---

## 7. 数据库表关系（简要）

```mermaid
erDiagram
    users ||--o{ resumes : has
    users ||--o{ voice_recordings : has
    users ||--o{ interview_sessions : has
    users ||--o| user_profiles : has

    interview_sessions ||--o{ interview_responses : has

    users {
        bigint id PK
        text email
        text password_hash
        text license_key
        text role
    }

    resumes {
        bigint id PK
        bigint user_id FK
        text file_path
        text original_filename
        text raw_text
        text analyzed_content
    }
```

---

## 8. 关键 IPC 一览

| IPC | 用途 |
|-----|------|
| `get-user-auth` | 获取当前登录状态 |
| `set-user-auth` | 设置 token / userApiBase |
| `user-login` / `user-register` / `user-license-login` | 认证 |
| `user-upload-resume` | 上传并解析简历 |
| `user-list-resumes` | 简历列表 |
| `user-get-resume` | 获取单份简历详情 |
| `user-update-resume` | 更新解析内容 |
| `initialize-model` | 初始化 AI 会话（含简历上下文） |
| `send-text-message` / `send-image-content` | 发送消息给 AI |
| `commit-transcript-segment` | 提交转写片段 |

---

## 9. 配置存储

```mermaid
flowchart LR
    subgraph 主进程
        C[getLocalConfig]
    end

    subgraph 存储
        F[config.json<br/>或 内存]
    end

    C --> F

    F --> |userApiBase| 后端地址
    F --> |userAuthToken| JWT
    F --> |apiKey| 模型 Key
    F --> |modelApiBase| 模型 API 地址
```

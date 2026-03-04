import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AuthView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            box-sizing: border-box;
            user-select: none;
        }

        :host {
            display: block;
            max-width: 560px;
            margin: 0 auto;
            padding: 20px 12px;
        }

        .card {
            background: var(--card-background, rgba(255, 255, 255, 0.04));
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
            border-radius: 10px;
            padding: 18px;
            display: grid;
            gap: 14px;
        }

        .title {
            font-size: 18px;
            font-weight: 700;
            color: var(--text-color);
        }

        .subtitle {
            font-size: 12px;
            line-height: 1.4;
            color: var(--description-color, rgba(255, 255, 255, 0.65));
        }

        .tabs {
            display: flex;
            gap: 8px;
        }

        .tab-btn {
            flex: 1;
            padding: 8px 10px;
            border-radius: 8px;
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.2));
            background: transparent;
            color: var(--text-color);
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            opacity: 0.75;
        }

        .tab-btn.active {
            opacity: 1;
            background: var(--button-hover-background, rgba(255, 255, 255, 0.12));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.3));
        }

        .field {
            display: grid;
            gap: 6px;
        }

        .label {
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            font-weight: 500;
        }

        .input {
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            border-radius: 8px;
            padding: 10px 12px;
            font-size: 13px;
        }

        .input:focus {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
        }

        .service-info {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.55));
            line-height: 1.4;
        }

        .btn-row {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .btn {
            border-radius: 8px;
            padding: 9px 12px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.2));
            cursor: pointer;
        }

        .btn.primary {
            color: #fff;
            background: #2563eb;
            border-color: #2563eb;
        }

        .btn.secondary {
            color: var(--text-color);
            background: transparent;
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .status {
            font-size: 12px;
            border-radius: 8px;
            padding: 8px 10px;
            border: 1px solid transparent;
        }

        .status.success {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            border-color: rgba(34, 197, 94, 0.3);
        }

        .status.error {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.3);
        }

        .status.info {
            background: rgba(59, 130, 246, 0.1);
            color: #60a5fa;
            border-color: rgba(59, 130, 246, 0.3);
        }
    `;

    static properties = {
        mode: { type: String },
        email: { type: String },
        password: { type: String },
        isLoading: { type: Boolean },
        statusMessage: { type: String },
        statusType: { type: String },
        userApiBase: { type: String },
        onAuthComplete: { type: Function },
        onSkip: { type: Function },
    };

    constructor() {
        super();
        this.mode = 'login';
        this.email = '';
        this.password = '';
        this.isLoading = false;
        this.statusMessage = '';
        this.statusType = 'info';
        this.userApiBase = '';
        this.onAuthComplete = () => {};
        this.onSkip = () => {};
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadUserAuthConfig();
    }

    async loadUserAuthConfig() {
        if (!window.require) return;
        try {
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('get-user-auth');
            if (res?.success) {
                this.userApiBase = String(res.userApiBase || '').trim();
                localStorage.setItem('userApiBase', this.userApiBase);
            }
            if (!this.userApiBase) {
                this.statusType = 'error';
                this.statusMessage = '用户服务地址未配置，请先到高级设置配置 userApiBase。';
            }
        } catch (error) {
            this.statusType = 'error';
            this.statusMessage = '读取用户服务配置失败: ' + (error?.message || '未知错误');
        }
        this.requestUpdate();
    }

    setMode(mode) {
        this.mode = mode;
        this.statusMessage = '';
        this.requestUpdate();
    }

    async handleSubmit() {
        if (this.isLoading) return;
        const email = this.email.trim();
        const password = this.password.trim();
        if (!email || !password) {
            this.statusType = 'error';
            this.statusMessage = '请填写邮箱和密码。';
            this.requestUpdate();
            return;
        }
        if (!this.userApiBase) {
            this.statusType = 'error';
            this.statusMessage = '请先配置用户服务地址（userApiBase）。';
            this.requestUpdate();
            return;
        }

        this.isLoading = true;
        this.statusType = 'info';
        this.statusMessage = this.mode === 'login' ? '登录中...' : '注册中...';
        this.requestUpdate();

        try {
            const { ipcRenderer } = window.require('electron');
            const channel = this.mode === 'login' ? 'user-login' : 'user-register';
            const res = await ipcRenderer.invoke(channel, { email, password });
            if (!res?.success) {
                this.statusType = 'error';
                this.statusMessage = res?.error || '操作失败';
                return;
            }
            this.statusType = 'success';
            this.statusMessage = this.mode === 'login' ? '登录成功，正在进入主页...' : '注册成功，正在进入主页...';
            this.password = '';
            this.requestUpdate();
            if (typeof this.onAuthComplete === 'function') {
                this.onAuthComplete(res.user || null);
            }
        } catch (error) {
            this.statusType = 'error';
            this.statusMessage = '操作失败: ' + (error?.message || '未知错误');
        } finally {
            this.isLoading = false;
            this.requestUpdate();
        }
    }

    render() {
        return html`
            <div class="card">
                <div class="title">账号登录</div>
                <div class="subtitle">登录后可同步管理简历、录音与面试记录。你也可以先跳过，后续在应用内再登录。</div>

                <div class="tabs">
                    <button class="tab-btn ${this.mode === 'login' ? 'active' : ''}" @click=${() => this.setMode('login')} ?disabled=${this.isLoading}>
                        邮箱登录
                    </button>
                    <button
                        class="tab-btn ${this.mode === 'register' ? 'active' : ''}"
                        @click=${() => this.setMode('register')}
                        ?disabled=${this.isLoading}
                    >
                        邮箱注册
                    </button>
                </div>

                <div class="field">
                    <label class="label">邮箱</label>
                    <input
                        class="input"
                        type="email"
                        placeholder="your@email.com"
                        .value=${this.email}
                        @input=${e => (this.email = e.target.value)}
                        ?disabled=${this.isLoading}
                    />
                </div>

                <div class="field">
                    <label class="label">密码</label>
                    <input
                        class="input"
                        type="password"
                        placeholder="请输入密码"
                        .value=${this.password}
                        @input=${e => (this.password = e.target.value)}
                        ?disabled=${this.isLoading}
                    />
                </div>


                ${this.statusMessage
                    ? html`<div class="status ${this.statusType}">${this.statusMessage}</div>`
                    : ''}

                <div class="btn-row">
                    <button class="btn primary" @click=${this.handleSubmit} ?disabled=${this.isLoading}>
                        ${this.isLoading ? '处理中...' : this.mode === 'login' ? '登录' : '注册'}
                    </button>
                    <button class="btn secondary" @click=${() => this.onSkip()} ?disabled=${this.isLoading}>跳过，稍后登录</button>
                </div>
            </div>
        `;
    }
}

customElements.define('auth-view', AuthView);

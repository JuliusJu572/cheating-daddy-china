import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class MainView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        .welcome {
            font-size: 24px;
            margin-bottom: 8px;
            font-weight: 600;
            margin-top: auto;
        }

        .status-display {
            margin-bottom: 16px;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .status-display.has-key {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            color: #22c55e;
        }

        .status-display.no-key {
            background: rgba(251, 191, 36, 0.1);
            border: 1px solid rgba(251, 191, 36, 0.3);
            color: #fbbf24;
        }

        .status-icon {
            font-size: 18px;
        }

        .input-group {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
        }

        .input-group input {
            flex: 1;
        }

        input {
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 14px;
            width: 100%;
            border-radius: 8px;
            font-size: 14px;
            transition: border-color 0.2s ease;
        }

        input:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        input::placeholder {
            color: var(--placeholder-color);
        }

        .start-button {
            background: #ffffff;
            color: #333333;
            border: 1px solid #e5e7eb;
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            cursor: pointer;
            transition: all 0.15s ease;
            width: auto;
            min-width: 80px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            align-self: flex-start;
        }

        .start-button:hover {
            background: #f9fafb;
            border-color: #d1d5db;
            color: #000000;
            transform: translateY(0);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .start-button:active {
            background: #f3f4f6;
            box-shadow: none;
        }

        .start-button:disabled, .start-button.disabled {
            background: #f3f4f6;
            color: #9ca3af;
            border-color: #e5e7eb;
            cursor: not-allowed;
            box-shadow: none;
        }

        .secondary-button {
            background: transparent;
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .secondary-button:hover {
            background: var(--button-hover-background);
            border-color: var(--button-hover-border);
        }

        .shortcut-icons {
            display: flex;
            align-items: center;
            gap: 2px;
            margin-left: 4px;
        }

        .shortcut-icons svg {
            width: 14px;
            height: 14px;
        }

        .shortcut-icons svg path {
            stroke: currentColor;
        }

        .description {
            color: var(--description-color);
            font-size: 14px;
            margin-bottom: 24px;
            line-height: 1.5;
        }

        .link {
            color: var(--link-color);
            text-decoration: underline;
            cursor: pointer;
        }

        .shortcut-hint {
            color: var(--description-color);
            font-size: 11px;
            opacity: 0.8;
        }

        .error-message {
            color: #ef4444;
            font-size: 12px;
            margin-top: 4px;
        }

        .status-message {
            margin-top: 8px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            text-align: center;
        }

        .status-success {
            background: rgba(34, 197, 94, 0.1);
            color: #22c55e;
            border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .status-error {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }

        .status-info {
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
            border: 1px solid rgba(59, 130, 246, 0.2);
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 500px;
        }
    `;

    static properties = {
        onStart: { type: Function },
        onAPIKeyHelp: { type: Function },
        isInitializing: { type: Boolean },
        onLayoutModeChange: { type: Function },
        onOpenSettings: { type: Function },
        _licenseKeyValue: { type: String, state: true },
        _emailValue: { type: String, state: true },
        _passwordValue: { type: String, state: true },
        _authStep: { type: String, state: true },
        _authState: { type: String, state: true },
        _userEmail: { type: String, state: true },
        hasApiKey: { type: Boolean, state: true },
        _statusMessage: { type: String, state: true },
        _statusType: { type: String, state: true },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.onAPIKeyHelp = () => {};
        this.onOpenSettings = () => {};
        this.isInitializing = false;
        this.onLayoutModeChange = () => {};
        this._licenseKeyValue = '';
        this._emailValue = localStorage.getItem('userLoginEmail') || '';
        this._passwordValue = localStorage.getItem('userLoginPassword') || '';
        this._authStep = 'license';
        this._authState = 'idle';
        this._userEmail = '';
        this.hasApiKey = !!localStorage.getItem('apiKey');
        this._statusMessage = '';
        this._statusType = '';
        this._onAuthExpired = this.handleAuthExpired.bind(this);
        this.boundKeydownHandler = this.handleKeydown.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();
        const hydrated = window.__configHydrated;
        if (hydrated && typeof hydrated.then === 'function') {
            hydrated
                .then(() => {
                    this.initializeAuthFlow();
                })
                .catch(() => {});
        } else {
            this.initializeAuthFlow();
        }

        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });
        window.electron?.ipcRenderer?.on('user-auth-expired', this._onAuthExpired);
        // Listen for account status changes (e.g. frozen)
        window.electron?.ipcRenderer?.on('auth-status-changed', (event, data) => {
            if (data && data.status === 'frozen') {
                this._statusMessage = data.message || '账户已被冻结';
                this._statusType = 'error';
                // Force logout flow
                this.handleAuthExpired();
            }
        });
        document.addEventListener('keydown', this.boundKeydownHandler);
        this.loadLayoutMode();
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.electron?.ipcRenderer?.removeAllListeners('session-initializing');
        window.electron?.ipcRenderer?.removeListener?.('user-auth-expired', this._onAuthExpired);
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    handleKeydown(e) {
        const isMac = navigator.platform.toLowerCase().includes('mac') ||
              navigator.userAgent.toLowerCase().includes('mac') ||
              process.platform === 'darwin';
        const isCmdOrCtrlEnter = isMac
            ? (e.metaKey && !e.ctrlKey && e.key === 'Enter')
            : (!e.metaKey && e.ctrlKey && e.key === 'Enter');

        if (isCmdOrCtrlEnter && this._authStep === 'ready') {
            e.preventDefault();
            this.handleStartClick();
            return;
        }

        if (isCmdOrCtrlEnter && (this._authStep === 'license' || this._authStep === 'login')) {
            e.preventDefault();
            this.handleStartClick();
        }
    }

    async initializeAuthFlow() {
        this.hasApiKey = !!localStorage.getItem('apiKey');
        this._authState = 'idle';
        this._statusMessage = '';
        this._statusType = '';
        try {
            let ipcRenderer = null;
            if (window.require) {
                ipcRenderer = window.require('electron').ipcRenderer;
            } else if (window.electron?.ipcRenderer) {
                ipcRenderer = window.electron.ipcRenderer;
            }
            if (!ipcRenderer) return;
            const sessionRes = await ipcRenderer.invoke('auth-get-session');
            const hasToken = !!sessionRes?.ok && !!sessionRes?.data?.hasToken;
            if (!this.hasApiKey) {
                this._authStep = 'license';
                return;
            }
            if (!hasToken) {
                this._authStep = 'login';
                return;
            }
            const meRes = await ipcRenderer.invoke('auth-me');
            if (meRes?.ok) {
                const user = meRes?.data?.user || {};
                this._userEmail = String(user?.email || '');
                this._authStep = 'ready';
                localStorage.setItem('userAuthToken', sessionRes?.data?.token || '');
                localStorage.setItem('userProfile', JSON.stringify(user || {}));
            } else {
                this._authStep = 'login';
            }
        } catch (_) {
            this._authStep = this.hasApiKey ? 'login' : 'license';
        } finally {
            this.requestUpdate();
        }
    }

    handleAuthExpired() {
        localStorage.removeItem('userAuthToken');
        localStorage.removeItem('userProfile');
        this._authStep = this.hasApiKey ? 'login' : 'license';
        this._userEmail = '';
        this._statusMessage = '登录状态已过期，请重新登录';
        this._statusType = 'error';
        this.requestUpdate();
    }

    async handleLicenseInput(e) {
        this._licenseKeyValue = e.target.value || '';
        this._statusMessage = '';
        this.requestUpdate();
    }

    async handleEmailInput(e) {
        this._emailValue = e.target.value || '';
        localStorage.setItem('userLoginEmail', this._emailValue);
        this._statusMessage = '';
        this.requestUpdate();
    }

    async handlePasswordInput(e) {
        this._passwordValue = e.target.value || '';
        localStorage.setItem('userLoginPassword', this._passwordValue);
        this._statusMessage = '';
        this.requestUpdate();
    }

    async handleStartClick() {
        if (this.isInitializing) {
            return;
        }

        if (this._authStep === 'ready') {
            this.onStart();
            return;
        }

        if (this._authStep === 'license') {
            await this.handleLicenseValidate();
            return;
        }

        if (this._authStep === 'login') {
            await this.handleUserLogin();
        }
    }

    async handleLicenseValidate() {
        const key = this._licenseKeyValue.trim();

        if (!key) {
            this._statusMessage = '请输入License Key';
            this._statusType = 'error';
            this.requestUpdate();
            return;
        }

        if (!/^CD-/i.test(key)) {
            this._statusMessage = 'License Key格式无效，应以CD-开头';
            this._statusType = 'error';
            this.requestUpdate();
            return;
        }

        this._authState = 'validating';
        this._statusMessage = '正在验证License Key...';
        this._statusType = 'info';
        this.requestUpdate();

        try {
            let ipcRenderer = null;
            if (window.require) {
                ipcRenderer = window.require('electron').ipcRenderer;
            } else if (window.electron?.ipcRenderer) {
                ipcRenderer = window.electron.ipcRenderer;
            }

            if (!ipcRenderer) {
                throw new Error('无法连接到主进程');
            }

            // 解密License Key
            const decryptRes = await ipcRenderer.invoke('decrypt-license-key', key);

            if (!decryptRes?.success || !decryptRes.apiKey) {
                this._statusMessage = 'License Key无效，解密失败';
                this._statusType = 'error';
                this.requestUpdate();
                return;
            }

            const apiKey = decryptRes.apiKey;
            const apiBase = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

            // 测试连接
            const connectRes = await ipcRenderer.invoke('test-model-connection', {
                apiBase: apiBase,
                headers: { Authorization: `Bearer ${apiKey}` }
            });

            if (!connectRes?.success) {
                this._statusMessage = 'API连接测试失败，请检查License Key';
                this._statusType = 'error';
                this.requestUpdate();
                return;
            }

            // 保存解密后的API Key
            localStorage.setItem('licenseKey', key);
            localStorage.setItem('apiKey', apiKey);
            await ipcRenderer.invoke('set-license-key', { licenseKey: key, apiKey });

            this._authState = 'persisting';
            this._statusMessage = 'License Key验证成功，请登录账号';
            this._statusType = 'success';
            this.hasApiKey = true;
            this._authStep = 'login';
            this._licenseKeyValue = '';
        } catch (error) {
            console.error('验证License Key错误:', error);
            this._statusMessage = '验证失败: ' + (error?.message || '未知错误');
            this._statusType = 'error';
        } finally {
            this._authState = 'idle';
            this.requestUpdate();
        }
    }

    formatErrorMessage(res, fallback) {
        const code = String(res?.code || '');
        if (code === 'quota_exceeded') return '配额已用尽，请充值后再试';
        if (code === 'account_frozen') return '账户已被冻结，请联系管理员';
        if (code === 'auth_expired') return '登录已过期，请重新登录';
        if (code === 'insufficient_balance') return '余额不足，无法开始会话';
        return String(res?.message || fallback || '请求失败');
    }

    async handleUserLogin() {
        const email = this._emailValue.trim();
        const password = this._passwordValue;
        if (!email || !password) {
            this._statusMessage = '请输入邮箱和密码';
            this._statusType = 'error';
            this.requestUpdate();
            return;
        }
        this._authState = 'validating';
        this._statusMessage = '正在登录账号...';
        this._statusType = 'info';
        this.requestUpdate();
        try {
            let ipcRenderer = null;
            if (window.require) {
                ipcRenderer = window.require('electron').ipcRenderer;
            } else if (window.electron?.ipcRenderer) {
                ipcRenderer = window.electron.ipcRenderer;
            }
            if (!ipcRenderer) {
                throw new Error('无法连接到主进程');
            }
            const loginRes = await ipcRenderer.invoke('auth-login', { email, password });
            if (!loginRes?.ok) {
                this._statusMessage = this.formatErrorMessage(loginRes, '登录失败');
                this._statusType = 'error';
                this.requestUpdate();
                return;
            }
            const user = loginRes?.data?.user || {};
            const token = loginRes?.data?.token || '';
            
            // Client-side check for frozen/balance after login
            if (user.frozen) {
                this._statusMessage = '登录失败：账户已被冻结';
                this._statusType = 'error';
                // Logout immediately
                await ipcRenderer.invoke('auth-logout');
                localStorage.removeItem('userAuthToken');
                localStorage.removeItem('userProfile');
                this.requestUpdate();
                return;
            }
            
            // Check quota if available
            const quota = Number(user.quotaTokens ?? user.quota ?? 0);
            const used = Number(user.usedTokens ?? user.used ?? 0);
            // If quota > 0 and used >= quota, block.
            // Also block if quota is 0 (new account with no quota or exhausted)
            if ((quota > 0 && used >= quota) || quota <= 0) {
                this._statusMessage = '登录失败：账户余额不足';
                this._statusType = 'error';
                 // Logout immediately
                await ipcRenderer.invoke('auth-logout');
                localStorage.removeItem('userAuthToken');
                localStorage.removeItem('userProfile');
                this.requestUpdate();
                return;
            }

            this._userEmail = String(user?.email || email);
            this._authStep = 'ready';
            this._authState = 'ready';
            this._passwordValue = '';
            this._statusMessage = '登录成功，已完成认证';
            this._statusType = 'success';
            localStorage.setItem('userAuthToken', token);
            localStorage.setItem('userProfile', JSON.stringify(user || {}));
        } catch (error) {
            this._statusMessage = '登录失败: ' + (error?.message || '未知错误');
            this._statusType = 'error';
        } finally {
            if (this._authStep !== 'ready') {
                this._authState = 'idle';
            }
            this.requestUpdate();
        }
    }

    async handleLogoutClick() {
        try {
            let ipcRenderer = null;
            if (window.require) {
                ipcRenderer = window.require('electron').ipcRenderer;
            } else if (window.electron?.ipcRenderer) {
                ipcRenderer = window.electron.ipcRenderer;
            }
            if (ipcRenderer) {
                await ipcRenderer.invoke('auth-logout');
            }
            localStorage.removeItem('userAuthToken');
            localStorage.removeItem('userProfile');
            this._authStep = this.hasApiKey ? 'login' : 'license';
            this._userEmail = '';
            this._statusMessage = '已退出登录';
            this._statusType = 'info';
            this._authState = 'idle';
            this.requestUpdate();
        } catch (_) {}
    }

    handleOpenSettingsClick() {
        this.onOpenSettings();
    }

    handleAPIKeyHelpClick() {
        this.onAPIKeyHelp();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode && savedLayoutMode !== 'normal') {
            this.onLayoutModeChange(savedLayoutMode);
        }
    }

    getStartButtonText() {
        const isMac = navigator.platform.toLowerCase().includes('mac') ||
                    navigator.userAgent.toLowerCase().includes('mac') ||
                    process.platform === 'darwin';

        const cmdIcon = html`<svg width="14px" height="14px" viewBox="0 0 24 24" stroke-width="2" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path d="M15 6V18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
            <path
                d="M9 6C9 4.34315 7.65685 3 6 3C4.34315 3 3 4.34315 3 6C3 7.65685 4.34315 9 6 9H18C19.6569 9 21 7.65685 21 6C21 4.34315 19.6569 3 18 3C16.3431 3 15 4.34315 15 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
            <path
                d="M9 18C9 19.6569 7.65685 21 6 21C4.34315 21 3 19.6569 3 18C3 16.3431 4.34315 15 6 15H18C19.6569 15 21 16.3431 21 18C21 19.6569 19.6569 21 18 21C16.3431 21 15 19.6569 15 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>`;

        const enterIcon = html`<svg width="14px" height="14px" stroke-width="2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M10.25 19.25L6.75 15.75L10.25 12.25"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
            <path
                d="M6.75 15.75H12.75C14.9591 15.75 16.75 13.9591 16.75 11.75V4.75"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            ></path>
        </svg>`;

        if (isMac) {
            return html`开始会话 <span class="shortcut-icons">${cmdIcon}${enterIcon}</span>`;
        } else {
            return html`开始会话 <span class="shortcut-icons">Ctrl${enterIcon}</span>`;
        }
    }

    render() {
        let statusDisplay = html``;
        if (this._authStep === 'ready') {
            statusDisplay = html`
                <div class="status-display has-key">
                    <span class="status-icon">✅</span>
                    <span>已登录 ${this._userEmail || '当前用户'}，可以开始会话</span>
                </div>
            `;
        } else if (this._authStep === 'login') {
            statusDisplay = html`
                <div class="status-display no-key">
                    <span class="status-icon">👤</span>
                    <span>License Key已验证，请登录账号</span>
                </div>
            `;
        } else {
            statusDisplay = html`
                <div class="status-display no-key">
                    <span class="status-icon">🔑</span>
                    <span>请输入License Key</span>
                </div>
            `;
        }

        let statusMessageDisplay = html``;
        if (this._statusMessage) {
            const messageClass = this._statusType === 'error'
                ? 'status-error'
                : this._statusType === 'success'
                ? 'status-success'
                : 'status-info';

            statusMessageDisplay = html`
                <div class="status-message ${messageClass}">
                    ${this._statusMessage}
                </div>
            `;
        }

        const isBusy = this.isInitializing || this._authState === 'validating' || this._authState === 'persisting';

        let inputSection = html``;
        if (this._authStep === 'license') {
            inputSection = html`
                <div class="input-group">
                    <input
                        type="password"
                        placeholder="请输入License Key (格式: CD-xxxxx)"
                        .value=${this._licenseKeyValue}
                        @input=${e => this.handleLicenseInput(e)}
                        ?disabled=${isBusy}
                    />
                    <button
                        @click=${this.handleStartClick}
                        class="start-button ${isBusy ? 'disabled' : ''}"
                        ?disabled=${isBusy}
                    >
                        ${isBusy ? '验证中...' : '验证License'}
                    </button>
                </div>
                ${statusMessageDisplay}
            `;
        } else if (this._authStep === 'login') {
            inputSection = html`
                <div class="input-group" style="flex-direction: column; gap: 8px;">
                    <input
                        type="text"
                        placeholder="请输入登录邮箱"
                        .value=${this._emailValue}
                        @input=${e => this.handleEmailInput(e)}
                        ?disabled=${isBusy}
                    />
                    <input
                        type="password"
                        placeholder="请输入登录密码"
                        .value=${this._passwordValue}
                        @input=${e => this.handlePasswordInput(e)}
                        @keydown=${e => {
                            if (e.key === 'Enter') {
                                this.handleUserLogin();
                            }
                        }}
                        ?disabled=${isBusy}
                    />
                    <button
                        @click=${this.handleUserLogin}
                        class="start-button ${isBusy ? 'disabled' : ''}"
                        ?disabled=${isBusy}
                    >
                        ${isBusy ? '登录中...' : '登录账号'}
                    </button>
                </div>
                ${statusMessageDisplay}
            `;
        } else {
            inputSection = html`
                <div class="input-group">
                    <button
                        @click=${this.handleStartClick}
                        class="start-button ${this.isInitializing ? 'disabled' : ''}"
                        ?disabled=${this.isInitializing}
                    >
                        ${this.isInitializing ? '初始化中...' : this.getStartButtonText()}
                    </button>
                    <button
                        @click=${this.handleLogoutClick}
                        class="secondary-button"
                        ?disabled=${this.isInitializing}
                    >
                        退出登录
                    </button>
                </div>
                ${statusMessageDisplay}
            `;
        }

        return html`
            <div class="welcome">欢迎使用作弊老铁</div>

            ${statusDisplay}

            ${inputSection}
        `;
    }
}

customElements.define('main-view', MainView);

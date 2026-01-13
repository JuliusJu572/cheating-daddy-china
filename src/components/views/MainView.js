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
            background: var(--start-button-background);
            color: var(--start-button-color);
            border: 1px solid var(--start-button-border);
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .start-button:hover {
            background: var(--start-button-hover-background);
            border-color: var(--start-button-hover-border);
        }

        .start-button:disabled, .start-button.disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .start-button:disabled:hover, .start-button.disabled:hover {
            background: var(--start-button-background);
            border-color: var(--start-button-border);
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
        hasApiKey: { type: Boolean },
        isValidating: { type: Boolean },
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
        this.hasApiKey = !!localStorage.getItem('apiKey');
        this.isValidating = false;
        this._statusMessage = '';
        this._statusType = '';
        this.boundKeydownHandler = this.handleKeydown.bind(this);
    }

    connectedCallback() {
        super.connectedCallback();

        // Check if we already have a valid API key
        this.hasApiKey = !!localStorage.getItem('apiKey');

        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });
        document.addEventListener('keydown', this.boundKeydownHandler);
        this.loadLayoutMode();
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.electron?.ipcRenderer?.removeAllListeners('session-initializing');
        document.removeEventListener('keydown', this.boundKeydownHandler);
    }

    handleKeydown(e) {
        const isMac = navigator.platform.toLowerCase().includes('mac') ||
              navigator.userAgent.toLowerCase().includes('mac') ||
              process.platform === 'darwin';
        const isCmdOrCtrlEnter = isMac
            ? (e.metaKey && !e.ctrlKey && e.key === 'Enter')
            : (!e.metaKey && e.ctrlKey && e.key === 'Enter');

        if (isCmdOrCtrlEnter && this.hasApiKey) {
            e.preventDefault();
            this.handleStartClick();
            return;
        }
    }

    async handleInput(e) {
        this._licenseKeyValue = e.target.value || '';
        this._statusMessage = '';
        this.requestUpdate();
    }

    async handleStartClick() {
        if (this.isInitializing) {
            return;
        }

        // If we already have a valid API key, just start
        if (this.hasApiKey && !this._licenseKeyValue.trim()) {
            this.onStart();
            return;
        }

        // Otherwise, validate and save the License Key
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

        this.isValidating = true;
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
            const apiBase = 'https://open.bigmodel.cn/api/paas/v4';

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
            localStorage.setItem('apiKey', apiKey);
            localStorage.setItem('licenseKey', key);

            this._statusMessage = '✅ License Key验证成功！';
            this._statusType = 'success';
            this.hasApiKey = true;
            this._licenseKeyValue = '';

            // 2秒后开始会话
            setTimeout(() => {
                this._statusMessage = '';
                this.requestUpdate();
                this.onStart();
            }, 1000);

        } catch (error) {
            console.error('验证License Key错误:', error);
            this._statusMessage = '验证失败: ' + (error?.message || '未知错误');
            this._statusType = 'error';
        } finally {
            this.isValidating = false;
            this.requestUpdate();
        }
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
        // 状态显示
        let statusDisplay = html``;
        if (this.hasApiKey && !this._licenseKeyValue.trim()) {
            statusDisplay = html`
                <div class="status-display has-key">
                    <span class="status-icon">✅</span>
                    <span>License Key已配置，可以开始使用</span>
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

        // 状态消息显示
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

        // 输入框和按钮
        const inputSection = html`
            <div class="input-group">
                <input
                    type="password"
                    placeholder="请输入License Key (格式: CD-xxxxx)"
                    .value=${this._licenseKeyValue}
                    @input=${e => this.handleInput(e)}
                    ?disabled=${this.isValidating}
                />
                <button
                    @click=${this.handleStartClick}
                    class="start-button ${this.isInitializing || this.isValidating ? 'disabled' : ''}"
                    ?disabled=${this.isInitializing || this.isValidating}
                >
                    ${this.isValidating ? '验证中...' : (this.isInitializing ? '初始化中...' : this.getStartButtonText())}
                </button>
            </div>
            ${statusMessageDisplay}
            <div style="display: flex; gap: 8px; margin-bottom: 20px;">
                <button @click=${this.handleOpenSettingsClick} class="secondary-button">
                    打开设置
                </button>
            </div>
        `;

        return html`
            <div class="welcome">欢迎使用作弊老铁</div>

            ${statusDisplay}

            ${inputSection}
        `;
    }
}

customElements.define('main-view', MainView);

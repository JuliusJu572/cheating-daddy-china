import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { t } from '../../i18n/strings.js';
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

        .status-display.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
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

        /* Red blink animation for invalid API key */
        input.api-key-error {
            animation: blink-red 1s ease-in-out;
            border-color: #ff4444;
        }

        @keyframes blink-red {
            0%, 100% {
                border-color: var(--button-border);
                background: var(--input-background);
            }
            25%, 75% {
                border-color: #ff4444;
                background: rgba(255, 68, 68, 0.1);
            }
            50% {
                border-color: #ff6666;
                background: rgba(255, 68, 68, 0.15);
            }
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
        showApiKeyError: { type: Boolean },
        isValidating: { type: Boolean },
        isKeyValid: { type: Boolean },
        hasSavedKey: { type: Boolean },
        validationError: { type: String },
        _inputValue: { type: String, state: true },
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.onAPIKeyHelp = () => {};
        this.onOpenSettings = () => {};
        this.isInitializing = false;
        this.onLayoutModeChange = () => {};
        this.showApiKeyError = false;
        this.isValidating = false;
        this.isKeyValid = false;
        this.hasSavedKey = false;
        this.validationError = '';
        this.boundKeydownHandler = this.handleKeydown.bind(this);
        this._validationTimer = null;
        this._inputValue = '';

        // 检查是否有已保存的API key
        this.checkSavedApiKey();
    }

    async checkSavedApiKey() {
        const savedKey = localStorage.getItem('apiKey');
        this.hasSavedKey = !!savedKey;
        if (this.hasSavedKey) {
            // 有已保存的key，自动验证
            await this.validateSavedApiKey();
        }
        this.requestUpdate();
    }

    async validateSavedApiKey() {
        this.isValidating = true;
        this.validationError = '';
        this.requestUpdate();

        try {
            const apiKey = localStorage.getItem('apiKey');
            const apiBase = 'https://open.bigmodel.cn/api/paas/v4';

            let ipcRenderer = null;
            try {
                if (window.require) {
                    ipcRenderer = window.require('electron').ipcRenderer;
                } else if (window.electron && window.electron.ipcRenderer) {
                    ipcRenderer = window.electron.ipcRenderer;
                }
            } catch (_) {}

            if (!ipcRenderer) {
                this.validationError = '无法连接到主进程';
                this.isKeyValid = false;
                return;
            }

            // 测试连接
            const connectRes = await ipcRenderer.invoke('test-model-connection', {
                apiBase: apiBase,
                headers: { Authorization: `Bearer ${apiKey}` }
            });

            if (!connectRes?.success) {
                this.validationError = 'API key已过期或无效，请重新配置';
                this.isKeyValid = false;
                // 清除无效的key
                localStorage.removeItem('apiKey');
                this.hasSavedKey = false;
            } else {
                this.isKeyValid = true;
                console.log('✅ [MainView] 已保存的API key验证成功');
            }
        } catch (error) {
            console.error('❌ [MainView] 验证已保存的API key出错:', error);
            this.validationError = '验证失败: ' + (error?.message || '未知错误');
            this.isKeyValid = false;
            localStorage.removeItem('apiKey');
            this.hasSavedKey = false;
        } finally {
            this.isValidating = false;
            this.requestUpdate();
        }
    }

    connectedCallback() {
        super.connectedCallback();

        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });
        document.addEventListener('keydown', this.boundKeydownHandler);
        this.loadLayoutMode();
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        if (this._validationTimer) {
            clearTimeout(this._validationTimer);
            this._validationTimer = null;
        }

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
        const isAltEnter = e.altKey && e.key === 'Enter';
        const isAudioCapture = (isMac
            ? (e.metaKey && !e.ctrlKey)
            : (!e.metaKey && e.ctrlKey)) && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L');

        if ((isCmdOrCtrlEnter || isAltEnter) && this.isKeyValid) {
            e.preventDefault();
            this.handleStartClick();
            return;
        }
        if (isAudioCapture) {
            e.preventDefault();
            try { window.startQuickAudioCapture && window.startQuickAudioCapture(); } catch (_) {}
        }
    }

    async handleInput(e) {
        const v = e.target.value || '';
        this._inputValue = v;

        if (this._validationTimer) {
            clearTimeout(this._validationTimer);
            this._validationTimer = null;
        }

        this.showApiKeyError = false;
        this.validationError = '';

        if (!v.trim()) {
            this.isKeyValid = false;
            this.isValidating = false;
            localStorage.removeItem('apiKey');
            this.requestUpdate();
            return;
        }

        const s = v.trim();
        const isLicense = /^CD-/i.test(s);
        if (!isLicense) {
            this.validationError = '请输入有效的License Key (格式: CD-xxxxx)';
            this.showApiKeyError = true;
            this.isKeyValid = false;
            this.isValidating = false;
            localStorage.removeItem('apiKey');
            this.requestUpdate();
            return;
        }

        this.isValidating = true;
        this.requestUpdate();

        this._validationTimer = setTimeout(async () => {
            try {
                let ipcRenderer = null;
                try {
                    if (window.require) {
                        ipcRenderer = window.require('electron').ipcRenderer;
                    } else if (window.electron && window.electron.ipcRenderer) {
                        ipcRenderer = window.electron.ipcRenderer;
                    }
                } catch (_) {}
                if (!ipcRenderer) {
                    this.validationError = '无法连接到主进程';
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    this.requestUpdate();
                    return;
                }

                const decryptRes = await ipcRenderer.invoke('decrypt-license-key', s);

                if (!decryptRes?.success || !decryptRes.apiKey) {
                    console.log('❌ [MainView] License Key解密失败');
                    this.validationError = 'License Key无效，请检查输入';
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    localStorage.removeItem('apiKey');
                    this.requestUpdate();
                    return;
                }

                const apiKey = decryptRes.apiKey;
                const apiBase = 'https://open.bigmodel.cn/api/paas/v4';

                const connectRes = await ipcRenderer.invoke('test-model-connection', {
                    apiBase: apiBase,
                    headers: { Authorization: `Bearer ${apiKey}` }
                });

                if (!connectRes?.success) {
                    console.log('❌ [MainView] API连接测试失败');
                    this.validationError = 'API连接失败，请检查网络或联系支持';
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    localStorage.removeItem('apiKey');
                    this.requestUpdate();
                    return;
                }

                // 保存解密后的真实 API Key
                localStorage.setItem('apiKey', apiKey);
                localStorage.setItem('licenseKey', s);

                this.isKeyValid = true;
                this.hasSavedKey = true;
                this.showApiKeyError = false;
                this.validationError = '';
                console.log('✅ [MainView] API key验证并保存成功');

            } catch (error) {
                console.error('❌ [MainView] 验证过程出错:', error?.message || error);
                this.validationError = '验证失败: ' + (error?.message || '未知错误');
                this.showApiKeyError = true;
                this.isKeyValid = false;
                localStorage.removeItem('apiKey');
            }

            this.isValidating = false;
            this.requestUpdate();
        }, 800);
    }

    handleStartClick() {
        if (this.isInitializing || !this.isKeyValid) {
            return;
        }
        this.onStart();
    }

    handleReconfigureClick() {
        // 清除已保存的key，返回配置状态
        localStorage.removeItem('apiKey');
        localStorage.removeItem('licenseKey');
        this.hasSavedKey = false;
        this.isKeyValid = false;
        this._inputValue = '';
        this.validationError = '';
        this.requestUpdate();
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
            return html`${t('start_session')} <span class="shortcut-icons">${cmdIcon}${enterIcon}</span>`;
        } else {
            return html`${t('start_session')} <span class="shortcut-icons">Ctrl${enterIcon}</span>`;
        }
    }

    render() {
        // 状态显示
        let statusDisplay = html``;
        if (this.isValidating) {
            statusDisplay = html`
                <div class="status-display no-key">
                    <span class="status-icon">⏳</span>
                    <span>正在验证License Key...</span>
                </div>
            `;
        } else if (this.hasSavedKey && this.isKeyValid) {
            statusDisplay = html`
                <div class="status-display has-key">
                    <span class="status-icon">✅</span>
                    <span>License Key已验证，可以开始使用</span>
                </div>
            `;
        } else if (this.validationError) {
            statusDisplay = html`
                <div class="status-display error">
                    <span class="status-icon">❌</span>
                    <span>${this.validationError}</span>
                </div>
            `;
        } else {
            statusDisplay = html`
                <div class="status-display no-key">
                    <span class="status-icon">🔑</span>
                    <span>请输入License Key以继续</span>
                </div>
            `;
        }

        // 输入框和按钮
        let inputSection = html``;
        if (this.hasSavedKey && this.isKeyValid) {
            // 已有有效key，显示快捷操作
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
                        @click=${this.handleReconfigureClick}
                        class="secondary-button"
                    >
                        重新配置
                    </button>
                    <button
                        @click=${this.handleOpenSettingsClick}
                        class="secondary-button"
                    >
                        打开设置
                    </button>
                </div>
            `;
        } else {
            // 需要输入或重新输入key
            inputSection = html`
                <div class="input-group">
                    <input
                        type="password"
                        class="${this.showApiKeyError ? 'api-key-error' : ''}"
                        placeholder="${t('enter_api_key')}"
                        .value=${this._inputValue}
                        @input=${e => this.handleInput(e)}
                        ?disabled=${this.isValidating}
                    />
                    <button
                        @click=${this.handleStartClick}
                        class="start-button ${this.isInitializing || this.isValidating || !this.isKeyValid ? 'disabled' : ''}"
                        ?disabled=${this.isInitializing || this.isValidating || !this.isKeyValid}
                    >
                        ${this.isValidating ? '验证中...' : this.getStartButtonText()}
                    </button>
                </div>
            `;
        }

        return html`
            <div class="welcome">${t('welcome')}</div>

            ${statusDisplay}

            ${inputSection}

            <div class="description">
                ${t('api_key_help_prefix')} <span class="link" @click=${this.handleAPIKeyHelpClick.bind(this)}>${t('api_key_help_link')}</span>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);

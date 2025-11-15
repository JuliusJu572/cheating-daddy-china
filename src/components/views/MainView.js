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

        /* Red blink animation for empty API key */
        input.api-key-error {
            animation: blink-red 1s ease-in-out;
            border-color: #ff4444;
        }

        @keyframes blink-red {
            0%,
            100% {
                border-color: var(--button-border);
                background: var(--input-background);
            }
            25%,
            75% {
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

        .start-button.initializing {
            opacity: 0.5;
        }

        .start-button.initializing:hover {
            background: var(--start-button-background);
            border-color: var(--start-button-border);
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
        showApiKeyError: { type: Boolean },
        isValidating: { type: Boolean },
        isKeyValid: { type: Boolean },
        _inputValue: { type: String, state: true },  // ✅ 新增：跟踪用户输入
    };

    constructor() {
        super();
        this.onStart = () => {};
        this.onAPIKeyHelp = () => {};
        this.isInitializing = false;
        this.onLayoutModeChange = () => {};
        this.showApiKeyError = false;
        this.isValidating = false;
        this.isKeyValid = false;
        this.boundKeydownHandler = this.handleKeydown.bind(this);
        this._validationTimer = null;
        this._inputValue = '';  // ✅ 新增
    }

    connectedCallback() {
        super.connectedCallback();
        
        // ✅ 只在首次加载时清空（使用 flag 避免重复清空）
        if (!sessionStorage.getItem('appInitialized')) {
            localStorage.removeItem('apiKey');
            
            // ⚠️ 添加：如果 onboarding 从未设置，设置为已完成（跳过引导）
            if (!localStorage.getItem('onboardingCompleted')) {
                localStorage.setItem('onboardingCompleted', 'true');
            }
            
            sessionStorage.setItem('appInitialized', 'true');
        }
        
        window.electron?.ipcRenderer?.on('session-initializing', (event, isInitializing) => {
            this.isInitializing = isInitializing;
        });
        document.addEventListener('keydown', this.boundKeydownHandler);
        this.loadLayoutMode();
        resizeLayout();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        
        // ✅ 清理定时器
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
            try {
                const view = window.cheddar && typeof window.cheddar.getCurrentView === 'function'
                    ? window.cheddar.getCurrentView()
                    : 'main';
                if (view === 'main') {
                    this.handleStartClick();
                } else {
                    if (typeof window.captureManualScreenshot === 'function') {
                        window.captureManualScreenshot();
                    }
                }
            } catch (_) {
                this.handleStartClick();
            }
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
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    this.requestUpdate();
                    return;
                }

                
                
                const decryptRes = await ipcRenderer.invoke('decrypt-license-key', s);
                
                
                
                if (!decryptRes?.success || !decryptRes.apiKey) {
                    console.log('❌ [MainView] 解密失败');
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    localStorage.removeItem('apiKey');
                    this.requestUpdate();
                    return;
                }
                
                const apiKey = decryptRes.apiKey;

                const apiBase = localStorage.getItem('modelApiBase') || 'https://aihubmix.com/v1';
                
                
                const connectRes = await ipcRenderer.invoke('test-model-connection', {
                    apiBase: apiBase,
                    headers: { Authorization: `Bearer ${apiKey}` }
                });

                if (!connectRes?.success) {
                    console.log('❌ [MainView] API连接测试失败');
                    this.showApiKeyError = true;
                    this.isKeyValid = false;
                    this.isValidating = false;
                    localStorage.removeItem('apiKey');
                    this.requestUpdate();
                    return;
                }

                
                
                // ✅ 存储解密后的真实 API Key
                localStorage.setItem('apiKey', apiKey);
                
                // ✅ 验证存储是否成功
                const storedKey = localStorage.getItem('apiKey');
                
                this.isKeyValid = true;
                this.showApiKeyError = false;

            } catch (error) {
                console.error('❌ [MainView] 验证过程出错:', error?.message || error);
                this.showApiKeyError = true;
                this.isKeyValid = false;
                localStorage.removeItem('apiKey');
            }

            this.isValidating = false;
            this.requestUpdate();
        }, 800);
    }

    handleStartClick() {
        // ✅ 只有验证通过才能启动
        if (this.isInitializing || !this.isKeyValid) {
            return;
        }
        this.onStart();
    }

    handleAPIKeyHelpClick() {
        this.onAPIKeyHelp();
    }

    handleResetOnboarding() {
        localStorage.removeItem('onboardingCompleted');
        // Refresh the page to trigger onboarding
        window.location.reload();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode && savedLayoutMode !== 'normal') {
            // Notify parent component to apply the saved layout mode
            this.onLayoutModeChange(savedLayoutMode);
        }
    }

    // Method to trigger the red blink animation
    triggerApiKeyError() {
        this.showApiKeyError = true;
        // Remove the error class after 1 second
        setTimeout(() => {
            this.showApiKeyError = false;
        }, 1000);
    }

    getStartButtonText() {
        // 在 getStartButtonText() 函数中，修改 isMac 检测：
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
        // ✅ 使用保存的用户输入值，而不是从 localStorage 读取
        return html`
            <div class="welcome">${t('welcome')}</div>

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
                    class="start-button ${this.isInitializing || this.isValidating || !this.isKeyValid ? 'initializing' : ''}"
                    ?disabled=${this.isInitializing || this.isValidating || !this.isKeyValid}
                >
                    ${this.isValidating ? '验证中...' : this.getStartButtonText()}
                </button>
            </div>
            <div class="description">
                ${t('api_key_help_prefix')} <span class="link" @click=${this.handleAPIKeyHelpClick.bind(this)}>${t('api_key_help_link')}</span>
            </div>
        `;
    }
}

customElements.define('main-view', MainView);

import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';
import { t } from '../../i18n/strings.js';

export class AdvancedView extends LitElement {
    static styles = css`
        * {
            font-family:
                'Inter',
                -apple-system,
                BlinkMacSystemFont,
                sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            padding: 12px;
            margin: 0 auto;
            max-width: 700px;
        }

        .advanced-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .advanced-section {
            background: var(--card-background, rgba(255, 255, 255, 0.04));
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .danger-section {
            border-color: var(--danger-border, rgba(239, 68, 68, 0.3));
            background: var(--danger-background, rgba(239, 68, 68, 0.05));
        }

        .section-title {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            font-size: 14px;
            font-weight: 600;
            color: var(--text-color);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .section-title.danger {
            color: var(--danger-color, #ef4444);
        }

        .section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color, #007aff);
            border-radius: 1.5px;
        }

        .section-title.danger::before {
            background: var(--danger-color, #ef4444);
        }

        .advanced-description {
            font-size: 12px;
            color: var(--description-color, rgba(255, 255, 255, 0.7));
            line-height: 1.4;
            margin-bottom: 16px;
        }

        .warning-box {
            background: var(--warning-background, rgba(251, 191, 36, 0.08));
            border: 1px solid var(--warning-border, rgba(251, 191, 36, 0.2));
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 11px;
            color: var(--warning-color, #fbbf24);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            line-height: 1.4;
        }

        .danger-box {
            background: var(--danger-background, rgba(239, 68, 68, 0.08));
            border: 1px solid var(--danger-border, rgba(239, 68, 68, 0.2));
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 11px;
            color: var(--danger-color, #ef4444);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            line-height: 1.4;
        }

        .success-box {
            background: var(--success-background, rgba(34, 197, 94, 0.08));
            border: 1px solid var(--success-border, rgba(34, 197, 94, 0.2));
            border-radius: 4px;
            padding: 12px;
            margin-bottom: 16px;
            font-size: 11px;
            color: var(--success-color, #22c55e);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            line-height: 1.4;
        }

        .warning-icon,
        .danger-icon,
        .success-icon {
            flex-shrink: 0;
            font-size: 12px;
            margin-top: 1px;
        }

        .action-button {
            background: var(--button-background, rgba(255, 255, 255, 0.1));
            color: var(--text-color);
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.15));
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            align-items: center;
            gap: 6px;
            width: fit-content;
        }

        .action-button:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.25));
        }

        .action-button:active {
            transform: translateY(1px);
        }

        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .danger-button {
            background: var(--danger-button-background, rgba(239, 68, 68, 0.1));
            color: var(--danger-color, #ef4444);
            border-color: var(--danger-border, rgba(239, 68, 68, 0.3));
        }

        .danger-button:hover {
            background: var(--danger-button-hover, rgba(239, 68, 68, 0.15));
            border-color: var(--danger-border-hover, rgba(239, 68, 68, 0.4));
        }

        .action-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            line-height: 1.3;
            margin-top: 8px;
        }

        .status-message {
            margin-top: 12px;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        .status-success {
            background: var(--success-background, rgba(34, 197, 94, 0.1));
            color: var(--success-color, #22c55e);
            border: 1px solid var(--success-border, rgba(34, 197, 94, 0.2));
        }

        .status-error {
            background: var(--danger-background, rgba(239, 68, 68, 0.1));
            color: var(--danger-color, #ef4444);
            border: 1px solid var(--danger-border, rgba(239, 68, 68, 0.2));
        }

        .form-grid {
            display: grid;
            gap: 12px;
        }

        .form-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            align-items: start;
        }

        @media (max-width: 600px) {
            .form-row {
                grid-template-columns: 1fr;
            }
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .form-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .form-description {
            font-size: 11px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            line-height: 1.3;
            margin-top: 2px;
        }

        .form-control {
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.15s ease;
            min-height: 16px;
            font-weight: 400;
        }

        .form-control:focus {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
            background: var(--input-focus-background, rgba(0, 0, 0, 0.4));
        }

        .form-control:hover:not(:focus) {
            border-color: var(--input-hover-border, rgba(255, 255, 255, 0.2));
            background: var(--input-hover-background, rgba(0, 0, 0, 0.35));
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
            padding: 8px;
            background: var(--checkbox-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--checkbox-border, rgba(255, 255, 255, 0.06));
        }

        .checkbox-input {
            width: 14px;
            height: 14px;
            accent-color: var(--focus-border-color, #007aff);
            cursor: pointer;
        }

        .checkbox-label {
            font-weight: 500;
            font-size: 12px;
            color: var(--label-color, rgba(255, 255, 255, 0.9));
            cursor: pointer;
            user-select: none;
        }

        .rate-limit-controls {
            margin-left: 22px;
            opacity: 0.7;
            transition: opacity 0.15s ease;
        }

        .rate-limit-controls.enabled {
            opacity: 1;
        }

        .rate-limit-reset {
            margin-top: 10px;
            padding-top: 10px;
            border-top: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .rate-limit-warning {
            background: var(--warning-background, rgba(251, 191, 36, 0.08));
            border: 1px solid var(--warning-border, rgba(251, 191, 36, 0.2));
            border-radius: 4px;
            padding: 10px;
            margin-bottom: 12px;
            font-size: 11px;
            color: var(--warning-color, #fbbf24);
            display: flex;
            align-items: flex-start;
            gap: 8px;
            line-height: 1.4;
        }

        .rate-limit-warning-icon {
            flex-shrink: 0;
            font-size: 12px;
            margin-top: 1px;
        }

        .api-key-status {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 12px;
        }

        .api-key-status.has-key {
            background: var(--success-background, rgba(34, 197, 94, 0.1));
            color: var(--success-color, #22c55e);
            border: 1px solid var(--success-border, rgba(34, 197, 94, 0.2));
        }

        .api-key-status.no-key {
            background: var(--warning-background, rgba(251, 191, 36, 0.08));
            color: var(--warning-color, #fbbf24);
            border: 1px solid var(--warning-border, rgba(251, 191, 36, 0.2));
        }

        .button-group {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
    `;

    static properties = {
        isClearing: { type: Boolean },
        statusMessage: { type: String },
        statusType: { type: String },
        throttleTokens: { type: Boolean },
        maxTokensPerMin: { type: Number },
        throttleAtPercent: { type: Number },
        contentProtection: { type: Boolean },
        hasApiKey: { type: Boolean },
        apiKeyValid: { type: Boolean },
        isValidatingKey: { type: Boolean },
        newLicenseKey: { type: String },
        apiKeyMessage: { type: String },
        apiKeyMessageType: { type: String },
        isClearingCache: { type: Boolean },
        cacheMessage: { type: String },
        cacheMessageType: { type: String },
    };

    constructor() {
        super();
        this.isClearing = false;
        this.statusMessage = '';
        this.statusType = '';

        // Rate limiting defaults
        this.throttleTokens = true;
        this.maxTokensPerMin = 1000000;
        this.throttleAtPercent = 75;

        // Content protection default
        this.contentProtection = true;

        // API key state
        this.hasApiKey = false;
        this.apiKeyValid = false;
        this.isValidatingKey = false;
        this.newLicenseKey = '';
        this.apiKeyMessage = '';
        this.apiKeyMessageType = '';

        // Cache clearing state
        this.isClearingCache = false;
        this.cacheMessage = '';
        this.cacheMessageType = '';

        this.loadRateLimitSettings();
        this.loadContentProtectionSetting();
        this.checkApiKeyStatus();
    }

    connectedCallback() {
        super.connectedCallback();
        resizeLayout();
    }

    checkApiKeyStatus() {
        const apiKey = localStorage.getItem('apiKey');
        this.hasApiKey = !!apiKey;
        this.apiKeyValid = !!apiKey;
    }

    async clearLocalData() {
        if (this.isClearing) return;

        this.isClearing = true;
        this.statusMessage = '';
        this.statusType = '';
        this.requestUpdate();

        try {
            localStorage.clear();
            sessionStorage.clear();

            const databases = await indexedDB.databases();
            const clearPromises = databases.map(db => {
                return new Promise((resolve, reject) => {
                    const deleteReq = indexedDB.deleteDatabase(db.name);
                    deleteReq.onsuccess = () => resolve();
                    deleteReq.onerror = () => reject(deleteReq.error);
                    deleteReq.onblocked = () => {
                        console.warn(`Deletion of database ${db.name} was blocked`);
                        resolve();
                    };
                });
            });

            await Promise.all(clearPromises);

            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            this.statusMessage = `✅ 成功清除所有本地数据 (${databases.length} 个数据库)`;
            this.statusType = 'success';

            setTimeout(() => {
                this.statusMessage = '🔄 正在关闭应用...';
                this.requestUpdate();
                setTimeout(async () => {
                    if (window.require) {
                        const { ipcRenderer } = window.require('electron');
                        await ipcRenderer.invoke('quit-application');
                    }
                }, 1000);
            }, 2000);
        } catch (error) {
            console.error('清除数据错误:', error);
            this.statusMessage = `❌ 清除数据失败: ${error.message}`;
            this.statusType = 'error';
        } finally {
            this.isClearing = false;
            this.requestUpdate();
        }
    }

    async clearCheddarCache() {
        if (this.isClearingCache) return;

        this.isClearingCache = true;
        this.cacheMessage = '正在清理缓存...';
        this.cacheMessageType = 'info';
        this.requestUpdate();

        try {
            if (!window.require) {
                this.cacheMessage = '❌ 无法访问文件系统';
                this.cacheMessageType = 'error';
                return;
            }

            const { ipcRenderer } = window.require('electron');
            const result = await ipcRenderer.invoke('clear-cheddar-cache');

            if (result.success) {
                const { deletedFiles, freedSpace } = result;
                this.cacheMessage = `✅ 清理完成！删除了 ${deletedFiles} 个文件，释放 ${freedSpace} 空间`;
                this.cacheMessageType = 'success';
            } else {
                this.cacheMessage = `❌ 清理失败: ${result.error || '未知错误'}`;
                this.cacheMessageType = 'error';
            }
        } catch (error) {
            console.error('清理缓存错误:', error);
            this.cacheMessage = `❌ 清理失败: ${error.message}`;
            this.cacheMessageType = 'error';
        } finally {
            this.isClearingCache = false;
            this.requestUpdate();
        }
    }

    loadRateLimitSettings() {
        const throttleTokens = localStorage.getItem('throttleTokens');
        const maxTokensPerMin = localStorage.getItem('maxTokensPerMin');
        const throttleAtPercent = localStorage.getItem('throttleAtPercent');

        if (throttleTokens !== null) {
            this.throttleTokens = throttleTokens === 'true';
        }
        if (maxTokensPerMin !== null) {
            this.maxTokensPerMin = parseInt(maxTokensPerMin, 10) || 1000000;
        }
        if (throttleAtPercent !== null) {
            this.throttleAtPercent = parseInt(throttleAtPercent, 10) || 75;
        }
    }

    handleThrottleTokensChange(e) {
        this.throttleTokens = e.target.checked;
        localStorage.setItem('throttleTokens', this.throttleTokens.toString());
        this.requestUpdate();
    }

    handleMaxTokensChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value > 0) {
            this.maxTokensPerMin = value;
            localStorage.setItem('maxTokensPerMin', this.maxTokensPerMin.toString());
        }
    }

    handleThrottlePercentChange(e) {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value) && value >= 0 && value <= 100) {
            this.throttleAtPercent = value;
            localStorage.setItem('throttleAtPercent', this.throttleAtPercent.toString());
        }
    }

    resetRateLimitSettings() {
        this.throttleTokens = true;
        this.maxTokensPerMin = 1000000;
        this.throttleAtPercent = 75;

        localStorage.removeItem('throttleTokens');
        localStorage.removeItem('maxTokensPerMin');
        localStorage.removeItem('throttleAtPercent');

        this.requestUpdate();
    }

    loadContentProtectionSetting() {
        const contentProtection = localStorage.getItem('contentProtection');
        this.contentProtection = contentProtection !== null ? contentProtection === 'true' : true;
    }

    async handleContentProtectionChange(e) {
        this.contentProtection = e.target.checked;
        localStorage.setItem('contentProtection', this.contentProtection.toString());

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            try {
                await ipcRenderer.invoke('update-content-protection', this.contentProtection);
            } catch (error) {
                console.error('更新内容保护失败:', error);
            }
        }

        this.requestUpdate();
    }

    handleLicenseKeyInput(e) {
        this.newLicenseKey = e.target.value;
        this.apiKeyMessage = '';
        this.requestUpdate();
    }

    async handleSaveLicenseKey() {
        const key = this.newLicenseKey.trim();

        if (!key) {
            this.apiKeyMessage = '请输入License Key';
            this.apiKeyMessageType = 'error';
            this.requestUpdate();
            return;
        }

        if (!/^CD-/i.test(key)) {
            this.apiKeyMessage = 'License Key格式无效，应以CD-开头';
            this.apiKeyMessageType = 'error';
            this.requestUpdate();
            return;
        }

        this.isValidatingKey = true;
        this.apiKeyMessage = '正在验证License Key...';
        this.apiKeyMessageType = 'info';
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
                this.apiKeyMessage = 'License Key无效，解密失败';
                this.apiKeyMessageType = 'error';
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
                this.apiKeyMessage = 'API连接测试失败，请检查License Key';
                this.apiKeyMessageType = 'error';
                this.requestUpdate();
                return;
            }

            // 保存API Key
            localStorage.setItem('apiKey', apiKey);
            localStorage.setItem('licenseKey', key);

            this.apiKeyMessage = '✅ License Key验证并保存成功！';
            this.apiKeyMessageType = 'success';
            this.hasApiKey = true;
            this.apiKeyValid = true;
            this.newLicenseKey = '';

            // 3秒后清除消息
            setTimeout(() => {
                this.apiKeyMessage = '';
                this.requestUpdate();
            }, 3000);

        } catch (error) {
            console.error('保存License Key错误:', error);
            this.apiKeyMessage = '保存失败: ' + (error?.message || '未知错误');
            this.apiKeyMessageType = 'error';
        } finally {
            this.isValidatingKey = false;
            this.requestUpdate();
        }
    }

    handleClearApiKey() {
        if (confirm('确定要清除已保存的License Key吗？')) {
            localStorage.removeItem('apiKey');
            localStorage.removeItem('licenseKey');
            this.hasApiKey = false;
            this.apiKeyValid = false;
            this.apiKeyMessage = '✅ License Key已清除';
            this.apiKeyMessageType = 'success';

            setTimeout(() => {
                this.apiKeyMessage = '';
                this.requestUpdate();
            }, 2000);

            this.requestUpdate();
        }
    }

    render() {
        // API Key状态显示
        let apiKeyStatusDisplay = html``;
        if (this.hasApiKey && this.apiKeyValid) {
            apiKeyStatusDisplay = html`
                <div class="api-key-status has-key">
                    <span class="success-icon">✅</span>
                    <span>已配置有效的License Key</span>
                </div>
            `;
        } else {
            apiKeyStatusDisplay = html`
                <div class="api-key-status no-key">
                    <span class="warning-icon">⚠️</span>
                    <span>未配置License Key</span>
                </div>
            `;
        }

        // API Key消息显示
        let apiKeyMessageDisplay = html``;
        if (this.apiKeyMessage) {
            const messageClass = this.apiKeyMessageType === 'error'
                ? 'status-error'
                : this.apiKeyMessageType === 'success'
                ? 'status-success'
                : 'status-success';

            apiKeyMessageDisplay = html`
                <div class="status-message ${messageClass}">
                    ${this.apiKeyMessage}
                </div>
            `;
        }

        // 缓存消息显示
        let cacheMessageDisplay = html``;
        if (this.cacheMessage) {
            const messageClass = this.cacheMessageType === 'error'
                ? 'status-error'
                : this.cacheMessageType === 'success'
                ? 'status-success'
                : 'status-success';

            cacheMessageDisplay = html`
                <div class="status-message ${messageClass}">
                    ${this.cacheMessage}
                </div>
            `;
        }

        return html`
            <div class="advanced-container">
                <!-- API Key 管理部分 -->
                <div class="advanced-section">
                    <div class="section-title">
                        <span>🔑 API Key 管理</span>
                    </div>
                    <div class="advanced-description">
                        管理您的智谱AI License Key。首次使用时请输入License Key，之后会自动保存。
                    </div>

                    ${apiKeyStatusDisplay}

                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">License Key</label>
                            <input
                                type="password"
                                class="form-control"
                                placeholder="输入 License Key (格式: CD-xxxxx)"
                                .value=${this.newLicenseKey}
                                @input=${e => this.handleLicenseKeyInput(e)}
                                ?disabled=${this.isValidatingKey}
                            />
                            <div class="form-description">
                                请输入您购买的License Key，格式为 CD-xxxxx
                            </div>
                        </div>

                        <div class="button-group">
                            <button
                                class="action-button"
                                @click=${this.handleSaveLicenseKey}
                                ?disabled=${this.isValidatingKey || !this.newLicenseKey.trim()}
                            >
                                ${this.isValidatingKey ? '验证中...' : '💾 保存License Key'}
                            </button>
                            ${this.hasApiKey
                                ? html`
                                    <button
                                        class="action-button danger-button"
                                        @click=${this.handleClearApiKey}
                                    >
                                        🗑️ 清除已保存的Key
                                    </button>
                                `
                                : ''}
                        </div>

                        ${apiKeyMessageDisplay}
                    </div>
                </div>

                <!-- Cache Clearing Section -->
                <div class="advanced-section">
                    <div class="section-title">
                        <span>🗑️ 清理缓存</span>
                    </div>
                    <div class="advanced-description">
                        清理cheddar目录中的截图和音频缓存文件，释放磁盘空间。
                    </div>

                    <div class="form-grid">
                        <div class="button-group">
                            <button
                                class="action-button"
                                @click=${this.clearCheddarCache}
                                ?disabled=${this.isClearingCache}
                            >
                                ${this.isClearingCache ? '清理中...' : '🧹 清理缓存'}
                            </button>
                        </div>

                        ${cacheMessageDisplay}
                    </div>
                </div>

                <!-- Content Protection Section -->
                <div class="advanced-section">
                    <div class="section-title">
                        <span>🔒 内容保护</span>
                    </div>
                    <div class="advanced-description">
                        内容保护使应用窗口对屏幕共享和录制软件不可见。
                        这在共享屏幕时保护隐私，但可能干扰DisplayLink等显示设置。
                    </div>

                    <div class="form-grid">
                        <div class="checkbox-group">
                            <input
                                type="checkbox"
                                class="checkbox-input"
                                id="content-protection"
                                .checked=${this.contentProtection}
                                @change=${this.handleContentProtectionChange}
                            />
                            <label for="content-protection" class="checkbox-label">
                                启用内容保护（隐身模式）
                            </label>
                        </div>
                        <div class="form-description" style="margin-left: 22px;">
                            ${this.contentProtection
                                ? '应用当前对屏幕共享和录制软件不可见。'
                                : '应用当前对屏幕共享和录制软件可见。'}
                        </div>
                    </div>
                </div>

                <!-- Rate Limiting Section -->
                <div class="advanced-section">
                    <div class="section-title">
                        <span>⏱️ 速率限制</span>
                    </div>

                    <div class="rate-limit-warning">
                        <span class="rate-limit-warning-icon">⚠️</span>
                        <span
                            ><strong>警告：</strong>如果不了解这些设置的含义，请不要修改。
                            不正确的速率限制设置可能导致应用停止工作或意外达到API限制。</span
                        >
                    </div>

                    <div class="form-grid">
                        <div class="checkbox-group">
                            <input
                                type="checkbox"
                                class="checkbox-input"
                                id="throttle-tokens"
                                .checked=${this.throttleTokens}
                                @change=${this.handleThrottleTokensChange}
                            />
                            <label for="throttle-tokens" class="checkbox-label"> 接近速率限制时节流tokens </label>
                        </div>

                        <div class="rate-limit-controls ${this.throttleTokens ? 'enabled' : ''}">
                            <div class="form-row">
                                <div class="form-group">
                                    <label class="form-label">每分钟最大tokens数</label>
                                    <input
                                        type="number"
                                        class="form-control"
                                        .value=${this.maxTokensPerMin}
                                        min="1000"
                                        max="10000000"
                                        step="1000"
                                        @input=${this.handleMaxTokensChange}
                                        ?disabled=${!this.throttleTokens}
                                    />
                                    <div class="form-description">节流启动前的每分钟最大tokens数</div>
                                </div>

                                <div class="form-group">
                                    <label class="form-label">节流百分比</label>
                                    <input
                                        type="number"
                                        class="form-control"
                                        .value=${this.throttleAtPercent}
                                        min="1"
                                        max="99"
                                        step="1"
                                        @input=${this.handleThrottlePercentChange}
                                        ?disabled=${!this.throttleTokens}
                                    />
                                    <div class="form-description">
                                        达到此百分比时开始节流（${this.throttleAtPercent}% =
                                        ${Math.floor((this.maxTokensPerMin * this.throttleAtPercent) / 100)} tokens）
                                    </div>
                                </div>
                            </div>

                            <div class="rate-limit-reset">
                                <button class="action-button" @click=${this.resetRateLimitSettings} ?disabled=${!this.throttleTokens}>
                                    恢复默认值
                                </button>
                                <div class="form-description" style="margin-top: 8px;">将速率限制设置恢复为默认值</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Data Management Section -->
                <div class="advanced-section danger-section">
                    <div class="section-title danger">
                        <span>🗑️ 数据管理</span>
                    </div>
                    <div class="danger-box">
                        <span class="danger-icon">⚠️</span>
                        <span><strong>重要：</strong>此操作将永久删除所有本地数据，无法撤销。</span>
                    </div>

                    <div>
                        <button class="action-button danger-button" @click=${this.clearLocalData} ?disabled=${this.isClearing}>
                            ${this.isClearing ? '🔄 清除中...' : '🗑️ 清除所有本地数据'}
                        </button>

                        ${this.statusMessage
                            ? html`
                                  <div class="status-message ${this.statusType === 'success' ? 'status-success' : 'status-error'}">
                                      ${this.statusMessage}
                                  </div>
                              `
                            : ''}
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('advanced-view', AdvancedView);

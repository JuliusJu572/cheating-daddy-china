import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { t } from '../../i18n/strings.js';

export class AppHeader extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
            user-select: none;
        }

        .header {
            -webkit-app-region: drag;
            display: flex;
            align-items: center;
            padding: var(--header-padding);
            border: 1px solid var(--border-color);
            background: var(--header-background);
            border-radius: var(--border-radius);
        }

        .header-title {
            flex: 1;
            font-size: var(--header-font-size);
            font-weight: 600;
            -webkit-app-region: drag;
        }

        .header-actions {
            display: flex;
            gap: var(--header-gap);
            align-items: center;
            -webkit-app-region: no-drag;
        }

        .header-actions span {
            font-size: var(--header-font-size-small);
            color: var(--header-actions-color);
        }

        .button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: var(--header-button-padding);
            border-radius: 8px;
            font-size: var(--header-font-size-small);
            font-weight: 500;
        }

        .icon-button {
            background: none;
            color: var(--icon-button-color);
            border: none;
            padding: var(--header-icon-padding);
            border-radius: 8px;
            font-size: var(--header-font-size-small);
            font-weight: 500;
            display: flex;
            opacity: 0.6;
            transition: opacity 0.2s ease;
        }

        .icon-button svg {
            width: var(--icon-size);
            height: var(--icon-size);
        }

        .icon-button:hover {
            background: var(--hover-background);
            opacity: 1;
        }

        .button:hover {
            background: var(--hover-background);
        }

        :host([isclickthrough]) .button:hover,
        :host([isclickthrough]) .icon-button:hover {
            background: transparent;
        }

        .key {
            background: var(--key-background);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            margin: 0px;
        }

        .auth-chip {
            font-size: 11px;
            border: 1px solid var(--button-border);
            border-radius: 999px;
            padding: 4px 8px;
            color: var(--header-actions-color);
            cursor: pointer;
            background: transparent;
        }

        .auth-chip:hover {
            background: var(--hover-background);
        }

        .auth-dropdown-wrap {
            position: relative;
        }

        .auth-dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            margin-top: 4px;
            min-width: 180px;
            background: var(--header-background);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 8px 0;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .auth-dropdown-item {
            display: block;
            width: 100%;
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
            background: none;
            border: none;
            color: var(--text-color);
            cursor: pointer;
        }

        .auth-dropdown-item:hover {
            background: var(--hover-background);
        }

        .auth-dropdown-email {
            padding: 6px 12px;
            font-size: 11px;
            color: var(--header-actions-color);
            border-bottom: 1px solid var(--border-color);
        }

        .auth-overlay {
            position: fixed;
            inset: 0;
            z-index: 999;
        }

        .auth-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            min-width: 280px;
            background: var(--header-background);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 16px;
            z-index: 1001;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .auth-modal-title {
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 12px;
        }

        .auth-modal-field {
            margin-bottom: 10px;
        }

        .auth-modal-field label {
            display: block;
            font-size: 11px;
            margin-bottom: 4px;
            color: var(--header-actions-color);
        }

        .auth-modal-field input {
            width: 100%;
            padding: 8px 10px;
            font-size: 12px;
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 4px;
            color: var(--text-color);
            box-sizing: border-box;
        }

        .auth-modal-error {
            font-size: 11px;
            color: #ef4444;
            margin-bottom: 8px;
        }

        .auth-modal-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 14px;
        }
    `;

    static properties = {
        currentView: { type: String },
        statusText: { type: String },
        startTime: { type: Number },
        onCustomizeClick: { type: Function },
        onHelpClick: { type: Function },
        onHistoryClick: { type: Function },
        onCloseClick: { type: Function },
        onBackClick: { type: Function },
        onHideToggleClick: { type: Function },
        isClickThrough: { type: Boolean, reflect: true },
        advancedMode: { type: Boolean },
        onAdvancedClick: { type: Function },
        isUserLoggedIn: { type: Boolean },
        userEmail: { type: String },
        onAuthClick: { type: Function },
        onLogout: { type: Function },
    };

    constructor() {
        super();
        this.currentView = 'main';
        this.statusText = '';
        this.startTime = null;
        this.onCustomizeClick = () => {};
        this.onHelpClick = () => {};
        this.onHistoryClick = () => {};
        this.onCloseClick = () => {};
        this.onBackClick = () => {};
        this.onHideToggleClick = () => {};
        this.isClickThrough = false;
        this.advancedMode = false;
        this.onAdvancedClick = () => {};
        this.isUserLoggedIn = false;
        this.userEmail = '';
        this.onAuthClick = () => {};
        this.onLogout = () => {};
        this._timerInterval = null;
        this._authDropdownOpen = false;
        this._changePwOpen = false;
        this._changePwCurrent = '';
        this._changePwNew = '';
        this._changePwConfirm = '';
        this._changePwError = '';
        this._changePwLoading = false;
    }

    connectedCallback() {
        super.connectedCallback();
        this._startTimer();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._stopTimer();
    }

    updated(changedProperties) {
        super.updated(changedProperties);

        // Start/stop timer based on view change
        if (changedProperties.has('currentView')) {
            if (this.currentView === 'assistant' && this.startTime) {
                this._startTimer();
            } else {
                this._stopTimer();
            }
        }

        // Start timer when startTime is set
        if (changedProperties.has('startTime')) {
            if (this.startTime && this.currentView === 'assistant') {
                this._startTimer();
            } else if (!this.startTime) {
                this._stopTimer();
            }
        }
    }

    _startTimer() {
        // Clear any existing timer
        this._stopTimer();

        // Only start timer if we're in assistant view and have a start time
        if (this.currentView === 'assistant' && this.startTime) {
            this._timerInterval = setInterval(() => {
                // Trigger a re-render by requesting an update
                this.requestUpdate();
            }, 1000); // Update every second
        }
    }

    _stopTimer() {
        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    getViewTitle() {
        const titles = {
            onboarding: t('header_title_onboarding'),
            main: t('header_title_main'),
            customize: t('header_title_customize'),
            help: t('header_title_help'),
            history: t('header_title_history'),
            advanced: t('header_title_advanced'),
            assistant: t('header_title_assistant'),
            auth: '账号登录',
        };
        return titles[this.currentView] || t('header_title_main');
    }

    getElapsedTime() {
        if (this.currentView === 'assistant' && this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            return `${elapsed}s`;
        }
        return '';
    }

    isNavigationView() {
        const navigationViews = ['customize', 'help', 'history', 'advanced', 'auth'];
        return navigationViews.includes(this.currentView);
    }

    render() {
        const elapsedTime = this.getElapsedTime();

        return html`
            <div class="header">
                <div class="header-title">${this.getViewTitle()}</div>
                <div class="header-actions">
                    ${this.currentView === 'assistant'
                        ? html`
                              <span>${elapsedTime}</span>
                              <span>${this.statusText}</span>
                          `
                        : ''}
                    ${this.currentView === 'main'
                        ? html`
                              ${this.isUserLoggedIn
                                  ? html`
                                        <div class="auth-dropdown-wrap">
                                            <button class="auth-chip" @click=${() => { this._authDropdownOpen = !this._authDropdownOpen; this.requestUpdate(); }} title=${this.userEmail || '已登录'}>
                                                ${this.userEmail || '已登录'}
                                            </button>
                                            ${this._authDropdownOpen ? html`
                                                <div class="auth-overlay" @click=${() => { this._authDropdownOpen = false; this.requestUpdate(); }}></div>
                                                <div class="auth-dropdown">
                                                    <div class="auth-dropdown-email">${this.userEmail || '已登录'}</div>
                                                    <button class="auth-dropdown-item" @click=${() => this._openChangePassword()}>修改密码</button>
                                                    <button class="auth-dropdown-item" @click=${() => this._handleLogout()}>退出登录</button>
                                                </div>
                                            ` : ''}
                                        </div>
                                    `
                                  : html`<button class="button" @click=${this.onAuthClick}>登录</button>`}
                              <button class="icon-button" @click=${this.onHistoryClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 21V7C12 5.89543 12.8954 5 14 5H21.4C21.7314 5 22 5.26863 22 5.6V18.7143"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                      ></path>
                                      <path
                                          d="M12 21V7C12 5.89543 11.1046 5 10 5H2.6C2.26863 5 2 5.26863 2 5.6V18.7143"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                      ></path>
                                      <path d="M14 19L22 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
                                      <path d="M10 19L2 19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
                                      <path
                                          d="M12 21C12 19.8954 12.8954 19 14 19"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M12 21C12 19.8954 11.1046 19 10 19"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                              ${this.advancedMode
                                  ? html`
                                        <button class="icon-button" @click=${this.onAdvancedClick} title="Advanced Tools">
                                            <?xml version="1.0" encoding="UTF-8"?><svg
                                                width="24px"
                                                stroke-width="1.7"
                                                height="24px"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                color="currentColor"
                                            >
                                                <path d="M18.5 15L5.5 15" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"></path>
                                                <path
                                                    d="M16 4L8 4"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M9 4.5L9 10.2602C9 10.7376 8.82922 11.1992 8.51851 11.5617L3.48149 17.4383C3.17078 17.8008 3 18.2624 3 18.7398V19C3 20.1046 3.89543 21 5 21L19 21C20.1046 21 21 20.1046 21 19V18.7398C21 18.2624 20.8292 17.8008 20.5185 17.4383L15.4815 11.5617C15.1708 11.1992 15 10.7376 15 10.2602L15 4.5"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M12 9.01L12.01 8.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                                <path
                                                    d="M11 2.01L11.01 1.99889"
                                                    stroke="currentColor"
                                                    stroke-width="1.7"
                                                    stroke-linecap="round"
                                                    stroke-linejoin="round"
                                                ></path>
                                            </svg>
                                        </button>
                                    `
                                  : ''}
                              <button class="icon-button" @click=${this.onCustomizeClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M19.6224 10.3954L18.5247 7.7448L20 6L18 4L16.2647 5.48295L13.5578 4.36974L12.9353 2H10.981L10.3491 4.40113L7.70441 5.51596L6 4L4 6L5.45337 7.78885L4.3725 10.4463L2 11V13L4.40111 13.6555L5.51575 16.2997L4 18L6 20L7.79116 18.5403L10.397 19.6123L11 22H13L13.6045 19.6132L16.2551 18.5155C16.6969 18.8313 18 20 18 20L20 18L18.5159 16.2494L19.6139 13.598L21.9999 12.9772L22 11L19.6224 10.3954Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                              <button class="icon-button" @click=${this.onHelpClick}>
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M9 9C9 5.49997 14.5 5.5 14.5 9C14.5 11.5 12 10.9999 12 13.9999"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                      <path
                                          d="M12 18.01L12.01 17.9989"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : ''}
                    ${this.currentView === 'assistant'
                        ? html`
                              <button @click=${this.onHideToggleClick} class="button">
                                  ${t('hide')}&nbsp;&nbsp;<span class="key" style="pointer-events: none;">${window.cheddar?.isMacOS ? 'Cmd' : 'Ctrl'}</span
                                  >&nbsp;&nbsp;<span class="key">&bsol;</span>
                              </button>
                              <button @click=${this.onCloseClick} class="icon-button window-close">
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `
                        : html`
                              <button @click=${this.isNavigationView() ? this.onBackClick : this.onCloseClick} class="icon-button window-close">
                                  <?xml version="1.0" encoding="UTF-8"?><svg
                                      width="24px"
                                      height="24px"
                                      stroke-width="1.7"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                      color="currentColor"
                                  >
                                      <path
                                          d="M6.75827 17.2426L12.0009 12M17.2435 6.75736L12.0009 12M12.0009 12L6.75827 6.75736M12.0009 12L17.2435 17.2426"
                                          stroke="currentColor"
                                          stroke-width="1.7"
                                          stroke-linecap="round"
                                          stroke-linejoin="round"
                                      ></path>
                                  </svg>
                              </button>
                          `}
                </div>
            </div>

            ${this._changePwOpen ? html`
                <div class="auth-overlay" @click=${() => this._closeChangePassword()}></div>
                <div class="auth-modal" @click=${e => e.stopPropagation()}>
                    <div class="auth-modal-title">修改密码</div>
                    ${this._changePwError ? html`<div class="auth-modal-error">${this._changePwError}</div>` : ''}
                    <div class="auth-modal-field">
                        <label>当前密码</label>
                        <input type="password" .value=${this._changePwCurrent} @input=${e => { this._changePwCurrent = e.target.value; this._changePwError = ''; this.requestUpdate(); }} placeholder="请输入当前密码" />
                    </div>
                    <div class="auth-modal-field">
                        <label>新密码</label>
                        <input type="password" .value=${this._changePwNew} @input=${e => { this._changePwNew = e.target.value; this._changePwError = ''; this.requestUpdate(); }} placeholder="至少 8 位" />
                    </div>
                    <div class="auth-modal-field">
                        <label>确认新密码</label>
                        <input type="password" .value=${this._changePwConfirm} @input=${e => { this._changePwConfirm = e.target.value; this._changePwError = ''; this.requestUpdate(); }} placeholder="再次输入新密码" />
                    </div>
                    <div class="auth-modal-actions">
                        <button class="button" @click=${() => this._closeChangePassword()}>取消</button>
                        <button class="button" @click=${() => this._submitChangePassword()} ?disabled=${this._changePwLoading}>
                            ${this._changePwLoading ? '提交中...' : '确定'}
                        </button>
                    </div>
                </div>
            ` : ''}
        `;
    }

    _openChangePassword() {
        this._authDropdownOpen = false;
        this._changePwOpen = true;
        this._changePwCurrent = '';
        this._changePwNew = '';
        this._changePwConfirm = '';
        this._changePwError = '';
        this.requestUpdate();
    }

    _closeChangePassword() {
        this._changePwOpen = false;
        this._changePwCurrent = '';
        this._changePwNew = '';
        this._changePwConfirm = '';
        this._changePwError = '';
        this.requestUpdate();
    }

    async _submitChangePassword() {
        if (!this._changePwCurrent.trim()) {
            this._changePwError = '请输入当前密码';
            this.requestUpdate();
            return;
        }
        if (!this._changePwNew.trim()) {
            this._changePwError = '请输入新密码';
            this.requestUpdate();
            return;
        }
        if (this._changePwNew.length < 8) {
            this._changePwError = '新密码至少 8 位';
            this.requestUpdate();
            return;
        }
        if (this._changePwNew !== this._changePwConfirm) {
            this._changePwError = '两次输入的新密码不一致';
            this.requestUpdate();
            return;
        }
        this._changePwLoading = true;
        this._changePwError = '';
        this.requestUpdate();
        try {
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('user-change-password', {
                currentPassword: this._changePwCurrent,
                newPassword: this._changePwNew,
            });
            if (res?.success) {
                this._closeChangePassword();
            } else {
                this._changePwError = res?.error || '修改失败';
            }
        } catch (e) {
            this._changePwError = e?.message || '修改失败';
        } finally {
            this._changePwLoading = false;
            this.requestUpdate();
        }
    }

    async _handleLogout() {
        this._authDropdownOpen = false;
        this.requestUpdate();
        try {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('user-logout');
        } catch (_) {}
        if (typeof this.onLogout === 'function') this.onLogout();
    }
}

customElements.define('app-header', AppHeader);

import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class HelpView extends LitElement {
    static styles = css`
        * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            display: block;
            padding: 12px;
        }

        .help-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .option-group {
            background: var(--card-background, rgba(255, 255, 255, 0.04));
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
        }

        .option-label {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            color: var(--text-color);
            font-weight: 600;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .option-label::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color, #007aff);
            border-radius: 1.5px;
        }

        .description {
            color: var(--description-color, rgba(255, 255, 255, 0.75));
            font-size: 12px;
            line-height: 1.4;
            user-select: text;
            cursor: text;
        }

        .description strong {
            color: var(--text-color);
            font-weight: 500;
            user-select: text;
        }

        .description br {
            margin-bottom: 3px;
        }

        .link {
            color: var(--link-color, #007aff);
            text-decoration: none;
            cursor: pointer;
            transition: color 0.15s ease;
            user-select: text;
        }

        .link:hover {
            color: var(--link-hover-color, #0056b3);
            text-decoration: underline;
        }

        .key {
            background: var(--key-background, rgba(0, 0, 0, 0.3));
            color: var(--text-color);
            border: 1px solid var(--key-border, rgba(255, 255, 255, 0.15));
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            font-weight: 500;
            margin: 0 1px;
            white-space: nowrap;
            user-select: text;
            cursor: text;
        }

        .keyboard-section {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 12px;
            margin-top: 8px;
        }

        .keyboard-group {
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 10px;
        }

        .keyboard-group-title {
            font-weight: 600;
            font-size: 12px;
            color: var(--text-color);
            margin-bottom: 6px;
            padding-bottom: 3px;
        }

        .shortcut-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 3px 0;
            font-size: 11px;
        }

        .shortcut-description {
            color: var(--description-color, rgba(255, 255, 255, 0.7));
            user-select: text;
            cursor: text;
        }

        .shortcut-keys {
            display: flex;
            gap: 2px;
        }

        .profiles-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 8px;
        }

        .profile-item {
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            padding: 8px;
        }

        .profile-name {
            font-weight: 600;
            font-size: 12px;
            color: var(--text-color);
            margin-bottom: 3px;
            user-select: text;
            cursor: text;
        }

        .profile-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.6));
            line-height: 1.3;
            user-select: text;
            cursor: text;
        }

        .community-links {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .community-link {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: var(--input-background, rgba(0, 0, 0, 0.2));
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.1));
            border-radius: 4px;
            text-decoration: none;
            color: var(--link-color, #007aff);
            font-size: 11px;
            font-weight: 500;
            transition: all 0.15s ease;
            cursor: pointer;
        }

        .community-link:hover {
            background: var(--input-hover-background, rgba(0, 0, 0, 0.3));
            border-color: var(--link-color, #007aff);
        }

        .usage-steps {
            counter-reset: step-counter;
        }

        .usage-step {
            counter-increment: step-counter;
            position: relative;
            padding-left: 24px;
            margin-bottom: 6px;
            font-size: 11px;
            line-height: 1.3;
            user-select: text;
            cursor: text;
        }

        .usage-step::before {
            content: counter(step-counter);
            position: absolute;
            left: 0;
            top: 0;
            width: 16px;
            height: 16px;
            background: var(--link-color, #007aff);
            color: white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 9px;
            font-weight: 600;
        }

        .usage-step strong {
            color: var(--text-color);
            user-select: text;
        }
    `;

    static properties = {
        onExternalLinkClick: { type: Function },
        keybinds: { type: Object },
    };

    constructor() {
        super();
        this.onExternalLinkClick = () => {};
        this.keybinds = this.getDefaultKeybinds();
        this.loadKeybinds();
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    getDefaultKeybinds() {
        const isMac = cheddar.isMacOS || navigator.platform.includes('Mac');
        return {
            moveUp: isMac ? 'Alt+Up' : 'Ctrl+Up',
            moveDown: isMac ? 'Alt+Down' : 'Ctrl+Down',
            moveLeft: isMac ? 'Alt+Left' : 'Ctrl+Left',
            moveRight: isMac ? 'Alt+Right' : 'Ctrl+Right',
            toggleVisibility: isMac ? 'Cmd+\\' : 'Ctrl+\\',
            toggleClickThrough: isMac ? 'Cmd+M' : 'Ctrl+M',
            nextStep: isMac ? 'Cmd+Enter' : 'Ctrl+Enter',
            previousResponse: isMac ? 'Cmd+[' : 'Ctrl+[',
            nextResponse: isMac ? 'Cmd+]' : 'Ctrl+]',
            scrollUp: isMac ? 'Cmd+Shift+Up' : 'Ctrl+Shift+Up',
            scrollDown: isMac ? 'Cmd+Shift+Down' : 'Ctrl+Shift+Down',
            audioCapture: 'Ctrl+L',
        };
    }

    loadKeybinds() {
        const savedKeybinds = localStorage.getItem('customKeybinds');
        if (savedKeybinds) {
            try {
                this.keybinds = { ...this.getDefaultKeybinds(), ...JSON.parse(savedKeybinds) };
            } catch (e) {
                console.error('Failed to parse saved keybinds:', e);
                this.keybinds = this.getDefaultKeybinds();
            }
        }
    }

    formatKeybind(keybind) {
        return keybind.split('+').map(key => html`<span class="key">${key}</span>`);
    }

    handleExternalLinkClick(url) {
        this.onExternalLinkClick(url);
    }

    render() {
        const isMacOS = cheddar.isMacOS || false;
        const isLinux = cheddar.isLinux || false;

        return html`
            <div class="help-container">
                <div class="option-group">
                    <div class="option-label">
                        <span>社区与支持</span>
                    </div>
                    <div class="community-links">
                        <div class="community-link" title="微信：jrb_572_">
                            🟩 微信：jrb_572_
                        </div>
                        <a class="community-link" href="mailto:jrb572572@gmail.com">
                            ✉️ 邮箱：jrb572572@gmail.com
                        </a>
                    </div>
                </div>

                <div class="option-group">
                    <div class="option-label">
                        <span>键盘快捷键</span>
                    </div>
                    <div class="keyboard-section">
                        <div class="keyboard-group">
                            <div class="keyboard-group-title">窗口移动</div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">窗口上移</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.moveUp)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">窗口下移</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.moveDown)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">窗口左移</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.moveLeft)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">窗口右移</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.moveRight)}</div>
                            </div>
                        </div>

                        <div class="keyboard-group">
                            <div class="keyboard-group-title">窗口控制</div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">切换穿透模式</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.toggleClickThrough)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">切换窗口可见性</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.toggleVisibility)}</div>
                            </div>
                        </div>

                        <div class="keyboard-group">
                            <div class="keyboard-group-title">AI 操作</div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">截图并询问下一步</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.nextStep)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">开始音频录制（转写）</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.audioCapture)}</div>
                            </div>
                        </div>

                        <div class="keyboard-group">
                            <div class="keyboard-group-title">响应导航</div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">上一条响应</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.previousResponse)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">下一条响应</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.nextResponse)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">响应向上滚动</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.scrollUp)}</div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">响应向下滚动</span>
                                <div class="shortcut-keys">${this.formatKeybind(this.keybinds.scrollDown)}</div>
                            </div>
                        </div>

                        <div class="keyboard-group">
                            <div class="keyboard-group-title">文本输入</div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">发送消息给 AI</span>
                                <div class="shortcut-keys"><span class="key">Enter</span></div>
                            </div>
                            <div class="shortcut-item">
                                <span class="shortcut-description">文本输入中换行</span>
                                <div class="shortcut-keys"><span class="key">Shift</span><span class="key">Enter</span></div>
                            </div>
                        </div>
                    </div>
                    <div class="description" style="margin-top: 12px; font-style: italic; text-align: center;">
                        💡 可以在设置页自定义这些快捷键！
                    </div>
                </div>

                <div class="option-group">
                    <div class="option-label">
                        <span>如何使用</span>
                    </div>
                    <div class="usage-steps">
                        <div class="usage-step"><strong>输入 API Key：</strong> 在首页输入你的 API Key，点击“开始会话”进行连通性测试并进入窗口。</div>
                        <div class="usage-step"><strong>选择模型：</strong> 在设置页选择视觉模型与语音识别模型（如 Whisper-Large-v3）。</div>
                        <div class="usage-step"><strong>截图与下一步：</strong> 使用 ${this.formatKeybind(this.keybinds.nextStep)} 截图并让 AI 给出下一步建议。</div>
                        <div class="usage-step"><strong>音频录制：</strong> 在面试官开始说话前，使用 ${this.formatKeybind(this.keybinds.audioCapture)} 手动开始录音，结束后自动转写并回答。</div>
                        <div class="usage-step"><strong>窗口移动：</strong> 用方向键组合移动窗口到合适位置。</div>
                        <div class="usage-step"><strong>穿透模式：</strong> 使用 ${this.formatKeybind(this.keybinds.toggleClickThrough)} 让窗口可被点击穿透。</div>
                        <div class="usage-step"><strong>响应浏览：</strong> 使用 ${this.formatKeybind(this.keybinds.previousResponse)} 与 ${this.formatKeybind(this.keybinds.nextResponse)} 浏览响应。</div>
                    </div>
                </div>

                <div class="option-group">
                    <div class="option-label">
                        <span>支持的档案</span>
                    </div>
                    <div class="profiles-grid">
                        <div class="profile-item">
                            <div class="profile-name">求职面试</div>
                            <div class="profile-description">辅助回答面试问题与组织回复</div>
                        </div>
                        <div class="profile-item">
                            <div class="profile-name">销售电话</div>
                            <div class="profile-description">支持销售沟通与异议处理</div>
                        </div>
                        <div class="profile-item">
                            <div class="profile-name">商务会议</div>
                            <div class="profile-description">支持专业会议与讨论</div>
                        </div>
                        <div class="profile-item">
                            <div class="profile-name">演示与演讲</div>
                            <div class="profile-description">帮助准备演示与公众表达</div>
                        </div>
                        <div class="profile-item">
                            <div class="profile-name">商务谈判</div>
                            <div class="profile-description">指导商务谈判与交易</div>
                        </div>
                        <div class="profile-item">
                            <div class="profile-name">考试助手</div>
                            <div class="profile-description">学术类考试题目辅助</div>
                        </div>
                    </div>
                </div>

                <div class="option-group">
                    <div class="option-label">
                        <span>音频输入</span>
                    </div>
                    <div class="description">需要用户在面试官开始说话前，手动使用 ${this.formatKeybind(this.keybinds.audioCapture)} 开始录音；录音结束后会自动转写并用于生成回答。</div>
                </div>
            </div>
        `;
    }
}

customElements.define('help-view', HelpView);

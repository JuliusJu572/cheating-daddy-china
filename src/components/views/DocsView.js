import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class DocsView extends LitElement {
    static styles = css`
        * {
            box-sizing: border-box;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            cursor: default;
            user-select: none;
        }

        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
            width: 100%;
            overflow: hidden;
        }

        ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }

        ::-webkit-scrollbar-track {
            background: var(--scrollbar-background);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 3px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .docs-container {
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .docs-scroll {
            flex: 1;
            overflow-y: auto;
            padding-bottom: 20px;
            overflow-x: hidden;
        }

        .doc-section {
            background: var(--main-content-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 12px;
        }

        .doc-section-title {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-color);
            margin-bottom: 8px;
        }

        .doc-row {
            display: flex;
            gap: 8px;
            flex-direction: column;
            align-items: stretch;
            margin-bottom: 10px;
            min-width: 0;
        }

        .doc-button {
            background: var(--button-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
            width: fit-content;
        }

        .doc-button:hover {
            background: var(--hover-background);
        }

        .doc-button:disabled {
            opacity: 0.6;
            cursor: default;
        }

        .doc-button.danger:hover {
            background: rgba(255, 0, 0, 0.1);
            border-color: rgba(255, 0, 0, 0.25);
        }

        .doc-input,
        .doc-textarea {
            width: 100%;
            max-width: 100%;
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 10px;
            color: var(--text-color);
            font-size: 12px;
            line-height: 1.4;
            user-select: text;
            cursor: text;
            outline: none;
            min-width: 0;
        }

        .doc-textarea {
            min-height: 140px;
            resize: vertical;
            overflow-x: hidden;
            overflow-y: auto;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .doc-textarea.fixed {
            height: 140px;
            resize: none;
        }

        .doc-output {
            width: 100%;
            max-width: 100%;
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 8px;
            padding: 10px;
            color: var(--text-color);
            font-size: 12px;
            line-height: 1.4;
            user-select: text;
            cursor: text;
            outline: none;
            min-width: 0;
            height: 220px;
            overflow-y: auto;
            overflow-x: hidden;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .doc-output-content {
            user-select: text;
            cursor: text;
        }

        .doc-output-content :is(h1, h2, h3) {
            margin: 6px 0 8px;
            font-size: 12px;
        }

        .doc-output-content p {
            margin: 6px 0;
        }

        .doc-output-content ul,
        .doc-output-content ol {
            padding-left: 18px;
            margin: 6px 0;
        }

        .doc-output-content code {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 1px 4px;
            border-radius: 4px;
        }

        .doc-output-content pre {
            background: rgba(0, 0, 0, 0.35);
            border: 1px solid rgba(255, 255, 255, 0.08);
            padding: 10px;
            border-radius: 8px;
            overflow: auto;
        }

        .doc-hint {
            font-size: 11px;
            color: var(--description-color);
            line-height: 1.35;
        }

        .doc-status {
            font-size: 11px;
            color: var(--description-color);
        }

        .doc-error {
            font-size: 11px;
            color: rgba(255, 180, 180, 0.95);
            background: rgba(255, 0, 0, 0.08);
            border: 1px solid rgba(255, 0, 0, 0.15);
            padding: 8px 10px;
            border-radius: 8px;
            line-height: 1.35;
            overflow-wrap: anywhere;
            word-break: break-word;
        }
    `;

    static properties = {
        documentParsing: { type: Object },
        docLoading: { type: Boolean },
        resumeTextParsing: { type: Boolean },
        jdParsing: { type: Boolean },
        jdInput: { type: String },
        resumeTextInput: { type: String },
        enableDocParsingContext: { type: Boolean },
        resumeTextError: { type: String },
        jdError: { type: String },
        _mdJobId: { state: true },
    };

    constructor() {
        super();
        this.documentParsing = {
            resumeRaw: '',
            resumeParsed: '',
            resumeUpdatedAt: 0,
            jdRaw: '',
            jdParsed: '',
            jdUpdatedAt: 0,
        };
        this.docLoading = true;
        this.resumeTextParsing = false;
        this.jdParsing = false;
        this.jdInput = '';
        this.resumeTextInput = '';
        this.enableDocParsingContext = false;
        this.resumeTextError = '';
        this.jdError = '';
        this._mdJobId = 0;
        this.loadDocumentParsing();
    }

    renderMarkdownToHtml(markdownText) {
        const raw = typeof markdownText === 'string' ? markdownText : '';
        const marked = window.marked;
        if (marked && typeof marked.parse === 'function') {
            try {
                return marked.parse(raw);
            } catch (_) {
                return '';
            }
        }
        return '';
    }

    firstUpdated() {
        this._renderOutputsFromState();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('documentParsing') || changedProperties.has('resumeTextParsing') || changedProperties.has('jdParsing')) {
            this._renderOutputsFromState();
        }
    }

    _setOutputText(id, text) {
        const el = this.shadowRoot?.getElementById?.(id);
        if (el) el.textContent = String(text || '');
    }

    _setOutputHtml(id, htmlStr) {
        const el = this.shadowRoot?.getElementById?.(id);
        if (el) el.innerHTML = String(htmlStr || '');
    }

    _renderOutputsFromState() {
        const resumeOutId = 'resumeOutput';
        const jdOutId = 'jdOutput';

        if (this.resumeTextParsing) {
            this._setOutputText(resumeOutId, '解析中...');
        } else {
            const md = String(this.documentParsing?.resumeParsed || '');
            this._scheduleMarkdownRender(resumeOutId, md);
        }

        if (this.jdParsing) {
            this._setOutputText(jdOutId, '解析中...');
        } else {
            const md = String(this.documentParsing?.jdParsed || '');
            this._scheduleMarkdownRender(jdOutId, md);
        }
    }

    _scheduleMarkdownRender(outputId, markdown) {
        const md = typeof markdown === 'string' ? markdown : '';
        const jobId = ++this._mdJobId;
        setTimeout(() => {
            if (jobId !== this._mdJobId) return;
            const htmlStr = this.renderMarkdownToHtml(md);
            this._setOutputHtml(outputId, htmlStr);
        }, 0);
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();
    }

    async loadDocumentParsing() {
        try {
            this.docLoading = true;
            if (!window.require) {
                this.documentParsing = { ...this.documentParsing };
                this.enableDocParsingContext = false;
                return;
            }
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('get-document-parsing');
            if (res?.success && res?.data && typeof res.data === 'object') {
                this.documentParsing = res.data;
                this.enableDocParsingContext = res.enableDocParsingContext === true;
                if (typeof res.data.jdRaw === 'string' && !this.jdInput) {
                    this.jdInput = res.data.jdRaw;
                }
                if (typeof res.data.resumeRaw === 'string' && !this.resumeTextInput) {
                    this.resumeTextInput = res.data.resumeRaw;
                }
            }
        } catch (error) {
            console.error('Error loading document parsing:', error);
        } finally {
            this.docLoading = false;
        }
    }

    handleResumeTextInput(e) {
        this.resumeTextInput = e?.target?.value || '';
    }

    async handleParseResumeText() {
        try {
            const text = String(this.resumeTextInput || '').trim();
            if (!text) return;
            if (!window.require) return;

            console.log('[Docs] resume parse start, chars:', text.length);
            this.resumeTextError = '';
            this.resumeTextParsing = true;
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('parse-resume-text', { resumeText: text });
            if (!res?.success) throw new Error(res?.error || 'Parse failed');

            this.documentParsing = res.data || this.documentParsing;
            this.requestUpdate();
            console.log('[Docs] resume parse done, parsed chars:', String(res?.data?.resumeParsed || '').length);
        } catch (error) {
            console.error('Resume text parse failed:', error);
            this.resumeTextError = String(error?.message || '解析失败');
        } finally {
            this.resumeTextParsing = false;
        }
    }

    handleJdInput(e) {
        this.jdInput = e?.target?.value || '';
    }

    async handleParseJd() {
        try {
            const text = String(this.jdInput || '').trim();
            if (!text) return;
            if (!window.require) return;

            console.log('[Docs] jd parse start, chars:', text.length);
            this.jdError = '';
            this.jdParsing = true;
            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('parse-jd-text', { jdText: text });
            if (!res?.success) throw new Error(res?.error || 'Parse failed');

            this.documentParsing = res.data || this.documentParsing;
            this.requestUpdate();
            console.log('[Docs] jd parse done, parsed chars:', String(res?.data?.jdParsed || '').length);
        } catch (error) {
            console.error('JD parse failed:', error);
            this.jdError = String(error?.message || '解析失败');
        } finally {
            this.jdParsing = false;
        }
    }

    async handleClearDocuments() {
        try {
            if (!window.require) return;
            const empty = {
                resumeRaw: '',
                resumeParsed: '',
                resumeUpdatedAt: 0,
                jdRaw: '',
                jdParsed: '',
                jdUpdatedAt: 0,
            };
            this.documentParsing = empty;
            this.jdInput = '';
            this.resumeTextInput = '';
            this.resumeTextError = '';
            this.jdError = '';
            this.resumeTextParsing = false;
            this.jdParsing = false;
            this.requestUpdate();
            this._renderOutputsFromState();

            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('clear-document-parsing');
            if (res?.success) {
                this.documentParsing = res.data || this.documentParsing;
                this.jdInput = '';
                this.resumeTextInput = '';
                this.resumeTextError = '';
                this.jdError = '';
                this.requestUpdate();
            }
        } catch (error) {
            console.error('Clear document parsing failed:', error);
        }
    }

    render() {
        const doc = this.documentParsing || {};
        const modeLabel = this.enableDocParsingContext ? '开启：回答会携带“解析压缩版（简历/JD）”上下文' : '关闭：回答不携带任何简历/JD 上下文';

        return html`
            <div class="docs-container">
                <div class="docs-scroll">
                <div class="doc-section">
                    <div class="doc-row" style="justify-content: space-between;">
                        <div class="doc-hint">${modeLabel}（可在设置中切换）</div>
                        <button class="doc-button danger" @click=${this.handleClearDocuments}>清理已上传信息</button>
                    </div>
                </div>

                <div class="doc-section">
                    <div class="doc-section-title">简历解析</div>
                    <div class="doc-row">
                        <div class="doc-hint">输入简历内容（可直接粘贴文本）</div>
                        <textarea class="doc-textarea fixed" .value=${this.resumeTextInput} @input=${this.handleResumeTextInput} placeholder="粘贴简历文本内容"></textarea>
                        <button class="doc-button" @click=${this.handleParseResumeText} ?disabled=${this.resumeTextParsing || !String(this.resumeTextInput || '').trim()}>
                            ${this.resumeTextParsing ? '解析中…' : '解析简历文本'}
                        </button>
                        ${this.resumeTextError ? html`<div class="doc-error">${this.resumeTextError}</div>` : ''}
                    </div>
                    <div class="doc-hint">解析结果（Markdown 渲染）</div>
                    <div class="doc-output" contenteditable="false">
                        <div id="resumeOutput" class="doc-output-content"></div>
                    </div>
                </div>

                <div class="doc-section">
                    <div class="doc-section-title">JD 解析</div>
                    <div class="doc-row">
                        <textarea class="doc-textarea" style="min-height: 120px;" .value=${this.jdInput} @input=${this.handleJdInput} placeholder="粘贴/输入 JD 原文"></textarea>
                    </div>
                    <div class="doc-row">
                        <button class="doc-button" @click=${this.handleParseJd} ?disabled=${this.jdParsing || !String(this.jdInput || '').trim()}>
                            ${this.jdParsing ? '解析中…' : '解析 JD'}
                        </button>
                        <div class="doc-status">${this.jdParsing ? '正在调用模型…' : ''}</div>
                    </div>
                    ${this.jdError ? html`<div class="doc-error">${this.jdError}</div>` : ''}
                    <div class="doc-hint">解析结果（Markdown 渲染，不可编辑）</div>
                    <div class="doc-output" contenteditable="false">
                        <div id="jdOutput" class="doc-output-content"></div>
                    </div>
                </div>
                </div>
            </div>
        `;
    }
}

customElements.define('docs-view', DocsView);

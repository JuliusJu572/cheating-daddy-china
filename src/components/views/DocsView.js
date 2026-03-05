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
        docParsingModel: { type: String },
        docParsingEnableThinking: { type: Boolean },
        docParsingMaxTokens: { type: Number },
        resumeTextError: { type: String },
        jdError: { type: String },
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
        this.docParsingModel = 'deepseek-v3.2';
        this.docParsingEnableThinking = true;
        this.docParsingMaxTokens = 1024;
        this.resumeTextError = '';
        this.jdError = '';
        this._mdJobIds = { resumeOutput: 0, jdOutput: 0 };
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
             const md = String(this.documentParsing?.resumeParsed || '');
             if (!md) {
                 this._setOutputText(resumeOutId, '解析中...');
             } else {
                 this._scheduleMarkdownRender(resumeOutId, md);
             }
        } else {
            const md = String(this.documentParsing?.resumeParsed || '');
            this._scheduleMarkdownRender(resumeOutId, md);
        }

        if (this.jdParsing) {
             const md = String(this.documentParsing?.jdParsed || '');
             if (!md) {
                 this._setOutputText(jdOutId, '解析中...');
             } else {
                 this._scheduleMarkdownRender(jdOutId, md);
             }
        } else {
            const md = String(this.documentParsing?.jdParsed || '');
            this._scheduleMarkdownRender(jdOutId, md);
        }
    }

    _scheduleMarkdownRender(outputId, markdown) {
        const md = typeof markdown === 'string' ? markdown : '';
        const nextJobId = (this._mdJobIds?.[outputId] || 0) + 1;
        this._mdJobIds[outputId] = nextJobId;
        const render = () => {
            const htmlStr = this.renderMarkdownToHtml(md);
            this._setOutputHtml(outputId, htmlStr);
        };
        
        requestAnimationFrame(() => {
            if (nextJobId !== this._mdJobIds?.[outputId]) return;
            render();
        });
    }

    connectedCallback() {
        super.connectedCallback();
        // Resize window for this view
        resizeLayout();

        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.on('update-doc-parsing-stream', (_, { kind, text, done }) => {
                this.handleDocParsingStream(kind, text, done);
            });
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.removeAllListeners('update-doc-parsing-stream');
        }
    }

    handleDocParsingStream(kind, text, done) {
        if (kind === 'resume') {
            this.documentParsing = { ...this.documentParsing, resumeParsed: text };
            if (done) {
                this.resumeTextParsing = false;
                this.documentParsing.resumeUpdatedAt = Date.now();
            }
        } else if (kind === 'jd') {
            this.documentParsing = { ...this.documentParsing, jdParsed: text };
            if (done) {
                this.jdParsing = false;
                this.documentParsing.jdUpdatedAt = Date.now();
            }
        }
        this._renderOutputsFromState();
        this.requestUpdate();
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
            
            // Load content
            const res = await ipcRenderer.invoke('get-document-parsing');
            if (res?.success && res?.data && typeof res.data === 'object') {
                this.documentParsing = res.data;
                // enableDocParsingContext is now managed via config, but we can respect what get-document-parsing returns initially if it does
                if (typeof res.enableDocParsingContext === 'boolean') {
                    this.enableDocParsingContext = res.enableDocParsingContext;
                }
                if (typeof res.data.jdRaw === 'string' && !this.jdInput) {
                    this.jdInput = res.data.jdRaw;
                }
                if (typeof res.data.resumeRaw === 'string' && !this.resumeTextInput) {
                    this.resumeTextInput = res.data.resumeRaw;
                }

                // Force render after data load
                this.requestUpdate();
                await this.updateComplete;
                this._renderOutputsFromState();
            }

            // Load config
            const configRes = await ipcRenderer.invoke('get-config');
            if (configRes?.success && configRes?.config) {
                const cfg = configRes.config;
                if (cfg.docParsingModel) this.docParsingModel = cfg.docParsingModel;
                if (typeof cfg.docParsingEnableThinking === 'boolean') this.docParsingEnableThinking = cfg.docParsingEnableThinking;
                if (cfg.docParsingMaxTokens) this.docParsingMaxTokens = cfg.docParsingMaxTokens;
                if (typeof cfg.enableDocParsingContext === 'boolean') this.enableDocParsingContext = cfg.enableDocParsingContext;
            }
        } catch (error) {
            console.error('Error loading document parsing:', error);
        } finally {
            this.docLoading = false;
        }
    }

    getQwenTextModelOptions() {
        return [
            { value: 'qwen3.5-plus', name: 'Qwen3.5-Plus' },
            { value: 'qwen3-max', name: 'Qwen3-Max' },
            { value: 'qwen3.5-flash', name: 'Qwen3.5-Flash' },
            { value: 'qwen-flash', name: 'Qwen-Flash' },
            { value: 'deepseek-v3.2', name: 'DeepSeek-V3.2' },
            { value: 'kimi/kimi-k2.5', name: 'Kimi-K2.5' },
            { value: 'MiniMax/MiniMax-M2.5', name: 'MiniMax-M2.5' },
            { value: 'MiniMax/MiniMax-M2.1', name: 'MiniMax-M2.1' },
        ];
    }

    async persistModelConfig(payload) {
        if (!window.require) return;
        try {
            const { ipcRenderer } = window.require('electron');
            await ipcRenderer.invoke('set-model-config', payload);
        } catch (e) {
            console.error('Failed to persist model config:', e);
        }
    }

    handleDocParsingModelSelect(e) {
        this.docParsingModel = e.target.value;
        this.persistModelConfig({ docParsingModel: this.docParsingModel });
        this.requestUpdate();
    }

    handleDocParsingEnableThinkingChange(e) {
        this.docParsingEnableThinking = e.target.checked;
        this.persistModelConfig({ docParsingEnableThinking: this.docParsingEnableThinking });
        this.requestUpdate();
    }

    handleDocParsingMaxTokensChange(e) {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            this.docParsingMaxTokens = val;
            this.persistModelConfig({ docParsingMaxTokens: this.docParsingMaxTokens });
            this.requestUpdate();
        }
    }

    handleEnableDocParsingContextChange(e) {
        this.enableDocParsingContext = e.target.checked;
        this.persistModelConfig({ enableDocParsingContext: this.enableDocParsingContext });
        this.requestUpdate();
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
            this.requestUpdate(); // Force UI to show "Parsing..." immediately

            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('parse-resume-text', { resumeText: text });
            console.log('[Docs] resume parse invoked, success:', res?.success);

            if (!res?.success) throw new Error(res?.error || 'Parse failed');

            this.documentParsing = res.data || this.documentParsing;
            // Force re-render of output
            this._renderOutputsFromState(); 
            console.log('[Docs] resume parse done, parsed chars:', String(res?.data?.resumeParsed || '').length);
        } catch (error) {
            console.error('Resume text parse failed:', error);
            this.resumeTextError = String(error?.message || '解析失败');
        } finally {
            this.resumeTextParsing = false;
            this.requestUpdate();
            // Ensure outputs are rendered one last time
            setTimeout(() => this._renderOutputsFromState(), 50);
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
            this.requestUpdate();

            const { ipcRenderer } = window.require('electron');
            const res = await ipcRenderer.invoke('parse-jd-text', { jdText: text });
            console.log('[Docs] jd parse invoked, success:', res?.success);

            if (!res?.success) throw new Error(res?.error || 'Parse failed');

            this.documentParsing = res.data || this.documentParsing;
            this._renderOutputsFromState();
            console.log('[Docs] jd parse done, parsed chars:', String(res?.data?.jdParsed || '').length);
        } catch (error) {
            console.error('JD parse failed:', error);
            this.jdError = String(error?.message || '解析失败');
        } finally {
            this.jdParsing = false;
            this.requestUpdate();
            setTimeout(() => this._renderOutputsFromState(), 50);
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
        
        return html`
            <div class="docs-container">
                <div class="docs-scroll">
                
                <div class="doc-section">
                    <div class="doc-section-title">解析配置</div>
                    <div class="doc-row" style="align-items: center; justify-content: space-between; margin-bottom: 12px;">
                         <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="enableContextCtx" .checked=${this.enableDocParsingContext} @change=${this.handleEnableDocParsingContextChange} style="cursor: pointer;">
                            <label for="enableContextCtx" class="doc-hint" style="cursor: pointer; margin: 0; font-size: 12px; color: var(--text-color);">把解析内容加入上下文</label>
                        </div>
                        <button class="doc-button danger" @click=${this.handleClearDocuments}>清理所有信息</button>
                    </div>

                    <div class="doc-row" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div>
                            <div class="doc-hint" style="margin-bottom: 4px;">解析模型</div>
                            <select class="doc-input" .value=${this.docParsingModel} @change=${this.handleDocParsingModelSelect}>
                                ${this.getQwenTextModelOptions().map(
                                    option => html`<option value=${option.value} ?selected=${option.value === this.docParsingModel}>${option.name}</option>`
                                )}
                            </select>
                        </div>
                        <div>
                            <div class="doc-hint" style="margin-bottom: 4px;">最大 Tokens</div>
                            <input type="number" class="doc-input" .value=${this.docParsingMaxTokens} @input=${this.handleDocParsingMaxTokensChange} min="64" max="8192">
                        </div>
                    </div>
                     <div class="doc-row" style="margin-top: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="enableThinking" .checked=${this.docParsingEnableThinking} @change=${this.handleDocParsingEnableThinkingChange} style="cursor: pointer;">
                            <label for="enableThinking" class="doc-hint" style="cursor: pointer; margin: 0;">启用思考模式</label>
                        </div>
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

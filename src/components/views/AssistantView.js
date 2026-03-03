import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';

export class AssistantView extends LitElement {
    static styles = css`
        :host {
            height: 100%;
            display: flex;
            flex-direction: column;
        }

        * {
            font-family: 'Inter', sans-serif;
            cursor: default;
        }

        .response-container {
            flex: 1;
            min-height: 0;
            min-width: 0;
            overflow-x: hidden;
            overflow-y: auto;
            overflow-wrap: break-word;
            word-break: break-word;
            border-radius: 10px;
            font-size: var(--response-font-size, 18px);
            line-height: 1.6;
            background: var(--main-content-background);
            padding: 16px;
            scroll-behavior: smooth;
            user-select: text;
            cursor: text;
        }

        .live-transcript-container {
            margin-bottom: 10px;
            border-radius: 8px;
            border: 1px solid var(--button-border);
            background: var(--input-background);
            padding: 10px 12px;
            max-height: 140px;
            overflow-y: auto;
            user-select: text;
            transition: border-color 0.2s;
        }

        .live-transcript-container.recording {
            border-color: #f44336;
        }

        .live-transcript-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 6px;
        }

        .live-transcript-title {
            font-size: 12px;
            color: var(--description-color);
        }

        .clear-transcript-btn {
            background: transparent;
            border: none;
            padding: 0 2px;
            cursor: pointer;
            color: var(--description-color);
            font-size: 12px;
            line-height: 1;
            border-radius: 4px;
            opacity: 0.6;
            transition: opacity 0.15s;
        }

        .clear-transcript-btn:hover {
            opacity: 1;
            color: var(--text-color);
        }

        .live-transcript-content {
            font-size: 13px;
            line-height: 1.5;
            color: var(--text-color);
            white-space: pre-wrap;
            word-break: break-word;
            user-select: text;
        }

        .intent-preview-container {
            margin-bottom: 10px;
            border-radius: 8px;
            border: 1px solid rgba(34, 197, 94, 0.4);
            background: rgba(34, 197, 94, 0.08);
            padding: 10px 12px;
            max-height: 120px;
            overflow-y: auto;
            user-select: text;
        }

        .intent-preview-title {
            font-size: 11px;
            color: rgba(34, 197, 94, 0.9);
            margin-bottom: 6px;
            font-weight: 600;
        }

        .intent-preview-content {
            font-size: 13px;
            line-height: 1.25;
            letter-spacing: 0;
            color: var(--text-color);
            white-space: pre-wrap;
            word-break: break-word;
        }

        /* Allow text selection for all content within the response container */
        .response-container * {
            user-select: text;
            cursor: text;
        }

        /* Restore default cursor for interactive elements */
        .response-container a {
            cursor: pointer;
        }

        /* Animated word-by-word reveal */
        .response-container [data-word] {
            opacity: 0;
            filter: blur(10px);
            display: inline;
            transition: opacity 0.5s, filter 0.5s;
            overflow-wrap: break-word;
            word-break: break-word;
        }
        .response-container [data-word].visible {
            opacity: 1;
            filter: blur(0px);
        }

        /* Markdown styling */
        .response-container h1,
        .response-container h2,
        .response-container h3,
        .response-container h4,
        .response-container h5,
        .response-container h6 {
            margin: 1.2em 0 0.6em 0;
            color: var(--text-color);
            font-weight: 600;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container h1 {
            font-size: 1.8em;
        }
        .response-container h2 {
            font-size: 1.5em;
        }
        .response-container h3 {
            font-size: 1.3em;
        }
        .response-container h4 {
            font-size: 1.1em;
        }
        .response-container h5 {
            font-size: 1em;
        }
        .response-container h6 {
            font-size: 0.9em;
        }

        .response-container p {
            margin: 0.8em 0;
            color: var(--text-color);
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container ul,
        .response-container ol {
            margin: 0.8em 0;
            padding-left: 2em;
            color: var(--text-color);
            overflow-wrap: break-word;
        }

        .response-container li {
            margin: 0.4em 0;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container blockquote {
            margin: 1em 0;
            padding: 0.5em 1em;
            border-left: 4px solid var(--focus-border-color);
            background: rgba(0, 122, 255, 0.1);
            font-style: italic;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container code {
            background: rgba(255, 255, 255, 0.1);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85em;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container pre {
            background: var(--input-background);
            border: 1px solid var(--button-border);
            border-radius: 6px;
            padding: 1em;
            margin: 1em 0;
            max-width: 100%;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .response-container pre code {
            background: none;
            padding: 0;
            border-radius: 0;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .response-container a {
            color: var(--link-color);
            text-decoration: none;
        }

        .response-container a:hover {
            text-decoration: underline;
        }

        .response-container strong,
        .response-container b {
            font-weight: 600;
            color: var(--text-color);
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container em,
        .response-container i {
            font-style: italic;
        }

        .response-container hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 2em 0;
        }

        .response-container table {
            border-collapse: collapse;
            width: 100%;
            max-width: 100%;
            margin: 1em 0;
            table-layout: fixed;
        }

        .response-container th,
        .response-container td {
            border: 1px solid var(--border-color);
            padding: 0.5em;
            text-align: left;
            overflow-wrap: break-word;
            word-break: break-word;
        }

        .response-container th {
            background: var(--input-background);
            font-weight: 600;
        }

        .response-container::-webkit-scrollbar {
            width: 8px;
        }

        .response-container::-webkit-scrollbar-track {
            background: var(--scrollbar-track);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb {
            background: var(--scrollbar-thumb);
            border-radius: 4px;
        }

        .response-container::-webkit-scrollbar-thumb:hover {
            background: var(--scrollbar-thumb-hover);
        }

        .text-input-container {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            align-items: center;
        }

        .text-input-container input {
            flex: 1;
            background: var(--input-background);
            color: var(--text-color);
            border: 1px solid var(--button-border);
            padding: 10px 14px;
            border-radius: 8px;
            font-size: 14px;
        }

        .text-input-container input:focus {
            outline: none;
            border-color: var(--focus-border-color);
            box-shadow: 0 0 0 3px var(--focus-box-shadow);
            background: var(--input-focus-background);
        }

        .text-input-container input::placeholder {
            color: var(--placeholder-color);
        }

        .text-input-container button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 0;
            border-radius: 100px;
        }

        .text-input-container button:hover {
            background: var(--text-input-button-hover);
        }

        .nav-button {
            background: transparent;
            color: white;
            border: none;
            padding: 4px;
            border-radius: 50%;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
        }

        .nav-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .nav-button:disabled {
            opacity: 0.3;
        }

        .nav-button svg {
            stroke: white !important;
        }

        .response-counter {
            font-size: 12px;
            color: var(--description-color);
            white-space: nowrap;
            min-width: 60px;
            text-align: center;
        }

        .save-button {
            background: transparent;
            color: var(--start-button-background);
            border: none;
            padding: 4px;
            border-radius: 50%;
            font-size: 12px;
            display: flex;
            align-items: center;
            width: 36px;
            height: 36px;
            justify-content: center;
            cursor: pointer;
        }

        .save-button:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .save-button.saved {
            color: #4caf50;
        }

        .save-button svg {
            stroke: currentColor !important;
        }
    `;

    static properties = {
        responses: { type: Array },
        currentResponseIndex: { type: Number },
        selectedProfile: { type: String },
        liveTranscript: { type: String },
        intentPreview: { type: String },
        onSendText: { type: Function },
        onSubmitLiveTranscript: { type: Function },
        onClearLiveTranscript: { type: Function },
        isLiveAsrRunning: { type: Boolean },
        shouldAnimateResponse: { type: Boolean },
        savedResponses: { type: Array },
    };

    constructor() {
        super();
        this.responses = [];
        this.currentResponseIndex = -1;
        this.selectedProfile = 'interview';
        this.liveTranscript = '';
        this.intentPreview = '';
        this.onSendText = () => {};
        this.onSubmitLiveTranscript = async () => {};
        this.onClearLiveTranscript = () => {};
        this.isLiveAsrRunning = false;
        this._lastAnimatedWordCount = 0;
        this._mathInitialized = false;
        this._renderMathInElement = null;
        this._katex = null;
        this._pendingDisplayMath = [];
        this.handleGlobalKeydown = this.handleGlobalKeydown.bind(this);
        // Load saved responses from localStorage
        try {
            this.savedResponses = JSON.parse(localStorage.getItem('savedResponses') || '[]');
        } catch (e) {
            this.savedResponses = [];
        }
    }

    getProfileNames() {
        return {
            interview: 'Job Interview',
            sales: 'Sales Call',
            meeting: 'Business Meeting',
            presentation: 'Presentation',
            negotiation: 'Negotiation',
            exam: 'Exam Assistant',
        };
    }

    getCurrentResponse() {
        const profileNames = this.getProfileNames();
        return this.responses.length > 0 && this.currentResponseIndex >= 0
            ? this.responses[this.currentResponseIndex]
            : `Hey, Im listening to your ${profileNames[this.selectedProfile] || 'session'}?`;
    }

    renderMarkdown(content) {
        if (typeof window !== 'undefined' && window.marked) {
            try {
                window.marked.setOptions({
                    breaks: true,
                    gfm: true,
                    sanitize: false, // We trust the AI responses
                });
                const { markdown, blocks } = this.extractDisplayMath(String(content || ''));
                this._pendingDisplayMath = blocks;
                return window.marked.parse(markdown);
            } catch (error) {
                console.warn('Error parsing markdown:', error);
                return content; // Fallback to plain text
            }
        }
        console.log('Marked not available, using plain text');
        return content; // Fallback if marked is not available
    }

    extractDisplayMath(markdown) {
        const blocks = [];
        let out = String(markdown || '');

        const makeToken = idx => `@@KATEX_DISPLAY_${idx}@@`;

        const stripCommonIndent = text => {
            const lines = String(text || '').split(/\r?\n/);
            let minIndent = Infinity;
            for (const line of lines) {
                if (!line.trim()) continue;
                const m = line.match(/^[ \t]*/);
                const indent = m ? m[0].length : 0;
                if (indent < minIndent) minIndent = indent;
            }
            if (!Number.isFinite(minIndent) || minIndent <= 0) return lines.join('\n');
            return lines
                .map(line => {
                    let i = 0;
                    while (i < line.length && i < minIndent && (line[i] === ' ' || line[i] === '\t')) i++;
                    return line.slice(i);
                })
                .join('\n');
        };

        const takeMultiline = /(^|\n)[ \t]*\$\$[ \t]*\n([\s\S]*?)\n[ \t]*\$\$[ \t]*(?=\n|$)/g;
        out = out.replace(takeMultiline, (m, lead, body) => {
            const idx = blocks.length;
            const token = makeToken(idx);
            blocks.push({ token, math: stripCommonIndent(body) });
            return `${lead}\n${token}\n`;
        });

        const takeSingleLine = /(^|\n)[ \t]*\$\$[ \t]*([^\n]*?)[ \t]*\$\$[ \t]*(?=\n|$)/g;
        out = out.replace(takeSingleLine, (m, lead, body) => {
            const idx = blocks.length;
            const token = makeToken(idx);
            blocks.push({ token, math: String(body || '').trim() });
            return `${lead}\n${token}\n`;
        });

        return { markdown: out, blocks };
    }

    ensureMathRenderer() {
        if (this._mathInitialized) return;
        this._mathInitialized = true;

        const nodeRequire = typeof window !== 'undefined' ? window.require : null;
        if (!nodeRequire) return;

        try {
            const fs = nodeRequire('fs');
            const cssPath = nodeRequire.resolve('katex/dist/katex.min.css');
            if (!document.getElementById('katex-style')) {
                const style = document.createElement('style');
                style.id = 'katex-style';
                style.textContent = fs.readFileSync(cssPath, 'utf8');
                document.head.appendChild(style);
            }
        } catch (e) {}

        if (!document.getElementById('katex-style-fallback')) {
            const style = document.createElement('style');
            style.id = 'katex-style-fallback';
            style.textContent = `
.katex-mathml { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }
.katex-display { display: block; margin: 1em 0; text-align: center; }
.katex-display > .katex { display: inline-block; text-align: initial; }
`;
            document.head.appendChild(style);
        }

        try {
            const autoRender = nodeRequire('katex/contrib/auto-render');
            this._renderMathInElement = autoRender?.renderMathInElement || autoRender?.default || autoRender;
        } catch (e) {}

        try {
            const katex = nodeRequire('katex');
            this._katex = katex?.default || katex;
        } catch (e) {}
    }

    renderDisplayMathPlaceholders(container) {
        this.ensureMathRenderer();
        if (!this._pendingDisplayMath || this._pendingDisplayMath.length === 0) return;
        if (!this._katex || typeof this._katex.renderToString !== 'function') return;

        const renderOne = raw => {
            const math = String(raw || '')
                .replace(/[\u200B-\u200D\uFEFF]/g, '')
                .replace(/,\s*,/g, ',');
            return this._katex.renderToString(math, {
                displayMode: true,
                throwOnError: false,
                strict: false,
                trust: true,
            });
        };

        for (const block of this._pendingDisplayMath) {
            const token = block?.token;
            if (!token) continue;
            try {
                const rendered = renderOne(block.math);
                container.innerHTML = container.innerHTML
                    .split(token)
                    .join(`<div class="katex-display-block">${rendered}</div>`);
            } catch (e) {}
        }
        this._pendingDisplayMath = [];
    }

    renderMathInContainer(container) {
        this.ensureMathRenderer();
        if (typeof this._renderMathInElement !== 'function') return;

        try {
            this._renderMathInElement(container, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '$', right: '$', display: false },
                ],
                throwOnError: false,
                strict: false,
                trust: true,
                ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
            });
        } catch (e) {}
    }

    wrapWordsInContainer(container) {
        const tagsToSkip = new Set(['PRE', 'CODE']);

        const wrap = node => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                if (!text.trim()) return;
                const parent = node.parentElement;
                if (!parent) return;
                if (tagsToSkip.has(parent.tagName)) return;
                if (parent.closest && parent.closest('pre, code')) return;
                if (parent.closest && parent.closest('.katex')) return;

                const words = text.split(/(\s+)/);
                const frag = document.createDocumentFragment();
                for (const word of words) {
                    if (word.trim()) {
                        const span = document.createElement('span');
                        span.setAttribute('data-word', '');
                        span.textContent = word;
                        frag.appendChild(span);
                    } else {
                        frag.appendChild(document.createTextNode(word));
                    }
                }
                parent.replaceChild(frag, node);
                return;
            }

            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node;
                if (tagsToSkip.has(el.tagName)) return;
                if (el.classList && el.classList.contains('katex')) return;
                const children = Array.from(el.childNodes);
                for (const child of children) wrap(child);
            }
        };

        const children = Array.from(container.childNodes);
        for (const child of children) wrap(child);
    }

    getResponseCounter() {
        return this.responses.length > 0 ? `${this.currentResponseIndex + 1}/${this.responses.length}` : '';
    }

    navigateToPreviousResponse() {
        if (this.currentResponseIndex > 0) {
            this.currentResponseIndex--;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    navigateToNextResponse() {
        if (this.currentResponseIndex < this.responses.length - 1) {
            this.currentResponseIndex++;
            this.dispatchEvent(
                new CustomEvent('response-index-changed', {
                    detail: { index: this.currentResponseIndex },
                })
            );
            this.requestUpdate();
        }
    }

    scrollResponseUp() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.max(0, container.scrollTop - scrollAmount);
        }
    }

    scrollResponseDown() {
        const container = this.shadowRoot.querySelector('.response-container');
        if (container) {
            const scrollAmount = container.clientHeight * 0.3; // Scroll 30% of container height
            container.scrollTop = Math.min(container.scrollHeight - container.clientHeight, container.scrollTop + scrollAmount);
        }
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            const fontSizeValue = parseInt(fontSize, 10) || 20;
            const root = document.documentElement;
            root.style.setProperty('--response-font-size', `${fontSizeValue}px`);
        }
    }

    connectedCallback() {
        super.connectedCallback();

        // Load and apply font size
        this.loadFontSize();
        
        // Add global keydown listener
        document.addEventListener('keydown', this.handleGlobalKeydown);

        // Set up IPC listeners for keyboard shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');

            this.handlePreviousResponse = () => {
                console.log('Received navigate-previous-response message');
                this.navigateToPreviousResponse();
            };

            this.handleNextResponse = () => {
                console.log('Received navigate-next-response message');
                this.navigateToNextResponse();
            };

            this.handleScrollUp = () => {
                console.log('Received scroll-response-up message');
                this.scrollResponseUp();
            };

            this.handleScrollDown = () => {
                console.log('Received scroll-response-down message');
                this.scrollResponseDown();
            };

            this.handleClearHistoryTrigger = () => {
                console.log('Received clear-history-trigger message');
                this.clearHistory();
            };

            ipcRenderer.on('navigate-previous-response', this.handlePreviousResponse);
            ipcRenderer.on('navigate-next-response', this.handleNextResponse);
            ipcRenderer.on('scroll-response-up', this.handleScrollUp);
            ipcRenderer.on('scroll-response-down', this.handleScrollDown);
            ipcRenderer.on('clear-history-trigger', this.handleClearHistoryTrigger);
        }
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        // Remove global keydown listener
        document.removeEventListener('keydown', this.handleGlobalKeydown);

        // Clean up IPC listeners
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            if (this.handlePreviousResponse) {
                ipcRenderer.removeListener('navigate-previous-response', this.handlePreviousResponse);
            }
            if (this.handleNextResponse) {
                ipcRenderer.removeListener('navigate-next-response', this.handleNextResponse);
            }
            if (this.handleScrollUp) {
                ipcRenderer.removeListener('scroll-response-up', this.handleScrollUp);
            }
            if (this.handleScrollDown) {
                ipcRenderer.removeListener('scroll-response-down', this.handleScrollDown);
            }
            if (this.handleClearHistoryTrigger) {
                ipcRenderer.removeListener('clear-history-trigger', this.handleClearHistoryTrigger);
            }
        }
    }

    async handleSendText() {
        const textInput = this.shadowRoot.querySelector('#textInput');
        if (!textInput) return;

        const message = textInput.value.trim();
        textInput.value = '';
        if (message) {
            await this.onSendText(message);
            return;
        }
        if (typeof this.onSubmitLiveTranscript === 'function') {
            await this.onSubmitLiveTranscript();
        }
    }

    handleTextKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.handleSendText();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            const container = this.shadowRoot.querySelector('.response-container');
            if (container) {
                container.scrollTop = container.scrollHeight;
            }
        }, 0);
    }

    saveCurrentResponse() {
        const currentResponse = this.getCurrentResponse();
        if (currentResponse && !this.isResponseSaved()) {
            this.savedResponses = [
                ...this.savedResponses,
                {
                    response: currentResponse,
                    timestamp: new Date().toISOString(),
                    profile: this.selectedProfile,
                },
            ];
            // Save to localStorage for persistence
            localStorage.setItem('savedResponses', JSON.stringify(this.savedResponses));
            this.requestUpdate();
        }
    }

    async clearHistory() {
        try {
            if (window.require) {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('clear-chat-history');
            }
            this.responses = [];
            this.currentResponseIndex = -1;
            this.requestUpdate();
        } catch (error) {
            console.error('Failed to clear history:', error);
        }
    }

    handleGlobalKeydown(e) {
        // Ctrl+' or Cmd+' to clear history
        if ((e.ctrlKey || e.metaKey) && e.key === "'") {
            e.preventDefault();
            console.log("Ctrl+' detected, clearing history...");
            this.clearHistory();
        }
        // Ctrl+Shift+L to clear live transcript
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'L') {
            e.preventDefault();
            this.clearLiveTranscript();
        }
    }

    clearLiveTranscript() {
        if (typeof this.onClearLiveTranscript === 'function') {
            this.onClearLiveTranscript();
        }
    }

    isResponseSaved() {
        const currentResponse = this.getCurrentResponse();
        return this.savedResponses.some(saved => saved.response === currentResponse);
    }

    firstUpdated() {
        super.firstUpdated();
        this.updateResponseContent();
    }

    updated(changedProperties) {
        super.updated(changedProperties);
        if (changedProperties.has('responses') || changedProperties.has('currentResponseIndex')) {
            if (changedProperties.has('currentResponseIndex')) {
                this._lastAnimatedWordCount = 0;
            }
            this.updateResponseContent();
        }
        if (changedProperties.has('intentPreview') || changedProperties.has('isLiveAsrRunning')) {
            const el = this.shadowRoot?.getElementById('intentPreviewContent');
            if (el && this.intentPreview) {
                const escaped = String(this.intentPreview)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                el.innerHTML = escaped.replace(/\n/g, '<br>');
            }
        }
    }

    updateResponseContent() {
        console.log('updateResponseContent called');
        const container = this.shadowRoot.querySelector('#responseContainer');
        if (container) {
            const currentResponse = this.getCurrentResponse();
            console.log('Current response:', currentResponse);
            const renderedResponse = this.renderMarkdown(currentResponse);
            console.log('Rendered response:', renderedResponse);
            container.innerHTML = renderedResponse;
            this.renderDisplayMathPlaceholders(container);
            this.renderMathInContainer(container);
            this.wrapWordsInContainer(container);
            const words = container.querySelectorAll('[data-word]');
            if (this.shouldAnimateResponse) {
                for (let i = 0; i < this._lastAnimatedWordCount && i < words.length; i++) {
                    words[i].classList.add('visible');
                }
                for (let i = this._lastAnimatedWordCount; i < words.length; i++) {
                    words[i].classList.remove('visible');
                    setTimeout(() => {
                        words[i].classList.add('visible');
                        if (i === words.length - 1) {
                            this.dispatchEvent(new CustomEvent('response-animation-complete', { bubbles: true, composed: true }));
                        }
                    }, (i - this._lastAnimatedWordCount) * 100);
                }
                this._lastAnimatedWordCount = words.length;
            } else {
                words.forEach(word => word.classList.add('visible'));
                this._lastAnimatedWordCount = words.length;
            }
        } else {
            console.log('Response container not found');
        }
    }

    render() {
        const currentResponse = this.getCurrentResponse();
        const responseCounter = this.getResponseCounter();
        const isSaved = this.isResponseSaved();

        return html`
            ${this.isLiveAsrRunning ? html`
            <div class="live-transcript-container recording">
                <div class="live-transcript-header">
                    <div class="live-transcript-title">
                        🔴 实时识别中&nbsp;&nbsp;<span style="font-size:11px;opacity:0.7">再按 Ctrl+L 停止并提交给 AI</span>
                    </div>
                    ${this.liveTranscript ? html`
                        <button
                            class="clear-transcript-btn"
                            @click=${this.clearLiveTranscript}
                            title="清空转写 (Ctrl+Shift+L)"
                        >✕ 清空</button>
                    ` : ''}
                </div>
                <div class="live-transcript-content">${this.liveTranscript || '等待语音输入...'}</div>
            </div>
            ` : ''}

            ${this.isLiveAsrRunning && this.intentPreview ? html`
            <div class="intent-preview-container">
                <div class="intent-preview-title">回答建议</div>
                <div class="intent-preview-content" id="intentPreviewContent"></div>
            </div>
            ` : ''}

            <div class="response-container" id="responseContainer"></div>

            <div class="text-input-container">
                <button class="nav-button" @click=${this.navigateToPreviousResponse} ?disabled=${this.currentResponseIndex <= 0}>
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                    >
                        <path d="M15 6L9 12L15 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                ${this.responses.length > 0 ? html` <span class="response-counter">${responseCounter}</span> ` : ''}

                <button
                    class="save-button"
                    @click=${this.clearHistory}
                    title="Clear history"
                >
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M19 11V20.4C19 20.7314 18.7314 21 18.4 21H5.6C5.26863 21 5 20.7314 5 20.4V11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M10 17V11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M14 17V11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                        <path d="M21 7L16 7M3 7L8 7M8 7V3.6C8 3.26863 8.26863 3 8.6 3H15.4C15.7314 3 16 3.26863 16 3.6V7M8 7H16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>

                <input type="text" id="textInput" placeholder="Type a message to the AI..." @keydown=${this.handleTextKeydown} />

                <button class="nav-button" @click=${this.navigateToNextResponse} ?disabled=${this.currentResponseIndex >= this.responses.length - 1}>
                    <?xml version="1.0" encoding="UTF-8"?><svg
                        width="24px"
                        height="24px"
                        stroke-width="1.7"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        color="#ffffff"
                    >
                        <path d="M9 6L15 12L9 18" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
                    </svg>
                </button>
            </div>
        `;
    }
}

customElements.define('assistant-view', AssistantView);

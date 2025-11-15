import { html, css, LitElement } from '../../assets/lit-core-2.7.4.min.js';
import { t } from '../../i18n/strings.js';
import { resizeLayout } from '../../utils/windowResize.js';

export class CustomizeView extends LitElement {
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

        .settings-container {
            display: grid;
            gap: 12px;
            padding-bottom: 20px;
        }

        .settings-section {
            background: var(--card-background, rgba(255, 255, 255, 0.04));
            border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
            border-radius: 6px;
            padding: 16px;
            backdrop-filter: blur(10px);
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

        .section-title::before {
            content: '';
            width: 3px;
            height: 14px;
            background: var(--accent-color, #007aff);
            border-radius: 1.5px;
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

        .form-group.full-width {
            grid-column: 1 / -1;
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

        select.form-control {
            cursor: pointer;
            appearance: none;
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
            background-position: right 8px center;
            background-repeat: no-repeat;
            background-size: 12px;
            padding-right: 28px;
        }

        textarea.form-control {
            resize: vertical;
            min-height: 60px;
            line-height: 1.4;
            font-family: inherit;
        }

        textarea.form-control::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
        }

        .profile-option {
            display: flex;
            flex-direction: column;
            gap: 3px;
        }

        .current-selection {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10px;
            color: var(--success-color, #34d399);
            background: var(--success-background, rgba(52, 211, 153, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid var(--success-border, rgba(52, 211, 153, 0.2));
        }

        .current-selection::before {
            content: '✓';
            font-weight: 600;
        }

        .keybind-input {
            cursor: pointer;
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
            text-align: center;
            letter-spacing: 0.5px;
            font-weight: 500;
        }

        .keybind-input:focus {
            cursor: text;
            background: var(--input-focus-background, rgba(0, 122, 255, 0.1));
        }

        .keybind-input::placeholder {
            color: var(--placeholder-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
        }

        .reset-keybinds-button {
            background: var(--button-background, rgba(255, 255, 255, 0.1));
            color: var(--text-color);
            border: 1px solid var(--button-border, rgba(255, 255, 255, 0.15));
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
        }

        .reset-keybinds-button:hover {
            background: var(--button-hover-background, rgba(255, 255, 255, 0.15));
            border-color: var(--button-hover-border, rgba(255, 255, 255, 0.25));
        }

        .reset-keybinds-button:active {
            transform: translateY(1px);
        }

        .keybinds-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            border-radius: 4px;
            overflow: hidden;
        }

        .keybinds-table th,
        .keybinds-table td {
            padding: 8px 10px;
            text-align: left;
            border-bottom: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .keybinds-table th {
            background: var(--table-header-background, rgba(255, 255, 255, 0.04));
            font-weight: 600;
            font-size: 11px;
            color: var(--label-color, rgba(255, 255, 255, 0.8));
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .keybinds-table td {
            vertical-align: middle;
        }

        .keybinds-table .action-name {
            font-weight: 500;
            color: var(--text-color);
            font-size: 12px;
        }

        .keybinds-table .action-description {
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
            margin-top: 1px;
        }

        .keybinds-table .keybind-input {
            min-width: 100px;
            padding: 4px 8px;
            margin: 0;
            font-size: 11px;
        }

        .keybinds-table tr:hover {
            background: var(--table-row-hover, rgba(255, 255, 255, 0.02));
        }

        .keybinds-table tr:last-child td {
            border-bottom: none;
        }

        .table-reset-row {
            border-top: 1px solid var(--table-border, rgba(255, 255, 255, 0.08));
        }

        .table-reset-row td {
            padding-top: 10px;
            padding-bottom: 8px;
            border-bottom: none;
        }

        .settings-note {
            font-size: 10px;
            color: var(--note-color, rgba(255, 255, 255, 0.4));
            font-style: italic;
            text-align: center;
            margin-top: 10px;
            padding: 8px;
            background: var(--note-background, rgba(255, 255, 255, 0.02));
            border-radius: 4px;
            border: 1px solid var(--note-border, rgba(255, 255, 255, 0.08));
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

        /* Better focus indicators */
        .form-control:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Improved button states */
        .reset-keybinds-button:focus-visible {
            outline: none;
            border-color: var(--focus-border-color, #007aff);
            box-shadow: 0 0 0 2px var(--focus-shadow, rgba(0, 122, 255, 0.1));
        }

        /* Slider styles */
        .slider-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .slider-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .slider-value {
            font-size: 11px;
            color: var(--success-color, #34d399);
            background: var(--success-background, rgba(52, 211, 153, 0.1));
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: 500;
            border: 1px solid var(--success-border, rgba(52, 211, 153, 0.2));
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', monospace;
        }

        .slider-input {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: var(--input-background, rgba(0, 0, 0, 0.3));
            outline: none;
            border: 1px solid var(--input-border, rgba(255, 255, 255, 0.15));
            cursor: pointer;
        }

        .slider-input::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: pointer;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: var(--focus-border-color, #007aff);
            cursor: pointer;
            border: 2px solid var(--text-color, white);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .slider-input:hover::-webkit-slider-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-input:hover::-moz-range-thumb {
            background: var(--text-input-button-hover, #0056b3);
        }

        .slider-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 4px;
            font-size: 10px;
            color: var(--description-color, rgba(255, 255, 255, 0.5));
        }
    `;

    static properties = {
        selectedProfile: { type: String },
        selectedLanguage: { type: String },
        uiLanguage: { type: String },
        selectedScreenshotInterval: { type: String },
        selectedImageQuality: { type: String },
        layoutMode: { type: String },
        keybinds: { type: Object },
        googleSearchEnabled: { type: Boolean },
        backgroundTransparency: { type: Number },
        fontSize: { type: Number },
        onProfileChange: { type: Function },
        onLanguageChange: { type: Function },
        onScreenshotIntervalChange: { type: Function },
        onImageQualityChange: { type: Function },
        onLayoutModeChange: { type: Function },
        advancedMode: { type: Boolean },
        onAdvancedModeChange: { type: Function },
        selectedModel: { type: String },
        transcriptionModel: { type: String },
        modelApiBase: { type: String },
        modelApiKey: { type: String },
        modelTestStatus: { type: String },
    };

  constructor() {
        super();
        this.selectedProfile = 'interview';
        this.selectedLanguage = 'zh-CN';
        this.uiLanguage = localStorage.getItem('uiLanguage') || 'zh';
        this.selectedScreenshotInterval = '5';
        this.selectedImageQuality = 'medium';
        this.layoutMode = 'normal';
        this.keybinds = this.getDefaultKeybinds();
        this.onProfileChange = () => {};
        this.onLanguageChange = () => {};
        this.onScreenshotIntervalChange = () => {};
        this.onImageQualityChange = () => {};
        this.onLayoutModeChange = () => {};
        this.onAdvancedModeChange = () => {};

        // Google Search default
        this.googleSearchEnabled = false;

        // Advanced mode default
        this.advancedMode = false;

        // Background transparency default
        this.backgroundTransparency = 0.8;

        // Font size default (in pixels)
        this.fontSize = 20;

        this.selectedModel = localStorage.getItem('selectedModel') || 'aihubmix:qwen3-vl-30b-a3b-instruct';
        this.transcriptionModel = localStorage.getItem('transcriptionModel') || 'whisper-large-v3';
        this.modelApiBase = localStorage.getItem('modelApiBase') || '';
        this.modelApiKey = localStorage.getItem('modelApiKey') || '';
        this.modelTestStatus = '';

        this.loadKeybinds();
        this.loadGoogleSearchSettings();
        this.loadAdvancedModeSettings();
        this.loadBackgroundTransparency();
    this.loadFontSize();
    localStorage.setItem('selectedLanguage', this.selectedLanguage);
    this.boundKeydownHandler = this.handleKeydown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    // Load layout mode for display purposes
    this.loadLayoutMode();
    // Resize window for this view
    resizeLayout();
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

    getProfiles() {
        return [
            {
                value: 'interview',
                name: 'Job Interview',
                description: 'Get help with answering interview questions',
            },
            {
                value: 'sales',
                name: 'Sales Call',
                description: 'Assist with sales conversations and objection handling',
            },
            {
                value: 'meeting',
                name: 'Business Meeting',
                description: 'Support for professional meetings and discussions',
            },
            {
                value: 'presentation',
                name: 'Presentation',
                description: 'Help with presentations and public speaking',
            },
            {
                value: 'negotiation',
                name: 'Negotiation',
                description: 'Guidance for business negotiations and deals',
            },
            {
                value: 'exam',
                name: 'Exam Assistant',
                description: 'Academic assistance for test-taking and exam questions',
            },
        ];
    }

    getLanguages() {
        return [
            { value: 'en-US', name: 'English (US)' },
            { value: 'en-GB', name: 'English (UK)' },
            { value: 'en-AU', name: 'English (Australia)' },
            { value: 'en-IN', name: 'English (India)' },
            { value: 'de-DE', name: 'German (Germany)' },
            { value: 'es-US', name: 'Spanish (United States)' },
            { value: 'es-ES', name: 'Spanish (Spain)' },
            { value: 'fr-FR', name: 'French (France)' },
            { value: 'fr-CA', name: 'French (Canada)' },
            { value: 'hi-IN', name: 'Hindi (India)' },
            { value: 'pt-BR', name: 'Portuguese (Brazil)' },
            { value: 'ar-XA', name: 'Arabic (Generic)' },
            { value: 'id-ID', name: 'Indonesian (Indonesia)' },
            { value: 'it-IT', name: 'Italian (Italy)' },
            { value: 'ja-JP', name: 'Japanese (Japan)' },
            { value: 'tr-TR', name: 'Turkish (Turkey)' },
            { value: 'vi-VN', name: 'Vietnamese (Vietnam)' },
            { value: 'bn-IN', name: 'Bengali (India)' },
            { value: 'gu-IN', name: 'Gujarati (India)' },
            { value: 'kn-IN', name: 'Kannada (India)' },
            { value: 'ml-IN', name: 'Malayalam (India)' },
            { value: 'mr-IN', name: 'Marathi (India)' },
            { value: 'ta-IN', name: 'Tamil (India)' },
            { value: 'te-IN', name: 'Telugu (India)' },
            { value: 'nl-NL', name: 'Dutch (Netherlands)' },
            { value: 'ko-KR', name: 'Korean (South Korea)' },
            { value: 'cmn-CN', name: 'Mandarin Chinese (China)' },
            { value: 'pl-PL', name: 'Polish (Poland)' },
            { value: 'ru-RU', name: 'Russian (Russia)' },
            { value: 'th-TH', name: 'Thai (Thailand)' },
        ];
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

    handleProfileSelect(e) {
        this.selectedProfile = e.target.value;
        localStorage.setItem('selectedProfile', this.selectedProfile);
        this.onProfileChange(this.selectedProfile);
    }

    handleLanguageSelect(e) {
        this.selectedLanguage = 'zh-CN';
        localStorage.setItem('selectedLanguage', this.selectedLanguage);
        this.onLanguageChange(this.selectedLanguage);
    }

    handleUILanguageSelect(e) {
        this.uiLanguage = e.target.value;
        localStorage.setItem('uiLanguage', this.uiLanguage);
        this.requestUpdate();
    }

    handleScreenshotIntervalSelect(e) {
        this.selectedScreenshotInterval = e.target.value;
        localStorage.setItem('selectedScreenshotInterval', this.selectedScreenshotInterval);
        this.onScreenshotIntervalChange(this.selectedScreenshotInterval);
    }

    handleImageQualitySelect(e) {
        this.selectedImageQuality = e.target.value;
        this.onImageQualityChange(e.target.value);
    }

    handleLayoutModeSelect(e) {
        this.layoutMode = e.target.value;
        localStorage.setItem('layoutMode', this.layoutMode);
        this.onLayoutModeChange(e.target.value);
    }

    handleCustomPromptInput(e) {
        localStorage.setItem('customPrompt', e.target.value);
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
            audioCapture: isMac ? 'Cmd+L' : 'Ctrl+L',
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

    saveKeybinds() {
        localStorage.setItem('customKeybinds', JSON.stringify(this.keybinds));
        // Send to main process to update global shortcuts
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

    handleKeybindChange(action, value) {
        this.keybinds = { ...this.keybinds, [action]: value };
        this.saveKeybinds();
        this.requestUpdate();
    }

    resetKeybinds() {
        this.keybinds = this.getDefaultKeybinds();
        localStorage.removeItem('customKeybinds');
        this.requestUpdate();
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('update-keybinds', this.keybinds);
        }
    }

  getKeybindActions() {
        return [
            {
                key: 'moveUp',
                name: t('keybind_move_up_name'),
                description: t('keybind_move_up_desc'),
            },
            {
                key: 'moveDown',
                name: t('keybind_move_down_name'),
                description: t('keybind_move_down_desc'),
            },
            {
                key: 'moveLeft',
                name: t('keybind_move_left_name'),
                description: t('keybind_move_left_desc'),
            },
            {
                key: 'moveRight',
                name: t('keybind_move_right_name'),
                description: t('keybind_move_right_desc'),
            },
            {
                key: 'toggleVisibility',
                name: t('keybind_toggle_visibility_name'),
                description: t('keybind_toggle_visibility_desc'),
            },
            {
                key: 'toggleClickThrough',
                name: t('keybind_toggle_clickthrough_name'),
                description: t('keybind_toggle_clickthrough_desc'),
            },
            {
                key: 'nextStep',
                name: t('keybind_next_step_name'),
                description: t('keybind_next_step_desc'),
            },
            {
                key: 'previousResponse',
                name: t('keybind_prev_response_name'),
                description: t('keybind_prev_response_desc'),
            },
            {
                key: 'nextResponse',
                name: t('keybind_next_response_name'),
                description: t('keybind_next_response_desc'),
            },
            {
                key: 'scrollUp',
                name: t('keybind_scroll_up_name'),
                description: t('keybind_scroll_up_desc'),
            },
            {
                key: 'scrollDown',
                name: t('keybind_scroll_down_name'),
                description: t('keybind_scroll_down_desc'),
            },
            {
                key: 'audioCapture',
                name: t('keybind_audio_capture_name'),
                description: t('keybind_audio_capture_desc'),
            },
        ];
    }

  handleKeydown(e) {
    const isAudioCapture = e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && (e.key === 'l' || e.key === 'L');
    if (isAudioCapture) {
      e.preventDefault();
      try { window.startQuickAudioCapture && window.startQuickAudioCapture(); } catch (_) {}
    }
  }

    handleKeybindFocus(e) {
        e.target.placeholder = 'Press key combination...';
        e.target.select();
    }

    handleKeybindInput(e) {
        e.preventDefault();

        const modifiers = [];
        const keys = [];

        // Check modifiers
        if (e.ctrlKey) modifiers.push('Ctrl');
        if (e.metaKey) modifiers.push('Cmd');
        if (e.altKey) modifiers.push('Alt');
        if (e.shiftKey) modifiers.push('Shift');

        // Get the main key
        let mainKey = e.key;

        // Handle special keys
        switch (e.code) {
            case 'ArrowUp':
                mainKey = 'Up';
                break;
            case 'ArrowDown':
                mainKey = 'Down';
                break;
            case 'ArrowLeft':
                mainKey = 'Left';
                break;
            case 'ArrowRight':
                mainKey = 'Right';
                break;
            case 'Enter':
                mainKey = 'Enter';
                break;
            case 'Space':
                mainKey = 'Space';
                break;
            case 'Backslash':
                mainKey = '\\';
                break;
            case 'KeyS':
                if (e.shiftKey) mainKey = 'S';
                break;
            case 'KeyM':
                mainKey = 'M';
                break;
            default:
                if (e.key.length === 1) {
                    mainKey = e.key.toUpperCase();
                }
                break;
        }

        // Skip if only modifier keys are pressed
        if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
            return;
        }

        // Construct keybind string
        const keybind = [...modifiers, mainKey].join('+');

        // Get the action from the input's data attribute
        const action = e.target.dataset.action;

        // Update the keybind
        this.handleKeybindChange(action, keybind);

        // Update the input value
        e.target.value = keybind;
        e.target.blur();
    }

    loadGoogleSearchSettings() {
        const googleSearchEnabled = localStorage.getItem('googleSearchEnabled');
        if (googleSearchEnabled !== null) {
            this.googleSearchEnabled = googleSearchEnabled === 'true';
        }
    }

    async handleGoogleSearchChange(e) {
        this.googleSearchEnabled = e.target.checked;
        localStorage.setItem('googleSearchEnabled', this.googleSearchEnabled.toString());

        // Notify main process if available
        if (window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                await ipcRenderer.invoke('update-google-search-setting', this.googleSearchEnabled);
            } catch (error) {
                console.error('Failed to notify main process:', error);
            }
        }

        this.requestUpdate();
    }

    loadLayoutMode() {
        const savedLayoutMode = localStorage.getItem('layoutMode');
        if (savedLayoutMode) {
            this.layoutMode = savedLayoutMode;
        }
    }

    loadAdvancedModeSettings() {
        const advancedMode = localStorage.getItem('advancedMode');
        if (advancedMode !== null) {
            this.advancedMode = advancedMode === 'true';
        }
    }

    async handleAdvancedModeChange(e) {
        this.advancedMode = e.target.checked;
        localStorage.setItem('advancedMode', this.advancedMode.toString());
        this.onAdvancedModeChange(this.advancedMode);
        this.requestUpdate();
    }

    loadBackgroundTransparency() {
        const backgroundTransparency = localStorage.getItem('backgroundTransparency');
        if (backgroundTransparency !== null) {
            this.backgroundTransparency = parseFloat(backgroundTransparency) || 0.8;
        }
        this.updateBackgroundTransparency();
    }

    handleBackgroundTransparencyChange(e) {
        this.backgroundTransparency = parseFloat(e.target.value);
        localStorage.setItem('backgroundTransparency', this.backgroundTransparency.toString());
        this.updateBackgroundTransparency();
        this.requestUpdate();
    }

    updateBackgroundTransparency() {
        const root = document.documentElement;
        root.style.setProperty('--header-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--main-content-background', `rgba(0, 0, 0, ${this.backgroundTransparency})`);
        root.style.setProperty('--card-background', `rgba(255, 255, 255, ${this.backgroundTransparency * 0.05})`);
        root.style.setProperty('--input-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.375})`);
        root.style.setProperty('--input-focus-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--button-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.625})`);
        root.style.setProperty('--preview-video-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 1.125})`);
        root.style.setProperty('--screen-option-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
        root.style.setProperty('--screen-option-hover-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.75})`);
        root.style.setProperty('--scrollbar-background', `rgba(0, 0, 0, ${this.backgroundTransparency * 0.5})`);
    }

    loadFontSize() {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize !== null) {
            this.fontSize = parseInt(fontSize, 10) || 20;
        }
        this.updateFontSize();
    }

    handleFontSizeChange(e) {
        this.fontSize = parseInt(e.target.value, 10);
        localStorage.setItem('fontSize', this.fontSize.toString());
        this.updateFontSize();
        this.requestUpdate();
    }

    updateFontSize() {
        const root = document.documentElement;
        root.style.setProperty('--response-font-size', `${this.fontSize}px`);
    }

    getModelOptions() {
        return [
            { value: 'aihubmix:qwen3-vl-235b-a22b-instruct', name: 'Qwen3-VL-235B-A22B-Instruct' },
            { value: 'aihubmix:qwen3-vl-30b-a3b-instruct', name: 'Qwen3-VL-30B-A3B-Instruct' },
            { value: 'aihubmix:qwen3-vl-plus', name: 'Qwen3-VL-Plus' },
            { value: 'aihubmix:glm-4.5v', name: 'GLM-4.5V' },
        ];
    }

    getTranscriptionModelOptions() {
        return [
            { value: 'whisper-1', name: 'Whisper-1' },
            { value: 'whisper-large-v3', name: 'Whisper-Large-v3' },
            { value: 'whisper-large-v3-turbo', name: 'Whisper-Large-v3-Turbo' },
        ];
    }

    handleModelSelect(e) {
        this.selectedModel = e.target.value;
        localStorage.setItem('selectedModel', this.selectedModel);
    }

    handleTranscriptionModelSelect(e) {
        this.transcriptionModel = e.target.value;
        localStorage.setItem('transcriptionModel', this.transcriptionModel);
    }

    handleModelApiBaseInput(e) {
        this.modelApiBase = e.target.value;
        localStorage.setItem('modelApiBase', this.modelApiBase);
    }

    async handleModelApiKeyInput(e) {
        const v = e.target.value || '';
        this.modelApiKey = v;
        localStorage.setItem('modelApiKey', this.modelApiKey);
    }

    async handleTestModelConnection() {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            let token = (this.modelApiKey || '').trim();
            if (/^CD-/i.test(token)) {
                try {
                    const res = await ipcRenderer.invoke('decrypt-license-key', token);
                    token = res?.apiKey || '';
                } catch (_) {}
            }
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const result = await ipcRenderer.invoke('test-model-connection', { apiBase: this.modelApiBase || 'https://aihubmix.com/v1', headers });
            this.modelTestStatus = result.success ? 'success' : 'fail';
            this.requestUpdate();
        }
    }

    render() {
        const profiles = this.getProfiles();
        const languages = this.getLanguages();
        const profileNames = this.getProfileNames();
        const currentProfile = profiles.find(p => p.value === this.selectedProfile);
        const currentLanguage = languages.find(l => l.value === this.selectedLanguage);

        return html`
            <div class="settings-container">
                <!-- Profile & Behavior Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_ai_profile_section')}</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    ${t('customize_profile_type_label')}
                                    <span class="current-selection">${currentProfile?.name || 'Unknown'}</span>
                                </label>
                                <select class="form-control" .value=${this.selectedProfile} @change=${this.handleProfileSelect}>
                                    ${profiles.map(
                                        profile => html`
                                            <option value=${profile.value} ?selected=${this.selectedProfile === profile.value}>
                                                ${profile.name}
                                            </option>
                                        `
                                    )}
                                </select>
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <label class="form-label">${t('customize_custom_instructions_label')}</label>
                            <textarea
                                class="form-control"
                                placeholder="Add specific instructions for how you want the AI to behave during ${
                                    profileNames[this.selectedProfile] || 'this interaction'
                                }..."
                                .value=${localStorage.getItem('customPrompt') || '除非提出的面试问题是英文，不然一律请使用中文回答，如果是代码题，那么直接给出最终代码，以及代码的思路；如果是开放思维题，那么请尽可能多的给出不同的思路和方案。'}
                                rows="4"
                                @input=${this.handleCustomPromptInput}
                            ></textarea>
                            <div class="form-description">
                                Personalize the AI's behavior with specific instructions that will be added to the
                                ${profileNames[this.selectedProfile] || 'selected profile'} base prompts
                </div>
                </div>
            </div>
        </div>

                <!-- Audio & Microphone Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_audio_section')}</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">${t('customize_audio_mode_label')}</label>
                            <select class="form-control" .value=${localStorage.getItem('audioMode') || 'speaker_only'} @change=${e => localStorage.setItem('audioMode', e.target.value)}>
                                <option value="speaker_only">Speaker Only (Interviewer)</option>
                                <option value="mic_only">Microphone Only (Me)</option>
                                <option value="both">Both Speaker & Microphone</option>
                            </select>
                            <div class="form-description">
                                需要用户在面试官开始说话前，手动使用 Ctrl+L 开始录音，结束后自动转写用于回答。
                            </div>
                        </div>
                    </div>
                </div>

                


                <!-- Language & Audio Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_language_audio_section')}</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    ${t('customize_speech_language_label')}
                                    <span class="current-selection">${currentLanguage?.name || 'Unknown'}</span>
                                </label>
                                <select class="form-control" .value=${this.selectedLanguage} disabled>
                                    ${html`<option value="zh-CN" selected>中文 (简体)</option>`}
                                </select>
                                <div class="form-description">Language for speech recognition and AI responses</div>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">主界面语言</label>
                                <select class="form-control" .value=${this.uiLanguage} @change=${this.handleUILanguageSelect}>
                                    ${html`
                                        <option value="zh" ?selected=${this.uiLanguage === 'zh'}>中文</option>
                                        <option value="en" ?selected=${this.uiLanguage === 'en'}>English</option>
                                    `}
                                </select>
                                <div class="form-description">更改应用界面语言</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Interface Layout Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_interface_layout_section')}</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    ${t('customize_layout_mode_label')}
                                    <span class="current-selection">${this.layoutMode === 'compact' ? 'Compact' : 'Normal'}</span>
                                </label>
                                <select class="form-control" .value=${this.layoutMode} @change=${this.handleLayoutModeSelect}>
                                    <option value="normal" ?selected=${this.layoutMode === 'normal'}>Normal</option>
                                    <option value="compact" ?selected=${this.layoutMode === 'compact'}>Compact</option>
                                </select>
                                <div class="form-description">
                                    ${
                                        this.layoutMode === 'compact'
                                            ? 'Smaller window size with reduced padding and font sizes for minimal screen footprint'
                                            : 'Standard layout with comfortable spacing and font sizes'
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <div class="slider-container">
                                <div class="slider-header">
                                    <label class="form-label">${t('customize_bg_transparency_label')}</label>
                                    <span class="slider-value">${Math.round(this.backgroundTransparency * 100)}%</span>
                                </div>
                                <input
                                    type="range"
                                    class="slider-input"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    .value=${this.backgroundTransparency}
                                    @input=${this.handleBackgroundTransparencyChange}
                                />
                                <div class="slider-labels">
                                    <span>Transparent</span>
                                    <span>Opaque</span>
                                </div>
                                <div class="form-description">
                                    Adjust the transparency of the interface background elements
                                </div>
                            </div>
                        </div>

                        <div class="form-group full-width">
                            <div class="slider-container">
                                <div class="slider-header">
                                    <label class="form-label">${t('customize_response_font_size_label')}</label>
                                    <span class="slider-value">${this.fontSize}px</span>
                                </div>
                                <input
                                    type="range"
                                    class="slider-input"
                                    min="12"
                                    max="32"
                                    step="1"
                                    .value=${this.fontSize}
                                    @input=${this.handleFontSizeChange}
                                />
                                <div class="slider-labels">
                                    <span>12px</span>
                                    <span>32px</span>
                                </div>
                                <div class="form-description">
                                    Adjust the font size of AI response text in the assistant view
                                </div>
                            </div>
                        </div>


                    </div>
                </div>

                <!-- Screen Capture Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_screen_capture_section')}</span>
                    </div>

                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">
                                    ${t('capture_interval_label')}
                                    <span class="current-selection"
                                        >${this.selectedScreenshotInterval === 'manual' ? t('manual_option') : this.selectedScreenshotInterval + 's'}</span
                                    >
                                </label>
                                <select class="form-control" .value=${this.selectedScreenshotInterval} @change=${this.handleScreenshotIntervalSelect}>
                                    <option value="manual" ?selected=${this.selectedScreenshotInterval === 'manual'}>${t('manual_option')}</option>
                                    <option value="1" ?selected=${this.selectedScreenshotInterval === '1'}>${t('every_1s_option')}</option>
                                    <option value="2" ?selected=${this.selectedScreenshotInterval === '2'}>${t('every_2s_option')}</option>
                                    <option value="5" ?selected=${this.selectedScreenshotInterval === '5'}>${t('every_5s_option')}</option>
                                    <option value="10" ?selected=${this.selectedScreenshotInterval === '10'}>${t('every_10s_option')}</option>
                                </select>
                                <div class="form-description">
                                    ${
                                        this.selectedScreenshotInterval === 'manual'
                                            ? t('capture_interval_desc_manual')
                                            : t('capture_interval_desc_auto')
                                    }
                                </div>
                            </div>

                            <div class="form-group">
                                    <label class="form-label">
                                    ${t('image_quality_label')}
                                    <span class="current-selection"
                                        >${this.selectedImageQuality === 'high' ? t('high_quality_option') : this.selectedImageQuality === 'medium' ? t('medium_quality_option') : t('low_quality_option')}</span
                                    >
                                </label>
                                <select class="form-control" .value=${this.selectedImageQuality} @change=${this.handleImageQualitySelect}>
                                    <option value="high" ?selected=${this.selectedImageQuality === 'high'}>${t('high_quality_option')}</option>
                                    <option value="medium" ?selected=${this.selectedImageQuality === 'medium'}>${t('medium_quality_option')}</option>
                                    <option value="low" ?selected=${this.selectedImageQuality === 'low'}>${t('low_quality_option')}</option>
                                </select>
                                <div class="form-description">
                                    ${
                                        this.selectedImageQuality === 'high'
                                            ? t('image_quality_desc_high')
                                            : this.selectedImageQuality === 'medium'
                                              ? t('image_quality_desc_medium')
                                              : t('image_quality_desc_low')
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="section-title">
                        <span>Stealth Profile</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-group">
                            <label class="form-label">Profile</label>
                            <select class="form-control" .value=${localStorage.getItem('stealthProfile') || 'balanced'} @change=${async e => {
                                const v = e.target.value;
                                localStorage.setItem('stealthProfile', v);
                                try {
                                    const ipc = window.require ? window.require('electron').ipcRenderer : null;
                                    if (ipc) await ipc.invoke('set-stealth-level', v);
                                } catch (_) {}
                                alert('Restart the application for stealth changes to take full effect.');
                            }}>
                                <option value="visible">Visible</option>
                                <option value="balanced">Balanced</option>
                                <option value="ultra">Ultra-Stealth</option>
                            </select>
                            <div class="form-description">
                                Adjusts visibility and detection resistance. A restart is required for changes to apply.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Mode Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('advanced_mode_section')}</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">${t('advanced_mode_enable_label')}</label>
                                <div class="checkbox-group">
                                    <input
                                        type="checkbox"
                                        class="checkbox-input"
                                        .checked=${this.advancedMode}
                                        @change=${this.handleAdvancedModeChange}
                                    />
                                    <span class="form-description">启用后，顶部将显示“高级工具”入口</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Keyboard Shortcuts Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('customize_keyboard_shortcuts_section')}</span>
                    </div>

                    <table class="keybinds-table">
                        <thead>
                            <tr>
                                <th>${t('keybind_action_header')}</th>
                                <th>${t('keybind_shortcut_header')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.getKeybindActions().map(
                                action => html`
                                    <tr>
                                        <td>
                                            <div class="action-name">${action.name}</div>
                                            <div class="action-description">${action.description}</div>
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                class="form-control keybind-input"
                                                .value=${this.keybinds[action.key]}
                                                placeholder="Press keys..."
                                                data-action=${action.key}
                                                @keydown=${this.handleKeybindInput}
                                                @focus=${this.handleKeybindFocus}
                                                readonly
                                            />
                                        </td>
                                    </tr>
                                `
                            )}
                            <tr class="table-reset-row">
                                <td colspan="2">
                                    <button class="reset-keybinds-button" @click=${this.resetKeybinds}>${t('reset_to_defaults')}</button>
                                    <div class="form-description" style="margin-top: 8px;">
                                        ${t('reset_to_defaults_desc')}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Model Settings Section -->
                <div class="settings-section">
                    <div class="section-title">
                        <span>${t('model_settings_section')}</span>
                    </div>
                    <div class="form-grid">
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">${t('model_select_label')}</label>
                                <select class="form-control" .value=${this.selectedModel} @change=${this.handleModelSelect}>
                                    ${this.getModelOptions().map(opt => html`<option value=${opt.value} ?selected=${this.selectedModel === opt.value}>${opt.name}</option>`)}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label class="form-label">${t('transcription_model_label')}</label>
                                <select class="form-control" .value=${this.transcriptionModel} @change=${this.handleTranscriptionModelSelect}>
                                    ${this.getTranscriptionModelOptions().map(opt => html`<option value=${opt.value} ?selected=${this.transcriptionModel === opt.value}>${opt.name}</option>`)}
                                </select>
                            </div>
                        </div>
                        
                    </div>
                </div>

                <div class="settings-note">💡 ${t('settings_saved_note')}</div>
            </div>
        `;
    }
}

customElements.define('customize-view', CustomizeView);

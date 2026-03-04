const TOKEN_KEY = 'userToken';

class AppError extends Error {
    constructor({ message, code = '', status = 0, reason = '', requestId = '', retryable = false } = {}) {
        super(message || '请求失败');
        this.name = 'AppError';
        this.code = String(code || '');
        this.status = Number(status || 0);
        this.reason = String(reason || '');
        this.requestId = String(requestId || '');
        this.retryable = Boolean(retryable);
    }
}

function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

function getBaseUrl() {
    return window.location.origin.replace(/\/$/, '');
}

function mapErrorToUserMessage(error) {
    const code = String(error?.code || '');
    const fallback = error?.message || '请求失败';
    const map = {
        quota_exceeded: 'token 不足，账号已被冻结，请充值。',
        account_frozen: '账号已被冻结，请充值或联系管理员。',
        TOKEN_INVALID: '登录已过期，请重新登录。',
        LICENSE_INVALID: 'License 无效，请检查后重试。',
        UPSTREAM_API_ERROR: 'LLM 服务暂时异常，请稍后重试。',
        UPSTREAM_REQUEST_FAILED: '网络请求失败，请检查网络后重试。',
    };
    const primary = map[code] || fallback;
    const detail = [`错误码: ${code || 'UNKNOWN'}`];
    if (error?.requestId) detail.push(`请求ID: ${error.requestId}`);
    return `${primary}（${detail.join('，')}）`;
}

async function apiRequest(path, options = {}) {
    const { method = 'GET', body, requireAuth = true, headers = {} } = options;
    const finalHeaders = { ...headers };
    if (requireAuth) {
        const token = getToken();
        if (!token) {
            throw new AppError({ message: '请先登录', code: 'AUTH_MISSING', status: 401 });
        }
        finalHeaders.Authorization = `Bearer ${token}`;
    }
    let payload = body;
    if (body && !(body instanceof FormData) && !finalHeaders['Content-Type']) {
        finalHeaders['Content-Type'] = 'application/json; charset=utf-8';
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${getBaseUrl()}${path}`, {
        method,
        headers: finalHeaders,
        body: payload,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        if (res.status === 401) {
            setToken('');
            if (!window.location.pathname.endsWith('/index.html') && window.location.pathname !== '/') {
                window.location.href = '/index.html';
            }
        }
        throw new AppError({
            message: data?.error || `HTTP ${res.status}`,
            code: data?.code || '',
            status: data?.status || res.status,
            reason: data?.reason || '',
            requestId: data?.requestId || '',
            retryable: data?.retryable || false,
        });
    }
    return data;
}

async function ensureLoggedIn() {
    const token = getToken();
    if (!token) {
        window.location.href = '/index.html';
        return null;
    }
    try {
        const data = await apiRequest('/auth/me');
        return data.user || null;
    } catch (_err) {
        window.location.href = '/index.html';
        return null;
    }
}

window.WebApi = {
    getToken,
    setToken,
    apiRequest,
    ensureLoggedIn,
    renderNav,
    AppError,
    mapErrorToUserMessage,
};

function renderNav(user) {
    const navContainer = document.getElementById('nav-container');
    if (!navContainer) return;

    const path = window.location.pathname;
    const links = [
        { href: '/dashboard.html', text: '总览' },
        { href: '/resumes.html', text: '简历' },
        { href: '/voices.html', text: '录音' },
        { href: '/sessions.html', text: '面试记录' },
    ];

    if (user && user.role === 'admin') {
        links.push({ href: '/admin.html', text: '管理员' });
    }

    let html = '';
    links.forEach(link => {
        const activeClass = link.href === path ? 'active' : '';
        html += `<a href="${link.href}" class="${activeClass}">${link.text}</a>`;
    });

    html += `<button id="logout-btn">退出登录</button>`;
    navContainer.innerHTML = html;
    navContainer.className = 'nav';

    document.getElementById('logout-btn').addEventListener('click', () => {
        setToken('');
        window.location.href = '/index.html';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Nav rendering is now handled by individual pages after ensuring login
});

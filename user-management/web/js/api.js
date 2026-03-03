const TOKEN_KEY = 'userToken';

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

async function apiRequest(path, options = {}) {
    const { method = 'GET', body, requireAuth = true, headers = {} } = options;
    const finalHeaders = { ...headers };
    if (requireAuth) {
        const token = getToken();
        if (!token) {
            throw new Error('请先登录');
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
        throw new Error(data?.error || `HTTP ${res.status}`);
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
};

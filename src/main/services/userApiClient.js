const { createAppError, toOk } = require('./errorModel');

function withTimeout(ms) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ms);
    return {
        signal: controller.signal,
        done: () => clearTimeout(timeoutId),
    };
}

async function parseJsonSafe(res) {
    try {
        return await res.json();
    } catch (_) {
        return null;
    }
}

function resolveBase(base) {
    return String(base || '').trim().replace(/\/$/, '');
}

function createAccountLimitError(status, data) {
    const code = String(data?.code || '');
    if (code === 'quota_exceeded') {
        return createAppError({
            code: 'quota_exceeded',
            message: '配额超限，请充值后继续使用',
            retriable: false,
            details: data,
            status,
        });
    }
    if (code === 'account_frozen') {
        return createAppError({
            code: 'account_frozen',
            message: '账户已冻结，请联系管理员',
            retriable: false,
            details: data,
            status,
        });
    }
    return null;
}

async function userApiRequest({
    baseUrl,
    path,
    method = 'GET',
    token = '',
    body = null,
    timeoutMs = 12000,
}) {
    const base = resolveBase(baseUrl);
    if (!base) {
        throw createAppError({
            code: 'config_error',
            message: '用户服务地址未配置',
            retriable: false,
            status: 500,
        });
    }
    const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
    const timeout = withTimeout(timeoutMs);
    try {
        const headers = {
            'Content-Type': 'application/json; charset=utf-8',
        };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
            signal: timeout.signal,
        });
        const data = await parseJsonSafe(res);
        if (!res.ok) {
            // Check specific error codes from response body first
            const errorCode = String(data?.code || '');
            const errorMessage = String(data?.error || data?.message || '');

            if (res.status === 403 && (errorCode === 'account_frozen' || errorMessage === 'Account is frozen')) {
                throw createAppError({
                    code: 'account_frozen',
                    message: '登录失败：账号已被冻结',
                    retriable: false,
                    details: data,
                    status: 403,
                });
            }

            const limitError = createAccountLimitError(res.status, data || {});
            if (limitError) throw limitError;

            if (res.status === 401 || res.status === 404) {
                // 404 User not found is often treated as invalid credentials for security
                throw createAppError({
                    code: 'auth_failed',
                    message: '登录失败：邮箱或密码错误',
                    retriable: false,
                    details: data,
                    status: 401,
                });
            }
            
            if (res.status === 400) {
                 throw createAppError({
                    code: 'invalid_params',
                    message: '登录失败：请填写完整的邮箱和密码',
                    retriable: false,
                    details: data,
                    status: 400,
                });
            }

            if (res.status >= 500) {
                 throw createAppError({
                    code: 'server_error',
                    message: '登录失败：服务器内部错误',
                    retriable: true,
                    details: data,
                    status: res.status,
                });
            }

            throw createAppError({
                code: String(data?.code || 'request_failed'),
                message: String(data?.message || `请求失败(${res.status})`),
                retriable: res.status >= 500,
                details: data,
                status: res.status,
            });
        }
        return toOk(data, { status: res.status });
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw createAppError({
                code: 'timeout',
                message: '请求超时，请稍后再试',
                retriable: true,
                status: 408,
            });
        }
        // Network errors (like ECONNRESET) often appear as TypeErrors with specific causes in fetch
        if (error?.code === 'ECONNRESET' || error?.message?.includes('fetch failed')) {
             throw createAppError({
                code: 'network_error',
                message: '登录失败：网络连接错误',
                retriable: true,
                status: 0,
                details: error,
            });
        }
        throw error;
    } finally {
        timeout.done();
    }
}

async function loginByPassword(baseUrl, email, password) {
    const result = await userApiRequest({
        baseUrl,
        path: '/auth/login',
        method: 'POST',
        body: {
            email: String(email || '').trim(),
            password: String(password || ''),
        },
        timeoutMs: 15000,
    });
    const token = String(result?.data?.token || '').trim();
    if (!token) {
        throw createAppError({
            code: 'invalid_login_response',
            message: '登录响应缺少 token',
            retriable: false,
            details: result?.data || null,
            status: 502,
        });
    }
    return toOk({
        token,
        user: result?.data?.user || null,
    });
}

async function getMe(baseUrl, token) {
    return userApiRequest({
        baseUrl,
        path: '/auth/me',
        method: 'GET',
        token: String(token || '').trim(),
        timeoutMs: 12000,
    });
}

async function callUserAiProxyJson({
    baseUrl,
    token,
    servicePath,
    payload,
    timeoutMs = 30000,
}) {
    const safeServicePath = String(servicePath || '').replace(/^\/+/, '');
    if (!safeServicePath) {
        throw createAppError({
            code: 'config_error',
            message: 'AI 服务路径未配置',
            retriable: false,
            status: 500,
        });
    }
    const response = await userApiRequest({
        baseUrl,
        path: `/api/ai/${safeServicePath}`,
        method: 'POST',
        token: String(token || '').trim(),
        body: payload && typeof payload === 'object' ? payload : {},
        timeoutMs,
    });
    return response;
}

async function getUserBalance(baseUrl, token) {
    return userApiRequest({
        baseUrl,
        path: '/api/user/balance',
        method: 'GET',
        token: String(token || '').trim(),
        timeoutMs: 12000,
    });
}

async function deductUserTokens(baseUrl, token, tokens) {
    return userApiRequest({
        baseUrl,
        path: '/api/user/deduct',
        method: 'POST',
        token: String(token || '').trim(),
        body: { tokens: Number(tokens) },
        timeoutMs: 12000,
    });
}

module.exports = {
    loginByPassword,
    getMe,
    getUserBalance,
    deductUserTokens,
    callUserAiProxyJson,
    createAccountLimitError,
};

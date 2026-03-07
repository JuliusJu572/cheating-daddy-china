const { fromException, toOk, createAppError } = require('../services/errorModel');
const { loginByPassword, getMe, getUserBalance, deductUserTokens, callUserAiProxyJson } = require('../services/userApiClient');

function normalizeUsageRecord(servicePath, payload, responseData) {
    const usage = responseData?.usage || {};
    const totalTokensRaw = usage?.total_tokens ?? usage?.totalTokens ?? responseData?.tokenUsage ?? null;
    const totalTokens = Number(totalTokensRaw);
    return {
        ts: Date.now(),
        servicePath: String(servicePath || ''),
        model: String(payload?.model || ''),
        totalTokens: Number.isFinite(totalTokens) ? totalTokens : null,
    };
}

function upsertUsageRecord(configStore, record) {
    const cfg = configStore.get();
    const prev = Array.isArray(cfg.tokenUsageRecords) ? cfg.tokenUsageRecords : [];
    const next = [...prev, record].slice(-200);
    configStore.update({
        tokenUsageRecords: next,
    });
}

function clearAuth(configStore) {
    configStore.update({
        userAuthToken: '',
        userProfile: null,
    });
}

function registerAuthIpcHandlers({ ipcMain, configStore, sendToRenderer }) {
    ipcMain.handle('auth-login', async (_event, payload) => {
        try {
            const email = String(payload?.email || '').trim();
            const password = String(payload?.password || '');
            if (!email || !password) {
                throw createAppError({
                    code: 'invalid_input',
                    message: '请输入邮箱和密码',
                    retriable: false,
                    status: 400,
                });
            }
            const cfg = configStore.get();
            const baseUrl = cfg.userApiBase || '';
            const loginResult = await loginByPassword(baseUrl, email, password);
            const token = loginResult?.data?.token || '';
            const user = loginResult?.data?.user || {};

            // Explicitly check for frozen status if backend returns 200 but user is frozen (defensive programming)
            if (user?.status === 'frozen' || user?.is_frozen === true) {
                 throw createAppError({
                    code: 'account_frozen',
                    message: '登录失败：账号已被冻结',
                    retriable: false,
                    status: 403,
                });
            }

            // We can skip getMe if login response already contains user info
            // But if getMe provides more fresh info, we can keep it.
            // For now, let's trust login response or merge them if needed.
            // The prompt implies login response has { token, user: { id, email } }
            
            // To ensure consistency, we can update profile from login result immediately
            configStore.update({
                userAuthToken: token,
                userProfile: user,
            });

            // Optional: Background refresh of profile
            getMe(baseUrl, token).then(res => {
                if (res.ok && res.data?.user) {
                    configStore.update({ userProfile: res.data.user });
                }
            }).catch(() => {});

            return toOk({
                token,
                user: user,
            });
        } catch (error) {
            const normalized = fromException(error, 'auth_login_failed');
            return normalized;
        }
    });

    ipcMain.handle('auth-me', async () => {
        try {
            const cfg = configStore.get();
            const token = String(cfg.userAuthToken || '').trim();
            if (!token) {
                throw createAppError({
                    code: 'not_logged_in',
                    message: '未登录',
                    retriable: false,
                    status: 401,
                });
            }
            const result = await getMe(cfg.userApiBase || '', token);
            const user = result?.data?.user || null;
            configStore.update({ userProfile: user });
            return toOk({ user });
        } catch (error) {
            const normalized = fromException(error, 'auth_me_failed');
            if (normalized.code === 'auth_expired') {
                clearAuth(configStore);
                if (typeof sendToRenderer === 'function') {
                    sendToRenderer('user-auth-expired', {
                        code: normalized.code,
                        message: normalized.message,
                    });
                }
            }
            return normalized;
        }
    });

    ipcMain.handle('auth-logout', async () => {
        clearAuth(configStore);
        return toOk({ loggedOut: true });
    });

    ipcMain.handle('auth-get-session', async () => {
        const cfg = configStore.get();
        const token = String(cfg.userAuthToken || '').trim();
        let user = cfg.userProfile || null;

        // Force check balance/status on session restore to prevent bypass
        if (token) {
            try {
                // Try to get fresh balance data
                const balanceRes = await getUserBalance(cfg.userApiBase || '', token);
                if (balanceRes.ok && balanceRes.data) {
                    const data = balanceRes.data;
                    user = {
                        ...user,
                        frozen: data.frozen,
                        quotaTokens: data.quotaTokens,
                        usedTokens: data.usedTokens
                    };
                    configStore.update({ userProfile: user });
                }
            } catch (e) {
                // Ignore network error on startup, use cached profile
            }
        }

        return toOk({
            token,
            user,
            hasToken: !!token,
        });
    });

    ipcMain.handle('auth-get-balance', async () => {
        try {
            const cfg = configStore.get();
            const token = String(cfg.userAuthToken || '').trim();
            if (!token) {
                throw createAppError({
                    code: 'not_logged_in',
                    message: '请先登录账号',
                    retriable: false,
                    status: 401,
                });
            }
            // 1. Try new balance API
            let balanceData = {};
            try {
                const balanceRes = await getUserBalance(cfg.userApiBase || '', token);
                if (balanceRes.ok && balanceRes.data) {
                    balanceData = balanceRes.data;
                }
            } catch (e) {
                // Fallback to getMe if balance API fails (or not implemented yet on backend)
            }

            // 2. Fallback to getMe/local profile
            const me = await getMe(cfg.userApiBase || '', token);
            const user = me?.data?.user || {};
            
            // Merge balance data
            const frozen = balanceData.frozen ?? user?.frozen ?? user?.isFrozen ?? false;
            const quota = balanceData.quotaTokens ?? user?.quotaTokens ?? user?.quota ?? null;
            const used = balanceData.usedTokens ?? user?.usedTokens ?? user?.used ?? 0;
            const balance = quota !== null ? Math.max(0, quota - used) : null;

            // Update local profile with latest stats
            if (me.ok) {
                 const updatedUser = { 
                    ...user, 
                    frozen, 
                    quotaTokens: quota, 
                    usedTokens: used 
                };
                configStore.update({ userProfile: updatedUser });
            }

            const usageRecords = Array.isArray(cfg.tokenUsageRecords) ? cfg.tokenUsageRecords : [];
            return toOk({
                user,
                balance,
                quota,
                used,
                frozen: !!frozen,
                usageRecords,
            });
        } catch (error) {
            const normalized = fromException(error, 'balance_query_failed');
            if (normalized.code === 'auth_expired') {
                clearAuth(configStore);
                if (typeof sendToRenderer === 'function') {
                    sendToRenderer('user-auth-expired', {
                        code: normalized.code,
                        message: normalized.message,
                    });
                }
            }
            return normalized;
        }
    });

    ipcMain.handle('auth-deduct-tokens', async (event, payload) => {
        try {
            const cfg = configStore.get();
            const token = String(cfg.userAuthToken || '').trim();
            const tokens = Number(payload?.tokens || 0);

            if (!token) return { success: false, error: 'not_logged_in' };
            if (tokens <= 0) return { success: true, deducted: 0 }; // No deduction needed

            // Fire and forget - don't block
            deductUserTokens(cfg.userApiBase || '', token, tokens)
                .then(res => {
                    if (res.ok && res.data) {
                        const data = res.data;
                        const user = cfg.userProfile || {};
                        
                        // Update local profile with latest stats
                        const updatedUser = { 
                            ...user, 
                            frozen: data.frozen, 
                            quotaTokens: data.quotaTokens, 
                            usedTokens: data.usedTokens 
                        };
                        configStore.update({ userProfile: updatedUser });
                        
                        // If account became frozen, notify renderer to update UI status
                        if (data.frozen) {
                            // Find the window that sent the request or all windows
                            const windows = require('electron').BrowserWindow.getAllWindows();
                            windows.forEach(win => {
                                win.webContents.send('auth-status-changed', { 
                                    status: 'frozen',
                                    message: '账户余额耗尽，已自动冻结'
                                });
                            });
                        }
                    }
                })
                .catch(err => {
                    console.error('Token deduction failed:', err);
                });

            return { success: true, queued: true };
        } catch (error) {
            console.error('Error in auth-deduct-tokens:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('auth-call-ai-proxy-json', async (event, payload) => {
        try {
            const cfg = configStore.get();
            const token = String(cfg.userAuthToken || '').trim();
            if (!token) {
                throw createAppError({
                    code: 'not_logged_in',
                    message: '请先登录',
                    retriable: false,
                    status: 401,
                });
            }
            const servicePath = String(payload?.servicePath || cfg.aiProxyServicePath || '').trim();
            const reqPayload = payload?.payload && typeof payload.payload === 'object' ? payload.payload : {};
            const result = await callUserAiProxyJson({
                baseUrl: cfg.proxyApiBase || cfg.userApiBase || '',
                token,
                servicePath,
                payload: reqPayload,
                timeoutMs: Number(payload?.timeoutMs) || 30000,
            });
            upsertUsageRecord(configStore, normalizeUsageRecord(servicePath, reqPayload, result?.data));
            return toOk({
                response: result?.data || {},
            });
        } catch (error) {
            const normalized = fromException(error, 'ai_proxy_failed');
            if (normalized.code === 'auth_expired') {
                clearAuth(configStore);
                if (typeof sendToRenderer === 'function') {
                    sendToRenderer('user-auth-expired', {
                        code: normalized.code,
                        message: normalized.message,
                    });
                }
            }
            return normalized;
        }
    });
}

module.exports = {
    registerAuthIpcHandlers,
};

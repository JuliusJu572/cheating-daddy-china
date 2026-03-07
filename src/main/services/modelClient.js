class DirectModelClient {
    constructor({ fetchImpl, apiBase, apiKey }) {
        this.fetchImpl = fetchImpl;
        this.apiBase = String(apiBase || '').replace(/\/$/, '');
        this.apiKey = String(apiKey || '').trim();
    }

    async chat(payload) {
        const endpoint = `${this.apiBase}/chat/completions`;
        const res = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(payload),
        });
        return res;
    }
}

class ProxyModelClient {
    constructor({ ipcRendererInvoke, servicePath }) {
        this.ipcRendererInvoke = ipcRendererInvoke;
        this.servicePath = String(servicePath || 'chat/completions');
    }

    async chat(payload) {
        const result = await this.ipcRendererInvoke('auth-call-ai-proxy-json', {
            servicePath: this.servicePath,
            payload,
        });
        return result;
    }
}

module.exports = {
    DirectModelClient,
    ProxyModelClient,
};

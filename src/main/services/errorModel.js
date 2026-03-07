function createAppError({ code, message, retriable = false, details = null, status = 500 }) {
    return {
        ok: false,
        code: String(code || 'internal_error'),
        message: String(message || 'Internal error'),
        retriable: !!retriable,
        details: details || null,
        status: Number(status) || 500,
    };
}

function toOk(data = null, extra = {}) {
    return {
        ok: true,
        code: 'ok',
        message: '',
        retriable: false,
        details: null,
        data,
        ...extra,
    };
}

function fromException(error, fallbackCode = 'internal_error') {
    if (error && typeof error === 'object' && error.ok === false && error.code) {
        return error;
    }
    return createAppError({
        code: fallbackCode,
        message: error?.message || 'Unexpected error',
        retriable: false,
        details: error ? { name: error.name } : null,
        status: 500,
    });
}

module.exports = {
    createAppError,
    toOk,
    fromException,
};

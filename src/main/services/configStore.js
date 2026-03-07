function createConfigStore({ getLocalConfig, writeConfig }) {
    function get() {
        return getLocalConfig();
    }

    function update(patch) {
        const current = getLocalConfig();
        const nextPatch = patch && typeof patch === 'object' ? patch : {};
        const next = { ...current, ...nextPatch };
        writeConfig(next);
        return next;
    }

    return {
        get,
        update,
    };
}

module.exports = {
    createConfigStore,
};

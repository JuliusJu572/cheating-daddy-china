function configureWindowsPaths({ app, path, processRef }) {
    if (processRef.platform !== 'win32') return;
    const appDataPath = processRef.env.APPDATA || path.join(processRef.env.USERPROFILE, 'AppData', 'Roaming');
    const customUserDataPath = path.join(appDataPath, 'CheatingBuddy');
    app.setPath('userData', customUserDataPath);
    app.setPath('appData', customUserDataPath);
    app.setPath(
        'userCache',
        path.join(processRef.env.LOCALAPPDATA || path.join(processRef.env.USERPROFILE, 'AppData', 'Local'), 'CheatingBuddy', 'Cache')
    );
    app.setPath('logs', path.join(customUserDataPath, 'logs'));
    console.log('🔧 [Windows] 设置userData路径:', customUserDataPath);
}

module.exports = {
    configureWindowsPaths,
};

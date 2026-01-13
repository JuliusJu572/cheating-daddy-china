const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
    onboarded: false,
    stealthLevel: 'balanced',
    layout: 'normal',
};

function getConfigDir() {
    const platform = os.platform();
    const homeDir = os.homedir();

    if (platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Roaming', 'cheating-daddy-config');
    }

    if (platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'cheating-daddy-config');
    }

    return path.join(homeDir, '.config', 'cheating-daddy-config');
}

function getConfigFilePath() {
    return path.join(getConfigDir(), 'config.json');
}

function ensureConfigDir() {
    const configDir = getConfigDir();
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
}

function readExistingConfig() {
    const configFilePath = getConfigFilePath();

    try {
        if (fs.existsSync(configFilePath)) {
            const configData = fs.readFileSync(configFilePath, 'utf8');
            return JSON.parse(configData);
        }
    } catch (error) {
        console.warn('Error reading config file:', error.message);
    }

    return {};
}

function writeConfig(config) {
    ensureConfigDir();
    const configFilePath = getConfigFilePath();

    try {
        fs.writeFileSync(configFilePath, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing config file:', error.message);
        throw error;
    }
}

function mergeWithDefaults(existingConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG };

    for (const key in DEFAULT_CONFIG) {
        if (existingConfig.hasOwnProperty(key)) {
            mergedConfig[key] = existingConfig[key];
        }
    }

    return mergedConfig;
}

function getLocalConfig() {
    try {
        ensureConfigDir();

        const existingConfig = readExistingConfig();
        const finalConfig = mergeWithDefaults(existingConfig);

        const needsUpdate = JSON.stringify(existingConfig) !== JSON.stringify(finalConfig);

        if (needsUpdate) {
            writeConfig(finalConfig);
            console.log('Config updated with missing fields');
        }

        return finalConfig;
    } catch (error) {
        console.error('Error in getLocalConfig:', error.message);
        return { ...DEFAULT_CONFIG };
    }
}

module.exports = {
    getLocalConfig,
    writeConfig,
}; 
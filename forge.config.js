const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// 根据当前平台动态配置 makers
const makers = [
    // Windows
    {
        name: '@electron-forge/maker-squirrel',
        platforms: ['win32'],
        config: {
            name: 'cheating-daddy',
            productName: 'Cheating Daddy',
            shortcutName: 'Cheating Daddy',
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
        },
    },
    // macOS
    {
        name: '@electron-forge/maker-dmg',
        platforms: ['darwin'],
        config: {
            name: 'Cheating Daddy',
            format: 'UDZO',
        }
    },
];

// 只在 Linux 上添加 AppImage maker
if (process.platform === 'linux') {
    makers.push({
        name: '@reforged/maker-appimage',
        platforms: ['linux'],
        config: {
            options: {
                name: 'Cheating Daddy',
                productName: 'Cheating Daddy',
                genericName: 'AI Assistant',
                description: 'AI assistant for interviews and learning',
                categories: ['Development', 'Education'],
                icon: 'src/assets/logo.png'
            }
        },
    });
}

module.exports = {
    packagerConfig: {
        asar: true,
        extraResource: ['./src/assets/SystemAudioDump'],
        name: 'Cheating Daddy',
        icon: 'src/assets/logo',
        appBundleId: 'com.cheatingdaddy.app',
        appCategoryType: 'public.app-category.utilities',
    },
    rebuildConfig: {},
    makers: makers,
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
};
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const makers = [
    // Windows
    {
        name: '@electron-forge/maker-squirrel',
        platforms: ['win32'],
        config: {
            name: 'cheating-buddy',
            productName: 'Cheating Buddy',
            shortcutName: 'Cheating Buddy',
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            setupExe: 'Cheating.Buddy.exe',
        },
    },
    // macOS - ZIP
    {
        name: '@electron-forge/maker-zip',
        platforms: ['darwin'],
    },
    // macOS - DMG（简化配置）
    {
        name: '@electron-forge/maker-dmg',
        platforms: ['darwin'],
        config: {
            name: 'CheatingBuddy',
            format: 'UDZO',
            // ✅ 移除 contents 配置，让 Forge 自动处理
            // 或者使用正确的配置格式
        }
    },
];

if (process.platform === 'linux') {
    makers.push({
        name: '@reforged/maker-appimage',
        platforms: ['linux'],
        config: {
            options: {
                name: 'Cheating Buddy',
                productName: 'Cheating Buddy',
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
        extraResource: [
            './src/assets/SystemAudioDump'
        ],
        name: 'CheatingBuddy',
        icon: 'src/assets/logo',
        appBundleId: 'com.cheatingdaddy.app',
        appCategoryType: 'public.app-category.utilities',
        ...(process.platform === 'darwin' && {
            osxSign: false,
            osxNotarize: false,
        }),
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
    hooks: {
        packageAfterPrune: async (config, buildPath, electronVersion, platform, arch) => {
            if (platform === 'darwin') {
                console.log('✅ macOS package created with Universal Binary');
            }
        }
    }
};
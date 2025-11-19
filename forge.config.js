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
    // macOS - ZIP (可选)
    {
        name: '@electron-forge/maker-zip',
        platforms: ['darwin'],
    },
    // macOS - DMG
    {
        name: '@electron-forge/maker-dmg',
        platforms: ['darwin'],
        config: {
            name: 'Cheating Buddy',
            format: 'UDZO',
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
        // ✅ 改为打包整个 assets 目录（包含 Universal Binary）
        extraResource: [
            './src/assets/SystemAudioDump'
        ],
        name: 'Cheating Buddy',
        icon: 'src/assets/logo',
        appBundleId: 'com.cheatingdaddy.app',
        appCategoryType: 'public.app-category.utilities',
        // ✅ macOS 特定配置
        ...(process.platform === 'darwin' && {
            osxSign: false, // 如果需要签名，改为 true 并配置证书
            osxNotarize: false, // 如果需要公证，配置相应参数
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
    // ✅ 添加打包前的 hook
    hooks: {
        packageAfterPrune: async (config, buildPath, electronVersion, platform, arch) => {
            if (platform === 'darwin') {
                console.log('✅ macOS package created with Universal Binary');
            }
        }
    }
};
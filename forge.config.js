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
    // macOS - ZIP（主要分发方式）
    {
        name: '@electron-forge/maker-zip',
        platforms: ['darwin'],
    },
    // macOS - DMG（修复配置）
    {
        name: '@electron-forge/maker-dmg',
        platforms: ['darwin'],
        config: {
            // ✅ 使用无空格的名称
            name: 'CheatingBuddy',
            // ✅ 添加详细配置
            title: 'Cheating Buddy',
            format: 'UDZO',
            // ✅ 指定背景和图标（可选）
            icon: 'src/assets/logo.icns',
            // ✅ 添加重试逻辑
            overwrite: true,
            // ✅ DMG 窗口配置
            contents: [
                {
                    x: 448,
                    y: 344,
                    type: 'link',
                    path: '/Applications'
                },
                {
                    x: 192,
                    y: 344,
                    type: 'file',
                    path: undefined // 会自动填充应用路径
                }
            ],
            // ✅ 额外的 DMG 选项
            additionalDMGOptions: {
                window: {
                    size: {
                        width: 660,
                        height: 400
                    }
                }
            }
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
        // ✅ 使用无空格的应用名称
        name: 'CheatingBuddy',
        // ✅ 显示名称可以有空格
        productName: 'Cheating Buddy',
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
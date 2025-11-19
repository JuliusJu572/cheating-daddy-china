#!/bin/bash
set -e

echo "🔨 Building SystemAudioDump Universal Binary..."

# 检查是否在 macOS 上运行
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "⚠️  Warning: SystemAudioDump can only be built on macOS"
    echo "    Skipping build..."
    exit 0
fi

# 创建输出目录
mkdir -p src/assets

# 检查源文件是否存在
if [ ! -f "src/native/SystemAudioDump.c" ]; then
    echo "❌ Error: src/native/SystemAudioDump.c not found"
    exit 1
fi

echo "📦 Compiling for x86_64..."
clang -arch x86_64 \
    -framework AudioToolbox \
    -framework CoreAudio \
    -o src/assets/SystemAudioDump_intel \
    src/native/SystemAudioDump.c

echo "📦 Compiling for arm64..."
clang -arch arm64 \
    -framework AudioToolbox \
    -framework CoreAudio \
    -o src/assets/SystemAudioDump_arm \
    src/native/SystemAudioDump.c

echo "🔗 Creating Universal Binary..."
lipo -create \
    -arch x86_64 src/assets/SystemAudioDump_intel \
    -arch arm64 src/assets/SystemAudioDump_arm \
    -output src/assets/SystemAudioDump

echo "🧹 Cleaning up temporary files..."
rm -f src/assets/SystemAudioDump_intel src/assets/SystemAudioDump_arm

echo "✅ Verifying Universal Binary..."
lipo -info src/assets/SystemAudioDump

echo "✅ Setting executable permissions..."
chmod +x src/assets/SystemAudioDump

echo "✅ SystemAudioDump Universal Binary build complete!"
echo "   Location: src/assets/SystemAudioDump"
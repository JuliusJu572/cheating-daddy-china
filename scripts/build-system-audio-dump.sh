#!/bin/bash
set -e

echo "🔨 Building SystemAudioDump for multiple architectures..."

# 设置路径
SOURCE_DIR="./SystemAudioDump"
OUTPUT_DIR="./src/assets"
BINARY_NAME="SystemAudioDump"

# 创建临时构建目录
BUILD_DIR="./build-temp"
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# ✅ 改为 macOS 13.0（因为需要 capturesAudio 等 API）
MIN_MACOS_VERSION="13.0"

# 1️⃣ 编译 x86_64 (Intel) 版本
echo "📦 Building for x86_64 (Intel) with minimum macOS $MIN_MACOS_VERSION..."
swiftc -target x86_64-apple-macos$MIN_MACOS_VERSION \
    -O \
    -parse-as-library \
    -o "$BUILD_DIR/${BINARY_NAME}-x86_64" \
    "$SOURCE_DIR/main.swift"

# 2️⃣ 编译 arm64 (Apple Silicon) 版本
echo "📦 Building for arm64 (Apple Silicon) with minimum macOS $MIN_MACOS_VERSION..."
swiftc -target arm64-apple-macos$MIN_MACOS_VERSION \
    -O \
    -parse-as-library \
    -o "$BUILD_DIR/${BINARY_NAME}-arm64" \
    "$SOURCE_DIR/main.swift"

# 3️⃣ 使用 lipo 合并成通用二进制
echo "🔗 Creating Universal Binary..."
lipo -create \
    "$BUILD_DIR/${BINARY_NAME}-x86_64" \
    "$BUILD_DIR/${BINARY_NAME}-arm64" \
    -output "$OUTPUT_DIR/$BINARY_NAME"

# 4️⃣ 设置可执行权限
chmod +x "$OUTPUT_DIR/$BINARY_NAME"

# 5️⃣ 验证架构
echo "✅ Verifying architectures:"
lipo -info "$OUTPUT_DIR/$BINARY_NAME"
file "$OUTPUT_DIR/$BINARY_NAME"

# ✅ 验证最低系统版本
echo ""
echo "📋 Minimum macOS version requirement:"
otool -l "$OUTPUT_DIR/$BINARY_NAME" | grep -A 3 LC_VERSION_MIN_MACOSX || \
otool -l "$OUTPUT_DIR/$BINARY_NAME" | grep -A 3 LC_BUILD_VERSION

# 清理临时文件
rm -rf "$BUILD_DIR"

echo ""
echo "✅ Build complete! Universal binary saved to $OUTPUT_DIR/$BINARY_NAME"
echo "⚠️  Requires macOS $MIN_MACOS_VERSION or later"
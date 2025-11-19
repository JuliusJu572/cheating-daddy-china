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

# 1️⃣ 编译 x86_64 (Intel) 版本
echo "📦 Building for x86_64 (Intel)..."
swiftc -target x86_64-apple-macos11 \
    -O \
    -parse-as-library \
    -o "$BUILD_DIR/${BINARY_NAME}-x86_64" \
    "$SOURCE_DIR/main.swift"

# 2️⃣ 编译 arm64 (Apple Silicon) 版本
echo "📦 Building for arm64 (Apple Silicon)..."
swiftc -target arm64-apple-macos11 \
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

# 清理临时文件
rm -rf "$BUILD_DIR"

echo "✅ Build complete! Universal binary saved to $OUTPUT_DIR/$BINARY_NAME"
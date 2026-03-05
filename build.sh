#!/usr/bin/env bash
# build.sh — Build Polarkivet for macOS and produce a distributable .dmg
# Requires: Rust toolchain, Node.js, cargo-tauri
set -euo pipefail

APP_NAME="polarkivet"
BUNDLE_DIR="src-tauri/target/release/bundle"

echo "==> Building frontend..."
npm run build

echo "==> Building Tauri app (release)..."
cargo tauri build --target aarch64-apple-darwin --bundles app,dmg
cargo tauri build --target x86_64-apple-darwin --bundles app,dmg

echo "==> Creating universal binary with lipo..."
# Merge the two .app bundles into a universal app
ARM_APP="$BUNDLE_DIR/macos/${APP_NAME}.app"
X64_APP="src-tauri/target/x86_64-apple-darwin/release/bundle/macos/${APP_NAME}.app"
UNIVERSAL_APP="dist-mac/${APP_NAME}.app"

mkdir -p dist-mac
cp -R "$ARM_APP" "$UNIVERSAL_APP"

lipo -create \
  "src-tauri/target/aarch64-apple-darwin/release/${APP_NAME}" \
  "src-tauri/target/x86_64-apple-darwin/release/${APP_NAME}" \
  -output "$UNIVERSAL_APP/Contents/MacOS/${APP_NAME}"

echo "==> Ad-hoc code signing (no Apple Developer account required)..."
codesign --deep --force --sign - "$UNIVERSAL_APP"

echo "==> Creating DMG..."
hdiutil create -volname "Polarkivet" \
  -srcfolder dist-mac \
  -ov -format UDZO \
  "dist-mac/Polarkivet.dmg"

echo ""
echo "Done! Distributable files:"
echo "  dist-mac/Polarkivet.dmg   — macOS disk image (universal, arm64 + x86_64)"
echo ""
echo "Note: Users may need to right-click → Open on first launch due to Gatekeeper."

# LessonFoundry Mobile App

React Native / Expo mobile client for LessonFoundry.

## Features
- **Token-based Authentication:** Works with LessonFoundry API session tokens.
- **Teacher Avatar Selection:** Select and upload avatar photos directly from device camera roll.
- **Student Video Playback:** Stream authorized AI teacher video lessons using native video player.
- **Modernist Design System:** Shares typography, colors, and layout principles with LessonFoundry web.

## Quick Start (Local Testing with Expo Go)

1. **Install dependencies:**
   ```bash
   cd mobile
   npm install
   ```

2. **Start the development server:**
   ```bash
   npx expo start
   ```

3. **Run on your device:**
   - Install **Expo Go** from Google Play Store or iOS App Store.
   - Scan the QR code shown in your terminal.

## Building Native APK for Android (via EAS)

1. **Install EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to Expo:**
   ```bash
   eas login
   ```

3. **Configure and build preview APK:**
   ```bash
   eas build --platform android --profile preview
   ```
   This generates an `.apk` file that can be downloaded and installed directly on any Android device without the Google Play Store.

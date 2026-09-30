# LessonFoundry Mobile

## Test on a phone with Expo Go

```bash
npm ci
EXPO_PUBLIC_API_URL=https://lessonfoundry.duckdns.org/api npx expo start
```

Scan the QR code with Expo Go. The phone must be able to reach the configured API URL; `127.0.0.1` refers to the phone itself and will not reach the EC2 server.

## Installable Android APK

The GitHub Mobile Release workflow creates an Android preview APK when the repository secret `EXPO_TOKEN` is configured. The workflow is manual:

```text
Actions → Mobile Release → Run workflow
```

The resulting GitHub Release contains:

```text
lessonfoundry-android-<version>.apk
```

Download that APK on Android, allow installation from the browser/files app when prompted, and install it.

## iOS

A directly downloadable unsigned iOS app is not produced. Use an EAS internal distribution/TestFlight build with an Apple Developer account.

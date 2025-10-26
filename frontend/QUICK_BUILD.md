# 🎃 QUICK BUILD COMMANDS

## One-Time Setup
```bash
cd frontend
npm install
npm install -g eas-cli
eas login
```

## Build APK (Choose One)

### Preview Build (RECOMMENDED) ✅
```bash
eas build --profile preview --platform android
```
**Best for: Personal use, local WiFi, Halloween costume**
**Time: ~10 minutes**

### Development Build
```bash
eas build --profile development --platform android
```
**Best for: Testing and debugging**

### Production Build
```bash
eas build --profile production --platform android
```
**Best for: Play Store release**

## After Build Completes
1. Check build status: https://expo.dev
2. Download APK from provided link
3. Transfer to phone
4. Install and enjoy!

## Update Backend URL
Edit `frontend/.env`:
```bash
EXPO_PUBLIC_BACKEND_URL=http://YOUR_JETSON_IP:8001
```

## Troubleshooting
```bash
# Clear cache and retry
eas build --clear-cache --platform android --profile preview

# Check backend is running
curl http://YOUR_JETSON_IP:8001/api/health
```

## Important Notes
- ✅ APK works offline on local WiFi
- ✅ No internet needed after installation
- ✅ Rebuild only when code or backend URL changes
- ✅ SSH settings stored in app (no rebuild needed)

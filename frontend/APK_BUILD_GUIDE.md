# 📱 Pumpkin Control - APK Build Guide

## 🎯 Quick Start Guide

Your Pumpkin Control app is now ready to build as an APK! Follow these steps to create a standalone Android app.

---

## 📋 Prerequisites

1. **Node.js & npm** installed on your computer
2. **Git** installed
3. **Expo account** (free) - Sign up at https://expo.dev

---

## 🚀 Step-by-Step Build Instructions

### Step 1: Save & Download Your Project

**From Emergent Platform:**
1. Push your code to GitHub using Emergent's GitHub integration
2. OR download the project files directly

### Step 2: Set Up Locally

```bash
# Clone your repository (if using GitHub)
git clone <your-repo-url>
cd <your-project-name>/frontend

# OR if you downloaded files
cd pumpkin-control/frontend

# Install dependencies
npm install

# Install EAS CLI globally
npm install -g eas-cli
```

### Step 3: Configure Your Backend URL

**IMPORTANT:** Update the backend URL to your actual server

Edit `frontend/.env`:
```bash
# Replace with your actual backend URL (where FastAPI is hosted)
EXPO_PUBLIC_BACKEND_URL=http://YOUR_JETSON_IP:8001

# For local network (no internet):
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8001

# For internet-accessible server:
EXPO_PUBLIC_BACKEND_URL=https://your-domain.com
```

### Step 4: Login to Expo

```bash
eas login
# Enter your Expo account credentials
```

### Step 5: Configure Your Project

```bash
eas build:configure
# Select 'Android' when prompted
# This creates/updates eas.json (already done!)
```

### Step 6: Build Your APK

Choose one of these build options:

#### Option A: Development Build (Recommended for Testing)
```bash
eas build --profile development --platform android
```
**Benefits:**
- Includes developer tools
- Easier debugging
- Can update without rebuilding

#### Option B: Preview Build (Best for Your Use Case)
```bash
eas build --profile preview --platform android
```
**Benefits:**
- Smaller file size
- Works completely offline
- No dev tools overhead
- ✅ **RECOMMENDED for Halloween costume use!**

#### Option C: Production Build
```bash
eas build --profile production --platform android
```
**Benefits:**
- Optimized and smallest size
- Ready for Google Play Store

### Step 7: Wait & Download

1. EAS will upload your project and build in the cloud (~5-15 minutes)
2. You'll see a link in the terminal
3. Visit the link to download your APK
4. OR check your build status at: https://expo.dev/accounts/[your-account]/projects/pumpkin-control/builds

### Step 8: Install on Your Phone

1. Download the APK file to your computer
2. Transfer to your phone via:
   - USB cable
   - Google Drive
   - Email
   - Direct download from EAS build page on phone
3. Open the APK file on your phone
4. Allow "Install from unknown sources" if prompted
5. Install and open!

---

## 🔧 Important Configuration Notes

### Backend URL Configuration

Your app will connect to the backend specified in `EXPO_PUBLIC_BACKEND_URL`:

**For Local WiFi (No Internet):**
```
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8001
```
- Replace `192.168.1.100` with your Jetson's IP
- Works on local network only
- Perfect for your Halloween costume setup

**For Internet Access:**
```
EXPO_PUBLIC_BACKEND_URL=https://your-server.com
```
- Requires backend deployed to internet
- Access from anywhere

### Rebuild When Needed

You need to rebuild the APK when:
- ✅ Backend URL changes
- ✅ You add new features
- ✅ You change app icons or name
- ❌ NOT needed for: SSH config changes, command customization (these are stored in MongoDB)

---

## 🎃 Your Costume Setup

### Recommended Configuration:

1. **Backend:** Run FastAPI on Jetson (port 8001)
2. **Network:** Create WiFi hotspot from Jetson or use local router
3. **APK:** Build with preview profile using local IP
4. **Phone:** Install APK, connect to same WiFi

### Network Setup Options:

**Option 1: Jetson as Hotspot**
```bash
# On Jetson, create WiFi hotspot
# Phone connects to Jetson's hotspot
# Backend URL: http://localhost:8001 or http://127.0.0.1:8001
```

**Option 2: Local Router (Your Current Setup)**
```bash
# Both phone and Jetson on same WiFi
# Backend URL: http://[Jetson's-local-IP]:8001
# Example: http://192.168.1.100:8001
```

---

## 🐛 Troubleshooting

### Build Fails?
```bash
# Clear cache and try again
eas build --clear-cache --platform android --profile preview
```

### APK Won't Install?
- Enable "Install from unknown sources" in Android settings
- Check if APK is compatible (Android 6.0+)

### App Can't Connect?
- Verify backend is running: `curl http://JETSON_IP:8001/api/health`
- Check both devices on same network
- Try IP address instead of hostname
- Check firewall on Jetson

### Want to Update App?
```bash
# Make changes to code
# Rebuild APK
eas build --platform android --profile preview

# Install new APK over old one (keeps settings!)
```

---

## 📱 Build Profiles Explained

| Profile | Use Case | Size | Speed |
|---------|----------|------|-------|
| **development** | Testing & debugging | Large | Slow |
| **preview** | Personal use (YOU!) | Medium | Fast |
| **production** | App stores | Small | Fastest |

**For your Halloween costume: Use `preview` profile! ✅**

---

## 🎉 You're All Set!

Your APK will:
✅ Work completely offline (on local WiFi)
✅ Control your Jetson via SSH
✅ No internet needed once installed
✅ Customizable commands for all controls
✅ Terminal log viewer
✅ Password visibility toggle

**Happy Halloween! 🎃👻**

---

## 📚 Additional Resources

- EAS Build Docs: https://docs.expo.dev/build/introduction/
- Expo Account: https://expo.dev
- Need help? Check logs in EAS build dashboard

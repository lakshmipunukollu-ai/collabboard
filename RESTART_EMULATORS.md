# 🔄 How to Restart Firebase Emulators

## Quick Fix for "Port Taken" Errors

### Step 1: Kill All Firebase Processes

**In your terminal, run this ONE command:**

```bash
killall -9 node; sleep 2; echo "✅ All processes killed"
```

This will stop ALL Firebase emulators.

---

### Step 2: Start Fresh Emulator

```bash
cd /Users/priyankapunukollu/test
firebase emulators:start --only functions
```

Wait for this message:
```
✔ All emulators ready! It is now safe to connect your app.
✔ functions[us-central1-aiChat]: http function initialized
```

---

### Step 3: Start Dev Server (in a NEW terminal tab)

Open a **new terminal tab** (Cmd+T) and run:

```bash
cd /Users/priyankapunukollu/test
npm run dev
```

---

### Step 4: Test

1. Open http://localhost:5174
2. Click AI Assistant button (🤖)
3. Type "Hello"
4. You should get a response!

---

## 🐛 Still Having Issues?

### Check what's running on the ports:

```bash
lsof -i :5002  # Functions emulator
lsof -i :5174  # Dev server
```

### Kill specific port:

```bash
kill $(lsof -ti:5002)  # Kill functions emulator
kill $(lsof -ti:5174)  # Kill dev server
```

---

## ✅ Expected Setup

When everything is working, you should have:

1. **Terminal 1:** Firebase emulator running on port 5002
2. **Terminal 2:** Vite dev server running on port 5174
3. **Browser:** http://localhost:5174 with working AI Assistant

---

## 🚀 Alternative: Skip Local Testing

If local emulators keep having issues, just deploy to production:

1. Upgrade to Blaze plan (free tier included)
2. Run: `firebase deploy`
3. Test on your live URL

The `.env` file is already configured with your API key!

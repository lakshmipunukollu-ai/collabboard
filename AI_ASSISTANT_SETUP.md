# 🤖 AI Assistant Setup Guide

## ✅ What's Been Done

1. Created Firebase Functions backend (`/functions` folder)
2. Created secure OpenAI proxy function
3. Updated frontend to call your backend (not OpenAI directly)
4. Your OpenAI API key will be stored securely on Firebase (never exposed to users)

---

## 🖥️ Local Development (run AI Assistant on localhost)

When the app runs on `localhost`, it calls the **Firebase Functions emulator** at `http://localhost:5002/.../aiChat`. You must start the emulator before using the AI Assistant.

### First time only

From the project root, install the Functions backend dependencies once:

```bash
cd functions && npm install && cd ..
```

Then use the one-command or two-terminal option below.

### One-command option (recommended)

From the project root, run:

```bash
npm run dev:all
```

This starts both the Functions emulator and the frontend in one terminal (logs are prefixed with `[emulator]` and `[app]`). Stop both with **Ctrl+C**. Wait until you see **"All emulators ready!"** in the terminal before using the AI Assistant; if you see "unavailable", wait a few more seconds for the emulator to finish starting, then try again.

### Two-terminal option

**Start the Functions emulator (from project root):**

```bash
firebase emulators:start --only functions
```

Wait until you see:
```
✔ All emulators ready! It is now safe to connect your app.
✔ functions[us-central1-aiChat]: http function initialized
```

Then in a **separate terminal**, start the frontend:

```bash
npm run dev
```

If you see `ERR_CONNECTION_REFUSED` or "AI Assistant is unavailable", the emulator is not running—start it with the command above. For port conflicts or restart steps, see `RESTART_EMULATORS.md`.

---

## 📝 Step-by-Step Deployment

### Step 1: Install Firebase Functions Dependencies

```bash
cd functions
npm install
cd ..
```

### Step 2: Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in (or create an account)
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)
5. **Save it somewhere safe** - you'll need it in the next step

### Step 3: Login to Firebase

```bash
firebase login
```

This will open your browser for authentication.

### Step 4: Set OpenAI API Key as a Secret

Run this command (replace `your-actual-key` with your real OpenAI API key):

```bash
firebase functions:secrets:set OPENAI_API_KEY
```

When prompted, paste your OpenAI API key (starts with `sk-...`) and press Enter.

Example flow:
```
? Enter a value for OPENAI_API_KEY: sk-proj-abc123...
✔ Created a new secret version projects/.../secrets/OPENAI_API_KEY
```

### Step 5: Deploy Firebase Functions

```bash
firebase deploy --only functions
```

This will:
- Upload your function code to Firebase
- Make it available at: `https://us-central1-collabboard-lakshmi.cloudfunctions.net/aiChat`
- Usually takes 2-3 minutes

### Step 6: Deploy Your Frontend

```bash
npm run build
firebase deploy --only hosting
```

---

## ✅ Testing

1. Open your deployed app
2. Click the AI Assistant button (🤖 bottom-right)
3. Type a message like "Help me brainstorm project ideas"
4. You should get a response!

---

## 🔒 Security Features

✅ **API Key is Hidden** - Stored securely in Firebase Functions, never sent to the browser  
✅ **User Authentication** - Only signed-in users can use the AI  
✅ **Rate Limiting** - Firebase automatically limits excessive requests  
✅ **CORS Protection** - Only your domain can call the function  

---

## 💰 Cost Considerations

**Firebase Functions:**
- Free tier: 2M invocations/month
- After that: $0.40 per million invocations

**OpenAI API:**
- GPT-4: ~$0.03 per 1,000 tokens (about 750 words)
- GPT-3.5-turbo: ~$0.002 per 1,000 tokens (much cheaper!)

**To reduce costs:**
- Change `model: 'gpt-4'` to `model: 'gpt-3.5-turbo'` in `/functions/index.js` line 40
- Set usage limits in your OpenAI account dashboard

---

## 🐛 Troubleshooting

### Function deployment fails
```bash
# Check Firebase login
firebase login --reauth

# Check project
firebase projects:list
```

### AI Assistant shows error
1. Check function logs: `firebase functions:log`
2. Verify API key is set: `firebase functions:config:get`
3. Check function URL is correct in `AIAssistant.jsx`

### "Unauthorized" error
- User must be signed in with Clerk
- Check browser console for auth token errors

---

## 📚 Files Modified

- `/functions/index.js` - OpenAI proxy function
- `/functions/package.json` - Dependencies
- `/src/components/AIAssistant.jsx` - Updated to use backend
- `/firebase.json` - Added functions configuration
- `/.gitignore` - Added functions/node_modules

---

## 🎉 You're Done!

Once deployed, **every user** can use the AI Assistant without needing their own API key!

Questions? Check the function logs or let me know!

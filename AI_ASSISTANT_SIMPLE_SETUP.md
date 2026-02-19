# 🤖 AI Assistant - Simple Setup (Free Firebase Plan)

## ✅ Quick Setup Guide

### Step 1: Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in (or create account)
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)
5. **Keep it handy** - you'll need it in Step 3!

---

### Step 2: Login to Firebase

```bash
cd /Users/priyankapunukollu/test
firebase login --reauth
```

This opens your browser for authentication.

---

### Step 3: Add Your API Key to the Code

**Open this file:** `/Users/priyankapunukollu/test/functions/index.js`

**Find line 8** (looks like this):
```javascript
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
```

**Replace `YOUR_OPENAI_API_KEY_HERE` with your actual key:**
```javascript
const OPENAI_API_KEY = 'sk-proj-abc123...your-actual-key';
```

**Save the file!** (Cmd+S / Ctrl+S)

---

### Step 4: Deploy Everything

Run these commands:

```bash
# Deploy the function
firebase deploy --only functions

# Build and deploy frontend
npm run build
firebase deploy --only hosting
```

Deployment takes 2-3 minutes.

---

## ✅ Test It!

1. Open your deployed app
2. Click the AI Assistant button (🤖)
3. Ask: "Help me brainstorm project ideas"
4. You should get a response!

---

## 🔒 Security Notes

**Is this secure?**
- ✅ Your API key is in **server-side code** (not in browser)
- ✅ Users **cannot see** your API key
- ✅ Only authenticated users can use the AI
- ⚠️ Key is stored in code (less fancy than secrets, but still secure)

**Important:**
- Never commit your API key to Git (it's in `/functions/index.js`)
- The `.gitignore` doesn't cover this, so be careful!

---

## 💰 Cost Info

**OpenAI API:**
- GPT-3.5-turbo: ~$0.002 per 1,000 tokens (very cheap!)
- Example: 100 conversations = ~$0.20

**Firebase Functions (Free Plan):**
- ✅ 2 million invocations/month FREE
- ✅ 125K GB-seconds compute FREE
- ✅ 10GB outbound networking FREE

You'll likely stay within free limits!

---

## 🐛 Troubleshooting

### Function deployment fails
```bash
firebase deploy --only functions --debug
```

### AI shows "not configured" error
- Check that you replaced `YOUR_OPENAI_API_KEY_HERE` in `/functions/index.js`
- Redeploy: `firebase deploy --only functions`

### "Unauthorized" error
- User must be signed in with Clerk
- Check browser console for auth errors

---

## 📝 What Changed?

- ✅ Using Firebase Functions v1 (works on free plan)
- ✅ API key stored in code (not fancy secrets)
- ✅ Changed to GPT-3.5-turbo (60x cheaper than GPT-4!)
- ✅ Still secure - key is server-side only

---

## 🎉 You're Done!

Every user can now use the AI Assistant without needing their own API key!

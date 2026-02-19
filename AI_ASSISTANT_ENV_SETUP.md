# 🤖 AI Assistant Setup - Environment Variable Configuration

## ✅ Setup Complete!

Your AI Assistant now uses environment variables! The OpenAI API key is stored in `.env` files (NOT in your code).

---

## 📝 Quick Setup Guide

### Step 1: Get Your OpenAI API Key

1. Go to: https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click "Create new secret key"
4. **Copy the key** (starts with `sk-...`)

---

### Step 2: Add Your Key to the Environment Files

You need to add your key to **TWO locations**:

#### A. Root `.env.local` (for reference)

Open: `/Users/priyankapunukollu/test/.env.local`

Find line 16 and add your key:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

#### B. Functions `.env` (this is what actually gets used)

Open: `/Users/priyankapunukollu/test/functions/.env`

Replace `YOUR_OPENAI_API_KEY_HERE` with your actual key:
```bash
OPENAI_API_KEY=sk-your-actual-key-here
```

**Save both files!**

---

### Step 3: Deploy

```bash
cd /Users/priyankapunukollu/test

# Deploy the function
firebase deploy --only functions

# Build and deploy frontend
npm run build
firebase deploy --only hosting
```

---

## ✅ Testing

1. Open your deployed app
2. Click the AI Assistant button (🤖)
3. Type: "Help me brainstorm ideas"
4. You should get a response!

---

## 🔒 Security Benefits

✅ **API key is NOT in your code** - stored in `.env` files  
✅ **`.env` files are gitignored** - won't be committed to Git  
✅ **Key is server-side only** - frontend never sees it  
✅ **Works on free Firebase plan** - no paid features needed  
✅ **Easy to update** - just edit `.env` file and redeploy  

---

## 📂 File Structure

```
test/
├── .env.local              # Your local environment variables (root)
│   └── OPENAI_API_KEY=... # Added here for reference
│
├── functions/
│   ├── .env               # Firebase Functions environment (THIS ONE IS USED!)
│   │   └── OPENAI_API_KEY=... # ⚠️ ADD YOUR KEY HERE
│   ├── .env.example       # Template for other developers
│   ├── .gitignore         # Ensures .env files aren't committed
│   └── index.js           # Loads env vars with dotenv
```

---

## 🔄 How It Works

1. **`dotenv` package** loads variables from `functions/.env`
2. **Firebase Functions** reads `process.env.OPENAI_API_KEY`
3. **Your code** never contains the actual key
4. **When deployed**, the `.env` file goes with your function code
5. **Git ignores** `.env` files so they're never committed

---

## 💡 Pro Tips

### Updating Your Key

Just edit `functions/.env` and redeploy:
```bash
firebase deploy --only functions
```

### For Team Members

1. Share `functions/.env.example` (committed to Git)
2. They copy it to `functions/.env`
3. They add their own key (or use yours)
4. The `.env` file stays local (not in Git)

### Multiple Environments

Create different env files:
- `functions/.env` - for local/development
- `functions/.env.production` - for production (also gitignored)

---

## 💰 Cost Info

**OpenAI API:**
- GPT-3.5-turbo: ~$0.002 per 1,000 tokens
- Example: 100 conversations ≈ $0.20

**Firebase Functions (Free Plan):**
- ✅ 2M invocations/month FREE
- ✅ You'll likely stay within free limits!

---

## 🐛 Troubleshooting

### "AI Assistant not configured" error

**Problem:** Key not loaded from `.env` file

**Fix:**
1. Check `functions/.env` exists and has your key
2. Key should NOT have quotes: `OPENAI_API_KEY=sk-123...`
3. Redeploy: `firebase deploy --only functions`

### "Invalid OpenAI API key" error

**Problem:** Wrong or expired key

**Fix:**
1. Generate a new key at https://platform.openai.com/api-keys
2. Update `functions/.env`
3. Redeploy

### Key not being read

**Problem:** `dotenv` not loading properly

**Fix:**
1. Check `functions/package.json` has `"dotenv": "^16.3.1"`
2. Run `cd functions && npm install`
3. Redeploy

---

## 📋 Checklist

Before deploying, verify:

- [ ] OpenAI API key is in `functions/.env`
- [ ] Key starts with `sk-`
- [ ] No quotes around the key value
- [ ] `functions/.env` is NOT committed to Git
- [ ] `dotenv` package is installed in functions
- [ ] Firebase login is active (`firebase login`)

---

## 🎉 You're Done!

Your AI Assistant is now configured with environment variables. Users can chat with the AI without providing their own keys!

**Next Steps:**
- Deploy with `firebase deploy`
- Test the AI Assistant
- Optionally add spending limits in your OpenAI dashboard

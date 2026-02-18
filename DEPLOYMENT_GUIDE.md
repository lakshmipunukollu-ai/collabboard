# 🚀 Deployment Guide for CollabBoard

Your app is built and ready to deploy! Follow these steps:

---

## ✅ **Build Complete!**

Your production build is ready in the `/dist` folder:
- `index.html` - 0.43 kB
- CSS bundle - 2.87 kB
- JavaScript bundle - 763.97 kB (213 kB gzipped)

---

## 📋 **Pre-Deployment Checklist**

Before deploying, make sure you have:

### 1. **Clerk Production Keys** (Important!)
- Go to [Clerk Dashboard](https://dashboard.clerk.com)
- Switch to **Production** mode (toggle in top-right)
- Copy your **Production Publishable Key** (starts with `pk_live_...`)
- Update your production environment with this key

### 2. **Clerk Production Settings**
- Add your production domain to allowed origins
- Configure production OAuth credentials for Google/GitHub
- Test OAuth in production mode

### 3. **Firebase Database Rules**
Your current rules are simple (anyone authenticated can read/write):
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

**⚠️ Note:** These are basic rules. For production, consider more granular permissions.

---

## 🚀 **Deploy to Firebase Hosting**

### **Option 1: Deploy from Terminal** (Recommended)

Run these commands in your terminal:

```bash
# 1. Make sure you're in the project directory
cd /Users/priyankapunukollu/test

# 2. Login to Firebase (if not already logged in)
firebase login --reauth

# 3. Deploy everything (hosting + database rules)
firebase deploy
```

### **Option 2: Deploy Only Hosting** (Skip database rules)

```bash
firebase deploy --only hosting
```

### **Option 3: Deploy Only Database Rules**

```bash
firebase deploy --only database
```

---

## 🌐 **Your App Will Be Live At:**

After successful deployment, your app will be available at:

```
https://collabboard-lakshmi.web.app
```

Or:

```
https://collabboard-lakshmi.firebaseapp.com
```

---

## ⚙️ **Post-Deployment Setup**

### 1. **Update Clerk Settings**

In your [Clerk Dashboard](https://dashboard.clerk.com):

1. Go to **Developers** → **Allowed Origins**
2. Add your production URLs:
   - `https://collabboard-lakshmi.web.app`
   - `https://collabboard-lakshmi.firebaseapp.com`

3. Go to **Paths** and update:
   - **Sign-in URL**: `https://collabboard-lakshmi.web.app/sign-in`
   - **Sign-up URL**: `https://collabboard-lakshmi.web.app/sign-up`
   - **After sign-in**: `https://collabboard-lakshmi.web.app/`

### 2. **Configure OAuth (Production)**

For **Google OAuth**:
- Clerk provides shared credentials for development
- For production, set up your own Google OAuth app
- Add production callback URL from Clerk dashboard

For **GitHub OAuth**:
- Same process - use production OAuth credentials
- Update callback URLs

### 3. **Update Environment Variables**

Your production environment needs:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
```

**Note:** Firebase Hosting doesn't use `.env` files. Environment variables are baked into the build. Make sure to:
1. Update `.env.local` with production key
2. Rebuild: `npm run build`
3. Redeploy: `firebase deploy`

---

## 🔍 **Verify Deployment**

After deployment:

1. ✅ Visit your live URL
2. ✅ Test sign-in with Google
3. ✅ Test sign-in with GitHub
4. ✅ Test sign-in with email/password
5. ✅ Test creating sticky notes
6. ✅ Test real-time collaboration (open in 2 tabs)
7. ✅ Test multiplayer cursors
8. ✅ Verify presence panel shows online users

---

## 🐛 **Troubleshooting**

### **"Missing Publishable Key" Error**
- Make sure production key is in `.env.local`
- Rebuild the app: `npm run build`
- Redeploy: `firebase deploy`

### **OAuth Not Working**
- Check Clerk dashboard → Allowed Origins
- Verify production URLs are added
- Make sure OAuth providers are enabled for production

### **Database Connection Issues**
- Check Firebase Realtime Database is enabled
- Verify database rules are deployed
- Check browser console for errors

### **Authentication Issues**
- Verify Clerk production mode is active
- Check production publishable key is correct
- Clear browser cache and cookies

---

## 📊 **Monitor Your App**

### **Firebase Console**
- Monitor database usage: [Firebase Console](https://console.firebase.google.com)
- Check hosting metrics
- View real-time connections

### **Clerk Dashboard**
- Monitor active users
- View sign-in statistics
- Check authentication logs

---

## 🔄 **Future Deployments**

Whenever you make changes:

```bash
# 1. Build new version
npm run build

# 2. Deploy
firebase deploy
```

That's it! Firebase will automatically update your live site.

---

## 🎉 **You're Ready!**

Run this command to deploy:

```bash
firebase deploy
```

Your CollabBoard app will be live in seconds! 🚀

---

## 📞 **Need Help?**

- **Firebase Issues**: Check [Firebase Documentation](https://firebase.google.com/docs)
- **Clerk Issues**: Check [Clerk Documentation](https://clerk.com/docs)
- **Deployment Errors**: Check terminal output for specific error messages

---

**Good luck with your deployment!** 🎉

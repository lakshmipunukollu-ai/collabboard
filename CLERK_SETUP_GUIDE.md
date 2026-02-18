# Clerk Authentication Setup Guide

Your CollabBoard app has been successfully migrated from Firebase Auth to Clerk! Follow these steps to complete the setup.

---

## 🔑 Step 1: Get Your Clerk API Keys

1. **Sign up for Clerk** (if you haven't already):
   - Go to https://dashboard.clerk.com/sign-up
   - Create a new account

2. **Create a new application**:
   - Click "Add application" in your Clerk dashboard
   - Name it "CollabBoard" or similar
   - Choose your preferred authentication methods (see Step 2)

3. **Copy your Publishable Key**:
   - In your Clerk dashboard, navigate to **API Keys**
   - Copy the **Publishable Key** (starts with `pk_test_...` or `pk_live_...`)

4. **Add the key to your `.env.local` file**:
   ```bash
   # Replace 'your_clerk_publishable_key_here' with your actual key
   VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
   ```

---

## 🔐 Step 2: Configure Authentication Methods

In your Clerk dashboard, navigate to **User & Authentication** → **Email, Phone, Username** and **Social Connections**:

### Enable Email/Password Authentication:
1. Go to **Email, Phone, Username**
2. Toggle **Email address** to ON
3. Enable **Password** authentication
4. Save changes

### Enable Google OAuth:
1. Go to **Social Connections**
2. Toggle **Google** to ON
3. Clerk will handle OAuth automatically (no additional setup needed for development)
4. For production, you may want to add your own Google OAuth credentials

### Enable GitHub OAuth:
1. Go to **Social Connections**
2. Toggle **GitHub** to ON
3. For development, Clerk provides shared OAuth credentials
4. **For production**, create your own GitHub OAuth App:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - **Application name**: CollabBoard
   - **Homepage URL**: Your production URL
   - **Authorization callback URL**: Copy from Clerk dashboard
   - Copy Client ID and Client Secret to Clerk

---

## 🎨 Step 3: Customize the Sign-In/Sign-Up UI (Optional)

Clerk's components are already styled to match your dark theme, but you can further customize:

1. In Clerk dashboard, go to **Customization** → **Theme**
2. Adjust colors, fonts, and layout to match your brand
3. Changes apply instantly to your sign-in and sign-up pages

---

## 🚀 Step 4: Test Your Setup

1. **Start your development server**:
   ```bash
   npm run dev
   ```

2. **Test sign-in flow**:
   - Navigate to `http://localhost:5173`
   - You should see the sign-in page
   - Click "Sign up" link to test sign-up flow
   - Try signing in with:
     - ✅ Email/Password
     - ✅ Google OAuth
     - ✅ GitHub OAuth

3. **Test sign-out**:
   - After signing in, click the "Sign out" button in the header
   - You should be redirected back to sign-in page

4. **Test navigation**:
   - Sign-in page should have "Don't have an account? Sign up" link
   - Sign-up page should have "Already have an account? Sign in" link

---

## 📋 What Changed?

### Removed:
- ❌ Firebase Authentication
- ❌ `AuthContext.jsx`
- ❌ `LoginScreen.jsx` (replaced with Clerk components)
- ❌ Google Sign-In button component

### Added:
- ✅ Clerk React SDK (`@clerk/clerk-react`)
- ✅ `SignInPage.jsx` with Clerk's `<SignIn />` component
- ✅ `SignUpPage.jsx` with Clerk's `<SignUp />` component
- ✅ ClerkProvider in `main.jsx`
- ✅ Navigation links between sign-in and sign-up

### Updated:
- ✅ `App.jsx` - Uses Clerk's `useUser()` and auth state
- ✅ `BoardContext.jsx` - Uses Clerk user data
- ✅ `PresencePanel.jsx` - Uses Clerk user
- ✅ `CursorOverlay.jsx` - Uses Clerk user
- ✅ `.env.local` - Added Clerk publishable key

### Unchanged:
- ✅ Firebase Realtime Database (still used for board data, cursors, presence)
- ✅ All board functionality (sticky notes, shapes, real-time sync)
- ✅ All features (multi-select, copy/paste, etc.)

---

## 🔒 Security & Production

### For Production Deployment:

1. **Switch to production keys**:
   - In Clerk dashboard, go to **API Keys**
   - Copy **Production Publishable Key** (starts with `pk_live_...`)
   - Update your production environment variables

2. **Configure production OAuth**:
   - Set up your own Google OAuth credentials
   - Set up your own GitHub OAuth App
   - Add production callback URLs

3. **Set up custom domain** (optional):
   - Clerk supports custom domains for auth pages
   - See Clerk docs: https://clerk.com/docs/deployments/domains

4. **Enable additional security features**:
   - Multi-factor authentication (MFA)
   - Session management
   - Bot protection
   - All available in Clerk dashboard

---

## 📚 Additional Resources

- **Clerk Documentation**: https://clerk.com/docs
- **Clerk React Guide**: https://clerk.com/docs/quickstarts/react
- **Clerk Dashboard**: https://dashboard.clerk.com

---

## ❓ Troubleshooting

### "Missing Publishable Key" Error
- Make sure `VITE_CLERK_PUBLISHABLE_KEY` is set in `.env.local`
- Restart your dev server after adding the key

### Sign-in page not loading
- Check browser console for errors
- Verify Clerk key is correct
- Make sure Clerk SDK is installed: `npm install @clerk/clerk-react`

### OAuth providers not showing
- Go to Clerk dashboard → Social Connections
- Make sure providers are toggled ON
- Clear browser cache and try again

### User data not showing after sign-in
- Check that `user.id`, `user.firstName`, and `user.emailAddresses` are accessible
- Look for errors in browser console
- Verify BoardContext is receiving user data

---

## 🎉 You're All Set!

Once you've completed these steps, your CollabBoard app will have:
- ✅ Secure email/password authentication
- ✅ Google OAuth sign-in
- ✅ GitHub OAuth sign-in
- ✅ Beautiful sign-in and sign-up pages
- ✅ Seamless navigation between auth pages
- ✅ Production-ready authentication

Happy coding! 🚀

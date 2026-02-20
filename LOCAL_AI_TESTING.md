# Local AI Assistant Testing

This doc explains how to run the CollabBoard app locally and have the AI Assistant work against either the **deployed** function (Option A) or the **emulator** (Option B).

---

## Option A – Deployed function (no emulator)

The app calls `https://us-central1-collabboard-d900c.cloudfunctions.net/aiChat`. No local backend to run.

### 1. Environment variables (`.env.local`)

Set these in the project root `.env.local` so the app uses **collabboard-d900c**:

| Variable | Example / where to get it |
|----------|----------------------------|
| `VITE_FIREBASE_PROJECT_ID` | `collabboard-d900c` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `collabboard-d900c.firebaseapp.com` |
| `VITE_FIREBASE_DATABASE_URL` | `https://collabboard-d900c-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `collabboard-d900c.firebasestorage.app` |
| `VITE_FIREBASE_API_KEY` | From Firebase Console → **collabboard-d900c** → Project settings → Your apps → Web app config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Same as above |
| `VITE_FIREBASE_APP_ID` | Same as above |
| `VITE_FIREBASE_MEASUREMENT_ID` | Optional; same place |
| `VITE_CLERK_PUBLISHABLE_KEY` | Your Clerk key (unchanged) |

Do **not** set `VITE_USE_EMULATOR` (or set it to `false`) so the app uses the deployed URL.

### 2. Firebase Console – OpenAI key for deployed function

- Firebase Console → **collabboard-d900c** → **Build** → **Functions** → **aiChat**
- Open the function’s **Configuration** / **Environment variables** (or **Secrets**)
- Add **OPENAI_API_KEY** with your OpenAI API key (e.g. from https://platform.openai.com/api-keys)
- Save (and redeploy if prompted)

### 3. Run and test

```bash
npm run dev
```

Open the app (e.g. http://localhost:5174), sign in, open a board, open the AI Assistant, and send e.g. **“Add a sticky note”** or **“make a square”**. The request goes to the deployed **aiChat** function.

---

## Option B – Emulator (backend on your machine)

The app calls `http://localhost:5002/collabboard-d900c/us-central1/aiChat`. You must run the Functions emulator.

### 1. Environment variables (`.env.local`)

- Use the same **VITE_FIREBASE_*** values as in Option A (so the app still uses **collabboard-d900c** for Firebase).
- Add or set:
  ```bash
  VITE_USE_EMULATOR=true
  ```

### 2. OpenAI key for the emulator

- In **`functions/.env`** (inside the `functions` folder), set:
  ```bash
  OPENAI_API_KEY=your-openai-api-key
  ```
- Do not commit this file or share the key. `functions/.env` is used only when the emulator runs.

### 3. Start the emulator and the app

**Terminal 1 – Functions emulator**

From the **project root** (where `firebase.json` is):

```bash
firebase use collabboard-d900c
firebase emulators:start --only functions
```

Leave this running. The emulator serves **aiChat** on port **5002**. If port 5002 is in use, free it (e.g. `lsof -i :5002` then `kill <PID>`) or change the port in `firebase.json` and in `src/components/AIAssistant.jsx` (emulator URL).

**Terminal 2 – App**

From the same project root:

```bash
npm run dev
```

Open the app and use the AI Assistant as in Option A. Requests go to the emulator.

---

## Quick reference

| Goal | Set in `.env.local` | Backend | OPENAI_API_KEY |
|------|---------------------|---------|----------------|
| Use deployed function (Option A) | All `VITE_FIREBASE_*` for d900c; no (or false) `VITE_USE_EMULATOR` | Deployed **aiChat** on Firebase | Set in Firebase Console for **aiChat** (collabboard-d900c) |
| Use emulator (Option B) | Same + `VITE_USE_EMULATOR=true` | `firebase emulators:start --only functions` (port 5002) | In **functions/.env** |

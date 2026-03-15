# Deploying Crusader Combat

**Backend** runs on **Railway** (Node.js). **Frontend** runs on **Vercel** (static HTML/CSS/JS).

## 1. Deploy backend to Railway

1. Push this repo to GitHub (if you haven’t).
2. Go to [railway.app](https://railway.app), sign in, **New Project** → **Deploy from GitHub** and select this repo.
3. Railway will detect Node and use `npm start` (`node server/index.js`). It sets `PORT` for you.
4. After deploy, open the service → **Settings** → **Networking** → **Generate Domain**. Copy the URL (e.g. `https://crusader-combat-production.up.railway.app`).

**Note:** Leaderboard is stored in `server/leaderboard.json`. On Railway the filesystem can reset on redeploy unless you use a volume; for persistent scores you’d add a database later.

## 2. Deploy frontend to Vercel

1. Go to [vercel.com](https://vercel.com), sign in, **Add New** → **Project** and import this repo.
2. **Root Directory:** leave as `.` (repo root).
3. **Build and Output Settings:**
   - **Build Command:** `node scripts/inject-api.js`
   - **Output Directory:** `client`
4. **Environment Variables:** add one variable:
   - **Name:** `API_URL`  
   - **Value:** your Railway backend URL (no trailing slash), e.g. `https://crusader-combat-production.up.railway.app`
5. Deploy. The build will write `client/config.js` with that URL so the game calls your Railway API.

## 3. Run locally

- **Backend:** `npm start` (or `node server/index.js`) → game + API at `http://localhost:3000`.
- **Frontend only (e.g. with Live Server):** open `client/index.html`. With default `config.js` (`window.API_BASE = ""`), API calls go to the same origin; either run the backend on the same port via a proxy or run `npm start` and use `http://localhost:3000`.

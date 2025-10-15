# 🚂 Railway Deployment Guide for MOONWAVE Backend

## Complete Step-by-Step Guide (15 minutes)

---

## Part 1: Prepare Your Backend (5 minutes)

### Step 1.1: Generate API Key

Open terminal in the `backend-proxy` folder:

```bash
cd backend-proxy
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**COPY THIS KEY!** You'll need it for both Railway and your frontend.

Example output: `a7f5e9d2c8b1f4e6d3a9c7b5e8f1d4c2a9b6e3f0d7c4a1e8b5f2d9c6a3e0f7d4`

---

### Step 1.2: Test Backend Locally (Optional but Recommended)

Create `.env` file in `backend-proxy`:

```bash
# backend-proxy/.env
FX_CACHE_API_KEY=your-generated-key-here
PORT=3001
```

Install and test:

```bash
npm install
npm start
```

You should see:
```
🚀 [PROXY] Backend server running on port 3001
📡 [PROXY] Endpoints:
  GET /api/fx-cache (public read)
  POST /api/fx-cache (requires X-API-Key header)
🔐 [PROXY] API Key for writes: ✅ Custom key configured
🔄 [FX-AUTO-REFRESH] Starting automatic refresh every 4 hours
```

Press `Ctrl+C` to stop. Now you're ready to deploy!

---

## Part 2: Deploy to Railway (5 minutes)

### Step 2.1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click **"Login"** → Sign in with GitHub
3. Authorize Railway to access your repositories

---

### Step 2.2: Push Code to GitHub

If you haven't already:

```bash
# In your project root (NOT in backend-proxy)
git add .
git commit -m "Add backend cache server"
git push
```

---

### Step 2.3: Create New Project on Railway

1. **Click** "New Project" button (top right)
2. **Select** "Deploy from GitHub repo"
3. **Choose** your repository from the list
4. Railway will detect it's a Node.js project

---

### Step 2.4: Configure Root Directory

Railway needs to know the backend is in a subdirectory:

1. Click **"Settings"** tab (left sidebar)
2. Scroll to **"Service Settings"**
3. Find **"Root Directory"**
4. Enter: `backend-proxy`
5. Click **"Update"**

---

### Step 2.5: Set Environment Variable

1. Click **"Variables"** tab (left sidebar)
2. Click **"+ New Variable"**
3. Add this variable:
   ```
   Variable Name: FX_CACHE_API_KEY
   Value: [paste your generated key from Step 1.1]
   ```
4. Click **"Add"**

---

### Step 2.6: Deploy!

Railway will automatically deploy. You'll see:

```
Building...
Installing dependencies...
npm install
✓ Dependencies installed
Starting server...
npm start
✅ Deployment successful!
```

**Get your backend URL:**

1. Click on the deployment (it will say "Active")
2. Look for **"Settings"** → **"Domains"**
3. Click **"Generate Domain"**
4. Copy the URL (looks like: `moonwave-backend-production.up.railway.app`)

---

## Part 3: Update Frontend to Use Railway Backend (5 minutes)

### Step 3.1: Update App.tsx

Find the constant `BACKEND_URL` in your `App.tsx` (around line 100-150):

**BEFORE:**
```typescript
const BACKEND_URL = 'http://localhost:3001';
```

**AFTER:**
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://your-railway-url.up.railway.app';
```

Replace `your-railway-url.up.railway.app` with your actual Railway domain from Step 2.6.

---

### Step 3.2: Update CORS in server.js (Important!)

Before your frontend can connect, update the CORS settings in `backend-proxy/server.js`:

Find line ~40:

```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://your-frontend-domain.com',
    'https://expand-trend-44478751.figma.site'  // Your Figma Publish URL
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
```

**Add your actual Figma Publish URL** (or any other domain you'll use).

Commit and push:

```bash
git add .
git commit -m "Update CORS for production"
git push
```

Railway will auto-redeploy (takes ~1 minute).

---

## Part 4: Test the Integration (2 minutes)

### Step 4.1: Check Backend is Running

Open in browser:
```
https://your-railway-url.up.railway.app/health
```

Should see:
```json
{
  "status": "OK",
  "timestamp": "2025-10-15T23:45:00.000Z"
}
```

---

### Step 4.2: Check FX Cache Endpoint

Open in browser:
```
https://your-railway-url.up.railway.app/api/fx-cache
```

Should see:
```json
{
  "lastUpdate": 1729035600000,
  "usdjpy1D": [...],
  "dxy1D": [...],
  "usdjpy4H": [...],
  "dxy4H": [...],
  "dataReady": true,
  "cacheAge": "0.5 hours",
  "nextRefresh": "in 3.5 hours"
}
```

If you see data, **YOU'RE LIVE!** 🎉

---

### Step 4.3: Test from Your Frontend

1. Open your Figma Publish site
2. Open browser console (F12)
3. Look for these logs:

```
📊 [FX-CACHE] Checking backend cache at https://your-railway-url.up.railway.app/api/fx-cache
✅ [FX-CACHE] Backend cache hit! Age: 0.2 hours
📊 [FX-CACHE] Using backend cache (0.2 hours old, refreshed every 4 hours)
```

---

## ✅ Success Checklist

- [ ] Backend deployed on Railway
- [ ] Environment variable `FX_CACHE_API_KEY` set
- [ ] Railway domain generated
- [ ] Frontend `BACKEND_URL` updated
- [ ] CORS origins include your domain
- [ ] `/health` endpoint returns `{"status": "OK"}`
- [ ] `/api/fx-cache` endpoint returns FX data
- [ ] Frontend console shows "Backend cache hit"
- [ ] No CORS errors in browser console

---

## 📊 How It Works

### Backend (Railway):
1. **Starts up** → Immediately fetches FX data from APIs
2. **Stores in memory** → No database needed
3. **Auto-refreshes** → Every 4 hours (6 API calls/day total)
4. **Serves all users** → Instant cached responses

### Frontend (Figma Publish):
1. **Requests data** → From Railway backend
2. **Gets instant response** → No API calls needed
3. **Updates UI** → Shows fresh data
4. **Zero API quota usage** → Backend handles everything

### API Call Reduction:
- **Before**: 100 users × 4 API calls = 400 calls/day
- **After**: 6 refreshes × 4 APIs = 24 calls/day
- **Savings**: 94% reduction! ✨

---

## 🔧 Troubleshooting

### "Cannot connect to backend"

**Problem:** CORS error in console

**Solution:** Add your domain to CORS origins in `server.js` (Step 3.2)

---

### "503 Service Unavailable"

**Problem:** Railway service crashed

**Solution:** Check Railway logs:
1. Go to Railway dashboard
2. Click your project
3. Click "Deployments" tab
4. Look for error messages

Common fixes:
- Check `FX_CACHE_API_KEY` is set
- Check `package.json` has correct Node version
- Restart deployment: Settings → "Restart"

---

### "Data is stale"

**Problem:** Cache not refreshing

**Solution:** Check Railway logs for refresh messages:
```
🔄 [FX-AUTO-REFRESH] Starting refresh cycle...
✅ [FX-AUTO-REFRESH] Refresh complete in 2.3s
```

If not refreshing, check environment variables and restart.

---

### "CORS Error" on specific domain

**Problem:** Forgot to add domain to CORS

**Solution:** 
1. Edit `server.js` line ~40
2. Add your domain to origins array
3. Commit and push
4. Wait for Railway auto-redeploy (~1 min)

---

## 💰 Railway Free Tier Info

**Railway Free Tier includes:**
- ✅ 500 hours/month execution time (~20 days continuous)
- ✅ $5 credit/month
- ✅ Unlimited projects
- ✅ Auto-deploys from GitHub
- ✅ HTTPS/custom domains

**Your backend will use:**
- ~$0.50-1.00/month (well within free tier)
- Runs 24/7 automatically
- Auto-scales if needed

**Pro tip:** Railway pauses services with no traffic to save resources. Your service will auto-wake when requests come in.

---

## 🚀 Next Steps

### Optional: Add Custom Domain

1. In Railway → Settings → Domains
2. Click "Custom Domain"
3. Enter your domain: `api.moonwave.pro`
4. Add CNAME record to your DNS:
   ```
   CNAME api → [railway-provided-url]
   ```
5. Update frontend `BACKEND_URL` to `https://api.moonwave.pro`

### Optional: Add Monitoring

Railway provides:
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time log streaming
- **Alerts**: Set up notifications for errors

Access via: Dashboard → Metrics tab

### Optional: Set Up Staging Environment

1. Create new Railway project for staging
2. Deploy same code with different env vars
3. Test changes before production

---

## 📚 Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Node.js on Railway](https://docs.railway.app/languages/nodejs)
- [Environment Variables](https://docs.railway.app/develop/variables)

---

## 🎉 You're Done!

Your MOONWAVE backend is now:
- ✅ Running 24/7 on Railway
- ✅ Auto-refreshing every 4 hours
- ✅ Serving instant cached data
- ✅ Reducing API calls by 94%
- ✅ Completely free (within Railway's free tier)

**Enjoy your ultra-fast, API-efficient financial dashboard!** 🌊📈

---

**Questions?** Check the logs in Railway or test locally first with `npm start`.

# ⚡ Quick Deploy Guide - Railway Backend

## 5-Minute Deployment Checklist

### ✅ Phase 1: Prepare (2 min)

**1. Generate API Key**
```bash
cd backend-proxy
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
**→ COPY THIS KEY!** You'll need it twice.

**2. Test Locally (Optional)**
```bash
npm install
npm start
```
Should see: `🚀 Backend server running on port 3001`

---

### ✅ Phase 2: Deploy to Railway (2 min)

**1. Push to GitHub**
```bash
git add .
git commit -m "Add backend"
git push
```

**2. Deploy on Railway**
1. Go to [railway.app](https://railway.app)
2. Login with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Settings → Root Directory → `backend-proxy`
6. Variables → Add → `FX_CACHE_API_KEY` = [paste your key]
7. Settings → Domains → "Generate Domain"

**→ COPY YOUR RAILWAY URL!** (e.g., `moonwave-backend.up.railway.app`)

---

### ✅ Phase 3: Connect Frontend (1 min)

**1. Add to App.tsx** (top of file, ~line 25):
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
```

**2. Add Backend Fetch Function** (see INTEGRATION-STEPS.md for full code)

**3. Update Cache Check Order** (see INTEGRATION-STEPS.md)

**4. Set Environment Variable in Figma Publish:**
```
VITE_BACKEND_URL=https://your-railway-url.up.railway.app
```

---

### ✅ Phase 4: Test (30 sec)

**1. Check Backend:**
Open: `https://your-railway-url.up.railway.app/health`
Should see: `{"status":"OK"}`

**2. Check Cache:**
Open: `https://your-railway-url.up.railway.app/api/fx-cache`
Should see FX data JSON

**3. Check Frontend:**
Open Figma Publish site → F12 Console → Look for:
```
✅ [FX-CACHE-BACKEND] Backend cache loaded successfully
✅ [FX-CACHE] ═══ USING BACKEND CACHE ═══
```

---

## 🎯 Success = Zero API Calls!

**Before Backend:**
- 100 users → 400 API calls/day
- Slow initial load (5-10 seconds)
- API rate limits

**After Backend:**
- 100 users → 24 API calls/day (94% reduction!)
- Instant load (< 100ms)
- No rate limits

---

## 📋 Quick Reference URLs

Replace `your-railway-url` with your actual Railway domain:

| Endpoint | URL | Purpose |
|----------|-----|---------|
| Health Check | `https://your-railway-url.up.railway.app/health` | Verify backend is running |
| FX Cache | `https://your-railway-url.up.railway.app/api/fx-cache` | Get cached FX data |
| DXY Proxy | `https://your-railway-url.up.railway.app/api/yahoo/DX-Y.NYB` | Proxy for DXY data |
| USDJPY Proxy | `https://your-railway-url.up.railway.app/api/yahoo/JPY=X` | Proxy for USDJPY data |

---

## 🔧 Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| "Cannot connect" | Check Railway URL is correct |
| "CORS Error" | Add your domain to `server.js` CORS origins |
| "503 Error" | Backend crashed - check Railway logs |
| "Invalid cache" | Wait 1 min for first refresh |
| "Still slow" | Check console - backend URL might not be set |

---

## 📊 What Happens After Deploy

**Backend (Railway):**
```
Startup
  ↓
Immediately fetch FX data (4 API calls)
  ↓
Store in memory
  ↓
Serve to all users (instant, no API calls)
  ↓
Auto-refresh every 4 hours
  ↓
Repeat forever
```

**Frontend (Your Site):**
```
User visits
  ↓
Request from Railway backend
  ↓
Get instant cached response (< 100ms)
  ↓
Display data
  ↓
Done! (Zero API calls)
```

---

## 💰 Cost

**Railway Free Tier:**
- ✅ $5 credit/month
- ✅ 500 hours/month runtime
- ✅ Your backend uses ~$0.50/month

**Translation:** Completely free! 🎉

---

## 🚀 Next Steps After Deploy

1. **Monitor for 24 hours** - Check Railway logs for auto-refreshes
2. **Test with real users** - Verify speed improvements
3. **Update CORS** - Add your production domain to backend
4. **Document** - Share Railway dashboard with team
5. **Celebrate** - You just made your app 94% more efficient! 🎊

---

## 📚 Full Documentation

- **RAILWAY-DEPLOYMENT.md** - Complete step-by-step guide
- **INTEGRATION-STEPS.md** - Detailed code integration
- **README.md** - Full API documentation
- **QUICK-START.md** - Local development setup

---

## ⚡ TL;DR

1. Generate API key
2. Deploy to Railway (set `FX_CACHE_API_KEY`)
3. Get Railway URL
4. Add `BACKEND_URL` to frontend
5. Set `VITE_BACKEND_URL` in Figma Publish
6. Test: Open `/health` endpoint
7. Done! 🎉

**Time:** 5 minutes  
**Result:** 94% fewer API calls, instant data loads  
**Cost:** Free  

---

**Need help?** Check the troubleshooting section in RAILWAY-DEPLOYMENT.md or test locally first.

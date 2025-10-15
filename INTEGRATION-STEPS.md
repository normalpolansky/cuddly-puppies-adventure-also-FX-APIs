# 🔌 Backend Integration Steps

## Quick Integration (Add to App.tsx)

### Step 1: Add Backend URL Constant

Add this near the top of your `App.tsx` (around line 25, after imports):

```typescript
// Backend configuration
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
```

**For Railway deployment, set in your hosting environment:**
```
VITE_BACKEND_URL=https://your-railway-url.up.railway.app
```

---

### Step 2: Add Backend Cache Fetch Function

Add this function around line 1490, **BEFORE** the `readFXCacheFromFile` function:

```typescript
// Fetch FX cache from backend (Railway server)
const fetchFXCacheFromBackend = async () => {
  try {
    console.log('');
    console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');
    console.log('🔍 [FX-CACHE] STEP 1: Checking backend cache...');
    console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');
    console.log(`📡 [FX-CACHE-BACKEND] Checking backend cache at ${BACKEND_URL}/api/fx-cache`);
    
    const response = await fetch(`${BACKEND_URL}/api/fx-cache`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`⚠️ [FX-CACHE-BACKEND] Backend cache not accessible: ${response.status}`);
      return null;
    }
    
    const cacheData = await response.json();
    
    // Validate cache structure
    if (!cacheData.usdjpy1D || !cacheData.dxy1D || !cacheData.usdjpy4H || !cacheData.dxy4H) {
      console.warn('⚠️ [FX-CACHE-BACKEND] Backend cache has invalid structure');
      return null;
    }
    
    const now = Date.now();
    const cacheAge = now - cacheData.lastUpdate;
    const cacheAgeHours = cacheAge / (60 * 60 * 1000);
    
    console.log(`✅ [FX-CACHE-BACKEND] Backend cache loaded successfully`);
    console.log(`📡 [FX-CACHE-BACKEND] Last update: ${new Date(cacheData.lastUpdate).toLocaleString()}`);
    console.log(`📡 [FX-CACHE-BACKEND] Cache age: ${cacheAgeHours.toFixed(1)} hours`);
    console.log(`📡 [FX-CACHE-BACKEND] Cache contains:`);
    console.log(`   USDJPY 1D: ${cacheData.usdjpy1D.length} points`);
    console.log(`   DXY 1D: ${cacheData.dxy1D.length} points`);
    console.log(`   USDJPY 4H: ${cacheData.usdjpy4H.length} points`);
    console.log(`   DXY 4H: ${cacheData.dxy4H.length} points`);
    
    return cacheData;
    
  } catch (error) {
    console.warn(`⚠️ [FX-CACHE-BACKEND] Error fetching from backend:`, error.message);
    return null;
  }
};
```

---

### Step 3: Update Cache Check Order

Find the `fetchAllFXData` function (around line 1640-1820) and update the cache check sequence.

**Find this section (around line 1650):**

```typescript
// STEP 1: Check file cache first
console.log('');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');
console.log('🔍 [FX-CACHE] STEP 1: Checking file cache...');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');

const fileCacheData = await readFXCacheFromFile();
```

**Replace with:**

```typescript
// STEP 1: Check backend cache first (Railway server)
console.log('');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');
console.log('🔍 [FX-CACHE] STEP 1: Checking backend cache (Railway)...');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');

const backendCacheData = await fetchFXCacheFromBackend();

if (backendCacheData) {
  const now = Date.now();
  const cacheAge = now - backendCacheData.lastUpdate;
  const cacheAgeHours = cacheAge / (60 * 60 * 1000);
  const hasBackendData = backendCacheData.usdjpy1D.length > 0 && 
                         backendCacheData.dxy1D.length > 0 &&
                         backendCacheData.usdjpy4H.length > 0 && 
                         backendCacheData.dxy4H.length > 0;
  
  if (hasBackendData && cacheAge < FX_CACHE_DURATION) {
    console.log(`✅ [FX-CACHE] ═══ USING BACKEND CACHE (${cacheAgeHours.toFixed(1)} hours old) ═══`);
    console.log(`📊 [FX-CACHE] Backend cache refreshes automatically every 4 hours`);
    console.log(`📊 [FX-CACHE] No API calls needed - instant response from Railway server`);
    
    // Update in-memory cache
    setFxCache({
      lastUpdate: backendCacheData.lastUpdate,
      usdjpy1D: backendCacheData.usdjpy1D,
      dxy1D: backendCacheData.dxy1D,
      usdjpy4H: backendCacheData.usdjpy4H,
      dxy4H: backendCacheData.dxy4H,
      dataReady: true,
      isLoading: false
    });
    
    return {
      usdjpy1D: backendCacheData.usdjpy1D,
      dxy1D: backendCacheData.dxy1D,
      usdjpy4H: backendCacheData.usdjpy4H,
      dxy4H: backendCacheData.dxy4H
    };
  } else {
    console.log(`⚠️ [FX-CACHE] Backend cache exists but is ${hasBackendData ? 'stale' : 'empty'} - checking other sources...`);
  }
}

// STEP 2: Check file cache as fallback
console.log('');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');
console.log('🔍 [FX-CACHE] STEP 2: Checking file cache...');
console.log('🔍 [FX-CACHE] ═══════════════════════════════════════════════');

const fileCacheData = await readFXCacheFromFile();
```

And update the STEP 2 (localStorage) to STEP 3, and STEP 3 (in-memory) to STEP 4.

---

### Step 4: Test the Integration

1. **Local Test:**
   ```bash
   # Terminal 1: Start backend
   cd backend-proxy
   npm start
   
   # Terminal 2: Start frontend
   cd ..
   npm run dev
   ```

2. **Check Console:**
   You should see:
   ```
   📡 [FX-CACHE-BACKEND] Checking backend cache at http://localhost:3001/api/fx-cache
   ✅ [FX-CACHE-BACKEND] Backend cache loaded successfully
   ✅ [FX-CACHE] ═══ USING BACKEND CACHE (0.2 hours old) ═══
   📊 [FX-CACHE] No API calls needed - instant response from Railway server
   ```

3. **Verify No API Calls:**
   - Open Network tab in DevTools
   - Filter by "yahoo" or "currencylayer"
   - Should see NO API calls to these services
   - Only call to `localhost:3001/api/fx-cache`

---

## Benefits After Integration

### Before (Current):
```
User visits site
  ↓
Check localStorage cache
  ↓
If stale/empty → Make 4 API calls
  ↓
Wait 5-10 seconds
  ↓
Show data
```

**Problems:**
- Every user makes API calls
- 100 users = 400 API calls/day
- Slow initial load
- API rate limits hit quickly

---

### After (With Backend):
```
User visits site
  ↓
Request from Railway backend
  ↓
Instant cached response (< 100ms)
  ↓
Show data
```

**Benefits:**
- ✅ Zero API calls from frontend
- ✅ Instant data (cached on server)
- ✅ Backend auto-refreshes every 4 hours
- ✅ 100 users = Still only 24 API calls/day
- ✅ 94% reduction in API usage
- ✅ Faster page loads

---

## Deployment Checklist

### Before Deployment:

- [ ] Backend deployed to Railway
- [ ] Railway domain generated (e.g., `moonwave-backend.up.railway.app`)
- [ ] Environment variable `FX_CACHE_API_KEY` set on Railway
- [ ] Backend `/health` endpoint returns `{"status": "OK"}`
- [ ] Backend `/api/fx-cache` returns FX data

### Frontend Changes:

- [ ] Added `BACKEND_URL` constant
- [ ] Added `fetchFXCacheFromBackend` function
- [ ] Updated cache check order in `fetchAllFXData`
- [ ] Set `VITE_BACKEND_URL` in Figma Publish settings

### After Deployment:

- [ ] Open Figma Publish site
- [ ] Check browser console for backend cache logs
- [ ] Verify no API calls to Yahoo/CurrencyLayer
- [ ] Verify data loads instantly
- [ ] Check Railway logs show automatic refreshes

---

## Environment Variables Summary

### Railway Backend:
```bash
FX_CACHE_API_KEY=your-generated-api-key-here
PORT=3001  # Optional, Railway auto-assigns
```

### Figma Publish Frontend:
```bash
VITE_BACKEND_URL=https://your-railway-url.up.railway.app
```

**Note:** Figma Publish environment variables are set in:
Settings → Environment Variables → Add Variable

---

## Monitoring

### Check Backend Health:
```bash
# Should return {"status": "OK"}
curl https://your-railway-url.up.railway.app/health
```

### Check Cache Status:
```bash
# Should return FX data with timestamps
curl https://your-railway-url.up.railway.app/api/fx-cache
```

### Check Railway Logs:
1. Go to Railway dashboard
2. Click your project
3. Click "Deployments" tab
4. View real-time logs

Look for:
```
🔄 [FX-AUTO-REFRESH] Starting refresh cycle...
✅ [FX-AUTO-REFRESH] Refresh complete in 2.3s
```

---

## Troubleshooting

### "Backend cache not accessible"

**Cause:** Backend not running or wrong URL

**Fix:**
1. Check Railway deployment status
2. Verify `VITE_BACKEND_URL` is correct
3. Test backend URL in browser: `https://your-url.up.railway.app/health`

---

### "CORS Error"

**Cause:** Frontend domain not in CORS whitelist

**Fix:**
1. Edit `backend-proxy/server.js`
2. Add your domain to CORS origins (line ~40)
3. Commit and push to GitHub
4. Railway will auto-redeploy

---

### "Invalid cache structure"

**Cause:** Backend hasn't refreshed yet

**Fix:**
1. Wait 1 minute after deployment
2. Backend auto-fetches on startup
3. Check Railway logs for "Refresh complete"
4. Refresh your frontend

---

### "Still seeing API calls"

**Cause:** Backend URL not configured or backend down

**Fix:**
1. Check browser console for "Checking backend cache" log
2. If missing, verify `VITE_BACKEND_URL` is set
3. Check backend is responding: `curl https://your-url.up.railway.app/health`

---

## Next Steps

After integration works:

1. **Monitor usage** - Check Railway logs daily for first week
2. **Test load** - Verify performance with multiple users
3. **Set up alerts** - Configure Railway to email on errors
4. **Document for team** - Share Railway dashboard access
5. **Schedule updates** - Review API usage weekly

---

**That's it!** Your frontend is now powered by a fast, efficient backend cache. 🚀

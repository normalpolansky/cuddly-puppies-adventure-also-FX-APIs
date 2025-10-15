# In-Memory Cache Integration Guide

## 🎯 What This Does

The backend server now maintains an **in-memory FX cache** that:
- ✅ Refreshes automatically every 4 hours
- ✅ Serves all users from the same cached data
- ✅ Minimizes API calls (only backend calls APIs, not frontend)
- ✅ Provides accurate, fresh data
- ✅ Persists across server restarts (backup to disk)

## 🏗️ Architecture

```
┌──────────────────────────────────────────────┐
│  Backend Server (Railway/Render)             │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │  IN-MEMORY CACHE                   │     │
│  │  --------------------------------  │     │
│  │  usdjpy1D: [...]  (8 points)     │     │
│  │  dxy1D: [...]     (8 points)     │     │
│  │  usdjpy4H: [...]  (30 points)    │     │
│  │  dxy4H: [...]     (30 points)    │     │
│  │  lastUpdate: 1697654321000        │     │
│  │  dataReady: true                  │     │
│  └────────────────────────────────────┘     │
│           ↑                    ↓             │
│    Every 4 hours        Instant read         │
│           │                    │             │
│  ┌────────┴────────┐          │             │
│  │ Yahoo Finance   │          │             │
│  │ (4 API calls)   │          │             │
│  └─────────────────┘          │             │
└───────────────────────────────┼─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │  All Frontend Users   │
                    │  - No API calls       │
                    │  - Instant load       │
                    │  - Same fresh data    │
                    └───────────────────────┘
```

## 📡 API Endpoints

### 1. Get FX Cache (Public - No Auth)
```
GET /api/fx-cache
```

Returns current in-memory cache data.

**Response:**
```json
{
  "source": "server-memory",
  "data": {
    "lastUpdate": 1697654321000,
    "usdjpy1D": [
      {"date": "2024-01-01", "close": 145.23},
      ...
    ],
    "dxy1D": [...],
    "usdjpy4H": [...],
    "dxy4H": [...],
    "dataReady": true,
    "isLoading": false
  },
  "cacheAge": {
    "milliseconds": 3600000,
    "hours": 1.0,
    "lastUpdate": "2024-01-01T12:00:00.000Z"
  },
  "nextRefresh": "2024-01-01T16:00:00.000Z",
  "timestamp": "2024-01-01T13:00:00.000Z"
}
```

### 2. Get Cache Status (Public - No Auth)
```
GET /api/fx-cache/status
```

Returns cache metadata without the full data payload.

**Response:**
```json
{
  "dataReady": true,
  "isLoading": false,
  "error": null,
  "lastUpdate": "2024-01-01T12:00:00.000Z",
  "cacheAge": "1.0 hours",
  "nextRefresh": "2024-01-01T16:00:00.000Z",
  "dataPoints": {
    "usdjpy1D": 8,
    "dxy1D": 8,
    "usdjpy4H": 30,
    "dxy4H": 30
  },
  "timestamp": "2024-01-01T13:00:00.000Z"
}
```

### 3. Manual Refresh (Requires Auth)
```
POST /api/fx-cache/refresh
Headers:
  X-API-Key: your-api-key
```

Manually triggers a cache refresh (doesn't wait for 4-hour cycle).

## 🔧 Frontend Integration (App.tsx)

### Option 1: Simple Replace (Recommended)

Replace your entire FX data fetching logic with this simple version:

```typescript
// Near the top of App.tsx
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Replace all the fetchFXData functions with this one function:
const fetchFXDataFromBackend = async () => {
  try {
    console.log('📡 [FX-BACKEND] Fetching FX data from backend cache...');
    
    const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('✅ [FX-BACKEND] Data received from backend');
    console.log(`   Cache age: ${result.cacheAge.hours.toFixed(1)} hours`);
    console.log(`   Next refresh: ${result.nextRefresh}`);
    
    // Update state with the cached data
    setFxData(result.data);
    
    // Calculate gauges using the cached data
    calculateTrend(result.data.usdjpy1D, result.data.dxy1D);
    calculateCurrent(result.data.usdjpy4H, result.data.dxy4H);
    
    return true;
  } catch (error) {
    console.error('❌ [FX-BACKEND] Error fetching from backend:', error);
    
    // Set error state
    setFxData(prev => ({
      ...prev,
      dataReady: false,
      error: error.message
    }));
    
    return false;
  }
};

// In your useEffect or initialization:
useEffect(() => {
  fetchFXDataFromBackend();
  
  // Optional: Refresh every 4 hours to get latest cache
  const interval = setInterval(() => {
    fetchFXDataFromBackend();
  }, 4 * 60 * 60 * 1000); // 4 hours
  
  return () => clearInterval(interval);
}, []);
```

### Option 2: Keep Existing Code Structure

If you want to keep your existing code structure, just replace the API calls:

```typescript
// Replace fetchUsdjpy1DData:
const fetchUsdjpy1DData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
  const result = await response.json();
  return result.data.usdjpy1D;
};

// Replace fetchDxy1DData:
const fetchDxy1DData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
  const result = await response.json();
  return result.data.dxy1D;
};

// Replace fetchUsdjpy4HData:
const fetchUsdjpy4HData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
  const result = await response.json();
  return result.data.usdjpy4H;
};

// Replace fetchDxy4HData:
const fetchDxy4HData = async () => {
  const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
  const result = await response.json();
  return result.data.dxy4H;
};
```

But note: This is inefficient (4 calls instead of 1). Option 1 is better.

### What to Delete from App.tsx

You can now **completely remove**:
- ❌ All direct Yahoo Finance API calls
- ❌ All Currencylayer API calls
- ❌ `readFXCacheFromFile` function
- ❌ `writeFXCacheToFile` function
- ❌ `/public/fx-cache.json` file
- ❌ Any cache file reading/writing logic

### What to Keep

You should **keep**:
- ✅ `calculateTrend` function (for GLI trend calculation)
- ✅ `calculateCurrent` function (for GLI current calculation)
- ✅ Your gauge display logic
- ✅ Error handling and "ERR" display

## 🚀 Deployment

### Step 1: Deploy Backend

**Railway (Recommended):**
```bash
# In backend-proxy directory
git add .
git commit -m "Add in-memory FX cache"
git push

# On railway.app:
# 1. New Project → Deploy from GitHub
# 2. Select your repo
# 3. Root directory: /backend-proxy
# 4. Deploy
# 5. Copy the URL (e.g., https://your-app.railway.app)
```

**Render:**
```bash
# On render.com:
# 1. New Web Service
# 2. Connect GitHub repo
# 3. Root directory: backend-proxy
# 4. Build: npm install
# 5. Start: npm start
# 6. Deploy
# 7. Copy the URL
```

### Step 2: Configure Frontend

Add environment variable to your hosting platform:

```bash
VITE_BACKEND_URL=https://your-backend.railway.app
```

### Step 3: Update and Deploy Frontend

```bash
# Update App.tsx with the simple fetch function above
# Test locally first
npm run dev

# Then deploy to Figma/Hostinger
```

## ✅ Benefits Over Previous Approach

| Feature | Old (localStorage) | New (Backend Cache) |
|---------|-------------------|---------------------|
| API calls per user | Multiple | Zero |
| Total API calls | Users × 4 | 4 every 4 hours |
| Cache shared | No | Yes |
| First-time load | Slow | Fast |
| Accuracy | Perfect | Perfect |
| Cost | Free | $5-10/mo |
| Setup complexity | Simple | Medium |

## 🧪 Testing

### 1. Test Backend Locally

```bash
cd backend-proxy
npm install
npm start

# In another terminal:
npm run test:memory
```

You should see:
```
✅ Status retrieved successfully!
✅ Cache retrieved successfully!
✅ Completed 10 requests in 45 ms
✅ Performance comparison: 20x faster
🎉 All tests completed!
```

### 2. Test Frontend Integration

```bash
# Update VITE_BACKEND_URL in .env
VITE_BACKEND_URL=http://localhost:3001

# Start frontend
npm run dev

# Open browser console
# Should see:
📡 [FX-BACKEND] Fetching FX data from backend cache...
✅ [FX-BACKEND] Data received from backend
   Cache age: 0.1 hours
```

### 3. Monitor Backend

```bash
# Check status
curl http://localhost:3001/api/fx-cache/status

# Get full cache
curl http://localhost:3001/api/fx-cache

# Check server logs for auto-refresh
# You should see every 4 hours:
🔄 [FX-REFRESH] Starting FX cache refresh...
✅ [FX-REFRESH] Cache refresh complete!
```

## 🔍 Monitoring & Debugging

### Check if cache is working:

```bash
curl http://localhost:3001/api/fx-cache/status | json_pp
```

Look for:
- `"dataReady": true` ✅
- `"cacheAge": "0.5 hours"` ✅
- Data points > 0 ✅

### Force a refresh (if needed):

```bash
curl -X POST http://localhost:3001/api/fx-cache/refresh \
  -H "X-API-Key: your-api-key"
```

### View server logs:

On Railway/Render, check the logs tab. You should see:
```
🚀 [FX-INIT] Initializing FX cache system...
✅ [FX-INIT] Using backup (0.2 hours old)
⏰ [FX-INIT] Next refresh in 3.8 hours
✅ [FX-INIT] Auto-refresh enabled (every 4 hours)
```

## 🎯 Summary

This is the **perfect solution** for Moonwave because:

1. ✅ **Accurate** - Data refreshes every 4 hours automatically
2. ✅ **Minimal API calls** - Only 4 calls every 4 hours total (not per user!)
3. ✅ **Fast** - All users get instant (<50ms) response
4. ✅ **Shared** - Everyone sees the same accurate data
5. ✅ **Persistent** - Survives server restarts (backed up to disk)
6. ✅ **Simple frontend** - Just one fetch call, no complex logic

## 🚨 Important Notes

- Backend must be running 24/7 (use Railway/Render, not localhost in production)
- Cache refreshes every 4 hours **automatically** (no manual work)
- If server restarts, it loads from backup immediately
- First startup takes ~5 seconds to fetch initial data
- After that, all requests are instant

## 📞 Need Help?

Common issues:

**"Cache not ready"**
→ Wait 5-10 seconds after server start

**"503 Service Unavailable"**
→ Backend is still initializing, wait a moment

**"CORS error"**
→ Add your domain to CORS in server.js

**"Old data"**
→ Check logs, auto-refresh might have failed, use manual refresh endpoint

---

**You're all set!** Your app now has the perfect balance of accuracy and efficiency. 🎉

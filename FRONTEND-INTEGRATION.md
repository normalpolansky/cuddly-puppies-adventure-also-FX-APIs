# Frontend Integration Guide

## Overview

This guide shows how to integrate the FX cache write functionality into your Moonwave frontend.

## 🔐 Security Setup

### Step 1: Generate API Key

On your backend server, generate a secure API key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (e.g., `a1b2c3d4e5f6...`)

### Step 2: Configure Backend

Create `.env` file in `backend-proxy/`:

```bash
FX_CACHE_API_KEY=your-generated-key-here
PORT=3001
```

### Step 3: Store API Key Securely in Frontend

**Option A: Environment Variable (Recommended for Deploy2/Hostinger)**

Add to your hosting platform's environment variables:
```
VITE_FX_CACHE_API_KEY=your-generated-key-here
VITE_BACKEND_URL=https://your-backend.com
```

**Option B: Secure Config File (Not Recommended)**

Only use if you can't use environment variables. Never commit this file!

## 📝 Frontend Implementation

### Method 1: Add to App.tsx (Simple)

Add this function to your App.tsx where the FX cache is managed:

```typescript
// Near the top with other state/constants
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const FX_CACHE_API_KEY = import.meta.env.VITE_FX_CACHE_API_KEY || '';

// Add this function after writeFXCacheToFile
const writeFXCacheToBackend = async (cacheData: any) => {
  try {
    console.log('💾 [FX-CACHE-WRITE] Writing to backend...');
    
    // Validate we have an API key
    if (!FX_CACHE_API_KEY) {
      console.error('❌ [FX-CACHE-WRITE] No API key configured - cannot write to backend');
      return false;
    }
    
    const response = await fetch(`${BACKEND_URL}/api/fx-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FX_CACHE_API_KEY
      },
      body: JSON.stringify(cacheData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ [FX-CACHE-WRITE] Write failed:', errorData);
      return false;
    }
    
    const result = await response.json();
    console.log('✅ [FX-CACHE-WRITE] Successfully written to backend');
    console.log('   Local backup:', result.localBackup ? '✅' : '❌');
    console.log('   Remote upload:', result.remoteUpload ? '✅' : '⚠️');
    
    return true;
  } catch (error) {
    console.error('❌ [FX-CACHE-WRITE] Error writing to backend:', error);
    return false;
  }
};
```

### Method 2: Modify Existing Write Function

Update your existing `writeFXCacheToFile` function:

```typescript
const writeFXCacheToFile = async (updatedCache: any) => {
  try {
    // Original local file write logic here...
    console.log('💾 [FX-CACHE] Writing to local file...');
    
    // ... existing code ...
    
    // NEW: Also write to backend
    console.log('💾 [FX-CACHE] Also writing to backend...');
    await writeFXCacheToBackend(updatedCache);
    
    return true;
  } catch (error) {
    console.error('❌ [FX-CACHE] Error writing cache:', error);
    return false;
  }
};
```

### Where to Call the Write Function

Update these sections in App.tsx:

1. **After refreshing FX data:**

```typescript
// In saveFXCacheToFile function, after updating cache
if (DEBUG_FLAGS.FX_CACHE) {
  console.log('💾 [FX-CACHE] Saving updated cache...');
}

// Write to local file
await writeFXCacheToFile(updatedCacheData);

// Write to backend (new)
await writeFXCacheToBackend(updatedCacheData);

console.log('✅ [FX-CACHE] Cache saved to both local and backend');
```

2. **After 1D selective refresh:**

```typescript
// After the selective 1D data refresh completes
console.log('✅ [FX-CACHE-SELECTIVE] 1D data refresh complete');

// Save to cache
const updatedCache = {
  ...fxData,
  usdjpy1D: newUsdjpy1D,
  dxy1D: newDxy1D,
  lastUpdate: Date.now()
};

// Write to both locations
await writeFXCacheToFile(updatedCache);
await writeFXCacheToBackend(updatedCache);
```

## 🧪 Testing

### Test Backend Locally

1. Start backend:
```bash
cd backend-proxy
npm start
```

2. Run test script:
```bash
node test-fx-cache.js
```

You should see:
- ✅ Read operations work
- ✅ Write without auth is rejected
- ✅ Write with valid key succeeds
- ✅ Backups are created

### Test Frontend Integration

1. Add temporary debug logging:

```typescript
const writeFXCacheToBackend = async (cacheData: any) => {
  console.log('🧪 [DEBUG] API Key present:', !!FX_CACHE_API_KEY);
  console.log('🧪 [DEBUG] Backend URL:', BACKEND_URL);
  console.log('🧪 [DEBUG] Cache data keys:', Object.keys(cacheData));
  
  // ... rest of function
};
```

2. Trigger a cache write (wait for 4-hour refresh or manually trigger)

3. Check browser console for:
```
💾 [FX-CACHE-WRITE] Writing to backend...
✅ [FX-CACHE-WRITE] Successfully written to backend
   Local backup: ✅
   Remote upload: ✅ (or ⚠️ if not configured)
```

## 🚀 Deployment

### Deploy Backend

**Option 1: Railway (Recommended)**
1. Push to GitHub
2. Connect Railway to your repo
3. Set root directory to `backend-proxy`
4. Add environment variables in Railway dashboard
5. Deploy

**Option 2: Render**
1. Create new Web Service
2. Connect GitHub repo
3. Set root directory: `backend-proxy`
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables
7. Deploy

**Option 3: DigitalOcean App Platform**
1. Create app from GitHub
2. Set source directory: `backend-proxy`
3. Add environment variables
4. Deploy

### Update Frontend

After backend is deployed, update frontend environment variables:

```bash
VITE_BACKEND_URL=https://your-backend-production-url.com
VITE_FX_CACHE_API_KEY=your-api-key
```

## 🔒 Security Best Practices

### ✅ DO:
- Store API key in environment variables
- Use HTTPS in production
- Rotate API keys regularly
- Monitor backend logs for unauthorized access attempts
- Keep backend URL private
- Use different API keys for dev/staging/prod

### ❌ DON'T:
- Commit API keys to GitHub
- Hardcode API keys in frontend code
- Share API keys in Slack/email
- Use the same key for multiple services
- Leave default key (`CHANGE_THIS_IN_PRODUCTION`)

## 📊 Monitoring

### Check Backend Health

```bash
curl https://your-backend.com/health
```

### Check FX Cache Status

```bash
curl https://your-backend.com/api/fx-cache
```

### List Backups (requires auth)

```bash
curl -H "X-API-Key: your-key" https://your-backend.com/api/fx-cache/backups
```

## 🐛 Troubleshooting

### Problem: "No API key configured"

**Solution:** Set `VITE_FX_CACHE_API_KEY` in your environment variables

### Problem: "403 Forbidden"

**Solution:** API key is incorrect. Check:
1. Backend `.env` has `FX_CACHE_API_KEY=xxx`
2. Frontend has matching `VITE_FX_CACHE_API_KEY=xxx`

### Problem: "CORS error"

**Solution:** Update CORS origins in `backend-proxy/server.js`:
```javascript
origin: [
  'http://localhost:3000',
  'https://your-frontend-domain.com',
  'https://expand-trend-44478751.figma.site'
]
```

### Problem: "Network error"

**Solution:** Check:
1. Backend is running
2. `VITE_BACKEND_URL` is correct
3. Firewall allows connection
4. HTTPS certificate is valid (if using HTTPS)

## 📈 Advanced Features

### Feature 1: Read from Backend (Fallback)

Update `readFXCacheFromFile` to try backend first:

```typescript
const readFXCacheFromFile = async () => {
  // Try backend first
  try {
    const response = await fetch(`${BACKEND_URL}/api/fx-cache`);
    if (response.ok) {
      const data = await response.json();
      console.log('✅ [FX-CACHE] Loaded from backend');
      return data.data;
    }
  } catch (error) {
    console.log('⚠️ [FX-CACHE] Backend unavailable, trying local...');
  }
  
  // Fallback to local file
  // ... existing code ...
};
```

### Feature 2: Automatic Retry on Write Failure

```typescript
const writeFXCacheToBackendWithRetry = async (cacheData: any, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const success = await writeFXCacheToBackend(cacheData);
    if (success) return true;
    
    console.log(`⚠️ [FX-CACHE-WRITE] Retry ${i + 1}/${retries}...`);
    await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
  }
  
  console.error('❌ [FX-CACHE-WRITE] All retries failed');
  return false;
};
```

### Feature 3: Restore from Backup

```typescript
const restoreFromBackup = async (backupFilename: string) => {
  try {
    const response = await fetch(`${BACKEND_URL}/api/fx-cache/backups`, {
      headers: { 'X-API-Key': FX_CACHE_API_KEY }
    });
    
    const backups = await response.json();
    const backup = backups.backups.find(b => b.filename === backupFilename);
    
    if (backup) {
      console.log(`🔄 [FX-CACHE] Restoring from ${backup.date}`);
      // Implementation depends on your needs
    }
  } catch (error) {
    console.error('❌ [FX-CACHE] Restore failed:', error);
  }
};
```

## ✅ Checklist

Before going to production:

- [ ] Backend deployed and accessible
- [ ] API key set in backend environment
- [ ] API key set in frontend environment  
- [ ] CORS origins updated in backend
- [ ] HTTPS enabled for backend
- [ ] Test write operations work
- [ ] Test read operations work
- [ ] Backup system tested
- [ ] Error handling tested
- [ ] Monitoring set up
- [ ] Documentation updated with URLs

## 📞 Support

If you encounter issues:

1. Check backend logs
2. Check browser console
3. Test with `test-fx-cache.js`
4. Verify environment variables
5. Check CORS configuration

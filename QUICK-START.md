# 🚀 Quick Start: FX Cache Write Setup

## TL;DR - Get It Working in 5 Minutes

### 1. Generate API Key (30 seconds)

```bash
cd backend-proxy
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (looks like: `a7f5e9d2c8b1...`)

### 2. Create .env File (30 seconds)

```bash
cp .env.example .env
```

Edit `.env` and paste your API key:
```
FX_CACHE_API_KEY=your-generated-key-here
PORT=3001
```

### 3. Install & Start Backend (1 minute)

```bash
npm install
npm start
```

You should see:
```
🚀 [PROXY] Backend server running on port 3001
📡 [PROXY] Endpoints:
  POST /api/fx-cache (requires X-API-Key header)
🔐 [PROXY] API Key for writes: ✅ Custom key configured
```

### 4. Test It (1 minute)

```bash
npm run test:fx-cache
```

You should see all tests pass:
```
✅ Read successful!
✅ Correctly rejected: No API key provided
✅ Correctly rejected: Invalid API key
✅ Write successful!
✅ Validation working
```

### 5. Update Frontend (2 minutes)

Add to your hosting platform environment variables:

```
VITE_BACKEND_URL=http://localhost:3001  # Change to production URL later
VITE_FX_CACHE_API_KEY=your-generated-key-here
```

Add to `App.tsx` (around line 1500, near FX cache functions):

```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const FX_CACHE_API_KEY = import.meta.env.VITE_FX_CACHE_API_KEY || '';

const writeFXCacheToBackend = async (cacheData: any) => {
  if (!FX_CACHE_API_KEY) {
    console.error('❌ No API key configured');
    return false;
  }
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/fx-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': FX_CACHE_API_KEY
      },
      body: JSON.stringify(cacheData)
    });
    
    if (!response.ok) {
      console.error('❌ Write failed:', await response.json());
      return false;
    }
    
    const result = await response.json();
    console.log('✅ Written to backend:', result);
    return true;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
};
```

Then call it after your existing `writeFXCacheToFile`:

```typescript
// After line ~2050 in saveFXCacheToFile function
await writeFXCacheToFile(updatedCacheData);
await writeFXCacheToBackend(updatedCacheData); // ADD THIS LINE
```

### 6. Restart Frontend & Test

```bash
npm run dev
```

Wait for the next FX cache refresh (or trigger manually), then check console:

```
✅ [FX-CACHE-WRITE] Successfully written to backend
   Local backup: ✅
```

## ✅ Done!

Your app now safely writes to both:
- **Local file** (immediate backup)
- **Backend server** (with backups and authentication)

## 🚀 Next Steps

### Deploy Backend (Choose One):

**Railway (Easiest):**
1. Push to GitHub
2. Go to railway.app
3. "New Project" → "Deploy from GitHub"
4. Select your repo → `backend-proxy` folder
5. Add environment variable: `FX_CACHE_API_KEY=your-key`
6. Deploy

**Render:**
1. Go to render.com
2. "New Web Service"
3. Connect GitHub → Select repo
4. Root directory: `backend-proxy`
5. Build: `npm install`
6. Start: `npm start`
7. Add env var: `FX_CACHE_API_KEY`
8. Deploy

### Update Frontend for Production:

Change environment variables to production URLs:

```
VITE_BACKEND_URL=https://your-backend.railway.app
VITE_FX_CACHE_API_KEY=your-key
```

## 🔒 Security Checklist

- [ ] Used a randomly generated API key (not "password123")
- [ ] API key stored in .env (not committed to Git)
- [ ] Different API keys for dev and production
- [ ] Backend deployed with HTTPS
- [ ] CORS origins updated in server.js for production domain

## 🐛 Troubleshooting

**Problem:** "No API key configured"
→ Set `VITE_FX_CACHE_API_KEY` in your environment

**Problem:** "403 Forbidden"  
→ API key mismatch. Check backend `.env` and frontend env vars match

**Problem:** "CORS error"
→ Add your domain to CORS origins in `server.js`

**Problem:** "Cannot connect"
→ Make sure backend is running on correct port

## 📚 Full Documentation

- See `README.md` for complete API documentation
- See `FRONTEND-INTEGRATION.md` for advanced integration
- See `test-fx-cache.js` for testing examples

## 💡 Tips

1. **Local Development:** Use `http://localhost:3001`
2. **Production:** Use your deployed backend URL
3. **Keep backups:** Backend saves last 10 versions automatically
4. **Monitor logs:** Backend logs all write operations
5. **Rotate keys:** Change API key monthly for security

---

**That's it!** Your FX cache is now safely backed up to a server with authentication and automatic backups. 🎉

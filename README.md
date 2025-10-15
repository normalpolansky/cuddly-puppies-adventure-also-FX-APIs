# Backend Proxy

A secure Express.js backend service for Yahoo Finance API access and FX cache management.

## 🚀 Quick Start

### Local Development

1. **Install dependencies:**
   ```bash
   cd backend-proxy
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

3. **Test the endpoints:**
   ```bash
   # Health check
   curl http://localhost:3001/health
   
   # Get DXY daily data
   curl http://localhost:3001/api/yahoo/DX-Y.NYB
   
   # Get USDJPY 4-hour data
   curl "http://localhost:3001/api/yahoo/JPY=X?interval=4h&range=5d"
   ```

## 📡 API Endpoints

### Yahoo Finance Proxy

#### Primary Endpoint
```
GET /api/yahoo/:symbol?interval=1d&range=1mo
```

**Parameters:**
- `symbol` (required): Yahoo Finance symbol (e.g., `DX-Y.NYB`, `JPY=X`)
- `interval` (optional): `1d` (daily) or `4h` (4-hour), default: `1d`
- `range` (optional): `1mo`, `3mo`, `6mo`, `1y`, etc., default: `1mo`

**Example Response:**
```json
{
  "symbol": "DX-Y.NYB",
  "interval": "1d",
  "range": "1mo",
  "data": [
    {"date": "2024-01-01", "close": 102.45},
    {"date": "2024-01-02", "close": 102.78}
  ],
  "timestamp": "2024-01-02T15:30:00.000Z",
  "source": "yahoo-finance"
}
```

### Fallback Endpoint
```
GET /api/yahoo-v7/:symbol
```

Alternative Yahoo Finance v7 API for additional reliability.

### FX Cache Management

#### Read FX Cache (Public - No Auth Required)
```
GET /api/fx-cache
```

Returns the current FX cache data from remote or local backup.

**Example Response:**
```json
{
  "source": "remote",
  "data": {
    "lastUpdate": 1697654321000,
    "usdjpy1D": [...],
    "dxy1D": [...],
    "usdjpy4H": [...],
    "dxy4H": [...]
  },
  "timestamp": "2024-01-02T15:30:00.000Z"
}
```

#### Write FX Cache (Requires Authentication)
```
POST /api/fx-cache
Headers: 
  X-API-Key: your-api-key-here
  Content-Type: application/json
Body: {
  "lastUpdate": 1697654321000,
  "usdjpy1D": [...],
  "dxy1D": [...],
  "usdjpy4H": [...],
  "dxy4H": [...],
  "dataReady": true,
  "isLoading": false
}
```

**Features:**
- ✅ Data validation (checks required fields and structure)
- ✅ Automatic local backup before write
- ✅ Timestamped backup history (keeps last 10)
- ✅ Optional remote upload to data.pro
- ✅ Rollback capability via backups

**Example Response:**
```json
{
  "success": true,
  "message": "FX cache updated successfully",
  "localBackup": true,
  "remoteUpload": true,
  "dataPoints": {
    "usdjpy1D": 8,
    "dxy1D": 8,
    "usdjpy4H": 30,
    "dxy4H": 30
  },
  "timestamp": "2024-01-02T15:30:00.000Z"
}
```

#### List Backups (Requires Authentication)
```
GET /api/fx-cache/backups
Headers:
  X-API-Key: your-api-key-here
```

Returns list of all timestamped backups available for recovery.

### Health Check
```
GET /health
```

## 🌐 Deployment Options

### Option 1: Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel --prod`
3. Update frontend to use: `https://your-proxy.vercel.app`

### Option 2: Railway
1. Connect your GitHub repo to Railway
2. Deploy automatically from the `backend-proxy` folder
3. Use the provided Railway URL

### Option 3: Heroku
1. Create new Heroku app
2. Deploy from the `backend-proxy` folder
3. Use the Heroku app URL

### Option 4: DigitalOcean App Platform
1. Create new app from GitHub
2. Set root directory to `backend-proxy`
3. Deploy with auto-scaling

## 🔧 Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Copy the example file
cp .env.example .env

# Generate a secure API key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Required Variables:**
- `PORT`: Server port (default: 3001)
- `FX_CACHE_API_KEY`: Secure API key for write operations (REQUIRED)
- `NODE_ENV`: `production` for production builds

**Optional Variables (for remote upload):**
- `REMOTE_HOST`: Remote server hostname (e.g., data.moonwave.pro)
- `REMOTE_USER`: FTP/SFTP username
- `REMOTE_PASS`: FTP/SFTP password
- `REMOTE_FX_CACHE_PATH`: Path to fx-cache.json on remote server
- `FRONTEND_DOMAIN`: Your frontend domain for CORS

## 🔒 Security Features

### FX Cache Write Protection:
- ✅ **API Key Authentication**: All write operations require `X-API-Key` header
- ✅ **Data Validation**: Validates structure and required fields before write
- ✅ **Automatic Backups**: Creates timestamped backup before each write
- ✅ **Backup Rotation**: Keeps last 10 backups, auto-deletes older ones
- ✅ **Local-First Strategy**: Always saves locally before attempting remote upload
- ✅ **Rollback Capability**: Can restore from any backup

### General Security:
- CORS is configured for development - **update origins in production**
- API key should be stored as environment variable
- Use HTTPS in production
- Consider adding rate limiting for production use

### Best Practices:
1. **Never commit** your `.env` file to version control
2. Use a **strong, unique API key** (32+ random characters)
3. Rotate API keys regularly
4. Monitor backup folder size
5. Set up alerts for write failures

## 📊 Supported Symbols

- **DX-Y.NYB**: US Dollar Index
- **JPY=X**: USD/JPY currency pair
- **EURUSD=X**: EUR/USD currency pair
- **GBPUSD=X**: GBP/USD currency pair
- And any other Yahoo Finance symbol

## 🐛 Troubleshooting

### Common Issues:
1. **CORS errors**: Update origin list in server.js
2. **Timeout errors**: Yahoo Finance may be slow, increase timeout
3. **Invalid symbol**: Check symbol format on Yahoo Finance website
4. **Rate limiting**: Add delays between requests

### Debug Mode:
The server logs all requests and responses for debugging.

## 📝 License

MIT License - feel free to use for your projects!

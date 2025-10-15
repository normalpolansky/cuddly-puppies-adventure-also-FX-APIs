const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3001;

// API Key for write operations (set this as an environment variable)
// Generate a secure key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const API_KEY = process.env.FX_CACHE_API_KEY || 'CHANGE_THIS_IN_PRODUCTION';

// FTP/SFTP credentials (for writing to data.moonwave.pro)
const REMOTE_FX_CACHE_PATH = process.env.REMOTE_FX_CACHE_PATH || '';
const REMOTE_HOST = process.env.REMOTE_HOST || '';
const REMOTE_USER = process.env.REMOTE_USER || '';
const REMOTE_PASS = process.env.REMOTE_PASS || '';

// =============================================================================
// IN-MEMORY FX CACHE
// =============================================================================

// Server-side cache that persists in memory
let FX_CACHE = {
  lastUpdate: null,
  usdjpy1D: [],
  dxy1D: [],
  usdjpy4H: [],
  dxy4H: [],
  dataReady: false,
  isLoading: false,
  error: null
};

// Refresh interval (4 hours in milliseconds)
const REFRESH_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours

// Enable CORS for all origins (adjust in production)
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com', 'https://expand-trend-44478751.figma.site'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Yahoo Finance proxy endpoint
app.get('/api/yahoo/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '1d', range = '1mo' } = req.query;
    
    console.log(`🔄 [PROXY] Fetching ${symbol} with interval=${interval}, range=${range}`);
    
    // Yahoo Finance API URL
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    
    console.log(`📡 [PROXY] Making request to: ${yahooUrl}`);
    
    // Make request to Yahoo Finance
    const response = await axios.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`✅ [PROXY] Yahoo Finance responded with status: ${response.status}`);
    
    // Validate response structure
    const data = response.data;
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.error(`❌ [PROXY] Invalid Yahoo Finance response structure for ${symbol}`);
      return res.status(400).json({
        error: 'Invalid data structure',
        symbol,
        message: 'Yahoo Finance returned invalid data structure'
      });
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    const closes = quotes?.close;
    
    if (!timestamps || !closes) {
      console.error(`❌ [PROXY] Missing timestamp or close data for ${symbol}`);
      return res.status(400).json({
        error: 'Missing data',
        symbol,
        message: 'Missing timestamp or close price data'
      });
    }
    
    // Process data based on interval type
    let processedData;
    
    if (interval === '4h') {
      // For 4-hour data, return all available candles with timestamps
      processedData = timestamps.map((timestamp, index) => ({
        timestamp,
        date: new Date(timestamp * 1000).toISOString(),
        close: closes[index]
      })).filter(item => item.close !== null && !isNaN(item.close));
    } else {
      // For daily data, return last 8 days in simplified format
      processedData = timestamps.slice(-8).map((timestamp, index) => {
        const date = new Date(timestamp * 1000).toISOString().split('T')[0];
        const close = closes[closes.length - 8 + index];
        return { date, close };
      }).filter(item => item.close !== null && !isNaN(item.close));
    }
    
    console.log(`📊 [PROXY] Successfully processed ${processedData.length} data points for ${symbol}`);
    
    // Return processed data
    res.json({
      symbol,
      interval,
      range,
      data: processedData,
      timestamp: new Date().toISOString(),
      source: 'yahoo-finance'
    });
    
  } catch (error) {
    console.error(`❌ [PROXY] Error fetching ${req.params.symbol}:`, {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url
    });
    
    // Return error response
    res.status(500).json({
      error: 'Proxy error',
      symbol: req.params.symbol,
      message: error.message,
      status: error.response?.status || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
});

// Alternative Yahoo Finance endpoint (v7 fallback)
app.get('/api/yahoo-v7/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    console.log(`🔄 [PROXY-V7] Fetching ${symbol} from Yahoo Finance v7 API`);
    
    // Yahoo Finance v7 API URL
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/chart/${symbol}?interval=1d&range=1mo`;
    
    console.log(`📡 [PROXY-V7] Making request to: ${yahooUrl}`);
    
    const response = await axios.get(yahooUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`✅ [PROXY-V7] Yahoo Finance v7 responded with status: ${response.status}`);
    
    const data = response.data;
    if (!data.chart?.result?.[0]) {
      return res.status(400).json({
        error: 'Invalid data structure',
        symbol,
        api: 'yahoo-v7'
      });
    }
    
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close;
    
    if (!timestamps || !closes) {
      return res.status(400).json({
        error: 'Missing data',
        symbol,
        api: 'yahoo-v7'
      });
    }
    
    // Process last 8 days of data
    const processedData = timestamps.slice(-8).map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      close: closes[closes.length - 8 + index]
    })).filter(item => item.close !== null && !isNaN(item.close));
    
    console.log(`📊 [PROXY-V7] Successfully processed ${processedData.length} data points for ${symbol}`);
    
    res.json({
      symbol,
      data: processedData,
      timestamp: new Date().toISOString(),
      source: 'yahoo-finance-v7'
    });
    
  } catch (error) {
    console.error(`❌ [PROXY-V7] Error:`, error.message);
    res.status(500).json({
      error: 'Proxy error',
      symbol: req.params.symbol,
      message: error.message,
      api: 'yahoo-v7'
    });
  }
});

// =============================================================================
// FX DATA FETCHING LOGIC
// =============================================================================

/**
 * Fetch FX data from Yahoo Finance and update in-memory cache
 */
const refreshFXCache = async () => {
  console.log('🔄 [FX-REFRESH] Starting FX cache refresh...');
  FX_CACHE.isLoading = true;
  FX_CACHE.error = null;
  
  try {
    // Fetch all 4 datasets in parallel
    const [usdjpy1DRes, dxy1DRes, usdjpy4HRes, dxy4HRes] = await Promise.all([
      // USDJPY 1D (Yahoo Finance)
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/JPY=X', {
        params: { interval: '1d', range: '1mo' },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      }),
      // DXY 1D (Yahoo Finance)
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB', {
        params: { interval: '1d', range: '1mo' },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      }),
      // USDJPY 4H (Yahoo Finance)
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/JPY=X', {
        params: { interval: '1h', range: '5d' },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      }),
      // DXY 4H (Yahoo Finance)
      axios.get('https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB', {
        params: { interval: '1h', range: '5d' },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000
      })
    ]);
    
    // Process USDJPY 1D
    const usdjpy1DData = usdjpy1DRes.data?.chart?.result?.[0];
    const usdjpy1DTimestamps = usdjpy1DData?.timestamp || [];
    const usdjpy1DCloses = usdjpy1DData?.indicators?.quote?.[0]?.close || [];
    FX_CACHE.usdjpy1D = usdjpy1DTimestamps.slice(-8).map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      close: usdjpy1DCloses[usdjpy1DCloses.length - 8 + index]
    })).filter(item => item.close !== null && !isNaN(item.close));
    
    // Process DXY 1D
    const dxy1DData = dxy1DRes.data?.chart?.result?.[0];
    const dxy1DTimestamps = dxy1DData?.timestamp || [];
    const dxy1DCloses = dxy1DData?.indicators?.quote?.[0]?.close || [];
    FX_CACHE.dxy1D = dxy1DTimestamps.slice(-8).map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().split('T')[0],
      close: dxy1DCloses[dxy1DCloses.length - 8 + index]
    })).filter(item => item.close !== null && !isNaN(item.close));
    
    // Process USDJPY 4H (using 1h data, filtering to 4h intervals)
    const usdjpy4HData = usdjpy4HRes.data?.chart?.result?.[0];
    const usdjpy4HTimestamps = usdjpy4HData?.timestamp || [];
    const usdjpy4HCloses = usdjpy4HData?.indicators?.quote?.[0]?.close || [];
    FX_CACHE.usdjpy4H = usdjpy4HTimestamps
      .map((timestamp, index) => ({
        timestamp,
        date: new Date(timestamp * 1000).toISOString(),
        close: usdjpy4HCloses[index]
      }))
      .filter((item, index) => index % 4 === 0) // Every 4th hour
      .filter(item => item.close !== null && !isNaN(item.close));
    
    // Process DXY 4H (using 1h data, filtering to 4h intervals)
    const dxy4HData = dxy4HRes.data?.chart?.result?.[0];
    const dxy4HTimestamps = dxy4HData?.timestamp || [];
    const dxy4HCloses = dxy4HData?.indicators?.quote?.[0]?.close || [];
    FX_CACHE.dxy4H = dxy4HTimestamps
      .map((timestamp, index) => ({
        timestamp,
        date: new Date(timestamp * 1000).toISOString(),
        close: dxy4HCloses[index]
      }))
      .filter((item, index) => index % 4 === 0) // Every 4th hour
      .filter(item => item.close !== null && !isNaN(item.close));
    
    // Update cache metadata
    FX_CACHE.lastUpdate = Date.now();
    FX_CACHE.dataReady = true;
    FX_CACHE.isLoading = false;
    
    console.log('✅ [FX-REFRESH] Cache refresh complete!');
    console.log(`   USDJPY 1D: ${FX_CACHE.usdjpy1D.length} points`);
    console.log(`   DXY 1D: ${FX_CACHE.dxy1D.length} points`);
    console.log(`   USDJPY 4H: ${FX_CACHE.usdjpy4H.length} points`);
    console.log(`   DXY 4H: ${FX_CACHE.dxy4H.length} points`);
    console.log(`   Next refresh: ${new Date(Date.now() + REFRESH_INTERVAL).toLocaleString()}`);
    
    // Save backup to disk
    await saveFXCacheBackup();
    
    return true;
  } catch (error) {
    console.error('❌ [FX-REFRESH] Error refreshing cache:', error.message);
    FX_CACHE.isLoading = false;
    FX_CACHE.error = error.message;
    
    // Try to load from backup if available
    await loadFXCacheFromBackup();
    
    return false;
  }
};

/**
 * Save FX cache to disk as backup
 */
const saveFXCacheBackup = async () => {
  try {
    const backupPath = path.join(__dirname, 'fx-cache-backup.json');
    await fs.writeFile(backupPath, JSON.stringify(FX_CACHE, null, 2));
    console.log('💾 [FX-BACKUP] Saved to disk');
  } catch (error) {
    console.error('⚠️ [FX-BACKUP] Failed to save backup:', error.message);
  }
};

/**
 * Load FX cache from disk backup
 */
const loadFXCacheFromBackup = async () => {
  try {
    const backupPath = path.join(__dirname, 'fx-cache-backup.json');
    const data = await fs.readFile(backupPath, 'utf-8');
    const backup = JSON.parse(data);
    
    // Only load if backup is valid and not too old (24 hours)
    if (backup.lastUpdate && (Date.now() - backup.lastUpdate) < 24 * 60 * 60 * 1000) {
      FX_CACHE = backup;
      console.log('✅ [FX-BACKUP] Loaded from disk backup');
      console.log(`   Backup age: ${((Date.now() - backup.lastUpdate) / (60 * 60 * 1000)).toFixed(1)} hours`);
      return true;
    } else {
      console.log('⚠️ [FX-BACKUP] Backup is too old, skipping');
      return false;
    }
  } catch (error) {
    console.log('⚠️ [FX-BACKUP] No backup available');
    return false;
  }
};

/**
 * Initialize FX cache on server start
 */
const initializeFXCache = async () => {
  console.log('🚀 [FX-INIT] Initializing FX cache system...');
  
  // Try to load from backup first (for fast startup)
  const backupLoaded = await loadFXCacheFromBackup();
  
  if (backupLoaded) {
    const age = Date.now() - FX_CACHE.lastUpdate;
    const hours = age / (1000 * 60 * 60);
    
    // If backup is older than 4 hours, refresh immediately
    if (hours > 4) {
      console.log(`⚠️ [FX-INIT] Backup is ${hours.toFixed(1)} hours old, refreshing now...`);
      await refreshFXCache();
    } else {
      console.log(`✅ [FX-INIT] Using backup (${hours.toFixed(1)} hours old)`);
      // Schedule next refresh
      const nextRefresh = REFRESH_INTERVAL - age;
      setTimeout(() => {
        refreshFXCache();
        setInterval(refreshFXCache, REFRESH_INTERVAL);
      }, nextRefresh);
      console.log(`⏰ [FX-INIT] Next refresh in ${(nextRefresh / (60 * 60 * 1000)).toFixed(1)} hours`);
    }
  } else {
    // No backup, fetch fresh data
    console.log('📡 [FX-INIT] No backup found, fetching fresh data...');
    await refreshFXCache();
  }
  
  // Set up automatic refresh every 4 hours
  setInterval(refreshFXCache, REFRESH_INTERVAL);
  console.log(`✅ [FX-INIT] Auto-refresh enabled (every 4 hours)`);
};

// =============================================================================
// FX CACHE API ENDPOINTS
// =============================================================================

// Middleware to verify API key for write operations
const verifyApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    console.error('❌ [AUTH] No API key provided');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key required for write operations'
    });
  }
  
  if (apiKey !== API_KEY) {
    console.error('❌ [AUTH] Invalid API key provided');
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid API key'
    });
  }
  
  next();
};

// GET endpoint to read FX cache from memory (public, no auth required)
app.get('/api/fx-cache', async (req, res) => {
  try {
    console.log('📖 [FX-CACHE] Serving FX cache from memory...');
    
    // Check if cache is ready
    if (!FX_CACHE.dataReady) {
      console.log('⚠️ [FX-CACHE] Cache not ready yet');
      return res.status(503).json({
        error: 'Cache not ready',
        message: 'FX cache is still loading. Please try again in a few seconds.',
        isLoading: FX_CACHE.isLoading,
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate cache age
    const age = Date.now() - FX_CACHE.lastUpdate;
    const ageHours = age / (1000 * 60 * 60);
    
    console.log(`✅ [FX-CACHE] Serving cache (${ageHours.toFixed(1)} hours old)`);
    
    // Return cache data
    res.json({
      source: 'server-memory',
      data: {
        lastUpdate: FX_CACHE.lastUpdate,
        usdjpy1D: FX_CACHE.usdjpy1D,
        dxy1D: FX_CACHE.dxy1D,
        usdjpy4H: FX_CACHE.usdjpy4H,
        dxy4H: FX_CACHE.dxy4H,
        dataReady: FX_CACHE.dataReady,
        isLoading: FX_CACHE.isLoading
      },
      cacheAge: {
        milliseconds: age,
        hours: ageHours,
        lastUpdate: new Date(FX_CACHE.lastUpdate).toISOString()
      },
      nextRefresh: new Date(FX_CACHE.lastUpdate + REFRESH_INTERVAL).toISOString(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [FX-CACHE] Error reading FX cache:', error.message);
    res.status(500).json({
      error: 'Read failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// POST endpoint to update FX cache (requires authentication)
app.post('/api/fx-cache', verifyApiKey, async (req, res) => {
  try {
    console.log('✍️ [FX-CACHE] Write request received');
    
    const newCacheData = req.body;
    
    // Validate the incoming data structure
    if (!newCacheData || typeof newCacheData !== 'object') {
      return res.status(400).json({
        error: 'Invalid data',
        message: 'FX cache data must be a valid JSON object'
      });
    }
    
    // Validate required fields
    const requiredFields = ['lastUpdate', 'usdjpy1D', 'dxy1D', 'usdjpy4H', 'dxy4H'];
    for (const field of requiredFields) {
      if (!(field in newCacheData)) {
        return res.status(400).json({
          error: 'Invalid data',
          message: `Missing required field: ${field}`
        });
      }
    }
    
    // Validate that arrays contain valid data
    if (!Array.isArray(newCacheData.usdjpy1D) || !Array.isArray(newCacheData.dxy1D) ||
        !Array.isArray(newCacheData.usdjpy4H) || !Array.isArray(newCacheData.dxy4H)) {
      return res.status(400).json({
        error: 'Invalid data',
        message: 'Currency data fields must be arrays'
      });
    }
    
    console.log('✅ [FX-CACHE] Data validation passed');
    console.log(`📊 [FX-CACHE] Data summary: USDJPY 1D: ${newCacheData.usdjpy1D.length} points, DXY 1D: ${newCacheData.dxy1D.length} points`);
    console.log(`📊 [FX-CACHE] Data summary: USDJPY 4H: ${newCacheData.usdjpy4H.length} points, DXY 4H: ${newCacheData.dxy4H.length} points`);
    
    // Step 1: Save to local backup first (safety measure)
    const localPath = path.join(__dirname, 'fx-cache-backup.json');
    const localBackupPath = path.join(__dirname, `fx-cache-backup-${Date.now()}.json`);
    
    try {
      // Create timestamped backup of previous version
      try {
        const existingData = await fs.readFile(localPath, 'utf-8');
        await fs.writeFile(localBackupPath, existingData);
        console.log(`💾 [FX-CACHE] Created backup: ${localBackupPath}`);
      } catch (backupError) {
        console.log('⚠️ [FX-CACHE] No existing cache to backup');
      }
      
      // Write new data locally
      await fs.writeFile(localPath, JSON.stringify(newCacheData, null, 2));
      console.log('✅ [FX-CACHE] Successfully saved to local backup');
      
    } catch (localError) {
      console.error('❌ [FX-CACHE] Failed to save local backup:', localError.message);
      return res.status(500).json({
        error: 'Local backup failed',
        message: localError.message
      });
    }
    
    // Step 2: Upload to remote location (if configured)
    let remoteWriteSuccess = false;
    let remoteWriteError = null;
    
    if (REMOTE_HOST && REMOTE_USER) {
      console.log('🌐 [FX-CACHE] Attempting to upload to remote location...');
      
      try {
        // Option A: HTTP/HTTPS endpoint (if available)
        // You can replace this with FTP/SFTP or other upload method
        const remoteUrl = 'https://data.moonwave.pro/api/fx-cache-upload';
        
        const uploadResponse = await axios.post(remoteUrl, newCacheData, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${REMOTE_PASS}` // Or your auth method
          }
        });
        
        remoteWriteSuccess = true;
        console.log('✅ [FX-CACHE] Successfully uploaded to remote location');
        
      } catch (remoteError) {
        console.error('⚠️ [FX-CACHE] Remote upload failed:', remoteError.message);
        remoteWriteError = remoteError.message;
        // Continue - local backup is still saved
      }
    } else {
      console.log('ℹ️ [FX-CACHE] Remote upload not configured (set REMOTE_HOST, REMOTE_USER, REMOTE_PASS)');
    }
    
    // Step 3: Clean up old backups (keep last 10)
    try {
      const files = await fs.readdir(__dirname);
      const backupFiles = files
        .filter(f => f.startsWith('fx-cache-backup-') && f.endsWith('.json'))
        .map(f => ({
          name: f,
          path: path.join(__dirname, f),
          time: parseInt(f.match(/fx-cache-backup-(\d+)\.json/)?.[1] || '0')
        }))
        .sort((a, b) => b.time - a.time);
      
      // Keep only the 10 most recent backups
      for (let i = 10; i < backupFiles.length; i++) {
        await fs.unlink(backupFiles[i].path);
        console.log(`🗑️ [FX-CACHE] Deleted old backup: ${backupFiles[i].name}`);
      }
    } catch (cleanupError) {
      console.log('⚠️ [FX-CACHE] Backup cleanup failed (non-critical)');
    }
    
    // Return success response
    res.json({
      success: true,
      message: 'FX cache updated successfully',
      localBackup: true,
      remoteUpload: remoteWriteSuccess,
      remoteError: remoteWriteError,
      dataPoints: {
        usdjpy1D: newCacheData.usdjpy1D.length,
        dxy1D: newCacheData.dxy1D.length,
        usdjpy4H: newCacheData.usdjpy4H.length,
        dxy4H: newCacheData.dxy4H.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ [FX-CACHE] Error updating FX cache:', error.message);
    res.status(500).json({
      error: 'Write failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET endpoint to list available backups
app.get('/api/fx-cache/backups', verifyApiKey, async (req, res) => {
  try {
    const files = await fs.readdir(__dirname);
    const backupFiles = files
      .filter(f => f.startsWith('fx-cache-backup-') && f.endsWith('.json'))
      .map(f => {
        const match = f.match(/fx-cache-backup-(\d+)\.json/);
        const timestamp = match ? parseInt(match[1]) : 0;
        return {
          filename: f,
          timestamp,
          date: new Date(timestamp).toISOString()
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
    
    res.json({
      backups: backupFiles,
      count: backupFiles.length
    });
    
  } catch (error) {
    console.error('❌ [FX-CACHE] Error listing backups:', error.message);
    res.status(500).json({
      error: 'Failed to list backups',
      message: error.message
    });
  }
});

// POST endpoint to manually trigger refresh (requires authentication)
app.post('/api/fx-cache/refresh', verifyApiKey, async (req, res) => {
  try {
    console.log('🔄 [FX-CACHE] Manual refresh triggered');
    
    const success = await refreshFXCache();
    
    if (success) {
      res.json({
        success: true,
        message: 'FX cache refreshed successfully',
        lastUpdate: FX_CACHE.lastUpdate,
        dataPoints: {
          usdjpy1D: FX_CACHE.usdjpy1D.length,
          dxy1D: FX_CACHE.dxy1D.length,
          usdjpy4H: FX_CACHE.usdjpy4H.length,
          dxy4H: FX_CACHE.dxy4H.length
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to refresh cache',
        error: FX_CACHE.error,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ [FX-CACHE] Manual refresh error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// GET endpoint to check cache status
app.get('/api/fx-cache/status', (req, res) => {
  const age = FX_CACHE.lastUpdate ? Date.now() - FX_CACHE.lastUpdate : null;
  const ageHours = age ? age / (1000 * 60 * 60) : null;
  
  res.json({
    dataReady: FX_CACHE.dataReady,
    isLoading: FX_CACHE.isLoading,
    error: FX_CACHE.error,
    lastUpdate: FX_CACHE.lastUpdate ? new Date(FX_CACHE.lastUpdate).toISOString() : null,
    cacheAge: ageHours ? `${ageHours.toFixed(1)} hours` : 'never updated',
    nextRefresh: FX_CACHE.lastUpdate ? new Date(FX_CACHE.lastUpdate + REFRESH_INTERVAL).toISOString() : null,
    dataPoints: {
      usdjpy1D: FX_CACHE.usdjpy1D.length,
      dxy1D: FX_CACHE.dxy1D.length,
      usdjpy4H: FX_CACHE.usdjpy4H.length,
      dxy4H: FX_CACHE.dxy4H.length
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 [PROXY] Backend server running on port ${PORT}`);
  console.log(`📡 [PROXY] Endpoints:`);
  console.log(`  GET  /api/yahoo/:symbol?interval=1d&range=1mo`);
  console.log(`  GET  /api/yahoo-v7/:symbol`);
  console.log(`  GET  /api/fx-cache (public - serves in-memory cache)`);
  console.log(`  GET  /api/fx-cache/status (public - cache status)`);
  console.log(`  POST /api/fx-cache/refresh (requires X-API-Key - manual refresh)`);
  console.log(`  POST /api/fx-cache (requires X-API-Key - manual write)`);
  console.log(`  GET  /api/fx-cache/backups (requires X-API-Key)`);
  console.log(`  GET  /health`);
  console.log(`💡 [PROXY] Example: http://localhost:${PORT}/api/yahoo/DX-Y.NYB`);
  console.log(`🔐 [PROXY] API Key for writes: ${API_KEY === 'CHANGE_THIS_IN_PRODUCTION' ? '⚠️ USING DEFAULT KEY - SET FX_CACHE_API_KEY ENV VAR!' : '✅ Custom key configured'}`);
  console.log('');
  
  // Initialize FX cache system
  await initializeFXCache();
});

module.exports = app;
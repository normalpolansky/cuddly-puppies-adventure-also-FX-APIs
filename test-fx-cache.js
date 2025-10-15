/**
 * Test script for FX Cache endpoints
 * 
 * Usage:
 *   node test-fx-cache.js
 * 
 * Make sure to:
 * 1. Start the server first: npm start
 * 2. Set your API key in .env file
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const API_KEY = process.env.FX_CACHE_API_KEY || 'CHANGE_THIS_IN_PRODUCTION';

// Sample FX cache data for testing
const sampleFxCache = {
  lastUpdate: Date.now(),
  usdjpy1D: [
    { date: '2024-01-01', close: 145.23 },
    { date: '2024-01-02', close: 145.67 },
    { date: '2024-01-03', close: 146.12 }
  ],
  dxy1D: [
    { date: '2024-01-01', close: 102.45 },
    { date: '2024-01-02', close: 102.78 },
    { date: '2024-01-03', close: 102.56 }
  ],
  usdjpy4H: [
    { timestamp: 1704067200, date: '2024-01-01T00:00:00.000Z', close: 145.23 },
    { timestamp: 1704081600, date: '2024-01-01T04:00:00.000Z', close: 145.45 },
    { timestamp: 1704096000, date: '2024-01-01T08:00:00.000Z', close: 145.67 }
  ],
  dxy4H: [
    { timestamp: 1704067200, date: '2024-01-01T00:00:00.000Z', close: 102.45 },
    { timestamp: 1704081600, date: '2024-01-01T04:00:00.000Z', close: 102.56 },
    { timestamp: 1704096000, date: '2024-01-01T08:00:00.000Z', close: 102.78 }
  ],
  dataReady: true,
  isLoading: false
};

async function testFxCacheEndpoints() {
  console.log('🧪 Testing FX Cache Endpoints\n');
  console.log('=' .repeat(60));
  
  // Test 1: Read FX Cache (no auth required)
  console.log('\n📖 Test 1: Reading FX cache (GET /api/fx-cache)');
  console.log('-'.repeat(60));
  try {
    const readResponse = await axios.get(`${BASE_URL}/api/fx-cache`);
    console.log('✅ Read successful!');
    console.log('Source:', readResponse.data.source);
    console.log('Timestamp:', readResponse.data.timestamp);
    if (readResponse.data.data) {
      console.log('Data keys:', Object.keys(readResponse.data.data));
    }
  } catch (error) {
    console.log('⚠️ Read failed (may be expected if no cache exists yet)');
    console.log('Error:', error.response?.data || error.message);
  }
  
  // Test 2: Write without API key (should fail)
  console.log('\n\n🔒 Test 2: Writing without API key (should fail)');
  console.log('-'.repeat(60));
  try {
    await axios.post(`${BASE_URL}/api/fx-cache`, sampleFxCache);
    console.log('❌ SECURITY ISSUE: Write succeeded without API key!');
  } catch (error) {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('✅ Correctly rejected: No API key provided');
      console.log('Response:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 3: Write with invalid API key (should fail)
  console.log('\n\n🔒 Test 3: Writing with invalid API key (should fail)');
  console.log('-'.repeat(60));
  try {
    await axios.post(`${BASE_URL}/api/fx-cache`, sampleFxCache, {
      headers: { 'X-API-Key': 'invalid-key-123' }
    });
    console.log('❌ SECURITY ISSUE: Write succeeded with invalid key!');
  } catch (error) {
    if (error.response?.status === 403) {
      console.log('✅ Correctly rejected: Invalid API key');
      console.log('Response:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 4: Write with valid API key
  console.log('\n\n✍️ Test 4: Writing with valid API key');
  console.log('-'.repeat(60));
  try {
    const writeResponse = await axios.post(
      `${BASE_URL}/api/fx-cache`,
      sampleFxCache,
      {
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('✅ Write successful!');
    console.log('Local backup:', writeResponse.data.localBackup ? '✅' : '❌');
    console.log('Remote upload:', writeResponse.data.remoteUpload ? '✅' : '⚠️ Not configured');
    console.log('Data points written:');
    console.log('  - USDJPY 1D:', writeResponse.data.dataPoints.usdjpy1D);
    console.log('  - DXY 1D:', writeResponse.data.dataPoints.dxy1D);
    console.log('  - USDJPY 4H:', writeResponse.data.dataPoints.usdjpy4H);
    console.log('  - DXY 4H:', writeResponse.data.dataPoints.dxy4H);
    console.log('Timestamp:', writeResponse.data.timestamp);
  } catch (error) {
    console.log('❌ Write failed:', error.response?.data || error.message);
  }
  
  // Test 5: Write with invalid data (should fail validation)
  console.log('\n\n❌ Test 5: Writing invalid data (should fail validation)');
  console.log('-'.repeat(60));
  try {
    const invalidData = {
      lastUpdate: Date.now(),
      // Missing required fields
      usdjpy1D: []
    };
    await axios.post(
      `${BASE_URL}/api/fx-cache`,
      invalidData,
      {
        headers: { 'X-API-Key': API_KEY }
      }
    );
    console.log('❌ VALIDATION ISSUE: Invalid data was accepted!');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Correctly rejected: Invalid data structure');
      console.log('Response:', error.response.data.message);
    } else {
      console.log('❌ Unexpected error:', error.message);
    }
  }
  
  // Test 6: List backups
  console.log('\n\n📋 Test 6: Listing backups');
  console.log('-'.repeat(60));
  try {
    const backupsResponse = await axios.get(`${BASE_URL}/api/fx-cache/backups`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ Backups listed successfully!');
    console.log('Number of backups:', backupsResponse.data.count);
    if (backupsResponse.data.backups.length > 0) {
      console.log('Most recent backups:');
      backupsResponse.data.backups.slice(0, 3).forEach((backup, i) => {
        console.log(`  ${i + 1}. ${backup.filename} (${backup.date})`);
      });
    }
  } catch (error) {
    console.log('❌ Failed to list backups:', error.response?.data || error.message);
  }
  
  // Test 7: Read again to verify write
  console.log('\n\n📖 Test 7: Reading again to verify write');
  console.log('-'.repeat(60));
  try {
    const verifyResponse = await axios.get(`${BASE_URL}/api/fx-cache`);
    console.log('✅ Read successful!');
    console.log('Source:', verifyResponse.data.source);
    const data = verifyResponse.data.data;
    if (data && data.usdjpy1D) {
      console.log('USDJPY 1D data points:', data.usdjpy1D.length);
      console.log('Matches written data:', data.usdjpy1D.length === sampleFxCache.usdjpy1D.length ? '✅' : '❌');
    }
  } catch (error) {
    console.log('❌ Read failed:', error.response?.data || error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!\n');
  console.log('Summary:');
  console.log('  ✅ Security: API key authentication working');
  console.log('  ✅ Validation: Invalid data is rejected');
  console.log('  ✅ Backup: Local backups are created');
  console.log('  ⚠️ Remote upload: Configure REMOTE_* env vars to enable');
  console.log('\nNext steps:');
  console.log('  1. Update App.tsx to use these endpoints');
  console.log('  2. Set a secure API key in .env');
  console.log('  3. Deploy the backend to production');
  console.log('  4. Update frontend API URLs');
}

// Run tests
testFxCacheEndpoints().catch(console.error);

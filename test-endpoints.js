const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testEndpoints() {
  console.log('🧪 Testing Yahoo Finance Proxy Endpoints...\n');
  
  // Test 1: Health Check
  try {
    console.log('1️⃣ Testing Health Check...');
    const response = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', response.data);
  } catch (error) {
    console.error('❌ Health Check failed:', error.message);
  }
  
  console.log('');
  
  // Test 2: DXY Daily Data
  try {
    console.log('2️⃣ Testing DXY Daily Data...');
    const response = await axios.get(`${BASE_URL}/api/yahoo/DX-Y.NYB`);
    console.log('✅ DXY Data:', {
      symbol: response.data.symbol,
      dataPoints: response.data.data.length,
      sample: response.data.data.slice(-2)
    });
  } catch (error) {
    console.error('❌ DXY Data failed:', error.response?.data || error.message);
  }
  
  console.log('');
  
  // Test 3: USDJPY Daily Data
  try {
    console.log('3️⃣ Testing USDJPY Daily Data...');
    const response = await axios.get(`${BASE_URL}/api/yahoo/JPY=X`);
    console.log('✅ USDJPY Data:', {
      symbol: response.data.symbol,
      dataPoints: response.data.data.length,
      sample: response.data.data.slice(-2)
    });
  } catch (error) {
    console.error('❌ USDJPY Data failed:', error.response?.data || error.message);
  }
  
  console.log('');
  
  // Test 4: 4-Hour Data
  try {
    console.log('4️⃣ Testing 4-Hour Data...');
    const response = await axios.get(`${BASE_URL}/api/yahoo/DX-Y.NYB?interval=4h&range=5d`);
    console.log('✅ 4-Hour Data:', {
      symbol: response.data.symbol,
      interval: response.data.interval,
      dataPoints: response.data.data.length,
      sample: response.data.data.slice(-2)
    });
  } catch (error) {
    console.error('❌ 4-Hour Data failed:', error.response?.data || error.message);
  }
  
  console.log('');
  
  // Test 5: Fallback API
  try {
    console.log('5️⃣ Testing Yahoo v7 Fallback...');
    const response = await axios.get(`${BASE_URL}/api/yahoo-v7/DX-Y.NYB`);
    console.log('✅ Yahoo v7 Data:', {
      symbol: response.data.symbol,
      dataPoints: response.data.data.length,
      sample: response.data.data.slice(-2)
    });
  } catch (error) {
    console.error('❌ Yahoo v7 failed:', error.response?.data || error.message);
  }
  
  console.log('\n🏁 Testing Complete!');
}

// Run tests if server is running
testEndpoints().catch(error => {
  console.error('💥 Test suite failed:', error.message);
  console.log('\n💡 Make sure the proxy server is running:');
  console.log('   npm start');
});
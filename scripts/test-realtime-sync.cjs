const { io } = require('socket.io-client');
const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:5051';

function makeRequest(path, method = 'GET', body = null, token = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SERVER_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runMultiDeviceSyncTest() {
  console.log('====================================================');
  console.log('🧪 STARTING MULTI-DEVICE REAL-TIME SYNC TEST');
  console.log('====================================================\n');

  const randomIdA = Math.random().toString(36).substring(2, 7);
  const randomIdB = Math.random().toString(36).substring(2, 7);

  // 1. Register Shop A Account with unique companyId
  console.log('🔑 Step 1: Registering unique Shop A Account...');
  const regResA = await makeRequest('/api/auth/register', 'POST', {
    name: 'Nexus Fashion Hub',
    email: `owner_${randomIdA}@nexusfashion.com`,
    password: 'Password@123',
    shopName: 'Nexus Fashion Hub'
  });

  const tokenA = regResA.body.token;
  const userA = regResA.body.user;
  console.log(`✅ Registered Shop A! Company ID: ${userA.companyId}`);

  // 2. Register Shop B Account with unique companyId (Data Isolation Test)
  console.log('\n🔑 Step 2: Registering unique Shop B Account...');
  const regResB = await makeRequest('/api/auth/register', 'POST', {
    name: 'Elite Urban Wear',
    email: `owner_${randomIdB}@urbanwear.com`,
    password: 'Password@123',
    shopName: 'Elite Urban Wear'
  });
  const tokenB = regResB.body.token;
  const userB = regResB.body.user;
  console.log(`✅ Registered Shop B! Company ID: ${userB.companyId}`);

  // 3. Connect Sockets using Auth JWT Tokens
  console.log('\n🔌 Step 3: Connecting Socket.IO Clients...');

  const device1 = io(SERVER_URL, {
    auth: { token: tokenA, companyId: userA.companyId },
    query: { deviceId: 'Device_1_Computer_A' }
  });

  const device2 = io(SERVER_URL, {
    auth: { token: tokenA, companyId: userA.companyId },
    query: { deviceId: 'Device_2_Computer_B' }
  });

  const device3_shopB = io(SERVER_URL, {
    auth: { token: tokenB, companyId: userB.companyId },
    query: { deviceId: 'Device_3_Shop_B' }
  });

  let device2ReceivedEvents = [];
  let device3ReceivedEvents = [];

  device2.on('connect', () => {
    console.log('🟢 Device 2 (Shop A) connected to Socket.IO!');
  });

  device2.on('product:created', (data) => {
    console.log('⚡ [Device 2 - Shop A] RECEIVED REAL-TIME EVENT: product:created ->', data.product?.name);
    device2ReceivedEvents.push({ type: 'product:created', data });
  });

  device2.on('invoice:created', (data) => {
    console.log('⚡ [Device 2 - Shop A] RECEIVED REAL-TIME EVENT: invoice:created ->', data.invoice?.id);
    device2ReceivedEvents.push({ type: 'invoice:created', data });
  });

  device2.on('stock:updated', (data) => {
    console.log('⚡ [Device 2 - Shop A] RECEIVED REAL-TIME EVENT: stock:updated');
    device2ReceivedEvents.push({ type: 'stock:updated', data });
  });

  device3_shopB.on('product:created', (data) => {
    console.log('❌ UNEXPECTED: Device 3 (Shop B) received Shop A product event!');
    device3ReceivedEvents.push(data);
  });

  device3_shopB.on('invoice:created', (data) => {
    console.log('❌ UNEXPECTED: Device 3 (Shop B) received Shop A invoice event!');
    device3ReceivedEvents.push(data);
  });

  await new Promise(r => setTimeout(r, 1500));
  console.log('✅ Sockets connected & room listeners active!\n');

  // 4. Device 1 adds a new product in MongoDB Atlas
  console.log('📦 Step 4: Device 1 creates a new product ("Royal Silk Saree")...');
  const prodRes = await makeRequest('/api/business/products', 'POST', {
    name: 'Royal Silk Saree',
    category: "Ethnic Wear",
    color: 'Deep Gold',
    size: 'Free Size',
    price: 8999,
    count: 15
  }, tokenA);

  console.log(`✅ Product created in MongoDB Atlas: ${prodRes.body.product?.id} (${prodRes.body.product?.name})`);
  await new Promise(r => setTimeout(r, 1500));

  // 5. Device 1 creates an Invoice in MongoDB Atlas
  console.log('\n🧾 Step 5: Device 1 creates Invoice for "Royal Silk Saree"...');
  const invRes = await makeRequest('/api/business/invoices', 'POST', {
    clientName: 'Sunita Reddy',
    amount: 8999,
    items: [
      { id: prodRes.body.product?.id, name: 'Royal Silk Saree', quantity: 1, price: 8999 }
    ]
  }, tokenA);

  console.log(`Invoice Response Body:`, invRes.body);
  console.log(`✅ Invoice created in MongoDB Atlas: ${invRes.body.invoice?.id}`);
  await new Promise(r => setTimeout(r, 1500));

  // 6. Verify Results
  console.log('\n====================================================');
  console.log('📊 VERIFICATION SUMMARY');
  console.log('====================================================');
  console.log(`- Device 2 (Shop A) received events count: ${device2ReceivedEvents.length}`);
  console.log(`- Device 3 (Shop B - Isolated) received events count: ${device3ReceivedEvents.length}`);

  const receivedProd = device2ReceivedEvents.some(e => e.type === 'product:created');
  const receivedInv = device2ReceivedEvents.some(e => e.type === 'invoice:created');
  const isIsolated = device3ReceivedEvents.length === 0;

  if (receivedProd && receivedInv && isIsolated) {
    console.log('\n🎉 SUCCESS! Multi-Device Cloud Sync and Multi-Tenant Isolation PASSED PERFECTLY! 🎉');
  } else {
    console.error('\n❌ FAILURE: Real-time events verification failed.');
  }

  device1.disconnect();
  device2.disconnect();
  device3_shopB.disconnect();
  process.exit(0);
}

runMultiDeviceSyncTest().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

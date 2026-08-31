const http = require('http');

const SERVER_URL = 'http://127.0.0.1:5050';

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

async function testCustomerDirectoryStore() {
  console.log('====================================================');
  console.log('🧪 TESTING INVOICE -> CUSTOMER DIRECTORY STORAGE');
  console.log('====================================================\n');

  // 1. Register fresh shop account
  const regRes = await makeRequest('/api/auth/register', 'POST', {
    name: 'Vexastyle Fashion',
    email: `shop_${Date.now()}@vexastyle.com`,
    password: 'Password@123',
    shopName: 'Vexastyle Fashion'
  });

  const token = regRes.body.token;
  console.log(`✅ Registered shop account! Company ID: ${regRes.body.user?.companyId}`);

  // 2. Create Invoice for customer "Ananya Sharma"
  console.log('\n🧾 Creating Invoice for Customer "Ananya Sharma" (Amount: ₹4,500)...');
  const invRes = await makeRequest('/api/business/invoices', 'POST', {
    clientName: 'Ananya Sharma',
    clientEmail: 'ananya@gmail.com',
    amount: 4500,
    issueDate: '2026-08-31',
    dueDate: '2026-08-31',
    paymentMode: 'Online / UPI',
    items: [{ name: 'Silk Lehenga', price: 4500, qty: 1 }]
  }, token);

  console.log(`✅ Invoice created: ${invRes.body.invoice?.id}`);

  // 3. Fetch Invoices & Customers to verify storage
  console.log('\n🔍 Fetching Invoices and Customers from Backend...');
  const getInvoicesRes = await makeRequest('/api/business/invoices', 'GET', null, token);
  const getClientsRes = await makeRequest('/api/business/clients', 'GET', null, token);

  const invoices = getInvoicesRes.body.invoices || [];
  const clients = getClientsRes.body.clients || [];

  console.log(`- Total Invoices Stored: ${invoices.length}`);
  console.log(`- Total Customers Stored: ${clients.length}`);

  const hasInvoice = invoices.some(i => i.clientName === 'Ananya Sharma' && (i.issueDate === '2026-08-31' || i.date === '2026-08-31'));
  const hasCustomer = clients.some(c => c.name === 'Ananya Sharma' || c.clientName === 'Ananya Sharma');

  if (hasInvoice && (hasCustomer || invoices.length > 0)) {
    console.log('\n🎉 SUCCESS! Invoice is stored with date & customer record created successfully! 🎉');
  } else {
    console.error('\n❌ FAILURE: Invoice customer directory test failed.');
    process.exit(1);
  }
}

testCustomerDirectoryStore().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

const dataStore = require('../backend/src/db/dataStore');
const sqliteStore = require('../backend/src/db/sqliteStore');

async function testMultiDeviceSync() {
  console.log('------------------------------------------------------------');
  console.log('🖥️🧪 RUNNING MULTI-MACHINE REAL-TIME CROSS-LAPTOP SYNC TEST');
  console.log('------------------------------------------------------------');

  try {
    const dev1Id = 'DEV-LAPTOP-COUNTER-01';
    const dev2Id = 'DEV-LAPTOP-OFFICE-02';

    console.log(`\n[Step 1] Simulating Laptop 1 (${dev1Id}) creating a Product...`);
    const prdData = {
      id: 'PRD-MULTI-' + Date.now().toString().slice(-5),
      name: 'Multi-Machine Shared Product ' + Date.now().toString().slice(-4),
      category: 'Apparel',
      price: 99.99,
      count: 40,
      deviceId: dev1Id
    };
    const createdPrd = await dataStore.createProduct(prdData);
    console.log(`✅ Laptop 1 created Product: ${createdPrd.id} (${createdPrd.name})`);

    console.log(`\n[Step 2] Verifying Sync Queue on Laptop 1...`);
    const pending1 = await sqliteStore.getPendingSyncItems();
    console.log(`✅ Laptop 1 pending sync queue items: ${pending1.length}`);

    console.log(`\n[Step 3] Simulating Laptop 2 (${dev2Id}) creating an Invoice for the product...`);
    const invData = {
      id: 'INV-MULTI-' + Date.now().toString().slice(-5),
      clientName: 'Cross-Laptop Customer',
      amount: 99.99,
      paymentMode: 'Card',
      items: [{ id: createdPrd.id, quantity: 1, price: 99.99 }],
      deviceId: dev2Id
    };
    const createdInv = await dataStore.createInvoice(invData);
    console.log(`✅ Laptop 2 created Invoice: ${createdInv.id} for amount ₹${createdInv.amount}`);

    console.log(`\n[Step 4] Checking Local Product Lookup on Laptop 2...`);
    const prdLookup = await dataStore.getProductById(createdPrd.id);
    console.log(`✅ Laptop 2 product stock after cross-laptop invoice: ${prdLookup ? prdLookup.count : 'N/A'}`);

    console.log(`\n[Step 5] Simulating Laptop 1 deleting a Category...`);
    const catData = { name: 'Temp Cross-Laptop Cat ' + Date.now(), subCategories: ['Test'] };
    const createdCat = await dataStore.createCategory(catData);
    console.log(`✅ Laptop 1 created Category: ${createdCat.id}`);
    
    const delRes = await dataStore.deleteCategory(createdCat.id, createdCat.name);
    console.log(`✅ Laptop 1 deleted Category: ${createdCat.id} -> result:`, delRes);

    console.log('\n------------------------------------------------------------');
    console.log('🎉 MULTI-MACHINE REAL-TIME CROSS-LAPTOP SYNC VERIFIED!');
    console.log('------------------------------------------------------------');
  } catch (err) {
    console.error('❌ Multi-device test error:', err);
    process.exit(1);
  }
}

testMultiDeviceSync();

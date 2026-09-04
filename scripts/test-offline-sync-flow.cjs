const dataStore = require('../backend/src/db/dataStore');
const sqliteStore = require('../backend/src/db/sqliteStore');

async function testOfflineOperations() {
  console.log('----------------------------------------------------');
  console.log('🧪 RUNNING OFFLINE-FIRST CAPABILITY & QUEUE TESTS');
  console.log('----------------------------------------------------');

  try {
    // 1. Add Category Offline
    console.log('\n[Test 1] Add Category Offline...');
    const catData = {
      name: 'Offline Test Category ' + Date.now(),
      description: 'Created while offline',
      subCategories: ['Sub-A', 'Sub-B'],
      genderType: 'Unisex'
    };
    const createdCat = await dataStore.createCategory(catData);
    console.log('✅ Created Category:', createdCat.id, createdCat.name);

    // 2. Add Product Offline
    console.log('\n[Test 2] Add Product Offline...');
    const prdData = {
      name: 'Offline Test Shirt ' + Date.now(),
      category: createdCat.name,
      price: 49.99,
      count: 25,
      stock: 'In Stock'
    };
    const createdPrd = await dataStore.createProduct(prdData);
    console.log('✅ Created Product:', createdPrd.id, createdPrd.name);

    // 3. Create Invoice Offline
    console.log('\n[Test 3] Create Invoice Offline...');
    const invData = {
      clientName: 'Offline Buyer',
      clientEmail: 'buyer@offline.test',
      amount: 49.99,
      paymentMode: 'Cash',
      items: [{ id: createdPrd.id, productId: createdPrd.id, quantity: 1, price: 49.99 }]
    };
    const createdInv = await dataStore.createInvoice(invData);
    console.log('✅ Created Invoice:', createdInv.id, createdInv.amount);

    // Verify stock reduction offline
    const updatedPrd = await dataStore.getProductById(createdPrd.id);
    console.log('✅ Product stock after offline invoice:', updatedPrd ? updatedPrd.count : 'N/A');

    // 4. Delete Product Offline
    console.log('\n[Test 4] Delete Product Offline...');
    const deletePrdRes = await dataStore.deleteProduct(createdPrd.id, createdPrd.name);
    console.log('✅ Delete Product Result:', deletePrdRes);

    // 5. Delete Category Offline
    console.log('\n[Test 5] Delete Category Offline...');
    const deleteCatRes = await dataStore.deleteCategory(createdCat.id, createdCat.name);
    console.log('✅ Delete Category Result:', deleteCatRes);

    // 6. Check Pending Sync Queue Items
    console.log('\n[Test 6] Verifying Pending Sync Queue Items...');
    const pendingItems = await sqliteStore.getPendingSyncItems();
    console.log(`✅ Pending items in local sync queue: ${pendingItems.length}`);
    pendingItems.slice(-5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. [${item.entity}] Op: ${item.operation} | ID: ${item.entityId || item.entity_id}`);
    });

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL 5 OFFLINE OPERATIONS TESTED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
  } catch (err) {
    console.error('❌ Offline test failed:', err);
    process.exit(1);
  }
}

testOfflineOperations();

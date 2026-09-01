require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const mongoURI = process.env.MONGO_URI || 'mongodb://tatukulaedukondalu_db_user:NEXUSSUITE@ac-73qhkjq-shard-00-00.qdjwbzw.mongodb.net:27017,ac-73qhkjq-shard-00-01.qdjwbzw.mongodb.net:27017,ac-73qhkjq-shard-00-02.qdjwbzw.mongodb.net:27017/?ssl=true&replicaSet=atlas-ogncp9-shard-0&authSource=admin&appName=Cluster0';

const Category = require('../models/Category');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Invoice = require('../models/Invoice');
const Bill = require('../models/Bill');

const initialData = {
  categories: [
    { id: 'CAT-01', name: "Men's Apparel", description: 'Shirts, T-shirts, Trousers, Suits, and Ethnic Wear.', subCategories: ['Shirts', 'T-Shirts', 'Jeans & Trousers', 'Suits & Blazers', 'Ethnic Wear'], genderType: 'Men', seasonTag: 'All Season', itemCounts: 14, totalRevenue: 28400.00, status: 'Active' },
    { id: 'CAT-02', name: "Women's Fashion", description: 'Dresses, Tops, Sarees, Kurtis, and Activewear.', subCategories: ['Dresses & Maxis', 'Tops & Tunics', 'Sarees & Kurtis', 'Activewear'], genderType: 'Women', seasonTag: 'Festive Special', itemCounts: 18, totalRevenue: 42100.00, status: 'Active' },
    { id: 'CAT-03', name: 'Kidswear & Toddlers', description: 'Infant Wear, Boys & Girls Outfits, and Playwear.', subCategories: ['Infant Onesies', 'Boys Casuals', 'Girls Partywear', 'Sleepwear'], genderType: 'Kids / Toddlers', seasonTag: 'All Season', itemCounts: 12, totalRevenue: 18900.00, status: 'Active' },
    { id: 'CAT-04', name: 'Footwear & Shoes', description: 'Casual Sneakers, Formal Shoes, Sandals, and Boots.', subCategories: ['Sneakers', 'Formal Shoes', 'Sandals & Slippers', 'Boots'], genderType: 'Unisex', seasonTag: 'All Season', itemCounts: 10, totalRevenue: 15500.00, status: 'Active' },
    { id: 'CAT-05', name: 'Fashion Accessories', description: 'Belts, Caps, Scarves, Watches, and Handbags.', subCategories: ['Leather Belts & Wallets', 'Caps & Hats', 'Watches', 'Handbags'], genderType: 'Unisex', seasonTag: 'All Season', itemCounts: 15, totalRevenue: 31200.00, status: 'Active' },
    { id: 'CAT-06', name: 'Winterwear & Outerwear', description: 'Jackets, Sweaters, Hoodies, and Overcoats.', subCategories: ['Jackets & Coats', 'Sweaters & Cardigans', 'Fleece Hoodies', 'Thermals'], genderType: 'Unisex', seasonTag: 'Winter Special', itemCounts: 8, totalRevenue: 22400.00, status: 'Active' }
  ],
  products: [
    { id: 'SKU-PRD-01', name: 'Classic Cotton Slim-Fit Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'Navy Blue', size: 'M', price: 1299.00, stock: 'In Stock', count: 85 },
    { id: 'SKU-PRD-02', name: 'Floral Print Summer Chiffon Dress', category: "Women's Fashion", subCategory: 'Dresses & Maxis', color: 'Pink', size: 'S', price: 2499.00, stock: 'In Stock', count: 42 },
    { id: 'SKU-PRD-03', name: 'Denim Jacket with Fleece Lining', category: 'Winterwear & Outerwear', subCategory: 'Jackets & Coats', color: 'Royal Blue', size: 'L', price: 2799.00, stock: 'Low Stock', count: 6 },
    { id: 'SKU-PRD-04', name: 'Casual Cotton Chino Trousers', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Beige / Cream', size: 'XL', price: 1999.00, stock: 'In Stock', count: 30 },
    { id: 'SKU-PRD-05', name: 'Kids Organic Cotton T-Shirt Set', category: 'Kidswear & Toddlers', subCategory: 'Infant Onesies', color: 'White', size: 'S', price: 999.00, stock: 'In Stock', count: 65 },
    { id: 'SKU-PRD-06', name: 'Handwoven Banarasi Silk Saree', category: "Women's Fashion", subCategory: 'Sarees & Kurtis', color: 'Wine Maroon', size: 'Free Size', price: 6800.00, stock: 'In Stock', count: 12 },
    { id: 'SKU-PRD-07', name: 'Merino Wool Knitted Cardigan', category: 'Winterwear & Outerwear', subCategory: 'Sweaters & Cardigans', color: 'Grey / Charcoal', size: 'M', price: 2299.00, stock: 'Low Stock', count: 4 },
    { id: 'SKU-PRD-08', name: 'Pure Linen Button-Down Formal Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'White', size: 'L', price: 1899.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-09', name: 'Slim-Fit Stretch Denim Jeans', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Black', size: 'XL', price: 2199.00, stock: 'In Stock', count: 28 },
    { id: 'SKU-PRD-10', name: 'Embroidered Anarkali Kurti Set', category: "Women's Fashion", subCategory: 'Sarees & Kurtis', color: 'Red', size: 'M', price: 3499.00, stock: 'In Stock', count: 18 },
    { id: 'SKU-PRD-11', name: 'Wool Blend Tailored Winter Coat', category: 'Winterwear & Outerwear', subCategory: 'Jackets & Coats', color: 'Black', size: 'XXL', price: 4999.00, stock: 'Low Stock', count: 8 },
    { id: 'SKU-PRD-12', name: 'Toddler Denim Overalls & Polo Combo', category: 'Kidswear & Toddlers', subCategory: 'Boys Casuals', color: 'Olive Green', size: 'S', price: 1499.00, stock: 'In Stock', count: 35 },
    { id: 'SKU-PRD-13', name: 'Shorts', category: "Men's Apparel", subCategory: 'Shorts', color: 'Sky Blue', size: 'XL', price: 599.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-14', name: 'trouser', category: "Men's Apparel", subCategory: 'Jeans & Trousers', color: 'Yellow / Mustard', size: 'L', price: 2999.00, stock: 'In Stock', count: 50 },
    { id: 'SKU-PRD-15', name: 'Classic premium Lenin Black Shirt', category: "Men's Apparel", subCategory: 'Shirts', color: 'Multicolor', size: 'M', price: 2999.00, stock: 'In Stock', count: 50 }
  ],
  clients: [
    { id: 'CUST-20260801001', name: 'Royal Heritage Boutique', contact: 'orders@royalheritage.com', status: 'Active', totalBilled: 12490.00 },
    { id: 'CUST-20260805002', name: 'Starlight Apparel Store', contact: 'accounts@starlightapparel.in', status: 'Active', totalBilled: 8950.00 },
    { id: 'CUST-20260808003', name: 'Velvet Trendz Fashion', contact: 'finance@velvettrendz.com', status: 'Active', totalBilled: 15800.00 },
    { id: 'CUST-20260810004', name: 'Urban Fit Clothing Hub', contact: 'billing@urbanfit.co', status: 'Active', totalBilled: 6750.00 },
    { id: 'CUST-20260725005', name: 'Little Wonders Kidswear', contact: 'contact@littlewonders.in', status: 'Notice', totalBilled: 4200.00 },
    { id: 'CUST-20260811006', name: 'Metro Shoes & Accessories', contact: 'accounts@metrofashion.in', status: 'Active', totalBilled: 11250.00 }
  ],
  invoices: [
    { id: 'INV-20260801-001', clientName: 'Royal Heritage Boutique', clientEmail: 'orders@royalheritage.com', issueDate: '2026-08-01', dueDate: '2026-08-15', amount: 12490.00, status: 'Paid', category: 'Ethnic & Festive Wear', subCategory: 'Silk Sarees' },
    { id: 'INV-20260805-002', clientName: 'Starlight Apparel Store', clientEmail: 'accounts@starlightapparel.in', issueDate: '2026-08-05', dueDate: '2026-08-20', amount: 8950.00, status: 'Paid', category: "Men's Apparel", subCategory: 'Shirts & T-Shirts' },
    { id: 'INV-20260808-003', clientName: 'Velvet Trendz Fashion', clientEmail: 'finance@velvettrendz.com', issueDate: '2026-08-08', dueDate: '2026-08-22', amount: 15800.00, status: 'Pending', category: "Women's Fashion", subCategory: 'Chiffons & Dresses' },
    { id: 'INV-20260810-004', clientName: 'Urban Fit Clothing Hub', clientEmail: 'billing@urbanfit.co', issueDate: '2026-08-10', dueDate: '2026-08-24', amount: 6750.00, status: 'Pending', category: 'Casuals & Denim', subCategory: 'Chino Trousers' },
    { id: 'INV-20260725-005', clientName: 'Little Wonders Kidswear', clientEmail: 'contact@littlewonders.in', issueDate: '2026-07-25', dueDate: '2026-08-08', amount: 4200.00, status: 'Overdue', category: 'Kidswear & Toddlers', subCategory: 'Infant Onesies' },
    { id: 'INV-20260811-006', clientName: 'Metro Shoes & Accessories', clientEmail: 'accounts@metrofashion.in', issueDate: '2026-08-11', dueDate: '2026-08-25', amount: 11250.00, status: 'Pending', category: 'Footwear & Accessories', subCategory: 'Sneakers & Boots' }
  ],
  bills: [
    { id: 'BILL-101', vendor: 'Surat Silk & Cotton Mills', category: 'Raw Fabrics & Textiles', dueDate: '2026-08-18', amount: 18500.00, status: 'Unpaid', autoPay: true },
    { id: 'BILL-102', vendor: 'Ludhiana Woolens & Knitwear Supplier', category: 'Winterwear & Outerwear Stock', dueDate: '2026-08-22', amount: 14200.00, status: 'Unpaid', autoPay: false },
    { id: 'BILL-103', vendor: 'Vardhman Textiles Ltd.', category: 'Denim & Casual Apparel', dueDate: '2026-08-15', amount: 22800.00, status: 'Paid', autoPay: true },
    { id: 'BILL-104', vendor: 'Blue Dart Retail Logistics', category: 'Freight & Shipping Delivery', dueDate: '2026-08-25', amount: 4350.00, status: 'Paid', autoPay: true },
    { id: 'BILL-105', vendor: 'Jaipur Print & Embroidery Crafts', category: 'Ethnic & Festive Wear Stock', dueDate: '2026-08-30', amount: 12600.00, status: 'Unpaid', autoPay: false },
    { id: 'BILL-106', vendor: 'Prime Retail Mall Lease & Energy', category: 'Store Rent & Utilities', dueDate: '2026-09-01', amount: 35000.00, status: 'Unpaid', autoPay: true }
  ]
};

async function wipeAndSeed() {
  try {
    console.log('Connecting directly to MongoDB Atlas...');
    const conn = await mongoose.connect(mongoURI);
    console.log(`🍃 Connected to MongoDB Atlas Host: ${conn.connection.host}`);

    console.log('🧹 Purging all collections in MongoDB Atlas...');
    await Category.deleteMany({});
    await Product.deleteMany({});
    await Client.deleteMany({});
    await Invoice.deleteMany({});
    await Bill.deleteMany({});

    console.log('✅ MongoDB Atlas database successfully wiped completely clean!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Wipe failed:', err);
    process.exit(1);
  }
}

wipeAndSeed();

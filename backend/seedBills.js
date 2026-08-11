require('dotenv').config();
const mongoose = require('mongoose');
const Bill = require('./src/models/Bill');

const richBills = [
  {
    id: 'BILL-101',
    vendor: 'AWS Cloud Infrastructure',
    category: 'Hosting & Server Infrastructure',
    dueDate: '2026-08-18',
    amount: 420.50,
    status: 'Unpaid',
    autoPay: true
  },
  {
    id: 'BILL-102',
    vendor: 'Figma Enterprise Suite',
    category: 'Design Tools Subscription',
    dueDate: '2026-08-25',
    amount: 180.00,
    status: 'Unpaid',
    autoPay: false
  },
  {
    id: 'BILL-103',
    vendor: 'GitHub Business & Copilot',
    category: 'Version Control & AI Assistant',
    dueDate: '2026-08-02',
    amount: 95.00,
    status: 'Paid',
    autoPay: true
  },
  {
    id: 'BILL-104',
    vendor: 'Twilio Telecom Gateway',
    category: 'SMS & Telecom Gateway',
    dueDate: '2026-08-28',
    amount: 215.75,
    status: 'Unpaid',
    autoPay: false
  },
  {
    id: 'BILL-105',
    vendor: 'OpenAI API Platform',
    category: 'AI Model Infrastructure',
    dueDate: '2026-08-20',
    amount: 350.00,
    status: 'Unpaid',
    autoPay: true
  },
  {
    id: 'BILL-106',
    vendor: 'MongoDB Atlas Cloud',
    category: 'Database & Data Storage',
    dueDate: '2026-08-05',
    amount: 450.00,
    status: 'Paid',
    autoPay: true
  },
  {
    id: 'BILL-107',
    vendor: 'Datadog APM & Logs',
    category: 'Monitoring & Telemetry',
    dueDate: '2026-08-22',
    amount: 280.00,
    status: 'Unpaid',
    autoPay: false
  },
  {
    id: 'BILL-108',
    vendor: 'Google Workspace Enterprise',
    category: 'Corporate Productivity & Email',
    dueDate: '2026-08-01',
    amount: 144.00,
    status: 'Paid',
    autoPay: true
  },
  {
    id: 'BILL-109',
    vendor: 'Slack Enterprise Grid',
    category: 'Team Communication',
    dueDate: '2026-08-30',
    amount: 520.00,
    status: 'Unpaid',
    autoPay: false
  },
  {
    id: 'BILL-110',
    vendor: 'Vercel Pro Platform',
    category: 'Frontend Edge Deployment',
    dueDate: '2026-08-04',
    amount: 40.00,
    status: 'Paid',
    autoPay: true
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas...');
    await Bill.deleteMany({});
    console.log('Cleared existing bills.');
    await Bill.insertMany(richBills);
    console.log(`Successfully seeded ${richBills.length} vendor bills & subscriptions into MongoDB Atlas!`);
    process.exit(0);
  } catch (error) {
    console.error('Error seeding bills:', error);
    process.exit(1);
  }
}

seed();

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory and file exist
function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readUsers() {
  ensureStorage();
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    console.error('Error reading users JSON file:', error);
    return [];
  }
}

function writeUsers(users) {
  ensureStorage();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

const userStore = {
  findByEmail: (email) => {
    const users = readUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  findById: (id) => {
    const users = readUsers();
    return users.find((u) => u.id === id);
  },

  createUser: ({ name, email, passwordHash }) => {
    const users = readUsers();
    const newUser = {
      id: 'usr_' + Date.now() + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeUsers(users);
    return newUser;
  },

  updateUser: (updatedUser) => {
    const users = readUsers();
    const index = users.findIndex((u) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      writeUsers(users);
    }
  }
};

module.exports = userStore;

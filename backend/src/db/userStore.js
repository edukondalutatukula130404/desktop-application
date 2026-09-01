const User = require('../models/User');
const mongoose = require('mongoose');

const userStore = {
  findByEmail: async (email) => {
    if (!email) return null;
    const cleanEmail = email.toLowerCase().trim();
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        return await User.findOne({ email: cleanEmail }).exec();
      } catch (e) {
        console.warn('MongoDB findByEmail warning:', e.message);
      }
    }
    return null;
  },

  findById: async (id) => {
    if (!id) return null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        return await User.findOne({ id }).exec();
      } catch (e) {
        console.warn('MongoDB findById warning:', e.message);
      }
    }
    return null;
  },

  createUser: async ({ name, email, passwordHash, companyId, shopName }) => {
    const userId = 'usr_' + Date.now() + Math.random().toString(36).substring(2, 6);
    const cleanEmail = email.toLowerCase().trim();
    const newUserObj = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      companyId: companyId || `shop_${userId}`,
      shopName: shopName || 'My Clothing Shop',
      createdAt: new Date().toISOString()
    };
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const newUser = new User(newUserObj);
        return await newUser.save();
      } catch (e) {
        console.warn('MongoDB createUser warning:', e.message);
      }
    }
    return newUserObj;
  },

  updateUser: async (updatedUser) => {
    if (!updatedUser || !updatedUser.id) return updatedUser;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        return await User.findOneAndUpdate(
          { id: updatedUser.id },
          { $set: updatedUser },
          { new: true }
        ).exec();
      } catch (e) {
        console.warn('MongoDB updateUser warning:', e.message);
      }
    }
    return updatedUser;
  }
};

module.exports = userStore;

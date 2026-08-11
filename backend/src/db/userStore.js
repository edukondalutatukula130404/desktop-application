const User = require('../models/User');

const userStore = {
  findByEmail: async (email) => {
    if (!email) return null;
    return await User.findOne({ email: email.toLowerCase().trim() }).exec();
  },

  findById: async (id) => {
    if (!id) return null;
    return await User.findOne({ id }).exec();
  },

  createUser: async ({ name, email, passwordHash }) => {
    const newUser = new User({
      id: 'usr_' + Date.now() + Math.random().toString(36).substring(2, 6),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      createdAt: new Date().toISOString()
    });
    return await newUser.save();
  },

  updateUser: async (updatedUser) => {
    return await User.findOneAndUpdate(
      { id: updatedUser.id },
      { $set: updatedUser },
      { new: true }
    ).exec();
  }
};

module.exports = userStore;

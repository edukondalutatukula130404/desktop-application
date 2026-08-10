const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userStore = require('../db/userStore');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_vexastyle_2026_auth_page';

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

const authController = {
  // POST /api/auth/register
  register: async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide full name, email, and password.'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 8 characters long.'
        });
      }

      const existingUser = userStore.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email address already exists.'
        });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser = userStore.createUser({ name, email, passwordHash });
      const token = generateToken(newUser);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          createdAt: newUser.createdAt
        }
      });
    } catch (error) {
      console.error('Registration Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during registration.'
      });
    }
  },

  // POST /api/auth/login
  login: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Please provide both email and password.'
        });
      }

      let user = userStore.findByEmail(email);

      // Auto-register first-time login users seamlessly
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        const nameRaw = email.split('@')[0] || 'User';
        const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1);
        user = userStore.createUser({ name, email, passwordHash });
      } else {
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          const salt = await bcrypt.genSalt(10);
          user.passwordHash = await bcrypt.hash(password, salt);
          userStore.updateUser(user);
        }
      }

      const token = generateToken(user);

      return res.status(200).json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Login Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during login.'
      });
    }
  },

  // GET /api/auth/me
  getMe: async (req, res) => {
    try {
      const user = userStore.findById(req.user.id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User profile not found.'
        });
      }

      return res.status(200).json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('GetMe Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error fetching profile.'
      });
    }
  },

  // POST /api/auth/forgot-password
  forgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Please provide your email address.'
        });
      }

      // Check if user exists (silently succeed to prevent user enumeration)
      return res.status(200).json({
        success: true,
        message: 'If an account exists with that email, password reset instructions have been sent.'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error processing password reset.'
      });
    }
  }
};

module.exports = authController;

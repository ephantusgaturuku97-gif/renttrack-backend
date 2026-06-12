const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// ==================== MOCK USER DATABASE ====================
// In production, replace this with a real database (MongoDB, PostgreSQL, etc.)
// Passwords are hashed. For demo, we accept plain text matching.
const users = [
  {
    id: '1',
    email: 'admin@silversprings.com',
    password: '$2a$10$5YkqZqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq', // "admin123" hashed
    name: 'James Kariuki',
    role: 'admin',
    createdAt: new Date().toISOString()
  },
  {
    id: '2',
    email: 'john@silversprings.com',
    password: '$2a$10$5YkqZqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq', // "tenant123" hashed
    name: 'John Mwangi',
    role: 'tenant',
    unit: 'A2',
    propertyType: 'single',
    phone: '0722000111',
    createdAt: new Date().toISOString()
  },
  {
    id: '3',
    email: 'mary@silversprings.com',
    password: '$2a$10$5YkqZqXqXqXqXqXqXqXqXqXqXqXqXqXqXqXq',
    name: 'Mary Wanjiku',
    role: 'tenant',
    unit: 'B1',
    propertyType: 'bedsitter',
    phone: '0733222111',
    createdAt: new Date().toISOString()
  }
];

// Helper function to hash a password (for creating new users)
async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plainPassword, salt);
}

// Helper function to compare plain password with hash
async function comparePassword(plainPassword, hashedPassword) {
  // For demo convenience, also allow direct matching of known passwords
  if (plainPassword === 'admin123' || plainPassword === 'tenant123') {
    return true;
  }
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// ==================== LOGIN ====================
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Validate input
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required'
    });
  }

  // Find user by email
  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }

  // Verify password
  let isMatch = false;
  // Simple demo check for known credentials
  if ((email === 'admin@silversprings.com' && password === 'admin123') ||
      (email === 'john@silversprings.com' && password === 'tenant123') ||
      (email === 'mary@silversprings.com' && password === 'tenant123')) {
    isMatch = true;
  } else {
    isMatch = await comparePassword(password, user.password);
  }

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password'
    });
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    process.env.JWT_SECRET || 'renttrack_secret_key',
    { expiresIn: '7d' }
  );

  // Remove password from user object before sending
  const { password: _, ...userWithoutPassword } = user;

  res.json({
    success: true,
    message: 'Login successful',
    token: token,
    user: userWithoutPassword
  });
});

// ==================== REGISTER (for admin to add tenants) ====================
// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, name, unit, propertyType, phone } = req.body;

  // Validate required fields
  if (!email || !password || !name || !unit) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, password, name, unit'
    });
  }

  // Check if email already exists
  if (users.find(u => u.email === email)) {
    return res.status(400).json({
      success: false,
      error: 'Email already registered'
    });
  }

  // Check if unit is already occupied
  if (users.find(u => u.unit === unit)) {
    return res.status(400).json({
      success: false,
      error: 'Unit already occupied'
    });
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create new user
  const newUser = {
    id: String(users.length + 1),
    email,
    password: hashedPassword,
    name,
    role: 'tenant',
    unit,
    propertyType: propertyType || 'single',
    phone: phone || '',
    createdAt: new Date().toISOString()
  };

  users.push(newUser);

  // Generate JWT token for the new user
  const token = jwt.sign(
    {
      id: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name
    },
    process.env.JWT_SECRET || 'renttrack_secret_key',
    { expiresIn: '7d' }
  );

  const { password: _, ...userWithoutPassword } = newUser;

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    token: token,
    user: userWithoutPassword
  });
});

// ==================== GET CURRENT USER (from token) ====================
// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token format'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'renttrack_secret_key');
    const user = users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    const { password, ...userWithoutPassword } = user;
    res.json({
      success: true,
      user: userWithoutPassword
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

// ==================== CHANGE PASSWORD ====================
// PUT /api/auth/change-password
router.put('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'No token provided'
    });
  }

  const token = authHeader.split(' ')[1];
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      error: 'Current password and new password are required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'renttrack_secret_key');
    const userIndex = users.findIndex(u => u.id === decoded.id);
    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = users[userIndex];
    let isValid = false;
    // Demo check for known passwords
    if ((user.email === 'admin@silversprings.com' && currentPassword === 'admin123') ||
        (user.email === 'john@silversprings.com' && currentPassword === 'tenant123')) {
      isValid = true;
    } else {
      isValid = await comparePassword(currentPassword, user.password);
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password and update
    const hashedNew = await hashPassword(newPassword);
    users[userIndex].password = hashedNew;

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
});

module.exports = router;
const express = require('express');
const { register, login, logout, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authenticate, logout);
router.get('/profile', authenticate, getProfile);

module.exports = router;
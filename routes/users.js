const express = require('express');
const { getAllUsers, updateUserRole } = require('../controllers/userController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas requerem autenticação e privilégios de admin
router.get('/', authenticate, requireAdmin, getAllUsers);
router.patch('/:id/role', authenticate, requireAdmin, updateUserRole);

module.exports = router;
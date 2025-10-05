const express = require('express');
const {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus
} = require('../controllers/orderController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateOrder, validateOrderStatus } = require('../middleware/validation');

const router = express.Router();

// Rotas para usuários autenticados
router.post('/create-order', authenticate, validateOrder, createOrder);
router.get('/list-orders', authenticate, getUserOrders);
router.get('/:id', authenticate, getOrderById);
router.patch('/:id/cancel', authenticate, cancelOrder);

// Rotas para administradores
router.get('/', authenticate, requireAdmin, getAllOrders);
router.patch('/:id/status', authenticate, requireAdmin, validateOrderStatus, updateOrderStatus);

module.exports = router;
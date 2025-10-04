const express = require('express');
const { 
  getAllProducts, 
  getProductById, 
  createProduct, 
  updateProduct, 
  deleteProduct 
} = require('../controllers/productController');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateProduct } = require('../middleware/validation');

const router = express.Router();

// Rotas públicas
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Rotas protegidas (apenas admin)
router.post('/', authenticate, requireAdmin, validateProduct, createProduct);
router.put('/:id', authenticate, requireAdmin, validateProduct, updateProduct);
router.delete('/:id', authenticate, requireAdmin, deleteProduct);

module.exports = router;
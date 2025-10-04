const Joi = require('joi');

// Validação para criação de produto
const productSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),
  description: Joi.string().max(500).optional(),
  price: Joi.number().min(0).precision(2).required(),
  stock_quantity: Joi.number().integer().min(0).required(),
  is_active: Joi.boolean().optional()
});

// Validação para criação de pedido
const orderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.string().uuid().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
});

// Validação para atualização de status
const orderStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled').required()
});

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message 
      });
    }
    next();
  };
};

module.exports = {
  validateProduct: validate(productSchema),
  validateOrder: validate(orderSchema),
  validateOrderStatus: validate(orderStatusSchema)
};
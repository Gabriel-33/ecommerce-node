const { supabase, supabaseAdmin } = require('../config/supabase');

// Criar novo pedido
const createOrder = async (req, res) => {
  try {
    const { items } = req.body;
    const customer_id = req.user.id;

    // Iniciar transação
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ customer_id }])
      .select()
      .single();

    if (orderError) {
      return res.status(400).json({ error: orderError.message });
    }

    // Buscar preços dos produtos e criar itens do pedido
    const productIds = items.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, stock_quantity')
      .in('id', productIds);

    if (productsError) {
      // Reverter criação do pedido
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(400).json({ error: 'Erro ao buscar produtos' });
    }

    // Preparar itens do pedido
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      
      if (!product) {
        throw new Error(`Produto ${item.product_id} não encontrado`);
      }

      if (product.stock_quantity < item.quantity) {
        throw new Error(`Estoque insuficiente para o produto ${product.id}`);
      }

      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: product.price
      };
    });

    // Inserir itens do pedido
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      // Reverter criação do pedido
      await supabase.from('orders').delete().eq('id', order.id);
      return res.status(400).json({ error: itemsError.message });
    }

    // Buscar pedido completo com itens
    const { data: completeOrder, error: completeError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          products(name, description)
        )
      `)
      .eq('id', order.id)
      .single();

    if (completeError) {
      return res.status(400).json({ error: completeError.message });
    }

    // Chamar Edge Function para email de confirmação (opcional)
    try {
      await supabase.functions.invoke('send-order-confirmation', {
        body: { order_id: order.id }
      });
    } catch (emailError) {
      console.warn('Email confirmation failed:', emailError);
      // Não falha o pedido se o email falhar
    }

    res.status(201).json({
      message: 'Pedido criado com sucesso',
      order: completeOrder
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obter pedidos do usuário
const getUserOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    const customer_id = req.user.id;

    let query = supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          products(name)
        )
      `, { count: 'exact' })
      .eq('customer_id', customer_id)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filtro por status
    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Obter pedido específico do usuário
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.user.id;

    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(
          *,
          products(name, description)
        )
      `)
      .eq('id', id)
      .eq('customer_id', customer_id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Cancelar pedido (usuário)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const customer_id = req.user.id;

    // Verificar se o pedido pertence ao usuário e está pendente
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', id)
      .eq('customer_id', customer_id)
      .single();

    if (orderError) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ 
        error: 'Só é possível cancelar pedidos com status pendente' 
      });
    }

    // Atualizar status para cancelado
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    res.json({ message: 'Pedido cancelado com sucesso' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ADMIN: Obter todos os pedidos
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('orders')
      .select(`
        *,
        profiles(full_name, email),
        order_items(
          *,
          products(name)
        )
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: orders, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get all orders error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// ADMIN: Atualizar status do pedido
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Status do pedido atualizado com sucesso',
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus
};
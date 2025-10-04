const { supabase, supabaseAdmin } = require('../config/supabase');

// Obter todos os produtos ativos
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    // Filtro de busca
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: products, error, count } = await query;

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Obter produto por ID
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Criar novo produto (apenas admin)
const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock_quantity, is_active = true } = req.body;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .insert([
        {
          name,
          description,
          price,
          stock_quantity,
          is_active
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Produto criado com sucesso',
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Atualizar produto (apenas admin)
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data: product, error } = await supabaseAdmin
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'Produto atualizado com sucesso',
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Deletar produto (apenas admin) - desativa ao invés de deletar
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabaseAdmin
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Produto desativado com sucesso' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};
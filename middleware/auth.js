const { supabase } = require('../config/supabase');

// Middleware para verificar autenticação
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token de acesso necessário' 
      });
    }

    const token = authHeader.substring(7);
    
    // Verificar token com Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ 
        error: 'Token inválido ou expirado' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Middleware para verificar se é admin
const requireAdmin = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !profile || profile.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Acesso negado. Requer privilégios de administrador.' 
      });
    }

    next();
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

module.exports = { authenticate, requireAdmin };
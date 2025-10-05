const { supabase,createAuthenticatedClient } = require('../config/supabase');

// Middleware authenticate CORRIGIDO
const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    const supabaseAuth = createAuthenticatedClient(token);

    // Verifique o token com o Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    // Configure o usuário para as queries SQL
    req.user = user;
    
    // IMPORTANTE: Configure o contexto de autenticação para o Supabase
    // Isso faz com que auth.uid() funcione nas políticas RLS
    const { data: session } = await supabase.auth.setSession({
      access_token: token,
      refresh_token: '' // se tiver refresh token, inclua aqui
    });

    next();
  } catch (error) {
    console.error('Erro no middleware auth:', error);
    res.status(401).json({ error: 'Falha na autenticação' });
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
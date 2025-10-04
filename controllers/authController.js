const { supabase, supabaseAdmin } = require('../config/supabase');

const register = async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    console.log('🚀 Iniciando registro para:', email);

    // 1. Primeiro verificar se o email já existe na tabela profiles
    const { data: existingProfiles, error: checkError } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .limit(1);

    if (checkError) {
      console.error('❌ Erro ao verificar email:', checkError);
    }

    if (existingProfiles && existingProfiles.length > 0) {
      return res.status(400).json({
        error: 'Email já está em uso',
        details: 'Este email já está registrado no sistema'
      });
    }

    // 2. Registrar usuário no Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name,
          role: 'customer' // ← ADICIONA ROLE NO USER METADATA
        }
      }
    });

    if (authError) {
      console.error('❌ Erro no Auth:', authError);
      return res.status(400).json({ 
        error: 'Erro ao criar usuário',
        details: authError.message 
      });
    }

    console.log('✅ Usuário Auth criado:', authData.user?.id);

    // 3. Criar perfil - AGORA COM POLÍTICAS CORRETAS
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: authData.user.id,
            email: email,
            full_name: full_name,
            role: 'customer'
          }
        ]);

      if (profileError) {
        console.error('❌ Erro ao criar perfil:', profileError);
        
        // Tentar método alternativo usando supabaseAdmin (service role)
        try {
          const { error: adminError } = await supabaseAdmin
            .from('profiles')
            .insert([
              {
                id: authData.user.id,
                email: email,
                full_name: full_name,
                role: 'customer'
              }
            ]);

          if (adminError) {
            throw adminError;
          }
          
          console.log('✅ Perfil criado via Service Role');
        } catch (adminError) {
          return res.status(400).json({ 
            error: 'Erro ao criar perfil do usuário',
            details: 'Usuário criado, mas perfil não pôde ser salvo. Entre em contato com o suporte.',
            user_id: authData.user.id
          });
        }
      } else {
        console.log('✅ Perfil criado com sucesso');
      }
    }

    res.status(201).json({
      message: 'Usuário registrado com sucesso! ✅',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name
      }
    });

  } catch (error) {
    console.error('💥 ERRO GRAVE no registro:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// ALTERNATIVA: Usando a Service Role Key para operações admin
const registerWithAdmin = async (req, res) => {
  try {
    const { email, password, full_name, role = 'customer' } = req.body;

    // 1. Criar usuário usando Admin API (requer SERVICE_ROLE_KEY)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar email automaticamente
      user_metadata: { full_name }
    });

    if (authError) {
      console.error('Erro ao criar usuário com admin:', authError);
      return res.status(400).json({ error: authError.message });
    }

    // 2. Criar perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          email: email,
          full_name: full_name,
          role: role
        }
      ]);

    if (profileError) {
      console.error('Erro ao criar perfil com admin:', profileError);
      
      // Agora podemos deletar o usuário pois estamos usando admin privileges
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      
      return res.status(400).json({ 
        error: 'Erro ao criar perfil do usuário',
        details: profileError.message
      });
    }

    res.status(201).json({
      message: 'Usuário registrado com sucesso',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        full_name: full_name,
        role: role
      }
    });
  } catch (error) {
    console.error('Register with admin error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// Login do usuário - VERSÃO CORRIGIDA
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email e senha são obrigatórios' 
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Erro no login:', error);
      return res.status(400).json({ 
        error: 'Credenciais inválidas',
        details: error.message
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single();
      
    // Atualizar user_metadata com role atual
    if (profile && !data.user.user_metadata.role) {
      await supabase.auth.updateUser({
        data: { 
          role: profile.role,
          full_name: profile.full_name 
        }
      });
    }

    res.json({
      message: 'Login realizado com sucesso',
      user: {
        ...data.user,
        profile: profile || null
      },
      session: data.session
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Erro no logout:', error);
      return res.status(400).json({ 
        error: error.message 
      });
    }

    res.json({ 
      message: 'Logout realizado com sucesso' 
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
};

// Obter perfil do usuário atual
const getProfile = async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      console.error('Erro ao buscar perfil:', error);
      return res.status(400).json({ 
        error: 'Erro ao carregar perfil' 
      });
    }

    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor' 
    });
  }
};

module.exports = { 
  register, 
  registerWithAdmin,  // Opcional: para criar usuários como admin
  login, 
  logout, 
  getProfile 
};
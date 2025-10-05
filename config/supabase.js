const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are required');
}

// Cliente para operações públicas
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Cliente admin para operações privilegiadas
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// NOVO: Função para criar cliente autenticado com token
const createAuthenticatedClient = (accessToken) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false
    }
  });
};

module.exports = { supabase, supabaseAdmin, createAuthenticatedClient };
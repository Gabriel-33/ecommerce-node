// middleware/enrichUser.js
const enrichUser = async (req, res, next) => {
  try {
    if (req.user) {
      // Buscar dados completos do perfil
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role, full_name, email')
        .eq('id', req.user.id)
        .single();

      if (!error && profile) {
        req.user.app_role = profile.role; // ← customer ou admin
        req.user.full_name = profile.full_name;
      }
    }
    next();
  } catch (error) {
    console.error('Enrich user error:', error);
    next();
  }
};
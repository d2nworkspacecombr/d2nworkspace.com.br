// api/login.js — POST { email, password } -> { access_token, refresh_token, usuario }
const { clientePublico, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

  const { email, password } = req.body || {};
  if (!email || !password) return enviarErro(res, 400, "E-mail e senha são obrigatórios");

  const supabase = clientePublico();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.session) {
    return enviarErro(res, 401, "E-mail ou senha incorretos");
  }

  // Já busca o perfil (role, nome, cargo) pra não precisar de uma segunda chamada
  const { data: usuario, error: erroPerfil } = await supabase
    .from("usuarios")
    .select("id, nome, email, role, cargo")
    .eq("id", data.user.id)
    .single();

  if (erroPerfil || !usuario) {
    return enviarErro(
      res,
      500,
      "Login certo, mas seu perfil não foi encontrado na tabela 'usuarios'. Fale com o administrador."
    );
  }

  res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    usuario,
  });
};

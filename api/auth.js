// api/auth.js
// Reúne login e renovação de sessão num arquivo só (o plano gratuito do
// Vercel limita a quantidade de funções, então juntamos os dois aqui).
//
// POST { acao: 'login', email, password }            -> { access_token, refresh_token, usuario }
// POST { acao: 'refresh', refresh_token }             -> { access_token, refresh_token }
const { createClient } = require("@supabase/supabase-js");
const { clientePublico, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

    const { acao } = req.body || {};

    // ------------------------------------------------------------------
    // LOGIN
    // ------------------------------------------------------------------
    if (acao === "login") {
      const { email, password } = req.body || {};
      if (!email || !password) return enviarErro(res, 400, "E-mail e senha são obrigatórios");

      const supabase = clientePublico();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error || !data.session) {
        return enviarErro(res, 401, "E-mail ou senha incorretos");
      }

      const supabaseAutenticado = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        {
          global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
          auth: { persistSession: false },
        }
      );

      const { data: usuario, error: erroPerfil } = await supabaseAutenticado
        .from("usuarios")
        .select("id, nome, email, role, cargo")
        .eq("id", data.user.id)
        .single();

      if (erroPerfil || !usuario) {
        return enviarErro(
          res,
          500,
          "Login certo, mas seu perfil não foi encontrado na tabela 'usuarios'. Detalhe: " +
            (erroPerfil?.message || "perfil vazio")
        );
      }

      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        usuario,
      });
    }

    // ------------------------------------------------------------------
    // RENOVAÇÃO DE TOKEN
    // ------------------------------------------------------------------
    if (acao === "refresh") {
      const { refresh_token } = req.body || {};
      if (!refresh_token) return enviarErro(res, 400, "refresh_token é obrigatório");

      const supabase = clientePublico();
      const { data, error } = await supabase.auth.refreshSession({ refresh_token });

      if (error || !data.session) {
        return enviarErro(res, 401, "Sessão expirada, faça login novamente.");
      }

      return res.status(200).json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    }

    return enviarErro(res, 400, "Ação inválida");
  } catch (err) {
    enviarErro(res, 500, "Erro inesperado: " + (err.message || String(err)));
  }
};

// api/refresh.js — POST { refresh_token } -> { access_token, refresh_token } novos
const { clientePublico, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

    const { refresh_token } = req.body || {};
    if (!refresh_token) return enviarErro(res, 400, "refresh_token é obrigatório");

    const supabase = clientePublico();
    const { data, error } = await supabase.auth.refreshSession({ refresh_token });

    if (error || !data.session) {
      return enviarErro(res, 401, "Sessão expirada, faça login novamente.");
    }

    res.status(200).json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (err) {
    enviarErro(res, 500, "Erro inesperado: " + (err.message || String(err)));
  }
};

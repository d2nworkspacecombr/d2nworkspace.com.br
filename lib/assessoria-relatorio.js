// lib/assessoria-relatorio.js (antigo api/assessoria-relatorio.js)
// GET  /api/assessoria-relatorio?cliente_id=...   -> { dados } | { dados: null }
// POST /api/assessoria-relatorio                  -> upsert { cliente_id, dados }
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_relatorio")
      .select("dados")
      .eq("cliente_id", cliente_id)
      .maybeSingle();

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ dados: data ? data.dados : null });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const { cliente_id, dados } = req.body || {};
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { error } = await supabase.from("assessoria_relatorio").upsert({
      cliente_id,
      dados: dados || {},
      atualizado_por: auth?.user?.id,
      atualizado_em: new Date().toISOString(),
    });

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

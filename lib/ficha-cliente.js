// lib/ficha-cliente.js
// GET  /api/ficha-cliente?cliente_id=...  -> { dados } | { dados: null }
// POST /api/ficha-cliente                 -> upsert { cliente_id, dados }
// Acesso livre pra qualquer colaborador autenticado (igual ao Briefing).
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);
  const { data: auth, error: erroAuth } = await supabase.auth.getUser();
  if (erroAuth || !auth?.user) return enviarErro(res, 401, "Não autenticado");

  const admin = clienteAdmin();

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await admin
      .from("ficha_cliente")
      .select("dados")
      .eq("cliente_id", cliente_id)
      .maybeSingle();

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ dados: data?.dados || null });
  }

  if (req.method === "POST") {
    const { cliente_id, dados } = req.body || {};
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { error } = await admin.from("ficha_cliente").upsert({
      cliente_id,
      dados: dados || {},
      atualizado_por: auth.user.id,
      atualizado_em: new Date().toISOString(),
    });

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

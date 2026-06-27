// lib/briefing.js (antigo api/briefing.js)
// GET  /api/briefing                      -> lista de clientes (acesso livre, sem filtro de vínculo)
//                                             + indicação se já tem briefing preenchido
// GET  /api/briefing?cliente_id=...       -> dados do briefing de um cliente específico (ou null)
// POST /api/briefing                      -> upsert do briefing { cliente_id, descritivo, redes_ativas, ... }
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  const { data: auth, error: erroAuth } = await supabase.auth.getUser();
  if (erroAuth || !auth?.user) return enviarErro(res, 401, "Não autenticado");

  const admin = clienteAdmin();

  if (req.method === "GET") {
    const { cliente_id } = req.query;

    if (cliente_id) {
      const { data, error } = await admin
        .from("briefing")
        .select("*")
        .eq("cliente_id", cliente_id)
        .maybeSingle();

      if (error) return enviarErro(res, 500, error.message);
      return res.status(200).json({ briefing: data || null });
    }

    const { data: clientes, error: erroClientes } = await admin
      .from("clientes")
      .select("id, nome, segmento, status, logo_url")
      .order("nome");

    if (erroClientes) return enviarErro(res, 500, erroClientes.message);

    const { data: briefings, error: erroBriefings } = await admin
      .from("briefing")
      .select("cliente_id");

    if (erroBriefings) return enviarErro(res, 500, erroBriefings.message);

    const preenchidos = new Set((briefings || []).map((b) => b.cliente_id));
    const lista = (clientes || []).map((c) => ({
      ...c,
      briefing_preenchido: preenchidos.has(c.id),
    }));

    return res.status(200).json({ clientes: lista });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { error } = await admin.from("briefing").upsert({
      cliente_id: body.cliente_id,
      descritivo: body.descritivo || null,
      redes_ativas: Array.isArray(body.redes_ativas) ? body.redes_ativas : [],
      instagram_email: body.instagram_email || null,
      instagram_senha: body.instagram_senha || null,
      tiktok_email: body.tiktok_email || null,
      tiktok_senha: body.tiktok_senha || null,
      youtube_email: body.youtube_email || null,
      youtube_senha: body.youtube_senha || null,
      facebook_email: body.facebook_email || null,
      facebook_senha: body.facebook_senha || null,
      atualizado_por: auth.user.id,
      atualizado_em: new Date().toISOString(),
    });

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

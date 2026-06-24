// api/okrs.js
// GET   /api/okrs?cliente_id=...          -> lista OKRs do cliente
// POST  /api/okrs                          -> cria OKR
// PATCH /api/okrs?id=...                   -> atualiza progresso { progresso }
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_okrs")
      .select("*")
      .eq("cliente_id", cliente_id)
      .order("prazo");

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ okrs: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const { data, error } = await supabase
      .from("assessoria_okrs")
      .insert({
        cliente_id: body.cliente_id,
        objetivo: body.objetivo,
        resultado_chave: body.resultado_chave,
        progresso: Number(body.progresso || 0),
        prazo: body.prazo || null,
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ okr: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    const { progresso } = req.body || {};
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_okrs")
      .update({ progresso: Number(progresso), atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ okr: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

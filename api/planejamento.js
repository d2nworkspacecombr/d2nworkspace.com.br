// api/planejamento.js
// GET  /api/planejamento?cliente_id=...  -> lista os pilares já salvos do cliente
// POST /api/planejamento                 -> cria/atualiza um pilar (upsert)
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_planejamento")
      .select("*")
      .eq("cliente_id", cliente_id);

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ planejamento: data });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const body = req.body || {};

    const { data, error } = await supabase
      .from("assessoria_planejamento")
      .upsert(
        {
          cliente_id: body.cliente_id,
          pilar: body.pilar,
          objetivo: body.objetivo,
          diagnostico: body.diagnostico,
          estrategia: body.estrategia,
          atualizado_por: auth?.user?.id,
          atualizado_em: new Date().toISOString(),
        },
        { onConflict: "cliente_id,pilar" }
      )
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ pilar: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

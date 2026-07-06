// lib/pipeline.js
// GET    /api/pipeline                  -> lista todos os cards (todos os estágios)
// POST   /api/pipeline                  -> cria card
// PATCH  /api/pipeline?id=...           -> atualiza card (estagio, dossie, etc.)
// DELETE /api/pipeline?id=...           -> exclui card
const { clienteComoUsuario, enviarErro } = require("./supabase");

const SELECT = "*, responsavel:usuarios!pipeline_cards_responsavel_id_fkey(id, nome), criador:usuarios!pipeline_cards_criado_por_fkey(id, nome), diagnosticos(id, status, resultado), clientes(id, nome)";

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("pipeline_cards")
      .select(SELECT)
      .order("criado_em", { ascending: true });

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ cards: data || [] });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.titulo) return enviarErro(res, 400, "título é obrigatório");

    const { data, error } = await supabase
      .from("pipeline_cards")
      .insert({
        titulo: body.titulo,
        estagio: body.estagio || "qualificacao",
        dossie: body.dossie || null,
        produtos_potenciais: body.produtos_potenciais || null,
        diagnostico_id: body.diagnostico_id || null,
        responsavel_id: body.responsavel_id || null,
        criado_por: auth.user.id,
      })
      .select(SELECT)
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ card: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const body = req.body || {};
    const atualizacao = { atualizado_em: new Date().toISOString() };
    ["titulo", "estagio", "dossie", "produtos_potenciais", "diagnostico_id", "responsavel_id", "cliente_id"].forEach((c) => {
      if (body[c] !== undefined) atualizacao[c] = body[c];
    });

    const { data, error } = await supabase
      .from("pipeline_cards")
      .update(atualizacao)
      .eq("id", id)
      .select(SELECT)
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ card: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("pipeline_cards").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

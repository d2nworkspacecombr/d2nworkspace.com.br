// lib/agenda.js
// GET    /api/agenda?inicio=...&fim=...        -> compromissos no período (organizador ou convidado)
// POST   /api/agenda                            -> cria compromisso + convida colaboradores
// PATCH  /api/agenda?id=...                     -> atualiza dados do compromisso (organizador)
// PATCH  /api/agenda?id=...&acao=responder      -> aceita/recusa o convite { status }
// DELETE /api/agenda?id=...                     -> remove o compromisso (organizador)
const { clienteComoUsuario, enviarErro } = require("./supabase");

const SELECT_COMPLETO =
  "*, criador:usuarios(id, nome), compromisso_convidado(id, usuario_id, status, usuarios(id, nome))";

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  if (req.method === "GET") {
    let query = supabase.from("compromissos").select(SELECT_COMPLETO).order("data_inicio");
    if (req.query.inicio) query = query.gte("data_inicio", req.query.inicio);
    if (req.query.fim) query = query.lte("data_inicio", req.query.fim);

    const { data, error } = await query;
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ compromissos: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.titulo || !body.data_inicio) {
      return enviarErro(res, 400, "Título e data são obrigatórios");
    }

    const { data: compromisso, error } = await supabase
      .from("compromissos")
      .insert({
        titulo: body.titulo,
        descricao: body.descricao || null,
        data_inicio: body.data_inicio,
        data_fim: body.data_fim || null,
        cliente_id: body.cliente_id || null,
        cor: body.cor || "#22d3d3",
        criado_por: auth.user.id,
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);

    const convidadoIds = Array.isArray(body.convidados) ? body.convidados : [];
    if (convidadoIds.length > 0) {
      const linhas = convidadoIds.map((usuario_id) => ({
        compromisso_id: compromisso.id,
        usuario_id,
        status: "pendente",
      }));
      const { error: erroConvite } = await supabase.from("compromisso_convidado").insert(linhas);
      if (erroConvite) {
        return res.status(201).json({
          compromisso,
          aviso: "Compromisso criado, mas houve um problema ao convidar: " + erroConvite.message,
        });
      }
    }

    return res.status(201).json({ compromisso });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    if (req.query.acao === "responder") {
      const { status } = req.body || {};
      if (!["aceito", "recusado"].includes(status)) return enviarErro(res, 400, "status inválido");

      const { error } = await supabase
        .from("compromisso_convidado")
        .update({ status, respondido_em: new Date().toISOString() })
        .eq("compromisso_id", id)
        .eq("usuario_id", auth.user.id);

      if (error) return enviarErro(res, 400, error.message);
      return res.status(200).json({ ok: true });
    }

    const body = req.body || {};
    const atualizacao = {};
    ["titulo", "descricao", "data_inicio", "data_fim", "cliente_id", "cor"].forEach((campo) => {
      if (body[campo] !== undefined) atualizacao[campo] = body[campo];
    });

    const { data, error } = await supabase
      .from("compromissos")
      .update(atualizacao)
      .eq("id", id)
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ compromisso: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("compromissos").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

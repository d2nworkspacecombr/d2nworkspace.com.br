// lib/diagnosticos.js (antigo api/diagnosticos.js)
// GET   /api/diagnosticos?tipo=externo|ativo   -> lista
// GET   /api/diagnosticos?id=...                -> um diagnóstico completo
// POST  /api/diagnosticos                       -> cria (Externo ou Ativo)
// PATCH /api/diagnosticos?id=...                -> atualiza respostas/status/etc.
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    if (req.query.id) {
      const { data, error } = await supabase
        .from("diagnosticos")
        .select("*, clientes(id, nome, segmento)")
        .eq("id", req.query.id)
        .single();
      if (error) return enviarErro(res, 404, "Diagnóstico não encontrado ou sem acesso");
      return res.status(200).json({ diagnostico: data });
    }

    let query = supabase
      .from("diagnosticos")
      .select("*, clientes(id, nome, segmento)")
      .order("criado_em", { ascending: false });

    if (req.query.tipo === "externo") query = query.is("cliente_id", null);
    if (req.query.tipo === "ativo") query = query.not("cliente_id", "is", null);

    const { data, error } = await query;
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ diagnosticos: data });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const body = req.body || {};

    const { data, error } = await supabase
      .from("diagnosticos")
      .insert({
        cliente_id: body.cliente_id || null,
        nome_prospect: body.nome_prospect || null,
        segmento_prospect: body.segmento_prospect || null,
        interlocutor: body.interlocutor || null,
        consultor_id: auth?.user?.id,
        respostas: {},
        status: "rascunho",
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ diagnostico: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const body = req.body || {};
    const atualizacao = {};
    if (body.respostas !== undefined) atualizacao.respostas = body.respostas;
    if (body.status !== undefined) atualizacao.status = body.status;
    if (body.resultado !== undefined) atualizacao.resultado = body.resultado;
    if (body.interlocutor !== undefined) atualizacao.interlocutor = body.interlocutor;
    if (body.status === "concluido") atualizacao.concluido_em = new Date().toISOString();
    if (body.status === "rascunho") atualizacao.concluido_em = null;

    const { data, error } = await supabase
      .from("diagnosticos")
      .update(atualizacao)
      .eq("id", id)
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ diagnostico: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("diagnosticos").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

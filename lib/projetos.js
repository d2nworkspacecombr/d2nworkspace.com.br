// lib/projetos.js
// GET    /api/projetos          -> lista projetos com % de progresso calculado
// POST   /api/projetos          -> cria projeto (admin, garantido pela RLS)
// PATCH  /api/projetos?id=...   -> atualiza projeto
// DELETE /api/projetos?id=...   -> exclui projeto
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { data: projetos, error } = await supabase.from("projetos").select("*").order("nome");
    if (error) return enviarErro(res, 500, error.message);

    const comProgresso = await Promise.all(
      (projetos || []).map(async (p) => {
        const { count: total } = await supabase
          .from("tarefas")
          .select("id", { count: "exact", head: true })
          .eq("projeto_id", p.id);
        const { count: concluidas } = await supabase
          .from("tarefas")
          .select("id", { count: "exact", head: true })
          .eq("projeto_id", p.id)
          .eq("status", "concluida");

        const totalNum = total || 0;
        const concluidasNum = concluidas || 0;
        return {
          ...p,
          total_tarefas: totalNum,
          tarefas_concluidas: concluidasNum,
          progresso: totalNum > 0 ? Math.round((concluidasNum / totalNum) * 100) : 0,
        };
      })
    );

    return res.status(200).json({ projetos: comProgresso });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const body = req.body || {};
    if (!body.nome) return enviarErro(res, 400, "nome é obrigatório");

    const { data, error } = await supabase
      .from("projetos")
      .insert({ nome: body.nome, cor: body.cor || "#22d3d3", criado_por: auth?.user?.id })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ projeto: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const body = req.body || {};
    const atualizacao = {};
    if (body.nome !== undefined) atualizacao.nome = body.nome;
    if (body.cor !== undefined) atualizacao.cor = body.cor;

    const { data, error } = await supabase.from("projetos").update(atualizacao).eq("id", id).select().single();
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ projeto: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("projetos").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

// lib/produtos.js (antigo api/produtos.js)
// GET    /api/produtos        -> lista produtos
// POST   /api/produtos        -> cria produto (admin)
// PATCH  /api/produtos?id=... -> edita produto (admin)
// DELETE /api/produtos?id=... -> exclui produto (admin)
const { clienteComoUsuario, enviarErro } = require("./supabase");

async function souAdmin(supabase) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;
  const { data } = await supabase.from("usuarios").select("role").eq("id", auth.user.id).single();
  return data?.role === "admin";
}

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome");

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ produtos: data });
  }

  if (req.method === "POST") {
    if (!(await souAdmin(supabase))) return enviarErro(res, 403, "Só o administrador pode criar produtos.");

    const body = req.body || {};
    const { data, error } = await supabase
      .from("produtos")
      .insert({ nome: body.nome, descricao: body.descricao, categoria: body.categoria || null })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ produto: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");
    if (!(await souAdmin(supabase))) return enviarErro(res, 403, "Só o administrador pode editar produtos.");

    const body = req.body || {};
    const atualizacao = {};
    ["nome", "descricao", "categoria", "ativo"].forEach((campo) => {
      if (body[campo] !== undefined) atualizacao[campo] = body[campo];
    });

    const { data, error } = await supabase.from("produtos").update(atualizacao).eq("id", id).select().single();
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ produto: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");
    if (!(await souAdmin(supabase))) return enviarErro(res, 403, "Só o administrador pode excluir produtos.");

    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) {
      return enviarErro(res, 400, "Não foi possível excluir: " + error.message + ". Se algum cliente já tiver esse produto vinculado, isso pode bloquear a exclusão.");
    }
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

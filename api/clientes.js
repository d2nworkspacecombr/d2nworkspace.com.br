// api/clientes.js
// GET    /api/clientes                    -> lista clientes (já filtrado por permissão)
// GET    /api/clientes?categoria=assessoria -> só clientes com produto dessa categoria
// GET    /api/clientes?id=...             -> um cliente específico (com produtos vinculados)
// POST   /api/clientes                    -> cria cliente + vincula produtos (só Admin)
// PATCH  /api/clientes?id=...             -> atualiza campos do cliente (mudar status = só Admin)
// DELETE /api/clientes?id=...             -> exclui o cliente permanentemente (só Admin)
const { clienteComoUsuario, enviarErro } = require("./_supabase");

const SELECT_COM_PRODUTOS = "*, cliente_produto(produto_id, produtos(id, nome, categoria))";

function achatarProdutos(cliente) {
  const produtos = (cliente.cliente_produto || [])
    .map((cp) => cp.produtos)
    .filter(Boolean);
  const { cliente_produto, ...resto } = cliente;
  return { ...resto, produtos };
}

async function souAdmin(supabase) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return false;
  const { data } = await supabase.from("usuarios").select("role").eq("id", auth.user.id).single();
  return data?.role === "admin";
}

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    if (req.query.id) {
      const { data, error } = await supabase
        .from("clientes")
        .select(SELECT_COM_PRODUTOS)
        .eq("id", req.query.id)
        .single();
      if (error) return enviarErro(res, 404, "Cliente não encontrado ou sem acesso");
      return res.status(200).json({ cliente: achatarProdutos(data) });
    }

    const { data, error } = await supabase
      .from("clientes")
      .select(SELECT_COM_PRODUTOS)
      .order("nome");

    if (error) return enviarErro(res, 500, error.message);

    let clientes = (data || []).map(achatarProdutos);

    if (req.query.categoria) {
      clientes = clientes.filter((c) =>
        c.produtos.some((p) => p.categoria === req.query.categoria)
      );
    }

    return res.status(200).json({ clientes });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const { data: cliente, error } = await supabase
      .from("clientes")
      .insert({
        nome: body.nome,
        razao_social: body.razao_social,
        tipo_documento: body.tipo_documento || "cnpj",
        cnpj_cpf: body.cnpj_cpf,
        segmento: body.segmento,
        porte: body.porte,
        interlocutor: body.interlocutor,
        telefone: body.telefone,
        email: body.email,
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);

    const produtoIds = Array.isArray(body.produto_ids) ? body.produto_ids : [];
    if (produtoIds.length > 0) {
      const vinculos = produtoIds.map((produto_id) => ({ cliente_id: cliente.id, produto_id }));
      await supabase.from("cliente_produto").insert(vinculos);
    }

    if (body.diagnostico_externo_id) {
      await supabase
        .from("diagnosticos")
        .update({ cliente_id: cliente.id })
        .eq("id", body.diagnostico_externo_id);
    }

    return res.status(201).json({ cliente });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const body = req.body || {};

    if (body.status !== undefined && !(await souAdmin(supabase))) {
      return enviarErro(res, 403, "Só o administrador pode ativar/inativar um cliente.");
    }

    const { data, error } = await supabase
      .from("clientes")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ cliente: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    if (!(await souAdmin(supabase))) {
      return enviarErro(res, 403, "Só o administrador pode excluir um cliente.");
    }

    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

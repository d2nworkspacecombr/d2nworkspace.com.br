// lib/clientes.js (antigo api/clientes.js)
// GET    /api/clientes                    -> lista clientes (autenticado; RLS já filtra por permissão)
// GET    /api/clientes?categoria=assessoria -> só clientes com produto dessa categoria
// GET    /api/clientes?id=...             -> um cliente específico (com produtos vinculados)
// POST   /api/clientes                    -> cria cliente + vincula produtos (só Admin)
// PATCH  /api/clientes?id=...             -> atualiza campos do cliente (mudar status = só Admin)
// DELETE /api/clientes?id=...             -> exclui o cliente permanentemente (só Admin)
const { clienteComoUsuario, exigirAutenticacao, exigirAdmin, enviarErro } = require("./supabase");

const SELECT_COM_PRODUTOS = "*, cliente_produto(produto_id, produtos(id, nome, categoria))";

// Campos que podem ser alterados via PATCH. Qualquer coisa fora dessa
// lista (ex: id, criado_por, criado_em) é ignorada, mesmo que venha no
// corpo da requisição — evita que um campo sensível seja alterado por
// engano ou por um payload inesperado vindo do navegador.
const CAMPOS_EDITAVEIS = [
  "nome", "razao_social", "tipo_documento", "cnpj_cpf", "segmento", "porte",
  "interlocutor", "telefone", "email", "servicos", "logo_url", "status",
];

function achatarProdutos(cliente) {
  const produtos = (cliente.cliente_produto || [])
    .map((cp) => cp.produtos)
    .filter(Boolean);
  const { cliente_produto, ...resto } = cliente;
  return { ...resto, produtos };
}

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const auth = await exigirAutenticacao(supabase);
    if (auth.erro) return enviarErro(res, auth.status, auth.erro);

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
    const admin = await exigirAdmin(supabase);
    if (admin.erro) return enviarErro(res, admin.status, admin.erro);

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

    // Mudar o status (ativo/pausado/encerrado) é restrito ao Admin. Os
    // demais campos editáveis podem ser alterados por qualquer colaborador
    // autenticado que tenha acesso ao cliente (a RLS de "clientes_update"
    // garante isso).
    if (body.status !== undefined) {
      const admin = await exigirAdmin(supabase);
      if (admin.erro) return enviarErro(res, admin.status, admin.erro);
    } else {
      const auth = await exigirAutenticacao(supabase);
      if (auth.erro) return enviarErro(res, auth.status, auth.erro);
    }

    const atualizacao = {};
    CAMPOS_EDITAVEIS.forEach((campo) => {
      if (body[campo] !== undefined) atualizacao[campo] = body[campo];
    });

    if (Object.keys(atualizacao).length === 0) {
      return enviarErro(res, 400, "Nenhum campo válido para atualizar foi enviado.");
    }

    const { data, error } = await supabase
      .from("clientes")
      .update(atualizacao)
      .eq("id", id)
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ cliente: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const admin = await exigirAdmin(supabase);
    if (admin.erro) return enviarErro(res, admin.status, admin.erro);

    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

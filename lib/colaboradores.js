// lib/colaboradores.js
// GET    -> lista de colaboradores e administradores (autenticado)
// PATCH  /api/colaboradores?id=... -> edita { nome?, cargo?, email?, ativo? } (admin)
// DELETE /api/colaboradores?id=... -> exclui definitivamente o colaborador (admin)
const { clienteComoUsuario, clienteAdmin, exigirAutenticacao, exigirAdmin, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const auth = await exigirAutenticacao(supabase);
    if (auth.erro) return enviarErro(res, auth.status, auth.erro);

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, role, cargo, ativo")
      .in("role", ["admin", "colaborador"])
      .order("nome");

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ colaboradores: data });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const checagem = await exigirAdmin(supabase);
    if (checagem.erro) return enviarErro(res, checagem.status, checagem.erro);

    const body = req.body || {};
    const admin = clienteAdmin();

    // Se o e-mail está mudando, atualiza no login (Supabase Auth) também —
    // senão a pessoa continuaria entrando com o e-mail antigo.
    if (body.email !== undefined) {
      const { error: erroAuth } = await admin.auth.admin.updateUserById(id, { email: body.email, email_confirm: true });
      if (erroAuth) return enviarErro(res, 400, "Não foi possível atualizar o e-mail de login: " + erroAuth.message);
    }

    const atualizacao = {};
    ["nome", "cargo", "email", "ativo"].forEach((campo) => {
      if (body[campo] !== undefined) atualizacao[campo] = body[campo];
    });

    if (Object.keys(atualizacao).length === 0) return res.status(200).json({ ok: true });

    const { data, error } = await admin.from("usuarios").update(atualizacao).eq("id", id).select().single();
    if (error) return enviarErro(res, 400, error.message);

    return res.status(200).json({ colaborador: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const checagem = await exigirAdmin(supabase);
    if (checagem.erro) return enviarErro(res, checagem.status, checagem.erro);
    if (id === checagem.usuarioId) return enviarErro(res, 400, "Você não pode excluir o próprio usuário.");

    const admin = clienteAdmin();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      return enviarErro(
        res,
        400,
        "Não foi possível excluir: " + error.message +
          ". Se essa pessoa já criou clientes, tarefas, projetos ou outros registros, o banco impede a exclusão — nesse caso, inative em vez de excluir."
      );
    }

    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

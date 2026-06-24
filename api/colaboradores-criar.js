// api/colaboradores-criar.js
// POST { nome, email, password, role, cargo, cliente_ids: [...] }
// Cria o login (Supabase Auth), o perfil em "usuarios" (via trigger) e os
// vínculos com os clientes selecionados. Só quem está logado como Admin
// pode chamar isso (verificado abaixo).
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

  // 1. Confirma que quem está chamando é Admin
  const supabaseUsuario = clienteComoUsuario(req);
  const { data: auth } = await supabaseUsuario.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  const { data: meuPerfil } = await supabaseUsuario
    .from("usuarios")
    .select("role")
    .eq("id", auth.user.id)
    .single();

  if (!meuPerfil || meuPerfil.role !== "admin") {
    return enviarErro(res, 403, "Só o Administrador pode criar colaboradores");
  }

  // 2. Cria o login com a chave administrativa
  const { nome, email, password, role, cargo, cliente_ids } = req.body || {};
  if (!nome || !email || !password) {
    return enviarErro(res, 400, "Nome, e-mail e senha são obrigatórios");
  }

  const admin = clienteAdmin();

  const { data: novoUsuario, error: erroCriacao } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, role: role || "colaborador", cargo: cargo || null },
  });

  if (erroCriacao) {
    return enviarErro(res, 400, "Não foi possível criar o login: " + erroCriacao.message);
  }

  // 3. Vincula os clientes selecionados (se algum foi marcado)
  if (Array.isArray(cliente_ids) && cliente_ids.length > 0) {
    const vinculos = cliente_ids.map((cliente_id) => ({
      cliente_id,
      usuario_id: novoUsuario.user.id,
      modulo: "assessoria",
      vinculado_por: auth.user.id,
    }));
    await admin.from("vinculo_colaborador_cliente").insert(vinculos);
  }

  res.status(201).json({ ok: true, usuario_id: novoUsuario.user.id });
};

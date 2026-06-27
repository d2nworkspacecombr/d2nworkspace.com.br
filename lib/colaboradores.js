// lib/colaboradores.js (antigo api/colaboradores.js)
// GET   -> lista de colaboradores e administradores
// PATCH /api/colaboradores?id=... -> ativa/inativa { ativo: true|false } (admin, garantido pela RLS)
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
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

    const body = req.body || {};
    if (body.ativo === undefined) return enviarErro(res, 400, "ativo é obrigatório");

    const { data, error } = await supabase
      .from("usuarios")
      .update({ ativo: body.ativo })
      .eq("id", id)
      .select();

    // Se a RLS bloquear (só Admin pode), o Supabase retorna 0 linhas, não um erro —
    // por isso checamos os dois casos.
    if (error) return enviarErro(res, 400, error.message);
    if (!data || data.length === 0) return enviarErro(res, 403, "Só o administrador pode inativar/ativar colaboradores.");

    return res.status(200).json({ colaborador: data[0] });
  }

  return enviarErro(res, 405, "Método não permitido");
};

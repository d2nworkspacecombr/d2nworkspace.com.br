// api/colaboradores.js — GET -> lista de colaboradores e administradores
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") return enviarErro(res, 405, "Método não permitido");

  const supabase = clienteComoUsuario(req);

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, role, cargo, ativo")
    .in("role", ["admin", "colaborador"])
    .order("nome");

  if (error) return enviarErro(res, 500, error.message);
  res.status(200).json({ colaboradores: data });
};

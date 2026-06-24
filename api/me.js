// api/me.js — GET (com header Authorization: Bearer ...) -> { usuario }
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  if (req.method !== "GET") return enviarErro(res, 405, "Método não permitido");

  const supabase = clienteComoUsuario(req);

  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("id, nome, email, role, cargo")
    .eq("id", auth.user.id)
    .single();

  if (error) return enviarErro(res, 500, error.message);

  res.status(200).json({ usuario });
};

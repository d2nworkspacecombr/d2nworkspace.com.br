// lib/categorias.js
// GET    /api/categorias          -> lista categorias (autenticado)
// POST   /api/categorias          -> cria categoria (só Admin)
// DELETE /api/categorias?id=...   -> exclui categoria (só Admin)
const { clienteComoUsuario, exigirAutenticacao, exigirAdmin, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const auth = await exigirAutenticacao(supabase);
    if (auth.erro) return enviarErro(res, auth.status, auth.erro);

    const { data, error } = await supabase.from("categorias").select("*").order("nome");
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ categorias: data });
  }

  if (req.method === "POST") {
    const admin = await exigirAdmin(supabase);
    if (admin.erro) return enviarErro(res, admin.status, admin.erro);

    const body = req.body || {};
    if (!body.nome) return enviarErro(res, 400, "nome é obrigatório");

    const { data, error } = await supabase.from("categorias").insert({ nome: body.nome }).select().single();
    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ categoria: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const admin = await exigirAdmin(supabase);
    if (admin.erro) return enviarErro(res, admin.status, admin.erro);

    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

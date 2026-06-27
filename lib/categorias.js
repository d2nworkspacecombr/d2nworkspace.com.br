// lib/categorias.js
// GET    /api/categorias          -> lista categorias
// POST   /api/categorias          -> cria categoria (admin, garantido pela RLS)
// DELETE /api/categorias?id=...   -> exclui categoria
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { data, error } = await supabase.from("categorias").select("*").order("nome");
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ categorias: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.nome) return enviarErro(res, 400, "nome é obrigatório");

    const { data, error } = await supabase.from("categorias").insert({ nome: body.nome }).select().single();
    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ categoria: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("categorias").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

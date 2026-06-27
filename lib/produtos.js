// lib/produtos.js (antigo api/produtos.js)
// GET  /api/produtos   -> lista produtos
// POST /api/produtos   -> cria produto (só Admin, garantido pelo banco)
const { clienteComoUsuario, enviarErro } = require("./supabase");

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
    const body = req.body || {};
    const { data, error } = await supabase
      .from("produtos")
      .insert({ nome: body.nome, descricao: body.descricao, categoria: body.categoria || null })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ produto: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

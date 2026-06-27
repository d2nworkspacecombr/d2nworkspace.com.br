// lib/etiquetas.js
// GET  /api/etiquetas   -> lista etiquetas
// POST /api/etiquetas   -> cria etiqueta nova (livre, qualquer colaborador)
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { data, error } = await supabase.from("etiquetas").select("*").order("nome");
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ etiquetas: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.nome) return enviarErro(res, 400, "nome é obrigatório");

    const { data, error } = await supabase
      .from("etiquetas")
      .upsert({ nome: body.nome }, { onConflict: "nome" })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ etiqueta: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

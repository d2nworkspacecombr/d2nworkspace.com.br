// api/vinculos.js
// GET    /api/vinculos?cliente_id=...           -> lista vínculos de um cliente
// POST   /api/vinculos                          -> cria vínculo {cliente_id, usuario_id, modulo}
// DELETE /api/vinculos?id=...                   -> remove vínculo
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("vinculo_colaborador_cliente")
      .select("id, modulo, usuario_id, usuarios:usuario_id(nome, cargo)")
      .eq("cliente_id", cliente_id);

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ vinculos: data });
  }

  if (req.method === "POST") {
    const { cliente_id, usuario_id, modulo } = req.body || {};
    const { data, error } = await supabase
      .from("vinculo_colaborador_cliente")
      .insert({ cliente_id, usuario_id, modulo: modulo || "assessoria" })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ vinculo: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase
      .from("vinculo_colaborador_cliente")
      .delete()
      .eq("id", id);

    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

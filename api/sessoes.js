// api/sessoes.js
// GET  /api/sessoes?cliente_id=...   -> lista sessões de um cliente
// POST /api/sessoes                  -> cria sessão
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_sessoes")
      .select("*")
      .eq("cliente_id", cliente_id)
      .order("data_sessao", { ascending: false });

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ sessoes: data });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const body = req.body || {};

    const { data, error } = await supabase
      .from("assessoria_sessoes")
      .insert({
        cliente_id: body.cliente_id,
        titulo: body.titulo,
        data_sessao: body.data_sessao,
        pauta: body.pauta,
        resumo: body.resumo,
        encaminhamentos: body.encaminhamentos,
        registrado_por: auth?.user?.id,
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ sessao: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

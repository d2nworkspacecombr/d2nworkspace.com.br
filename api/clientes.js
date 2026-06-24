// api/clientes.js
// GET  /api/clientes              -> lista clientes (já filtrado por permissão)
// GET  /api/clientes?modulo=assessoria -> só clientes com esse serviço contratado
// GET  /api/clientes?id=...       -> um cliente específico
// POST /api/clientes              -> cria cliente (só Admin, garantido pelo banco)
const { clienteComoUsuario, enviarErro } = require("./_supabase");

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    if (req.query.id) {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", req.query.id)
        .single();
      if (error) return enviarErro(res, 404, "Cliente não encontrado ou sem acesso");
      return res.status(200).json({ cliente: data });
    }

    let query = supabase.from("clientes").select("*").order("nome");
    if (req.query.modulo) {
      query = query.contains("servicos", [req.query.modulo]);
    }

    const { data, error } = await query;
    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ clientes: data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nome: body.nome,
        razao_social: body.razao_social,
        tipo_documento: body.tipo_documento || "cnpj",
        cnpj_cpf: body.cnpj_cpf,
        segmento: body.segmento,
        porte: body.porte,
        interlocutor: body.interlocutor,
        telefone: body.telefone,
        email: body.email,
        servicos: body.servicos || [],
      })
      .select()
      .single();

    if (error) return enviarErro(res, 400, error.message);
    return res.status(201).json({ cliente: data });
  }

  return enviarErro(res, 405, "Método não permitido");
};

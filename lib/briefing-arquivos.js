// lib/briefing-arquivos.js
// GET    /api/briefing-arquivos?cliente_id=...                -> lista arquivos do cliente
// POST   /api/briefing-arquivos                                -> upload { cliente_id, filename, base64 }
// DELETE /api/briefing-arquivos?cliente_id=...&filename=...    -> remove um arquivo
//
// Acesso livre, igual ao resto do Briefing: usa o cliente admin pra não
// depender de vínculo. O bucket é privado, então geramos link temporário
// (assinado) pra cada arquivo, em vez de uma URL pública permanente.
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./supabase");

const BUCKET = "briefing-arquivos";
const VALIDADE_LINK_SEGUNDOS = 300; // 5 minutos

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);
  const { data: auth, error: erroAuth } = await supabase.auth.getUser();
  if (erroAuth || !auth?.user) return enviarErro(res, 401, "Não autenticado");

  const admin = clienteAdmin();

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await admin.storage.from(BUCKET).list(cliente_id, {
      sortBy: { column: "created_at", order: "desc" },
    });

    if (error) return enviarErro(res, 500, error.message);

    const arquivosValidos = (data || []).filter((item) => item.id);

    const arquivos = await Promise.all(
      arquivosValidos.map(async (item) => {
        const caminho = `${cliente_id}/${item.name}`;
        const { data: assinado } = await admin.storage
          .from(BUCKET)
          .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS);
        return {
          nome: item.name,
          tamanho: item.metadata?.size || 0,
          criado_em: item.created_at,
          url: assinado?.signedUrl || null,
        };
      })
    );

    return res.status(200).json({ arquivos });
  }

  if (req.method === "POST") {
    const { cliente_id, filename, base64 } = req.body || {};
    if (!cliente_id || !filename || !base64) {
      return enviarErro(res, 400, "cliente_id, filename e base64 são obrigatórios");
    }

    const nomeSeguro = filename.replace(/[^\w.\-]/g, "_");
    const caminho = `${cliente_id}/${Date.now()}_${nomeSeguro}`;
    const buffer = Buffer.from(base64, "base64");

    const { error } = await admin.storage.from(BUCKET).upload(caminho, buffer, { upsert: false });
    if (error) return enviarErro(res, 400, "Não foi possível enviar o arquivo: " + error.message);

    return res.status(201).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { cliente_id, filename } = req.query;
    if (!cliente_id || !filename) return enviarErro(res, 400, "cliente_id e filename são obrigatórios");

    const { error } = await admin.storage.from(BUCKET).remove([`${cliente_id}/${filename}`]);
    if (error) return enviarErro(res, 400, error.message);

    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

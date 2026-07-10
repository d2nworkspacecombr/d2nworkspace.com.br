// lib/upload-logo.js (antigo api/upload-logo.js)
// POST { cliente_id, filename, base64 } -> faz upload no Storage e já
// atualiza o campo logo_url do cliente. Retorna a URL pública da imagem.
// Requer autenticação.
const { clienteComoUsuario, exigirAutenticacao, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

    const supabase = clienteComoUsuario(req);
    const auth = await exigirAutenticacao(supabase);
    if (auth.erro) return enviarErro(res, auth.status, auth.erro);

    const { cliente_id, filename, base64 } = req.body || {};
    if (!cliente_id || !filename || !base64) {
      return enviarErro(res, 400, "cliente_id, filename e base64 são obrigatórios");
    }

    const extensao = (filename.split(".").pop() || "png").toLowerCase();
    const caminho = `${cliente_id}/logo.${extensao}`;
    const buffer = Buffer.from(base64, "base64");

    const tipoMime =
      extensao === "png" ? "image/png" :
      extensao === "jpg" || extensao === "jpeg" ? "image/jpeg" :
      extensao === "svg" ? "image/svg+xml" :
      extensao === "webp" ? "image/webp" : "application/octet-stream";

    const { error: erroUpload } = await supabase.storage
      .from("logos")
      .upload(caminho, buffer, { contentType: tipoMime, upsert: true });

    if (erroUpload) {
      return enviarErro(res, 400, "Não foi possível enviar a imagem: " + erroUpload.message);
    }

    const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(caminho);
    const logo_url = publicUrlData.publicUrl + "?v=" + Date.now();

    // IMPORTANTE: pedimos o registro de volta com .select().single() de
    // propósito. Sem isso, se a permissão (RLS) bloquear a alteração por
    // qualquer motivo, o Supabase não gera erro nenhum — só não altera
    // nada, e o código seguiria achando que deu certo. Com o .select(),
    // se nenhuma linha voltar, sabemos com certeza que não salvou e
    // avisamos o usuário, em vez de mentir dizendo "sucesso".
    const { data: clienteAtualizado, error: erroUpdate } = await supabase
      .from("clientes")
      .update({ logo_url })
      .eq("id", cliente_id)
      .select()
      .single();

    if (erroUpdate || !clienteAtualizado) {
      return enviarErro(
        res,
        400,
        "A imagem foi enviada, mas não foi possível salvar no cadastro do cliente" +
          (erroUpdate ? ": " + erroUpdate.message : " (nenhuma linha foi alterada — provavelmente falta de permissão para este cliente).")
      );
    }

    res.status(200).json({ logo_url });
  } catch (err) {
    enviarErro(res, 500, "Erro inesperado: " + (err.message || String(err)));
  }
};

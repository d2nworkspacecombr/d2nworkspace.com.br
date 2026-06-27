// lib/upload-logo.js (antigo api/upload-logo.js)
// POST { cliente_id, filename, base64 } -> faz upload no Storage e já
// atualiza o campo logo_url do cliente. Retorna a URL pública da imagem.
const { clienteComoUsuario, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

    const { cliente_id, filename, base64 } = req.body || {};
    if (!cliente_id || !filename || !base64) {
      return enviarErro(res, 400, "cliente_id, filename e base64 são obrigatórios");
    }

    const supabase = clienteComoUsuario(req);

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

    const { error: erroUpdate } = await supabase
      .from("clientes")
      .update({ logo_url })
      .eq("id", cliente_id);

    if (erroUpdate) {
      return enviarErro(res, 400, "Imagem enviada, mas não foi possível salvar no cliente: " + erroUpdate.message);
    }

    res.status(200).json({ logo_url });
  } catch (err) {
    enviarErro(res, 500, "Erro inesperado: " + (err.message || String(err)));
  }
};

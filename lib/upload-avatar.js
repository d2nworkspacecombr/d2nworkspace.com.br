// lib/upload-avatar.js
// POST { filename, base64 } -> envia a foto de perfil do PRÓPRIO usuário logado
// (sempre o usuário autenticado — nunca de outra pessoa, por segurança)
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./supabase");

module.exports = async (req, res) => {
  if (req.method !== "POST") return enviarErro(res, 405, "Método não permitido");

  const supabase = clienteComoUsuario(req);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  const { filename, base64 } = req.body || {};
  if (!filename || !base64) return enviarErro(res, 400, "filename e base64 são obrigatórios");

  const admin = clienteAdmin();
  const extensao = (filename.split(".").pop() || "png").toLowerCase();
  const caminho = `${auth.user.id}/avatar.${extensao}`;
  const buffer = Buffer.from(base64, "base64");

  const tipoMime =
    extensao === "png" ? "image/png" :
    extensao === "jpg" || extensao === "jpeg" ? "image/jpeg" :
    extensao === "webp" ? "image/webp" : "application/octet-stream";

  const { error: erroUpload } = await admin.storage
    .from("avatars")
    .upload(caminho, buffer, { contentType: tipoMime, upsert: true });

  if (erroUpload) return enviarErro(res, 400, "Não foi possível enviar a foto: " + erroUpload.message);

  const { data: urlData } = admin.storage.from("avatars").getPublicUrl(caminho);
  const foto_url = urlData.publicUrl + "?v=" + Date.now();

  const { error: erroUpdate } = await admin.from("usuarios").update({ foto_url }).eq("id", auth.user.id);
  if (erroUpdate) return enviarErro(res, 400, "Foto enviada, mas não foi possível salvar: " + erroUpdate.message);

  return res.status(200).json({ foto_url });
};

// api/[...rota].js
// Único arquivo dentro de /api — "portal" que recebe toda chamada
// (/api/clientes, /api/auth, /api/diagnosticos, etc.) e direciona pro
// módulo certo dentro de /lib. Pro Vercel, isso conta como 1 função só,
// não importa quantos módulos existam dentro de /lib.
const { enviarErro } = require("../lib/supabase");

const ROTAS = {
  "auth": () => require("../lib/auth"),
  "clientes": () => require("../lib/clientes"),
  "colaboradores": () => require("../lib/colaboradores"),
  "colaboradores-criar": () => require("../lib/colaboradores-criar"),
  "produtos": () => require("../lib/produtos"),
  "vinculos": () => require("../lib/vinculos"),
  "diagnosticos": () => require("../lib/diagnosticos"),
  "assessoria-relatorio": () => require("../lib/assessoria-relatorio"),
  "upload-logo": () => require("../lib/upload-logo"),
  "briefing": () => require("../lib/briefing"),
};

module.exports = async (req, res) => {
  const partes = req.query.rota;
  const recurso = Array.isArray(partes) ? partes[0] : partes;

  const carregarModulo = ROTAS[recurso];
  if (!carregarModulo) {
    return enviarErro(res, 404, "Recurso não encontrado: " + recurso);
  }

  try {
    const handler = carregarModulo();
    return await handler(req, res);
  } catch (err) {
    return enviarErro(res, 500, "Erro inesperado no servidor: " + (err.message || String(err)));
  }
};

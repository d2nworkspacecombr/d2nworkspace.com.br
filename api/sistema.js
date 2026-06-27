// api/sistema.js
// Único arquivo dentro de /api. Recebe TODAS as chamadas de /api/* através
// de uma regra explícita em vercel.json (na raiz do projeto), que entrega o
// nome do recurso pedido como um parâmetro normal (req.query.recurso) — em
// vez de depender do nome de arquivo com colchetes, que não funcionou nesse
// projeto.
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
  "briefing-arquivos": () => require("../lib/briefing-arquivos"),
  "agenda": () => require("../lib/agenda"),
};

module.exports = async (req, res) => {
  const recurso = req.query.recurso || extrairRecursoDaUrl(req);

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

// Reserva — só usada se algum dia o recurso não vier na querystring por
// algum outro motivo (ex: chamada feita sem passar pelo rewrite).
function extrairRecursoDaUrl(req) {
  const caminho = (req.url || "").split("?")[0];
  const partes = caminho.replace(/^\/?api\/?/, "").split("/").filter(Boolean);
  return partes[0];
}

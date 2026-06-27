// lib/assessoria-relatorio.js
// GET  /api/assessoria-relatorio?cliente_id=...   -> { dados } | { dados: null }
// POST /api/assessoria-relatorio                  -> upsert { cliente_id, dados }
//                                                     + sincroniza Key Results e tarefas
//                                                     operacionais com o módulo Tarefas
const { clienteComoUsuario, clienteAdmin, enviarErro } = require("./supabase");

function statusPorConcluido(done) {
  return done ? "concluida" : "pendente";
}

// Monta a lista de tarefas que DEVERIAM existir, a partir dos dados salvos.
function montarListaDesejada(dados) {
  const desejado = [];

  (dados.okrs || []).forEach((okr) => {
    (okr.krs || []).forEach((kr) => {
      if (!kr.id || !kr.l) return;
      desejado.push({
        chave: "kr:" + kr.id,
        titulo: kr.l,
        status: statusPorConcluido(kr.done),
        paiChave: null,
        responsavel_ids: [],
        descricao: null,
        prazo: null,
      });
    });
  });

  (dados.atendimentos || []).forEach((atd) => {
    if (!atd.id) return;
    const chaveAtd = "atd:" + atd.id;
    desejado.push({
      chave: chaveAtd,
      titulo: "Atendimento: " + (atd.title || "Sem título"),
      status: "em_andamento",
      paiChave: null,
      responsavel_ids: [],
      descricao: null,
      prazo: null,
    });
    (atd.tasks || []).forEach((t) => {
      if (!t.id || !t.label) return;
      desejado.push({
        chave: chaveAtd + ":task:" + t.id,
        titulo: t.label,
        status: statusPorConcluido(t.done),
        paiChave: chaveAtd,
        responsavel_ids: t.tipo === "assessor" && Array.isArray(t.responsavel_ids) ? t.responsavel_ids : [],
        descricao: t.tipo === "interlocutor" && t.interlocutor_nome ? "Interlocutor: " + t.interlocutor_nome : null,
        prazo: t.dl || null,
      });
    });
  });

  return desejado;
}

// Compara o que deveria existir com o que já existe no projeto "Assessoria: Cliente"
// e cria/atualiza/exclui as tarefas necessárias.
async function sincronizarAssessoria(admin, clienteNome, usuarioId, dados) {
  const desejado = montarListaDesejada(dados);
  const nomeProjeto = "Assessoria: " + clienteNome;

  let { data: projeto } = await admin.from("projetos").select("id").eq("nome", nomeProjeto).maybeSingle();
  if (!projeto && desejado.length === 0) return; // nada a sincronizar e nada criado ainda

  if (!projeto) {
    const { data: novo, error } = await admin
      .from("projetos")
      .insert({ nome: nomeProjeto, cor: "#1d3f74", criado_por: usuarioId })
      .select("id")
      .single();
    if (error) throw error;
    projeto = novo;
  }

  const { data: existentes, error: erroExist } = await admin
    .from("tarefas")
    .select("id, origem_chave")
    .eq("projeto_id", projeto.id)
    .not("origem_chave", "is", null);
  if (erroExist) throw erroExist;

  const mapaExistente = new Map((existentes || []).map((t) => [t.origem_chave, t.id]));
  const mapaChaveParaId = new Map();
  const chavesDesejadas = new Set(desejado.map((d) => d.chave));

  const ordenado = [...desejado].sort((a, b) => (a.paiChave ? 1 : 0) - (b.paiChave ? 1 : 0));
  const erros = [];

  for (const item of ordenado) {
    try {
      const tarefaPaiId = item.paiChave ? mapaChaveParaId.get(item.paiChave) || null : null;
      const idExistente = mapaExistente.get(item.chave);

      if (idExistente) {
        const { error: erroUpdate } = await admin
          .from("tarefas")
          .update({ titulo: item.titulo, status: item.status, descricao: item.descricao, prazo: item.prazo, tarefa_pai_id: tarefaPaiId })
          .eq("id", idExistente);
        if (erroUpdate) throw erroUpdate;

        await admin.from("tarefa_responsavel").delete().eq("tarefa_id", idExistente);
        if (item.responsavel_ids.length > 0) {
          const { error: erroResp } = await admin
            .from("tarefa_responsavel")
            .insert(item.responsavel_ids.map((usuario_id) => ({ tarefa_id: idExistente, usuario_id })));
          if (erroResp) throw erroResp;
        }
        mapaChaveParaId.set(item.chave, idExistente);
      } else {
        const { data: nova, error: erroInsert } = await admin
          .from("tarefas")
          .insert({
            titulo: item.titulo,
            descricao: item.descricao,
            status: item.status,
            prazo: item.prazo,
            projeto_id: projeto.id,
            tarefa_pai_id: tarefaPaiId,
            ambiente: "empresa",
            criado_por: usuarioId,
            origem_modulo: "assessoria",
            origem_chave: item.chave,
          })
          .select("id")
          .single();
        if (erroInsert) throw erroInsert;

        if (item.responsavel_ids.length > 0) {
          const { error: erroResp } = await admin
            .from("tarefa_responsavel")
            .insert(item.responsavel_ids.map((usuario_id) => ({ tarefa_id: nova.id, usuario_id })));
          if (erroResp) throw erroResp;
        }
        mapaChaveParaId.set(item.chave, nova.id);
      }
    } catch (e) {
      erros.push('"' + item.titulo + '": ' + (e.message || String(e)));
    }
  }

  for (const [chave, id] of mapaExistente) {
    if (!chavesDesejadas.has(chave)) {
      await admin.from("tarefas").delete().eq("id", id);
    }
  }

  if (erros.length > 0) {
    throw new Error(erros.join(" | "));
  }
}

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);

  if (req.method === "GET") {
    const { cliente_id } = req.query;
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { data, error } = await supabase
      .from("assessoria_relatorio")
      .select("dados")
      .eq("cliente_id", cliente_id)
      .maybeSingle();

    if (error) return enviarErro(res, 500, error.message);
    return res.status(200).json({ dados: data ? data.dados : null });
  }

  if (req.method === "POST") {
    const { data: auth } = await supabase.auth.getUser();
    const { cliente_id, dados } = req.body || {};
    if (!cliente_id) return enviarErro(res, 400, "cliente_id é obrigatório");

    const { error } = await supabase.from("assessoria_relatorio").upsert({
      cliente_id,
      dados: dados || {},
      atualizado_por: auth?.user?.id,
      atualizado_em: new Date().toISOString(),
    });

    if (error) return enviarErro(res, 400, error.message);

    let aviso = null;
    try {
      const admin = clienteAdmin();
      const { data: cliente } = await admin.from("clientes").select("nome").eq("id", cliente_id).single();
      if (cliente) {
        await sincronizarAssessoria(admin, cliente.nome, auth?.user?.id, dados || {});
      }
    } catch (e) {
      aviso = "Relatório salvo, mas houve um problema ao sincronizar com o módulo Tarefas: " + e.message;
    }

    return res.status(200).json({ ok: true, aviso });
  }

  return enviarErro(res, 405, "Método não permitido");
};

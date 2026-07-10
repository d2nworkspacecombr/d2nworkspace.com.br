// lib/tarefas.js
// GET    /api/tarefas?projeto_id=...                    -> árvore completa de um projeto (todos os níveis)
// GET    /api/tarefas?ambiente=privado|empresa&visao=... -> lista filtrada (inbox|hoje|semana|mes|atrasadas|concluidas)
// POST   /api/tarefas                                     -> cria tarefa ou subtarefa
// PATCH  /api/tarefas?id=...                              -> atualiza campos (inclui "mover para" via tarefa_pai_id)
// DELETE /api/tarefas?id=...                              -> exclui (e as subtarefas, em cascata)
//
// LIMITE DE 3 NÍVEIS: a coluna "nivel" (1 = tarefa raiz, 2 = subtarefa,
// 3 = sub-subtarefa) é calculada e validada aqui no servidor — antes essa
// regra só existia no frontend, então uma chamada direta à API conseguia
// criar árvores mais profundas do que o combinado.
const { clienteComoUsuario, enviarErro } = require("./supabase");

const NIVEL_MAXIMO = 3;

const SELECT_TAREFA =
  "*, projeto:projetos(id, nome, cor), categoria:categorias(id, nome), " +
  "criador:usuarios!tarefas_criado_por_fkey(id, nome), " +
  "tarefa_responsavel(usuario_id, usuarios(id, nome)), " +
  "tarefa_etiqueta(etiqueta_id, etiquetas(id, nome))";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

// Percorre a árvore abaixo de uma tarefa e devolve:
// - ids: todos os descendentes (pra impedir mover uma tarefa pra dentro
//   dela mesma ou de uma de suas próprias subtarefas)
// - profundidade: quantos níveis existem abaixo dela (0 = não tem filhos)
async function obterDescendentes(supabase, tarefaId) {
  const ids = new Set();
  let atual = [tarefaId];
  let profundidade = 0;

  while (atual.length > 0) {
    const { data: filhos } = await supabase.from("tarefas").select("id").in("tarefa_pai_id", atual);
    if (!filhos || filhos.length === 0) break;
    profundidade++;
    filhos.forEach((f) => ids.add(f.id));
    atual = filhos.map((f) => f.id);
  }

  return { ids, profundidade };
}

// Depois de mover uma tarefa, todos os descendentes dela mudam de nível
// junto (ex: se a tarefa subiu 1 nível, os filhos dela também sobem 1).
async function atualizarNivelDescendentes(supabase, tarefaId, delta) {
  if (!delta) return;
  let atual = [tarefaId];

  while (atual.length > 0) {
    const { data: filhos } = await supabase.from("tarefas").select("id, nivel").in("tarefa_pai_id", atual);
    if (!filhos || filhos.length === 0) break;

    await Promise.all(
      filhos.map((f) => supabase.from("tarefas").update({ nivel: f.nivel + delta }).eq("id", f.id))
    );

    atual = filhos.map((f) => f.id);
  }
}

module.exports = async (req, res) => {
  const supabase = clienteComoUsuario(req);
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return enviarErro(res, 401, "Não autenticado");

  if (req.method === "GET") {
    const { projeto_id, ambiente, visao, categoria_id, etiqueta_id } = req.query;

    let query = supabase.from("tarefas").select(SELECT_TAREFA);

    if (projeto_id) {
      query = query.eq("projeto_id", projeto_id);
    } else {
      if (ambiente) query = query.eq("ambiente", ambiente);

      if (visao === "inbox") {
        query = query.is("projeto_id", null).neq("status", "concluida");
      } else if (visao === "hoje") {
        query = query.eq("prazo", hojeISO()).neq("status", "concluida");
      } else if (visao === "semana") {
        const seteDias = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        query = query.gte("prazo", hojeISO()).lte("prazo", seteDias).neq("status", "concluida");
      } else if (visao === "atrasadas") {
        query = query.lt("prazo", hojeISO()).neq("status", "concluida");
      } else if (visao === "mes") {
        const hoje = new Date();
        const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
        const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
        query = query.gte("prazo", inicioMes).lte("prazo", fimMes).neq("status", "concluida");
      } else if (visao === "concluidas") {
        query = query.eq("status", "concluida");
      } else {
        query = query.is("tarefa_pai_id", null);
      }
    }

    if (categoria_id) query = query.eq("categoria_id", categoria_id);

    query = query.order("ordem").order("criado_em");

    const { data, error } = await query;
    if (error) return enviarErro(res, 500, error.message);

    let tarefas = data || [];
    if (etiqueta_id) {
      tarefas = tarefas.filter((t) => (t.tarefa_etiqueta || []).some((te) => te.etiqueta_id === etiqueta_id));
    }

    return res.status(200).json({ tarefas });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (!body.titulo) return enviarErro(res, 400, "título é obrigatório");

    let ambiente = body.ambiente || "privado";
    let projeto_id = body.projeto_id || null;
    let nivel = 1;

    // Subtarefa herda ambiente e projeto da tarefa-mãe, pra árvore não ficar
    // inconsistente, e o nível é calculado a partir do nível da tarefa-mãe.
    if (body.tarefa_pai_id) {
      const { data: pai, error: erroPai } = await supabase
        .from("tarefas")
        .select("ambiente, projeto_id, nivel")
        .eq("id", body.tarefa_pai_id)
        .single();
      if (erroPai) return enviarErro(res, 400, "Tarefa-mãe não encontrada ou sem acesso");

      if (pai.nivel >= NIVEL_MAXIMO) {
        return enviarErro(
          res,
          400,
          `Não é possível criar essa subtarefa: o limite de ${NIVEL_MAXIMO} níveis de profundidade já foi atingido.`
        );
      }

      ambiente = pai.ambiente;
      projeto_id = pai.projeto_id;
      nivel = pai.nivel + 1;
    }

    const responsavelIds = Array.isArray(body.responsavel_ids) ? body.responsavel_ids : [];

    // Se já nasce atribuída a outra pessoa, não pode ficar "privada" — senão
    // a outra pessoa nunca conseguiria ver.
    if (responsavelIds.some((rid) => rid !== auth.user.id)) {
      ambiente = "empresa";
    }

    const { data: tarefa, error } = await supabase
      .from("tarefas")
      .insert({
        titulo: body.titulo,
        descricao: body.descricao || null,
        prioridade: body.prioridade || "media",
        prazo: body.prazo || null,
        projeto_id,
        categoria_id: body.categoria_id || null,
        tarefa_pai_id: body.tarefa_pai_id || null,
        nivel,
        ambiente,
        criado_por: auth.user.id,
      })
      .select(SELECT_TAREFA)
      .single();

    if (error) return enviarErro(res, 400, error.message);

    if (responsavelIds.length > 0) {
      await supabase
        .from("tarefa_responsavel")
        .insert(responsavelIds.map((usuario_id) => ({ tarefa_id: tarefa.id, usuario_id })));
    }

    const etiquetaIds = Array.isArray(body.etiqueta_ids) ? body.etiqueta_ids : [];
    if (etiquetaIds.length > 0) {
      await supabase
        .from("tarefa_etiqueta")
        .insert(etiquetaIds.map((etiqueta_id) => ({ tarefa_id: tarefa.id, etiqueta_id })));
    }

    return res.status(201).json({ tarefa });
  }

  if (req.method === "PATCH") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const body = req.body || {};
    const atualizacao = {};
    ["titulo", "descricao", "prioridade", "prazo", "status", "projeto_id", "categoria_id", "tarefa_pai_id"].forEach((campo) => {
      if (body[campo] !== undefined) atualizacao[campo] = body[campo];
    });

    if (body.status === "concluida") atualizacao.concluido_em = new Date().toISOString();
    if (body.status && body.status !== "concluida") atualizacao.concluido_em = null;

    // Mover a tarefa (mudar tarefa_pai_id): recalcula o nível, garante que
    // não ultrapasse o limite (considerando as subtarefas que ela já tem) e
    // impede um ciclo (mover pra dentro dela mesma ou de um descendente).
    let deltaNivel = 0;
    if (body.tarefa_pai_id !== undefined) {
      const { data: tarefaAtual, error: erroAtual } = await supabase
        .from("tarefas")
        .select("nivel")
        .eq("id", id)
        .single();
      if (erroAtual) return enviarErro(res, 400, "Tarefa não encontrada ou sem acesso");

      const { ids: idsDescendentes, profundidade: profundidadeAbaixo } = await obterDescendentes(supabase, id);

      let novoNivel = 1;
      if (body.tarefa_pai_id) {
        if (body.tarefa_pai_id === id || idsDescendentes.has(body.tarefa_pai_id)) {
          return enviarErro(res, 400, "Não é possível mover uma tarefa para dentro dela mesma ou de uma de suas subtarefas.");
        }

        const { data: novoPai, error: erroPai } = await supabase
          .from("tarefas")
          .select("nivel")
          .eq("id", body.tarefa_pai_id)
          .single();
        if (erroPai) return enviarErro(res, 400, "Tarefa-mãe não encontrada ou sem acesso");
        novoNivel = novoPai.nivel + 1;
      }

      if (novoNivel + profundidadeAbaixo > NIVEL_MAXIMO) {
        return enviarErro(
          res,
          400,
          `Não é possível mover: essa tarefa (com suas subtarefas) ultrapassaria o limite de ${NIVEL_MAXIMO} níveis de profundidade.`
        );
      }

      atualizacao.nivel = novoNivel;
      deltaNivel = novoNivel - tarefaAtual.nivel;
    }

    // Atribuir a tarefa a outra pessoa promove ela de "privada" pra "empresa"
    // automaticamente — senão a pessoa nova nunca conseguiria vê-la.
    if (Array.isArray(body.responsavel_ids)) {
      const { data: atual } = await supabase.from("tarefas").select("criado_por, ambiente").eq("id", id).single();
      const temOutroResponsavel = body.responsavel_ids.some((rid) => rid !== atual?.criado_por);
      if (atual && atual.ambiente === "privado" && temOutroResponsavel) {
        atualizacao.ambiente = "empresa";
      }
    }

    const { data, error } = await supabase
      .from("tarefas")
      .update(atualizacao)
      .eq("id", id)
      .select(SELECT_TAREFA)
      .single();

    if (error) return enviarErro(res, 400, error.message);

    if (deltaNivel) {
      await atualizarNivelDescendentes(supabase, id, deltaNivel);
    }

    if (Array.isArray(body.etiqueta_ids)) {
      await supabase.from("tarefa_etiqueta").delete().eq("tarefa_id", id);
      if (body.etiqueta_ids.length > 0) {
        await supabase
          .from("tarefa_etiqueta")
          .insert(body.etiqueta_ids.map((etiqueta_id) => ({ tarefa_id: id, etiqueta_id })));
      }
    }

    if (Array.isArray(body.responsavel_ids)) {
      await supabase.from("tarefa_responsavel").delete().eq("tarefa_id", id);
      if (body.responsavel_ids.length > 0) {
        await supabase
          .from("tarefa_responsavel")
          .insert(body.responsavel_ids.map((usuario_id) => ({ tarefa_id: id, usuario_id })));
      }
    }

    return res.status(200).json({ tarefa: data });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) return enviarErro(res, 400, "id é obrigatório");

    const { error } = await supabase.from("tarefas").delete().eq("id", id);
    if (error) return enviarErro(res, 400, error.message);
    return res.status(200).json({ ok: true });
  }

  return enviarErro(res, 405, "Método não permitido");
};

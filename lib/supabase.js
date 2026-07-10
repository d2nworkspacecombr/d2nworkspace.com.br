// lib/supabase.js (antigo api/_supabase.js)
// Arquivo auxiliar usado por todos os módulos de /lib pra falar com o Supabase.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Cria um cliente Supabase "como se fosse" o usuário que fez a requisição,
// usando o token (JWT) que o navegador envia no cabeçalho Authorization.
// Isso faz as regras de permissão (RLS) do banco respeitarem exatamente
// quem está logado, sem precisar reimplementar a lógica de acesso aqui.
function clienteComoUsuario(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "");

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
}

// Cliente "público" (sem login) — usado só pela função de login,
// pra verificar e-mail/senha.
function clientePublico() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}

function enviarErro(res, status, mensagem) {
  res.status(status).json({ erro: mensagem });
}

// Cliente "administrativo" — usa a chave secreta (service_role), nunca
// exposta ao navegador. Só usada aqui, dentro de funções do servidor,
// para ações que o usuário comum não pode fazer (como criar um login novo).
function clienteAdmin() {
  return createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

// ----------------------------------------------------------------------------
// CHECAGENS CENTRALIZADAS DE ACESSO
// ----------------------------------------------------------------------------
// Antes, cada módulo tinha sua própria forma (ou nenhuma) de checar se o
// usuário estava logado, e 3 versões diferentes de "é admin?" espalhadas
// pelo código. Agora existe um único jeito de fazer isso, usado em todo
// lugar — reduz o risco de esquecer a checagem num módulo novo e garante
// uma segunda camada de proteção além da RLS do banco.

// Confirma que existe um usuário autenticado na requisição.
// Devolve { usuarioId, usuario } se tudo certo, ou { erro, status } se não —
// o chamador só precisa checar "se (resultado.erro) devolve o erro".
async function exigirAutenticacao(supabase) {
  const { data: auth, error } = await supabase.auth.getUser();
  if (error || !auth?.user) return { erro: "Não autenticado", status: 401 };
  return { usuarioId: auth.user.id, usuario: auth.user };
}

// Confirma autenticação E que o usuário logado tem o papel "admin" na
// tabela usuarios. Substitui as 3 implementações que existiam separadas
// em produtos.js, colaboradores.js e colaboradores-criar.js.
async function exigirAdmin(supabase) {
  const autenticacao = await exigirAutenticacao(supabase);
  if (autenticacao.erro) return autenticacao;

  const { data: perfil, error } = await supabase
    .from("usuarios")
    .select("role")
    .eq("id", autenticacao.usuarioId)
    .single();

  if (error || !perfil || perfil.role !== "admin") {
    return { erro: "Só o administrador pode fazer isso.", status: 403 };
  }

  return { usuarioId: autenticacao.usuarioId };
}

module.exports = {
  clienteComoUsuario,
  clientePublico,
  clienteAdmin,
  enviarErro,
  exigirAutenticacao,
  exigirAdmin,
};

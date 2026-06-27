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

module.exports = { clienteComoUsuario, clientePublico, clienteAdmin, enviarErro };

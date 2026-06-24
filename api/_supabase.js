// api/_supabase.js
// Arquivo auxiliar (não é uma rota — começa com "_") usado por todas as
// outras funções da pasta /api para falar com o Supabase.
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

module.exports = { clienteComoUsuario, clientePublico, enviarErro };

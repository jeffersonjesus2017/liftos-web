import { redirect } from 'next/navigation';

// A rota raiz já é redirecionada para /app.html via next.config.mjs
// (redirects()). Este fallback cobre qualquer caso em que o redirect
// de config não seja aplicado (ex: alguns ambientes de preview).
export default function Home() {
  redirect('/app.html');
}

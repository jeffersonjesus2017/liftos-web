// Origem do Supabase (pública por desenho; a proteção dos dados é o RLS no banco).
const SUPABASE_HOST = 'xmxdxevrnvmczzlkxqxy.supabase.co';

// CSP do app (/app.html). Sem 'unsafe-inline' em script-src: todo o JS vive em /app.js e nas
// bibliotecas em /vendor — um HTML injetado não consegue executar script nem enviar dados
// para fora (connect-src só permite o próprio site e o Supabase).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // LIFT.OS é hoje um app único (HTML/CSS/JS + localStorage) servido como
  // arquivos estáticos em /public (app.html + app.js). O Next.js aqui só empacota,
  // hospeda, redireciona e serve a rota /api/analisar-foto — não há renderização React do app ainda.
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app.html',
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/app.html',
        headers: [{ key: 'Content-Security-Policy', value: CSP }],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;

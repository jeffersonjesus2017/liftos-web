/** @type {import('next').NextConfig} */
const nextConfig = {
  // LIFT.OS é hoje um app único (HTML/CSS/JS + localStorage) servido como
  // arquivo estático em /public/app.html. O Next.js aqui só empacota,
  // hospeda e redireciona — não há renderização React do app ainda.
  async redirects() {
    return [
      {
        source: '/',
        destination: '/app.html',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;

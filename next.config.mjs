/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // culori is import-heavy; letting Next tree-shake it keeps the client
    // bundle inside the microsite budget rather than shipping every colour space.
    optimizePackageImports: ['culori'],
  },
  async headers() {
    return [
      {
        // /share/[token] is the app's only unauthenticated route and the
        // first place a bearer secret (the token) lives directly in the URL —
        // block framing (clickjacking) and stop the token leaking to a third
        // party via the Referer header on any future outbound link.
        source: '/share/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets two dev servers (musicals + account) run from one folder without sharing a build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: "1536mb",
  },
  // The library used to live under /musicals: old links keep working.
  async redirects() {
    return [
      { source: "/musicals", destination: "/library", permanent: true },
      { source: "/musicals/:path*", destination: "/library/:path*", permanent: true },
      { source: "/admin/musicals/:path*", destination: "/admin/library/:path*", permanent: true },
    ];
  },
};

export default nextConfig;

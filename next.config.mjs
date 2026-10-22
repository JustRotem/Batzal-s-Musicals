/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets two dev servers (musicals + account) run from one folder without sharing a build directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: "1536mb",
  },
};

export default nextConfig;

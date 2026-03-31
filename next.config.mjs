/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    middlewareClientMaxBodySize: "1536mb",
  },
};

export default nextConfig;

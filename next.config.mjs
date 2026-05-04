/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow remote Pal images if/when the scraper writes URLs instead of local files.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;

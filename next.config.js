/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['img.mlbstatic.com', 'content.mlb.com', 'www.mlbstatic.com'],
  },
}

module.exports = nextConfig

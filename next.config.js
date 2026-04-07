/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['img.mlbstatic.com', 'content.mlb.com'],
  },
}

module.exports = nextConfig

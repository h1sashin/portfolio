/** @type {import('next').NextConfig} */

const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.googletagmanager.com *.google-analytics.com;
  img-src 'self' data: source.unsplash.com svgsilh.com media.graphassets.com;
  child-src szemborowski.com;
  connect-src 'self' api.emailjs.com vitals.vercel-insights.com;
  style-src 'self' fonts.googleapis.com 'unsafe-inline';
  font-src 'self' fonts.gstatic.com;  
`

const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ['source.unsplash.com', 'svgsilh.com', 'media.graphassets.com']
    },
    reactStrictMode: true,
    headers: async () => [
        {
            source: '/:path*',
            headers: [{ key: 'Content-Security-Policy', value: ContentSecurityPolicy.replace(/\s{2,}/g, ' ').trim() }]
        }
    ]
}

module.exports = nextConfig

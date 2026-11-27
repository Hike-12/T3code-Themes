/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  devIndicators: false,
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/koi-pond.html', destination: '/koi-pond', permanent: true },
      { source: '/dark-texture.html', destination: '/dark-texture', permanent: true },
      { source: '/downloads/dark-texture.zip', destination: '/downloads/dark-texture.json', permanent: true },
    ];
  },
};

export default config;

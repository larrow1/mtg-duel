/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cards.scryfall.io' },
      { protocol: 'https', hostname: 'c1.scryfall.com' },
      { protocol: 'https', hostname: 'c2.scryfall.com' },
    ],
  },
  // The cube.json + profiles.json files are read at runtime via
  // fs.readFileSync(process.cwd() + '/data/...'). Next's tracer can't see
  // dynamic paths, so we tell it to include the data dir in every API route.
  outputFileTracingIncludes: {
    '/api/**/*': ['./data/**/*'],
  },
};

export default nextConfig;

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@keryx/scripture', '@keryx/domain'],
  // dev サーバー起動中に `next build` しても互いの成果物を壊さないよう分離する
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
};

export default nextConfig;

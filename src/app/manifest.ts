import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'قرآن واژه',
    short_name: 'قرآن واژه',
    description: 'خواندن قرآن، جست‌وجو و بررسی ریشه‌ها و سیاق آیات',
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#faf4df',
    theme_color: '#faf4df',
    icons: [
      { src: '/icons/app-logo-v3-any-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-logo-v3-any-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-logo-v3-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

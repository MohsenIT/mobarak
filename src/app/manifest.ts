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
    background_color: '#0e2a22',
    theme_color: '#0e2a22',
    icons: [
      { src: '/icons/app-logo-v2-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-logo-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-logo-v2-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}

export const publicSiteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://peluqueria-lapaz.vercel.app';

export function publicPage(path = '') {
  return `${publicSiteUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/$/, path ? '' : '/');
}

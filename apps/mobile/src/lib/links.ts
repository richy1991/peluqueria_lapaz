export const publicSiteUrl = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://peluqueria-lapaz.vercel.app';
export const adminLoginUrl = `${publicSiteUrl.replace(/\/$/, '')}/admin/login`;

export function publicPage(path = '') {
  return `${publicSiteUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`.replace(/\/$/, path ? '' : '/');
}

import { Banknote, Bell, CalendarDays, Home, Images, PackageCheck, PackageOpen, Star, UserRound } from 'lucide-react-native';
import type { AppTab } from '@/components/AppShell';

export const clientTabs: AppTab[] = [
  { key: 'inicio', label: 'Inicio', href: '/client', icon: Home },
  { key: 'productos', label: 'Productos', href: '/client/products', icon: PackageCheck },
  { key: 'puntos', label: 'Puntos', href: '/client/points', icon: Star },
  { key: 'perfil', label: 'Perfil', href: '/client/profile', icon: UserRound },
];

export const barberTabs: AppTab[] = [
  { key: 'agenda', label: 'Agenda', href: '/barber', icon: CalendarDays },
  { key: 'productos', label: 'Productos', href: '/barber/products', icon: PackageOpen },
  { key: 'perfil', label: 'Perfil', href: '/barber/profile', icon: UserRound },
  { key: 'balance', label: 'Balance', href: '/barber/balance', icon: Banknote },
  { key: 'trabajos', label: 'Trabajos', href: '/barber/works', icon: Images },
];

export const clientExtraRoutes = [
  { label: 'Notificaciones', href: '/client/notifications', icon: Bell },
  { label: 'Galería de trabajos', href: '/client/gallery', icon: Images },
] as const;

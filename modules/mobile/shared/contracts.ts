export type MobileNavigationItem<Section extends string> = Readonly<{
  id: Section;
  href: string;
  label: string;
}>;

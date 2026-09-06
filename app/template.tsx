export default function AppTemplate({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="app-route-transition">{children}</div>;
}

import { ClientAccountView } from "@/modules/mobile/client";
import "./account-home.css";

export const dynamic = "force-dynamic";

export default function ClientAccountPage() {
  return <ClientAccountView section="inicio" />;
}

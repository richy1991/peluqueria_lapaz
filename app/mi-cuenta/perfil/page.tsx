import { ClientAccountView } from "@/modules/mobile/client";
import "../account-home.css";
import "./profile.css";

export const dynamic = "force-dynamic";

export default function ClientProfilePage() {
  return <ClientAccountView section="perfil" />;
}

import type { User } from "@supabase/supabase-js";
import { Brand } from "./brand";
import { AccountMenu } from "./account-menu";
import { SiteNotificationMenu } from "./site-notification-menu";
import { createClient } from "@/lib/supabase/server";
import { SiteNavigation, type PublicSection } from "./site-navigation";
import "./site-header.css";

export async function SiteHeader({ homeUser, currentPage }: { homeUser?: User | null; currentPage?: PublicSection }) {
  const onHome = homeUser !== undefined;
  let user = homeUser;
  if (user === undefined) {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }
  const name=user?.user_metadata?.full_name??user?.email?.split("@")[0]??"Usuario";
  return (
    <SiteNavigation
      onHome={onHome}
      currentPage={currentPage}
      brand={<Brand href={onHome ? "#top" : "/#top"} />}
      account={user ? <div className="site-account-actions">
        {onHome && <SiteNotificationMenu userId={user.id} />}
        <AccountMenu name={name} email={user.email ?? ""} />
      </div> : undefined}
    />
  );
}

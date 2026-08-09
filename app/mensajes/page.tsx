import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {getUserCapabilities} from "@/lib/user-capabilities";
import {ChatPanel} from "./chat-panel";

export const dynamic="force-dynamic";
export default async function MessagesPage({searchParams}:{searchParams:Promise<{conversation?:string}>}){
 const supabase=await createClient();const{data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const capabilities=await getUserCapabilities(user.id);const params=await searchParams;
 let conversations:Record<string,unknown>[]=[];let selected=params.conversation??null;
 if(capabilities.isAdmin){const{data}=await supabase.from("conversations").select("id,subject,status,updated_at,created_by,profiles!conversations_created_by_fkey(full_name,email)").order("updated_at",{ascending:false}).limit(100);conversations=(data??[]) as unknown as Record<string,unknown>[];selected=selected??(String(conversations[0]?.id??"")||null);}
 else {const{data:id}=await supabase.rpc("get_or_create_support_conversation");selected=String(id);const{data}=await supabase.from("conversations").select("id,subject,status,updated_at").eq("id",id).single();if(data)conversations=[data];}
 const{data:messages}=selected?await supabase.from("messages").select("id,body,created_at,sender_id,profiles!messages_sender_id_fkey(full_name,email)").eq("conversation_id",selected).order("created_at"): {data:[]};
 return <ChatPanel conversations={conversations} selected={selected} messages={(messages??[]) as unknown as Record<string,unknown>[]} isAdmin={capabilities.isAdmin} userId={user.id}/>;
}

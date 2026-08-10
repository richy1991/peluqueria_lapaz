"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Headphones,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Row = Record<string, unknown>;

export function FloatingSupportChat() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [support, setSupport] = useState(false);
  const [conversations, setConversations] = useState<Row[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<HTMLFormElement>(null);

  async function loadMessages(id: string) {
    const { data, error: loadError } = await createClient()
      .from("messages")
      .select("id,body,created_at,sender_id,profiles!messages_sender_id_fkey(full_name,email)")
      .eq("conversation_id", id)
      .order("created_at");

    if (loadError) setError(loadError.message);
    else setMessages((data ?? []) as unknown as Row[]);
  }

  async function initialize() {
    setOpen(true);
    setLoading(true);
    setError("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Inicia sesión para conversar con LEGEND CLUB.");
      setLoading(false);
      return;
    }

    setUserId(user.id);
    const [{ data: isAdmin }, { data: isCashier }] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_cashier"),
    ]);
    const isSupport = Boolean(isAdmin || isCashier);
    setSupport(isSupport);

    let rows: Row[] = [];
    let target: string | null = null;

    if (isSupport) {
      const { data, error: conversationError } = await supabase
        .from("conversations")
        .select("id,subject,status,updated_at,created_by,profiles!conversations_created_by_fkey(full_name,email)")
        .order("updated_at", { ascending: false })
        .limit(100);

      if (conversationError) setError(conversationError.message);
      rows = (data ?? []) as unknown as Row[];
      target = String(rows[0]?.id ?? "") || null;
    } else {
      const { data: id, error: conversationError } = await supabase.rpc(
        "get_or_create_support_conversation",
      );
      if (conversationError) setError(conversationError.message);
      else {
        target = String(id);
        const { data } = await supabase
          .from("conversations")
          .select("id,subject,status,updated_at")
          .eq("id", id)
          .single();
        if (data) rows = [data];
      }
    }

    setConversations(rows);
    setSelected(target);
    if (target) await loadMessages(target);
    setLoading(false);
  }

  async function choose(id: string) {
    setSelected(id);
    setMessages([]);
    await loadMessages(id);
    window.setTimeout(() => messageInputRef.current?.focus(), 80);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;

    const body = draft.trim();
    if (!body) return;

    setBusy(true);
    setError("");
    const { error: sendError } = await createClient().rpc("send_chat_message", {
      target_conversation: selected,
      message_body: body,
    });
    setBusy(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    setDraft("");
    await loadMessages(selected);
    window.requestAnimationFrame(() => messageInputRef.current?.focus());
  }

  useEffect(() => {
    if (!open || !selected) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`support-${selected}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selected}`,
        },
        () => void loadMessages(selected),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, selected]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const filtered = conversations.filter((item) => {
    const owner = item.profiles as Row | null;
    return String(owner?.full_name ?? owner?.email ?? item.subject ?? "")
      .toLowerCase()
      .includes(query.toLowerCase());
  });

  const selectedOwner = useMemo(() => {
    const conversation = conversations.find((item) => String(item.id) === selected);
    return conversation?.profiles as Row | null;
  }, [conversations, selected]);

  const contactName = support
    ? String(selectedOwner?.full_name ?? selectedOwner?.email ?? "Cliente")
    : "Soporte LEGEND CLUB";
  const contactInitials = support
    ? contactName.slice(0, 2).toUpperCase()
    : "LC";

  function formatConversationTime(value: unknown) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-BO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz",
    }).format(new Date(String(value)));
  }

  function formatMessageDate(value: unknown) {
    return new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/La_Paz",
    }).format(new Date(String(value)));
  }

  return (
    <>
      {!open && (
        <button className="support-fab" onClick={initialize} aria-label="Abrir atención al cliente">
          <MessageCircle />
          <i />
        </button>
      )}

      {open && (
        <section
          className={`support-window ${support ? "support-agent" : "support-client"}`}
          aria-label="Atención al cliente"
          role="dialog"
          aria-modal="true"
        >
          <header>
            <div className="support-logo"><Headphones /></div>
            <div className="support-header-copy">
              <strong>{support && selected ? contactName : "LEGEND CLUB"}</strong>
              <span><i /> {support && selected ? "Conversación activa" : "Atención privada"}</span>
            </div>
            <button className="support-close" onClick={() => setOpen(false)} aria-label="Cerrar chat" title="Cerrar"><X /></button>
          </header>

          {loading ? (
            <div className="support-loading">
              <MessageCircle />
              <p>Conectando con atención…</p>
            </div>
          ) : error && !userId ? (
            <div className="support-loading"><p>{error}</p></div>
          ) : (
            <div className="support-layout">
              {support && (
                <aside className={selected ? "has-selection" : ""}>
                  <div className="support-search">
                    <Search />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Buscar contacto"
                    />
                  </div>
                  <small>CONVERSACIONES</small>
                  {filtered.map((item) => {
                    const owner = item.profiles as Row | null;
                    const name = String(owner?.full_name ?? owner?.email ?? item.subject ?? "Cliente");
                    return (
                      <button
                        className={String(item.id) === selected ? "active" : ""}
                        key={String(item.id)}
                        onClick={() => choose(String(item.id))}
                      >
                        <span>{name.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{name}</strong>
                          <small>{String(item.status) === "open" ? "Conversación activa" : "Cerrada"}</small>
                        </div>
                        <time>{formatConversationTime(item.updated_at)}</time>
                      </button>
                    );
                  })}
                  {!filtered.length && <p>Sin conversaciones.</p>}
                </aside>
              )}

              <div className={`support-thread ${!selected ? "empty" : ""}`}>
                {selected ? (
                  <>
                    <div className="support-contact">
                      {support && (
                        <button onClick={() => setSelected(null)} aria-label="Volver a conversaciones">
                          <ArrowLeft />
                        </button>
                      )}
                      <span className="support-contact-avatar">{contactInitials}</span>
                      <div>
                        <strong>{contactName}</strong>
                        <span>
                          {support
                            ? "Atención individual"
                            : "Solo tú y nuestro equipo pueden ver este chat"}
                        </span>
                      </div>
                    </div>

                    <div className="support-messages" aria-live="polite">
                      {messages.map((message, index) => {
                        const mine = String(message.sender_id) === userId;
                        const sender = message.profiles as Row | null;
                        const previous = messages[index - 1];
                        const currentDay = new Date(String(message.created_at)).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" });
                        const previousDay = previous
                          ? new Date(String(previous.created_at)).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" })
                          : "";
                        return (
                          <div className="support-message-row" key={String(message.id)}>
                            {currentDay !== previousDay && <div className="support-date"><span>{formatMessageDate(message.created_at)}</span></div>}
                            <article className={mine ? "mine" : ""}>
                              <small>
                                {mine
                                  ? "Tú"
                                  : support
                                    ? String(sender?.full_name ?? sender?.email ?? "Cliente")
                                    : "LEGEND CLUB"}
                              </small>
                              <p>{String(message.body)}</p>
                              <time>
                                {new Intl.DateTimeFormat("es-BO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: "America/La_Paz",
                                }).format(new Date(String(message.created_at)))}
                                {mine && <Check aria-label="Enviado" />}
                              </time>
                            </article>
                          </div>
                        );
                      })}
                      {!messages.length && (
                        <div className="support-empty">
                          <Headphones />
                          <p>Inicia una conversación privada con atención al cliente.</p>
                        </div>
                      )}
                      <div ref={messageEndRef} />
                    </div>

                    <form ref={composeRef} className="support-compose" onSubmit={send}>
                      <button
                        className="support-attach"
                        type="button"
                        title="Envío de archivos disponible próximamente"
                        aria-label="Adjuntar archivo, disponible próximamente"
                        disabled
                      >
                        <Paperclip />
                      </button>
                      <textarea
                        ref={messageInputRef}
                        name="body"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            composeRef.current?.requestSubmit();
                          }
                        }}
                        maxLength={2000}
                        rows={1}
                        placeholder="Escribe un mensaje…"
                        aria-label="Mensaje"
                        required
                      />
                      <button className="support-send" disabled={busy || !draft.trim()} aria-label="Enviar mensaje">
                        <Send />
                      </button>
                    </form>
                    {error && <small className="support-error">{error}</small>}
                  </>
                ) : (
                  <div className="support-empty">
                    <MessageCircle />
                    <p>Selecciona un contacto para responder.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

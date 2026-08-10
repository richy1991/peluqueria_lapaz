"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Headphones,
  MessageCircle,
  MessagesSquare,
  Paperclip,
  Search,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = { full_name?: string | null; email?: string | null };
type Conversation = {
  id: string;
  subject?: string;
  status?: string;
  updated_at?: string;
  created_by?: string;
  profiles?: Profile | null;
};
type ChatMessage = {
  id: string;
  conversation_id: string;
  body: string;
  created_at: string;
  sender_id: string;
  read_at?: string | null;
  read_by?: string | null;
  profiles?: Profile | null;
};
type PanelPosition = { left: number; top: number };

function displayName(conversation?: Conversation) {
  return conversation?.profiles?.full_name
    ?? conversation?.profiles?.email
    ?? conversation?.subject
    ?? "Cliente";
}

function badgeValue(value: number) {
  return value > 99 ? "99+" : String(value);
}

export function FloatingSupportChat() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [support, setSupport] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadByConversation, setUnreadByConversation] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const [draggingPanel, setDraggingPanel] = useState(false);

  const panelRef = useRef<HTMLElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const composeRef = useRef<HTMLFormElement>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcastRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const openRef = useRef(false);
  const selectedRef = useRef<string | null>(null);
  const userIdRef = useRef("");
  const supportRef = useRef(false);
  const conversationsRef = useRef<Conversation[]>([]);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  useEffect(() => { supportRef.current = support; }, [support]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const focusMessageInput = useCallback((delay = 0) => {
    const focus = () => {
      const input = messageInputRef.current;
      if (!input || input.disabled || !selectedRef.current) return;
      input.focus({ preventScroll: true });
      const length = input.value.length;
      input.setSelectionRange(length, length);
    };
    window.requestAnimationFrame(focus);
    if (delay > 0) window.setTimeout(focus, delay);
  }, []);

  const unlockAudio = useCallback(async () => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (audioContextRef.current.state === "suspended") await audioContextRef.current.resume();
    return audioContextRef.current;
  }, []);

  const playIncomingSound = useCallback(async () => {
    try {
      const audio = await unlockAudio();
      if (audio.state !== "running") return;
      const start = audio.currentTime;
      const tone = (frequency: number, delay: number, duration: number) => {
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        const beginsAt = start + delay;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, beginsAt);
        gain.gain.setValueAtTime(0.0001, beginsAt);
        gain.gain.exponentialRampToValueAtTime(0.15, beginsAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, beginsAt + duration);
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.start(beginsAt);
        oscillator.stop(beginsAt + duration + 0.02);
      };
      tone(740, 0, 0.18);
      tone(988, 0.2, 0.24);
    } catch {
      // Algunos navegadores bloquean audio hasta la primera interacción del usuario.
    }
  }, [unlockAudio]);

  useEffect(() => {
    const enableSound = () => { void unlockAudio(); };
    window.addEventListener("pointerdown", enableSound, { once: true });
    window.addEventListener("keydown", enableSound, { once: true });
    return () => {
      window.removeEventListener("pointerdown", enableSound);
      window.removeEventListener("keydown", enableSound);
    };
  }, [unlockAudio]);

  const fetchConversations = useCallback(async (isSupport: boolean, createMissing = false) => {
    if (isSupport) {
      const { data, error: conversationError } = await supabase
        .from("conversations")
        .select("id,subject,status,updated_at,created_by,profiles!conversations_created_by_fkey(full_name,email)")
        .order("updated_at", { ascending: false })
        .limit(100);
      if (conversationError) throw conversationError;
      return (data ?? []) as unknown as Conversation[];
    }

    const conversationResult = await supabase
      .from("conversations")
      .select("id,subject,status,updated_at,created_by")
      .order("updated_at", { ascending: false })
      .limit(1);
    let data = conversationResult.data;
    const conversationError = conversationResult.error;
    if (conversationError) throw conversationError;

    if (!data?.length && createMissing) {
      const { data: id, error: createError } = await supabase.rpc("get_or_create_support_conversation");
      if (createError) throw createError;
      const result = await supabase
        .from("conversations")
        .select("id,subject,status,updated_at,created_by")
        .eq("id", id)
        .single();
      if (result.error) throw result.error;
      data = [result.data];
    }
    return (data ?? []) as unknown as Conversation[];
  }, [supabase]);

  const refreshUnread = useCallback(async (
    rows: Conversation[],
    currentUserId: string,
    isSupport: boolean,
  ) => {
    if (!rows.length || !currentUserId) {
      setUnreadByConversation({});
      return;
    }
    const ids = rows.map((item) => item.id);
    const { data, error: unreadError } = await supabase
      .from("messages")
      .select("conversation_id,sender_id,read_at")
      .in("conversation_id", ids)
      .is("read_at", null);
    if (unreadError) return;

    const creators = new Map(rows.map((item) => [item.id, item.created_by]));
    const counts: Record<string, number> = {};
    for (const message of data ?? []) {
      const conversationId = String(message.conversation_id);
      const senderId = String(message.sender_id);
      const incoming = isSupport
        ? senderId === String(creators.get(conversationId) ?? "")
        : senderId !== currentUserId;
      if (incoming) counts[conversationId] = (counts[conversationId] ?? 0) + 1;
    }
    setUnreadByConversation(counts);
  }, [supabase]);

  const refreshIndex = useCallback(async (createMissing = false) => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) return [] as Conversation[];
    const rows = await fetchConversations(supportRef.current, createMissing);
    conversationsRef.current = rows;
    setConversations(rows);
    await refreshUnread(rows, currentUserId, supportRef.current);
    return rows;
  }, [fetchConversations, refreshUnread]);

  const markConversationRead = useCallback(async (id: string) => {
    if (!id || document.visibilityState !== "visible") return;
    const { error: readError } = await supabase.rpc("mark_chat_conversation_read", {
      target_conversation: id,
    });
    if (!readError) {
      setUnreadByConversation((current) => ({ ...current, [id]: 0 }));
    }
  }, [supabase]);

  const loadMessages = useCallback(async (id: string, markAsRead = false) => {
    if (markAsRead) await markConversationRead(id);
    let { data, error: loadError } = await supabase
      .from("messages")
      .select("id,conversation_id,body,created_at,sender_id,read_at,read_by,profiles!messages_sender_id_fkey(full_name,email)")
      .eq("conversation_id", id)
      .order("created_at");
    if (loadError) {
      const fallback = await supabase
        .from("messages")
        .select("id,conversation_id,body,created_at,sender_id,profiles!messages_sender_id_fkey(full_name,email)")
        .eq("conversation_id", id)
        .order("created_at");
      data = fallback.data as typeof data;
      loadError = fallback.error;
    }
    if (loadError) setError(loadError.message);
    else if (selectedRef.current === id) setMessages((data ?? []) as unknown as ChatMessage[]);
  }, [markConversationRead, supabase]);

  const bootstrap = useCallback(async (createMissing = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { rows: [] as Conversation[], isSupport: false, currentUserId: "" };
    const [{ data: isAdmin }, { data: isCashier }] = await Promise.all([
      supabase.rpc("is_admin"),
      supabase.rpc("is_cashier"),
    ]);
    const isSupport = Boolean(isAdmin || isCashier);
    userIdRef.current = user.id;
    supportRef.current = isSupport;
    setUserId(user.id);
    setSupport(isSupport);
    const rows = await fetchConversations(isSupport, createMissing);
    conversationsRef.current = rows;
    setConversations(rows);
    await refreshUnread(rows, user.id, isSupport);
    return { rows, isSupport, currentUserId: user.id };
  }, [fetchConversations, refreshUnread, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void bootstrap(false).catch(() => undefined), 0);
    return () => window.clearTimeout(timer);
  }, [bootstrap]);

  async function initialize() {
    void unlockAudio();
    openRef.current = true;
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      const result = userIdRef.current
        ? { rows: await refreshIndex(true), currentUserId: userIdRef.current }
        : await bootstrap(true);
      if (!result.currentUserId) {
        setError("Inicia sesión para conversar con LEGEND CLUB.");
        return;
      }
      const target = supportRef.current ? null : selectedRef.current ?? result.rows[0]?.id ?? null;
      selectedRef.current = target;
      setSelected(target);
      if (supportRef.current) {
        setMessages([]);
        setPeerTyping(false);
        setQuery("");
      }
      if (target) await loadMessages(target, true);
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "No se pudo abrir el chat.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(id: string) {
    selectedRef.current = id;
    setSelected(id);
    setMessages([]);
    setPeerTyping(false);
    await loadMessages(id, true);
    focusMessageInput(80);
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = selectedRef.current;
    const body = draft.trim();
    if (!target || !body) return;
    setBusy(true);
    setError("");
    const { error: sendError } = await supabase.rpc("send_chat_message", {
      target_conversation: target,
      message_body: body,
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message);
      return;
    }
    setDraft("");
    void typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: userIdRef.current, typing: false },
    });
    await loadMessages(target);
    focusMessageInput(80);
  }

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`support-inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, async (payload) => {
        const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as Partial<ChatMessage>;
        const conversationId = String(row.conversation_id ?? "");
        if (!conversationId) return;
        const rows = await refreshIndex(false).catch(() => conversationsRef.current);
        const conversation = rows.find((item) => item.id === conversationId);
        const incoming = supportRef.current
          ? String(row.sender_id) === String(conversation?.created_by ?? "")
          : String(row.sender_id) !== userIdRef.current;
        if (payload.eventType === "INSERT" && incoming) void playIncomingSound();
        if (openRef.current && selectedRef.current === conversationId) {
          const visible = document.visibilityState === "visible";
          await loadMessages(conversationId, visible);
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, playIncomingSound, refreshIndex, supabase, userId]);

  useEffect(() => {
    if (!open || !selected || !userId) return;
    const channel = supabase
      .channel(`support-typing-${selected}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (String(payload?.userId) === userIdRef.current) return;
        if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
        const active = Boolean(payload?.typing);
        setPeerTyping(active);
        if (active) {
          peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 2600);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      typingChannelRef.current = null;
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      void supabase.removeChannel(channel);
    };
  }, [open, selected, supabase, userId]);

  useEffect(() => {
    const channel = typingChannelRef.current;
    if (!channel || !open || !selected || !userId) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    const now = Date.now();
    if (draft.trim() && now - lastTypingBroadcastRef.current > 650) {
      lastTypingBroadcastRef.current = now;
      void channel.send({ type: "broadcast", event: "typing", payload: { userId, typing: true } });
    }
    typingStopTimerRef.current = setTimeout(() => {
      void channel.send({ type: "broadcast", event: "typing", payload: { userId, typing: false } });
    }, 1250);
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    };
  }, [draft, open, selected, userId]);

  useEffect(() => {
    const markVisibleConversation = () => {
      const target = selectedRef.current;
      if (document.visibilityState === "visible" && openRef.current && target) {
        void loadMessages(target, true);
      }
    };
    document.addEventListener("visibilitychange", markVisibleConversation);
    return () => document.removeEventListener("visibilitychange", markVisibleConversation);
  }, [loadMessages]);

  useEffect(() => {
    const thread = messagesRef.current;
    if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
    if (open && selected) focusMessageInput(60);
  }, [focusMessageInput, messages, open, peerTyping, selected]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const viewport = window.visualViewport;
    const isMobile = window.matchMedia("(max-width: 760px)");
    const previousOverflow = document.body.style.overflow;

    const updateViewport = () => {
      if (!panel || !isMobile.matches) {
        panel?.style.removeProperty("--support-modal-top");
        panel?.style.removeProperty("--support-modal-left");
        panel?.style.removeProperty("--support-modal-width");
        panel?.style.removeProperty("--support-modal-height");
        document.body.style.overflow = previousOverflow;
        return;
      }
      document.body.style.overflow = "hidden";
      const visibleHeight = viewport?.height ?? window.innerHeight;
      const visibleWidth = viewport?.width ?? document.documentElement.clientWidth;
      const visibleTop = viewport?.offsetTop ?? 0;
      const visibleLeft = viewport?.offsetLeft ?? 0;
      panel.style.setProperty("--support-modal-top", `${Math.max(0, visibleTop)}px`);
      panel.style.setProperty("--support-modal-left", `${Math.max(0, visibleLeft)}px`);
      panel.style.setProperty("--support-modal-width", `${Math.max(1, visibleWidth)}px`);
      panel.style.setProperty("--support-modal-height", `${Math.max(1, visibleHeight)}px`);
      window.requestAnimationFrame(() => {
        const thread = messagesRef.current;
        if (thread) thread.scrollTop = thread.scrollHeight;
      });
    };

    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      panel?.style.removeProperty("--support-modal-top");
      panel?.style.removeProperty("--support-modal-left");
      panel?.style.removeProperty("--support-modal-width");
      panel?.style.removeProperty("--support-modal-height");
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handlePanelClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[data-no-refocus='true']")) return;
    focusMessageInput(20);
  }, [focusMessageInput]);

  const startPanelDrag = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || window.matchMedia("(max-width: 760px)").matches) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,input,textarea,select,a,[data-no-drag='true']")) return;
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    setPanelPosition({ left: rect.left, top: rect.top });
    setDraggingPanel(true);
    event.preventDefault();
  }, []);

  useEffect(() => {
    if (!draggingPanel) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const move = (event: PointerEvent) => {
      const drag = dragStateRef.current;
      const panel = panelRef.current;
      if (!drag || !panel || event.pointerId !== drag.pointerId) return;
      const margin = 8;
      const maxLeft = Math.max(margin, window.innerWidth - panel.offsetWidth - margin);
      const maxTop = Math.max(margin, window.innerHeight - panel.offsetHeight - margin);
      const left = Math.min(maxLeft, Math.max(margin, drag.startLeft + event.clientX - drag.startX));
      const top = Math.min(maxTop, Math.max(margin, drag.startTop + event.clientY - drag.startY));
      setPanelPosition({ left, top });
    };
    const stop = (event: PointerEvent) => {
      if (event.pointerId !== dragStateRef.current?.pointerId) return;
      dragStateRef.current = null;
      setDraggingPanel(false);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [draggingPanel]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  const filtered = conversations.filter((item) => displayName(item)
    .toLowerCase()
    .includes(query.toLowerCase()));
  const selectedConversation = conversations.find((item) => item.id === selected);
  const contactName = support ? displayName(selectedConversation) : "Soporte LEGEND CLUB";
  const contactInitials = support ? contactName.slice(0, 2).toUpperCase() : "LC";
  const unreadTotal = Object.values(unreadByConversation).reduce((total, value) => total + value, 0);

  function formatConversationTime(value?: string) {
    if (!value) return "";
    return new Intl.DateTimeFormat("es-BO", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz",
    }).format(new Date(value));
  }

  function formatMessageDate(value: string) {
    return new Intl.DateTimeFormat("es-BO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/La_Paz",
    }).format(new Date(value));
  }

  return (
    <>
      {!open && (
        <button className="support-fab" onClick={initialize} aria-label={unreadTotal ? `Abrir chat, ${unreadTotal} mensajes sin leer` : "Abrir atención al cliente"}>
          <MessageCircle />
          {unreadTotal > 0 ? <b className="support-unread-badge">{badgeValue(unreadTotal)}</b> : <i />}
        </button>
      )}

      {open && (
        <section
          ref={panelRef}
          onClick={handlePanelClick}
          style={panelPosition ? { left: panelPosition.left, top: panelPosition.top, right: "auto", bottom: "auto" } : undefined}
          className={`support-window ${support ? "support-agent" : "support-client"} ${draggingPanel ? "is-dragging" : ""}`}
          aria-label="Atención al cliente"
          role="dialog"
          aria-modal="true"
        >
          <header onPointerDown={startPanelDrag} data-drag-handle="true" title="Arrastra para mover el chat">
            <div className={`support-logo ${support && selected ? "is-contact" : ""}`}>
              {support && selected ? contactInitials : <Headphones />}
            </div>
            <div className="support-header-copy">
              <strong>{support && selected ? contactName : "LEGEND CLUB"}</strong>
              <span className={peerTyping ? "is-typing" : ""}><i /> {peerTyping ? "Escribiendo…" : support && selected ? "Conversación activa" : "Atención privada"}</span>
            </div>
            {support && selected && (
              <button
                className="support-history"
                onClick={() => { selectedRef.current = null; setSelected(null); setPeerTyping(false); }}
                aria-label="Abrir conversaciones recientes"
                title="Conversaciones recientes"
              >
                <MessagesSquare />
                {unreadTotal > 0 && <b>{badgeValue(unreadTotal)}</b>}
              </button>
            )}
            <button className="support-close" onClick={() => setOpen(false)} aria-label="Cerrar chat" title="Cerrar"><X /></button>
          </header>

          {loading ? (
            <div className="support-loading"><MessageCircle /><p>Conectando con atención…</p></div>
          ) : error && !userId ? (
            <div className="support-loading"><p>{error}</p></div>
          ) : (
            <div className="support-layout">
              {support && (
                <aside className={selected ? "has-selection" : ""}>
                  <div className="support-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contacto" /></div>
                  <small>CONVERSACIONES</small>
                  {filtered.map((item) => {
                    const name = displayName(item);
                    const unread = unreadByConversation[item.id] ?? 0;
                    return (
                      <button className={item.id === selected ? "active" : ""} key={item.id} onClick={() => choose(item.id)}>
                        <span>{name.slice(0, 2).toUpperCase()}</span>
                        <div><strong>{name}</strong><small>{item.status === "open" ? "Conversación activa" : "Cerrada"}</small></div>
                        <span className="support-conversation-meta">
                          <time>{formatConversationTime(item.updated_at)}</time>
                          {unread > 0 && <b className="support-contact-unread">{badgeValue(unread)}</b>}
                        </span>
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
                      {support && <button onClick={() => { selectedRef.current = null; setSelected(null); setPeerTyping(false); }} aria-label="Volver a conversaciones"><ArrowLeft /></button>}
                      <span className="support-contact-avatar">{contactInitials}</span>
                      <div>
                        <strong>{contactName}</strong>
                        <span className={peerTyping ? "is-typing" : ""}>{peerTyping ? "Escribiendo…" : support ? "Atención individual" : "Solo tú y nuestro equipo pueden ver este chat"}</span>
                      </div>
                    </div>

                    <div ref={messagesRef} className="support-messages" aria-live="polite">
                      {messages.map((message, index) => {
                        const mine = message.sender_id === userId;
                        const previous = messages[index - 1];
                        const currentDay = new Date(message.created_at).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" });
                        const previousDay = previous ? new Date(previous.created_at).toLocaleDateString("es-BO", { timeZone: "America/La_Paz" }) : "";
                        return (
                          <div className="support-message-row" key={message.id}>
                            {currentDay !== previousDay && <div className="support-date"><span>{formatMessageDate(message.created_at)}</span></div>}
                            <article className={mine ? "mine" : ""}>
                              <small>{mine ? "Tú" : support ? message.profiles?.full_name ?? message.profiles?.email ?? "Cliente" : "LEGEND CLUB"}</small>
                              <p>{message.body}</p>
                              <time>
                                {new Intl.DateTimeFormat("es-BO", { hour: "2-digit", minute: "2-digit", timeZone: "America/La_Paz" }).format(new Date(message.created_at))}
                                {mine && (message.read_at ? <CheckCheck className="is-read" aria-label="Leído" /> : <Check aria-label="Enviado" />)}
                              </time>
                            </article>
                          </div>
                        );
                      })}
                      {!messages.length && <div className="support-empty"><Headphones /><p>Inicia una conversación privada con atención al cliente.</p></div>}
                      {peerTyping && <div className="support-typing"><span><i /><i /><i /></span><small>Escribiendo…</small></div>}
                    </div>

                    <form ref={composeRef} className="support-compose" onSubmit={send}>
                      <button className="support-attach" type="button" title="Envío de archivos disponible próximamente" aria-label="Adjuntar archivo, disponible próximamente" disabled><Paperclip /></button>
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
                      <button className="support-send" disabled={busy || !draft.trim()} aria-label="Enviar mensaje"><Send /></button>
                    </form>
                    {error && <small className="support-error">{error}</small>}
                  </>
                ) : (
                  <div className="support-empty"><MessageCircle /><p>Selecciona un contacto para responder.</p></div>
                )}
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

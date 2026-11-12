import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { ScrollViewInstance } from 'react-native';
import { MessageCircle, Send } from 'lucide-react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, palette } from '@/components/ui';
import { barberTabs, clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

type ChatMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null };

export function SupportChat({ role }: { role: 'client' | 'barber' }) {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState('Conectando');
  const [peerTyping, setPeerTyping] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMessages = useCallback(async (id: string, markRead = false) => {
    if (markRead) await supabase.rpc('mark_chat_conversation_read', { target_conversation: id });
    const { data, error: loadError } = await supabase.from('messages').select('id,conversation_id,sender_id,body,created_at,read_at').eq('conversation_id', id).order('created_at');
    if (loadError) throw loadError;
    setMessages((data ?? []) as ChatMessage[]);
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      if (!userId) { setLoading(false); return; }
      setLoading(true); setError('');
      try {
        const { data: existing, error: existingError } = await supabase.from('conversations').select('id').order('updated_at', { ascending: false }).limit(1);
        if (existingError) throw existingError;
        let id = existing?.[0]?.id ?? '';
        if (!id) {
          const { data, error: createError } = await supabase.rpc('get_or_create_support_conversation');
          if (createError) throw createError;
          id = String(data ?? '');
        }
        if (!id) throw new Error('No se pudo abrir la conversación.');
        if (!active) return;
        setConversationId(id);
        await loadMessages(id, true);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'No se pudo abrir el chat.');
      } finally { if (active) setLoading(false); }
    }
    void initialize();
    return () => { active = false; };
  }, [userId, loadMessages]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase.channel(`mobile-conversation-${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as Partial<ChatMessage>;
        if (!row.id) return;
        if (payload.eventType === 'INSERT') {
          const next = row as ChatMessage;
          setMessages((current) => current.some((item) => item.id === next.id) ? current : [...current, next]);
          if (next.sender_id !== userId) void supabase.rpc('mark_chat_conversation_read', { target_conversation: conversationId });
        } else if (payload.eventType === 'UPDATE') {
          setMessages((current) => current.map((item) => item.id === row.id ? { ...item, ...row } as ChatMessage : item));
        }
      })
      .subscribe((status) => {
        setConnection(status === 'SUBSCRIBED' ? 'Conectado' : status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' ? 'Sin conexión en tiempo real' : 'Conectando');
      });
    const typingChannel = supabase.channel(`mobile-typing-${conversationId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (String(payload?.userId) === userId) return;
        if (peerTimerRef.current) clearTimeout(peerTimerRef.current);
        const active = Boolean(payload?.typing);
        setPeerTyping(active);
        if (active) peerTimerRef.current = setTimeout(() => setPeerTyping(false), 2500);
      }).subscribe();
    typingChannelRef.current = typingChannel;
    return () => {
      typingChannelRef.current = null;
      if (peerTimerRef.current) clearTimeout(peerTimerRef.current);
      void supabase.removeChannel(channel);
      void supabase.removeChannel(typingChannel);
    };
  }, [conversationId, userId]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = typingChannelRef.current;
    if (!channel) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (draft.trim()) void channel.send({ type: 'broadcast', event: 'typing', payload: { userId, typing: true } });
    typingTimerRef.current = setTimeout(() => void channel.send({ type: 'broadcast', event: 'typing', payload: { userId, typing: false } }), 1200);
    return () => { if (typingTimerRef.current) clearTimeout(typingTimerRef.current); };
  }, [draft, conversationId, userId]);

  async function send() {
    const body = draft.trim();
    if (!conversationId || !body || busy) return;
    setBusy(true); setError('');
    const { error: sendError } = await supabase.rpc('send_chat_message', { target_conversation: conversationId, message_body: body });
    setBusy(false);
    if (sendError) { setError(sendError.message); return; }
    setDraft('');
    try { await loadMessages(conversationId, false); } catch { /* El mensaje se sincroniza por tiempo real al reconectar. */ }
  }

  return (
    <AppShell title="Atención al cliente" roleLabel="MENSAJERÍA" tabs={role === 'client' ? clientTabs : barberTabs} backHref={role === 'client' ? '/client' : '/barber'} showChat={false}>
      <PageHeading eyebrow="Atención LEGEND" title="Conversación" description="Escribe a nuestro equipo. Tus mensajes se sincronizan con el soporte del sitio." />
      <Card style={styles.chatCard}>
        <CardTitle icon={MessageCircle} title="Soporte LEGEND CLUB" subtitle={connection} />
        {loading ? <EmptyState title="Cargando conversación…" /> : null}
        {error ? <InlineMessage>{error}</InlineMessage> : null}
        {!loading && !error && !messages.length ? <EmptyState title="Inicia la conversación" description="Cuéntanos cómo podemos ayudarte." /> : null}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
          <ScrollView ref={scrollRef} style={styles.messages} contentContainerStyle={styles.messagesContent} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {messages.map((item) => {
              const mine = item.sender_id === userId;
              return (
                <View key={item.id} style={[styles.messageRow, mine ? styles.mineRow : styles.theirRow]}>
                  <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
                    <Text style={[styles.sender, mine && styles.senderMine]}>{mine ? 'Tú' : 'LEGEND CLUB'}</Text>
                    <Text style={styles.messageText}>{item.body}</Text>
                    <Text style={styles.messageDate}>{formatDate(item.created_at, { dateStyle: undefined, timeStyle: 'short', timeZone: 'America/La_Paz' })}{mine && item.read_at ? ' · Visto' : ''}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          {peerTyping ? <Text style={styles.typing}>LEGEND CLUB está escribiendo…</Text> : null}
          <View style={styles.composer}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="Escribe un mensaje…" placeholderTextColor="#82776e" style={styles.input} multiline maxLength={2000} editable={!loading && Boolean(conversationId)} />
            <ActionButton label="Enviar" icon={Send} compact disabled={!draft.trim() || !conversationId} loading={busy} onPress={() => void send()} />
          </View>
        </KeyboardAvoidingView>
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  chatCard: { padding: 13 },
  messages: { maxHeight: 390, minHeight: 180, backgroundColor: '#191512', borderRadius: 14, padding: 10 },
  messagesContent: { gap: 10, paddingBottom: 8 },
  messageRow: { width: '100%', flexDirection: 'row' },
  mineRow: { justifyContent: 'flex-end' },
  theirRow: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '88%', minWidth: 100, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, gap: 5 },
  mineBubble: { backgroundColor: '#6e4c29', borderBottomRightRadius: 4 },
  theirBubble: { backgroundColor: '#29221c', borderColor: palette.border, borderWidth: 1, borderBottomLeftRadius: 4 },
  sender: { color: palette.gold, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  senderMine: { color: '#f4d08a' },
  messageText: { color: palette.text, fontSize: 13, lineHeight: 19 },
  messageDate: { color: '#cfbda5', fontSize: 9, textAlign: 'right' },
  typing: { color: palette.gold, fontSize: 10, paddingVertical: 5 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 10 },
  input: { flex: 1, maxHeight: 110, minHeight: 44, borderColor: palette.border, borderWidth: 1, borderRadius: 13, backgroundColor: '#191512', color: palette.text, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, textAlignVertical: 'top' },
});

import { useEffect, useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Minus, PackageCheck, Plus, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, palette } from '@/components/ui';
import { barberTabs, clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type Product = { id: string; name: string; description: string | null; category: string | null; brand: string | null; presentation: string | null; price: number; stock: number; image_paths: string[]; image_path: string | null };
type Reservation = { id: string; product_id: string; quantity: number; price_snapshot: number; expires_at: string; products: { name?: string } | null };
type CartLine = { productId: string; quantity: number };
type CatalogData = { products: Product[]; reservations: Reservation[] };

const cartKey = 'legend_club_product_cart';

function readStoredCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(cartKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is CartLine => typeof item?.productId === 'string' && Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 10) : [];
  } catch { return []; }
}

export function ProductCatalogPanel({ role }: { role: 'client' | 'barber' }) {
  const { session } = useSession();
  const userId = session?.user.id ?? '';
  const [cart, setCart] = useState<CartLine[]>(readStoredCart);
  const [expanded, setExpanded] = useState('');
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const query = useRemoteData<CatalogData>(async () => {
    if (!userId) throw new Error('Inicia sesión para consultar el catálogo.');
    const [productsResult, reservationsResult] = await Promise.all([
      supabase.from('products').select('id,name,description,category,brand,presentation,price,stock,image_paths,image_path').eq('status', 'active').gt('stock', 0).order('created_at', { ascending: false }).limit(80),
      role === 'client'
        ? supabase.from('product_reservations').select('id,product_id,quantity,price_snapshot,expires_at,products(name)').eq('client_id', userId).eq('status', 'reserved').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    return { products: requireData(productsResult) as Product[], reservations: requireData(reservationsResult) as Reservation[] };
  }, `${role}:${userId}`);

  useEffect(() => {
    try { localStorage.setItem(cartKey, JSON.stringify(cart)); } catch { /* El carrito sigue funcionando en esta sesión. */ }
  }, [cart]);

  const products = query.data?.products ?? [];
  const reservations = role === 'client' ? query.data?.reservations ?? [] : [];
  const reservedIds = new Set(reservations.map((item) => item.product_id));
  const visibleCart = cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: Math.max(1, Math.min(item.quantity, product.stock, 10)) }] : [];
  });
  const cartTotal = visibleCart.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);

  function addToCart(product: Product) {
    if (!product.stock || reservedIds.has(product.id)) return;
    setCart((previous) => {
      const line = previous.find((item) => item.productId === product.id);
      return line
        ? previous.map((item) => item.productId === product.id ? { ...item, quantity: Math.min(10, product.stock, item.quantity + 1) } : item)
        : [...previous, { productId: product.id, quantity: 1 }];
    });
    setMessage(`${product.name} se agregó al carrito.`);
    setError('');
  }

  function changeQuantity(product: Product, next: number) {
    if (next <= 0) { setCart((previous) => previous.filter((item) => item.productId !== product.id)); return; }
    setCart((previous) => previous.map((item) => item.productId === product.id ? { ...item, quantity: Math.max(1, Math.min(10, product.stock, next)) } : item));
  }

  async function reserve(product: Product, quantity = 1) {
    setBusyId(product.id); setError(''); setMessage('');
    const { error: reservationError } = await supabase.rpc('reserve_product', { p_product_id: product.id, p_quantity: quantity });
    setBusyId('');
    if (reservationError) { setError(reservationError.message); return; }
    setCart((previous) => previous.filter((item) => item.productId !== product.id));
    setMessage('Producto apartado durante 24 horas. Preséntate en el local para recogerlo y pagar.');
    query.refresh();
  }

  async function cancelReservation(reservation: Reservation) {
    setBusyId(reservation.id); setError(''); setMessage('');
    const { error: cancelError } = await supabase.rpc('cancel_my_product_reservation', { p_reservation_id: reservation.id });
    setBusyId('');
    if (cancelError) { setError(cancelError.message); return; }
    setMessage('Apartado cancelado. El producto ya no está reservado.');
    query.refresh();
  }

  const tabs = role === 'client' ? clientTabs : barberTabs;
  return (
    <AppShell title="Productos" roleLabel={role === 'client' ? 'CATÁLOGO' : 'CATÁLOGO DEL LOCAL'} activeTab="productos" tabs={tabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Catálogo" title={role === 'client' ? 'Productos' : 'Productos del local'} description="Revisa sus fotos, presentación, existencias y precio. Puedes apartarlos durante 24 horas." />
      {query.error || error || message ? <InlineMessage tone={message.includes('apartado') || message.includes('cancelado') || message.includes('agregó') ? 'success' : 'error'}>{message || error || query.error}</InlineMessage> : null}

      <Card>
        <CardTitle icon={ShoppingCart} title="Tu carrito" subtitle={visibleCart.length ? `${visibleCart.length} producto(s) · ${formatMoney(cartTotal)}` : 'Agrega productos para tenerlos a mano.'} />
        {visibleCart.length ? <>
          {visibleCart.map(({ product, quantity }) => (
            <View key={product.id} style={styles.cartRow}>
              <View style={{ flex: 1, gap: 4 }}><Text style={styles.itemTitle}>{product.name}</Text><Text style={styles.muted}>{formatMoney(product.price)} · {product.stock} disponibles</Text></View>
              <View style={styles.quantityControl}>
                <ActionButton label="−" icon={Minus} tone="secondary" compact onPress={() => changeQuantity(product, quantity - 1)} />
                <Text style={styles.quantity}>{quantity}</Text>
                <ActionButton label="+" icon={Plus} tone="secondary" compact disabled={quantity >= Math.min(product.stock, 10)} onPress={() => changeQuantity(product, quantity + 1)} />
              </View>
              <ActionButton label="Quitar" icon={Trash2} tone="danger" compact onPress={() => changeQuantity(product, 0)} />
              <ActionButton label="Apartar" icon={ShoppingBag} compact loading={busyId === product.id} onPress={() => void reserve(product, quantity)} />
            </View>
          ))}
          <View style={styles.cartTotal}><Text style={styles.muted}>Total de la selección</Text><Text style={styles.price}>{formatMoney(cartTotal)}</Text></View>
          <Text style={styles.muted}>Cada apartado dura 24 horas. El pago se realiza al recogerlo en el local.</Text>
        </> : <EmptyState title="Tu carrito está vacío" description="Abre un producto y agrégalo aquí." />}
      </Card>

      {role === 'client' ? <Card>
        <CardTitle icon={PackageCheck} title="Mis productos apartados" subtitle="Recoge y paga antes de la hora de vencimiento." />
        {reservations.length ? reservations.map((reservation) => (
          <View key={reservation.id} style={styles.reservationRow}>
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.itemTitle}>{reservation.products?.name ?? 'Producto'}</Text><Text style={styles.muted}>{reservation.quantity} unidad(es) · {formatMoney(Number(reservation.price_snapshot) * reservation.quantity)}</Text><Text style={styles.muted}>Vence {formatDate(reservation.expires_at)}</Text></View>
            <ActionButton label="Cancelar" icon={X} tone="danger" compact loading={busyId === reservation.id} onPress={() => Alert.alert('Cancelar apartado', `¿Cancelar el apartado de ${reservation.products?.name ?? 'este producto'}?`, [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar apartado', style: 'destructive', onPress: () => void cancelReservation(reservation) }])} />
          </View>
        )) : <EmptyState title="No tienes apartados activos" description="Tus productos reservados por 24 horas aparecerán aquí." />}
      </Card> : null}

      <Card>
        <CardTitle icon={PackageCheck} title="Productos disponibles" subtitle="El stock final se confirma al apartar." />
        {products.length ? products.map((product) => {
          const images = product.image_paths?.length ? product.image_paths : product.image_path ? [product.image_path] : [];
          const image = publicMediaUrl(images[0]);
          const isExpanded = expanded === product.id;
          const alreadyReserved = reservedIds.has(product.id);
          return (
            <View key={product.id} style={styles.productRow}>
              {image ? <Image source={{ uri: image }} alt={product.name} style={styles.productImage} /> : <View style={styles.productPlaceholder}><PackageCheck size={24} color={palette.gold} /></View>}
              <View style={styles.productCopy}>
                <Text style={styles.itemTitle}>{product.name}</Text>
                <Text style={styles.muted}>{product.category || 'Cuidado personal'} · {product.stock} disponibles</Text>
                <Text style={styles.price}>{formatMoney(product.price)}</Text>
                {isExpanded ? <>
                  {product.brand ? <Text style={styles.muted}>Marca: {product.brand}</Text> : null}
                  {product.presentation ? <Text style={styles.muted}>Presentación: {product.presentation}</Text> : null}
                  {product.description ? <Text style={styles.muted}>{product.description}</Text> : null}
                  {images.length > 1 ? <View style={styles.imageStrip}>{images.slice(1, 3).map((path, index) => { const uri = publicMediaUrl(path); return uri ? <Image key={`${path}-${index}`} source={{ uri }} alt={`${product.name}, foto ${index + 2}`} style={styles.secondaryImage} /> : null; })}</View> : null}
                </> : null}
                <View style={styles.productActions}>
                  <ActionButton label={isExpanded ? 'Ocultar detalles' : 'Ver detalles'} compact tone="secondary" onPress={() => setExpanded(isExpanded ? '' : product.id)} />
                  <ActionButton label="Agregar al carrito" icon={ShoppingCart} compact disabled={alreadyReserved} onPress={() => addToCart(product)} />
                  <ActionButton label={alreadyReserved ? 'Ya apartado' : 'Apartar ahora'} icon={ShoppingBag} compact tone="secondary" loading={busyId === product.id} disabled={alreadyReserved} onPress={() => void reserve(product)} />
                </View>
              </View>
            </View>
          );
        }) : !query.loading ? <EmptyState title="No hay productos disponibles" description="El catálogo se actualiza desde la administración del local." /> : null}
      </Card>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  cartRow: { gap: 9, paddingVertical: 12, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  quantityControl: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantity: { minWidth: 18, textAlign: 'center', color: palette.text, fontWeight: '800' },
  cartTotal: { borderTopColor: palette.border, borderTopWidth: 1, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reservationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  productRow: { flexDirection: 'row', gap: 11, paddingVertical: 13, borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth },
  productImage: { width: 90, height: 110, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  productPlaceholder: { width: 90, height: 110, borderRadius: 12, backgroundColor: palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  productCopy: { flex: 1, gap: 7 },
  itemTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  price: { color: palette.gold, fontSize: 13, fontWeight: '900' },
  productActions: { gap: 7, marginTop: 3 },
  imageStrip: { flexDirection: 'row', gap: 7 },
  secondaryImage: { flex: 1, height: 66, borderRadius: 9, backgroundColor: palette.surfaceRaised },
});

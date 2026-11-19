import { useCallback, useEffect, useMemo, useState, type SetStateAction } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThemedText as Text } from '@/components/ThemedText';
import { ChevronLeft, ChevronRight, Minus, PackageCheck, Plus, ShoppingBag, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppShell } from '@/components/AppShell';
import { ClientPageHeader, useClientHeaderHeight } from '@/components/ClientPageHeader';
import { ActionButton, EmptyState, InlineMessage, PageHeading, TextField } from '@/components/ui';
import { useAppearance } from '@/lib/appearance';
import { barberTabs, clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { formatDate, formatMoney, publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type Product = { id: string; name: string; description: string | null; category: string | null; brand: string | null; presentation: string | null; price: number; stock: number; image_paths: string[]; image_path: string | null };
type Reservation = { id: string; product_id: string; quantity: number; price_snapshot: number; expires_at: string; products: { name?: string } | null };
type CartLine = { productId: string; quantity: number };
type CatalogData = { products: Product[]; reservations: Reservation[] };

const cartKey = 'legend_club_product_cart';
const noProducts: Product[] = [];
const noReservations: Reservation[] = [];

function readStoredCart(ownerKey: string): CartLine[] {
  try {
    const raw = globalThis.localStorage?.getItem(ownerKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is CartLine => typeof item?.productId === 'string' && Number.isInteger(item?.quantity) && item.quantity > 0 && item.quantity <= 10) : [];
  } catch { return []; }
}

export function ProductCatalogPanel({ role }: { role: 'client' | 'barber' }) {
  const { session } = useSession();
  const { colors } = useAppearance();
  const insets = useSafeAreaInsets();
  const headerHeight = useClientHeaderHeight(226);
  const userId = session?.user.id ?? '';
  const ownerKey = `${cartKey}:${role}:${userId}`;
  const [carts, setCarts] = useState<Record<string, CartLine[]>>({});
  const cart = useMemo(() => carts[ownerKey] ?? readStoredCart(ownerKey), [carts, ownerKey]);
  const setCart = useCallback((update: SetStateAction<CartLine[]>) => {
    setCarts((current) => {
      const previous = current[ownerKey] ?? readStoredCart(ownerKey);
      return { ...current, [ownerKey]: typeof update === 'function' ? update(previous) : update };
    });
  }, [ownerKey]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  const [busyId, setBusyId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
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
    if (!userId) return;
    try { globalThis.localStorage?.setItem(ownerKey, JSON.stringify(cart)); } catch { /* El carrito sigue funcionando en esta sesión. */ }
  }, [cart, ownerKey, userId]);

  const products = query.data?.products ?? noProducts;
  const reservations = role === 'client' ? query.data?.reservations ?? noReservations : noReservations;
  const reservedIds = new Set(reservations.map((item) => item.product_id));
  const visibleCart = cart.flatMap((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: Math.max(1, Math.min(item.quantity, product.stock, 10)) }] : [];
  });
  const cartTotal = visibleCart.reduce((total, item) => total + Number(item.product.price) * item.quantity, 0);
  const categories = useMemo(() => ['Todos', ...new Set(products.map((product) => product.category?.trim()).filter((item): item is string => Boolean(item)))], [products]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es-BO');
    return products.filter((product) => {
      const matchesCategory = category === 'Todos' || product.category === category;
      const matchesSearch = !term || [product.name, product.brand, product.category, product.description].some((value) => value?.toLocaleLowerCase('es-BO').includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [category, products, search]);

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
    setSelectedProduct(null);
  }

  function changeQuantity(product: Product, next: number) {
    if (next <= 0) { setCart((previous) => previous.filter((item) => item.productId !== product.id)); return; }
    setCart((previous) => previous.map((item) => item.productId === product.id ? { ...item, quantity: Math.max(1, Math.min(10, product.stock, next)) } : item));
  }

  async function reserve(product: Product, quantity = 1, closeDetails = false) {
    setBusyId(product.id); setError(''); setMessage('');
    try {
      const { error: reservationError } = await supabase.rpc('reserve_product', { p_product_id: product.id, p_quantity: quantity });
      if (reservationError) throw reservationError;
      setCart((previous) => previous.filter((item) => item.productId !== product.id));
      setMessage('Producto apartado durante 24 horas. Preséntate en el local para recogerlo y pagar.');
      if (closeDetails) setSelectedProduct(null);
      query.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo apartar el producto. Inténtalo nuevamente.');
    } finally {
      setBusyId('');
    }
  }

  async function cancelReservation(reservation: Reservation) {
    setBusyId(reservation.id); setError(''); setMessage('');
    try {
      const { error: cancelError } = await supabase.rpc('cancel_my_product_reservation', { p_reservation_id: reservation.id });
      if (cancelError) throw cancelError;
      setMessage('Apartado cancelado. El producto ya no está reservado.');
      query.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo cancelar el apartado. Inténtalo nuevamente.');
    } finally {
      setBusyId('');
    }
  }

  function openProduct(product: Product) {
    setImageIndex(0);
    setSelectedProduct(product);
    setCartOpen(false);
    setError('');
    setMessage('');
  }

  function openCart() {
    setSelectedProduct(null);
    setCartOpen(true);
  }

  function closeViewer() {
    setSelectedProduct(null);
    setCartOpen(false);
  }

  const cartCount = visibleCart.reduce((total, item) => total + item.quantity, 0);
  const reservedQuantity = reservations.reduce((total, item) => total + item.quantity, 0);
  const selectedImages = selectedProduct?.image_paths?.length
    ? selectedProduct.image_paths
    : selectedProduct?.image_path ? [selectedProduct.image_path] : [];
  const activeImageIndex = Math.min(imageIndex, Math.max(0, selectedImages.length - 1));
  const selectedImageUrl = selectedImages[activeImageIndex] ? publicMediaUrl(selectedImages[activeImageIndex]) : null;
  const viewerVisible = cartOpen || Boolean(selectedProduct);
  const tabs = role === 'client' ? clientTabs : barberTabs;

  return (
    <AppShell title="Productos" roleLabel={role === 'client' ? 'CATÁLOGO' : 'CATÁLOGO DEL LOCAL'} activeTab="productos" tabs={tabs} onRefresh={query.refresh} refreshing={query.loading}
      floatingHeaderHeight={role === 'client' ? headerHeight : undefined}
      floatingHeader={role === 'client' ? (scrollY) => <ClientPageHeader scrollY={scrollY} expandedHeight={headerHeight} eyebrow="CATÁLOGO" title="Productos" description="Revisa fotos, presentación, existencias y precios. Aparta artículos durante 24 horas." /> : undefined}>
      {role === 'barber' ? <PageHeading eyebrow="Catálogo" title="Productos del local" description="Revisa fotos, presentación, existencias y precios. Aparta artículos durante 24 horas." /> : null}
      <View style={[styles.catalogBody, role === 'client' && styles.clientCatalogBody]}>
        {error || message ? <InlineMessage tone={message.includes('apartado') || message.includes('cancelado') || message.includes('agreg') ? 'success' : 'error'}>{message || error}</InlineMessage> : query.error && query.data ? <InlineMessage>{query.error}</InlineMessage> : null}

        {query.data ? <>
          <Animated.View entering={FadeInDown.duration(280)}>
            <Pressable onPress={openCart} accessibilityRole="button" accessibilityLabel={`Abrir carrito: ${cartCount} productos seleccionados y ${reservations.length} apartados activos`} style={[styles.cartLauncher, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
              <View style={[styles.cartLauncherIcon, { backgroundColor: colors.glassRaised }]}><ShoppingCart size={21} color={colors.accent} /></View>
              <View style={styles.cartLauncherCopy}>
                <Text style={[styles.cartLauncherTitle, { color: colors.text }]}>{'Tu carrito'}</Text>
                <Text style={[styles.cartLauncherSubtitle, { color: colors.muted }]}>{cartCount ? `${cartCount} producto(s) seleccionado(s)` : 'Aún está vacío'}{role === 'client' ? ` · ${reservations.length} apartado(s)` : ''}</Text>
              </View>
              <View style={[styles.cartLauncherBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.cartLauncherCount, { color: colors.accent }]}>{cartCount + reservedQuantity}</Text>
                <ChevronRight size={17} color={colors.accent} />
              </View>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(90).duration(280)} style={styles.catalogFilters}>
            <TextField label="Buscar productos" value={search} onChangeText={setSearch} placeholder="Nombre, marca o categoría" autoCapitalize="none" autoCorrect={false} returnKeyType="search" />
            {categories.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryList}>
              {categories.map((item) => {
                const selected = item === category;
                return <Pressable key={item} onPress={() => setCategory(item)} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.categoryChip, { backgroundColor: selected ? colors.accentSoft : colors.glassRaised, borderColor: selected ? colors.accent : colors.glassBorder }]}>
                  <Text style={[styles.categoryText, { color: selected ? colors.accent : colors.muted }]}>{item}</Text>
                </Pressable>;
              })}
            </ScrollView> : null}
          </Animated.View>

          {filteredProducts.length ? <View style={styles.productGrid}>{filteredProducts.map((product, index) => {
            const images = product.image_paths?.length ? product.image_paths : product.image_path ? [product.image_path] : [];
            const image = publicMediaUrl(images[0]);
            return (
              <Animated.View key={product.id} entering={FadeInDown.delay(210 + index * 55).duration(300)} style={[styles.productCard, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
                <Pressable onPress={() => openProduct(product)} accessibilityRole="button" accessibilityLabel={`Ver detalles de ${product.name}`} style={styles.productCardPress}>
                  {image ? <Image source={{ uri: image }} style={[styles.productImage, { backgroundColor: colors.raised }]} resizeMode="cover" alt={product.name} accessibilityLabel={product.name} /> : <View style={[styles.productPlaceholder, { backgroundColor: colors.raised }]}><PackageCheck size={27} color={colors.accent} /></View>}
                  {images.length > 1 ? <View style={[styles.imageCount, { backgroundColor: colors.raised }]}><Text style={[styles.imageCountText, { color: colors.text }]}>{images.length} fotos</Text></View> : null}
                  {product.category ? <Text numberOfLines={1} style={[styles.categoryTag, { color: colors.accent, backgroundColor: colors.accentSoft }]}>{product.category}</Text> : null}
                  <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.text }]}>{product.name}</Text>
                  <Text numberOfLines={2} style={[styles.productDescription, { color: colors.muted }]}>{product.description || product.brand || 'Cuidado personal'}</Text>
                  <View style={styles.productMeta}>
                    <Text style={[styles.price, { color: colors.accent }]}>{formatMoney(product.price)}</Text>
                    <Text style={[styles.stockLabel, { color: colors.muted }]}>{product.stock} disponibles</Text>
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}</View> : <EmptyState title={products.length ? 'No encontramos ese producto' : 'Pronto publicaremos productos disponibles'} description={products.length ? 'Prueba con otro nombre o categoría.' : undefined} />}
        </> : !query.loading ? <EmptyState title="No se pudo cargar el catálogo" description={query.error || 'Intenta actualizar la pantalla.'} /> : null}
      </View>

      <Modal transparent visible={viewerVisible} animationType="slide" onRequestClose={closeViewer} statusBarTranslucent navigationBarTranslucent>
        <View style={[styles.modalShade, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeViewer} accessibilityRole="button" accessibilityLabel="Cerrar ventana" />
          {selectedProduct ? (
            <View style={[styles.viewerSheet, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
              <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false} bounces={false}>
                <View style={[styles.detailMedia, { backgroundColor: colors.raised }]}>
                  {selectedImageUrl ? <Image source={{ uri: selectedImageUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" alt={selectedProduct.name} accessibilityLabel={selectedProduct.name} /> : <PackageCheck size={58} color={colors.accent} />}
                  {selectedImages.length > 1 ? <>
                    <Pressable onPress={() => setImageIndex((activeImageIndex - 1 + selectedImages.length) % selectedImages.length)} style={[styles.galleryArrow, styles.galleryPrevious, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel="Foto anterior"><ChevronLeft size={21} color={colors.text} /></Pressable>
                    <Pressable onPress={() => setImageIndex((activeImageIndex + 1) % selectedImages.length)} style={[styles.galleryArrow, styles.galleryNext, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel="Foto siguiente"><ChevronRight size={21} color={colors.text} /></Pressable>
                    <View style={[styles.imageCounter, { backgroundColor: colors.surface }]}><Text style={[styles.imageCounterText, { color: colors.text }]}>{activeImageIndex + 1}/{selectedImages.length}</Text></View>
                  </> : null}
                  <Pressable onPress={closeViewer} style={[styles.viewerClose, { backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel="Cerrar detalles"><X size={20} color={colors.text} /></Pressable>
                </View>
                <View style={styles.productDetails}>
                  {selectedProduct.category ? <Text style={[styles.categoryTag, { color: colors.accent, backgroundColor: colors.accentSoft }]}>{selectedProduct.category}</Text> : null}
                  <Text style={[styles.detailTitle, { color: colors.text }]}>{selectedProduct.name}</Text>
                  {selectedProduct.description ? <Text style={[styles.detailDescription, { color: colors.muted }]}>{selectedProduct.description}</Text> : null}
                  {error ? <InlineMessage>{error}</InlineMessage> : null}
                  <View style={[styles.detailFact, { borderBottomColor: colors.border }]}><Text style={[styles.detailFactLabel, { color: colors.muted }]}>{'Marca'}</Text><Text style={[styles.detailFactValue, { color: colors.text }]}>{selectedProduct.brand || 'No especificada'}</Text></View>
                  <View style={[styles.detailFact, { borderBottomColor: colors.border }]}><Text style={[styles.detailFactLabel, { color: colors.muted }]}>{'Presentación'}</Text><Text style={[styles.detailFactValue, { color: colors.text }]}>{selectedProduct.presentation || 'No especificada'}</Text></View>
                  <View style={[styles.detailFact, { borderBottomColor: colors.border }]}><Text style={[styles.detailFactLabel, { color: colors.muted }]}>{'Cantidad disponible'}</Text><Text style={[styles.detailFactValue, { color: colors.text }]}>{selectedProduct.stock}</Text></View>
                  <View style={[styles.detailFact, { borderBottomColor: colors.border }]}><Text style={[styles.detailFactLabel, { color: colors.muted }]}>{'Precio'}</Text><Text style={[styles.detailFactValue, styles.detailPrice, { color: colors.accent }]}>{formatMoney(selectedProduct.price)}</Text></View>
                </View>
              </ScrollView>
              <View style={[styles.viewerActions, { borderTopColor: colors.border, paddingBottom: 12 }]}>
                <ActionButton label="Agregar al carrito" icon={ShoppingCart} tone="secondary" disabled={reservedIds.has(selectedProduct.id)} onPress={() => addToCart(selectedProduct)} />
                <ActionButton label="Apartar por 24 horas" icon={ShoppingBag} loading={busyId === selectedProduct.id} onPress={() => void reserve(selectedProduct, 1, true)} />
              </View>
            </View>
          ) : (
            <View style={[styles.viewerSheet, styles.cartSheet, { backgroundColor: colors.surface, borderColor: colors.glassBorder }]}>
              <View style={styles.sheetHeading}>
                <View style={[styles.sheetIcon, { backgroundColor: colors.glassRaised }]}><ShoppingCart size={21} color={colors.accent} /></View>
                <View style={styles.sheetHeadingCopy}>
                  <Text style={[styles.sheetEyebrow, { color: colors.accent }]}>{'SELECCIÓN DE PRODUCTOS'}</Text>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>{'Tu carrito'}</Text>
                </View>
                <Pressable onPress={closeViewer} style={[styles.viewerClose, styles.sheetClose, { backgroundColor: colors.glassRaised }]} accessibilityRole="button" accessibilityLabel="Cerrar carrito"><X size={20} color={colors.text} /></Pressable>
              </View>
              {error || message || query.error ? <InlineMessage tone={message.includes('apartado') || message.includes('cancelado') ? 'success' : 'error'}>{message || error || query.error || ''}</InlineMessage> : null}
              <ScrollView style={styles.cartScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {visibleCart.length ? <>
                  <View style={styles.cartList}>{visibleCart.map(({ product, quantity }) => {
                    const image = publicMediaUrl(product.image_paths?.[0] ?? product.image_path);
                    return <View key={product.id} style={[styles.cartLine, { borderBottomColor: colors.border }]}>
                      <View style={[styles.cartThumb, { backgroundColor: colors.raised }]}>
                        {image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" alt={product.name} accessibilityLabel={product.name} /> : <PackageCheck size={22} color={colors.accent} />}
                      </View>
                      <View style={styles.cartLineCopy}>
                        <Text numberOfLines={2} style={[styles.itemTitle, { color: colors.text }]}>{product.name}</Text>
                        <Text style={[styles.muted, { color: colors.muted }]}>{formatMoney(product.price)} · {product.stock} disponibles</Text>
                        <View style={styles.cartLineControls}>
                          <View style={[styles.quantityControl, { backgroundColor: colors.glassRaised, borderColor: colors.glassBorder }]}>
                            <Pressable onPress={() => changeQuantity(product, quantity - 1)} disabled={quantity <= 1} style={styles.quantityButton} accessibilityRole="button" accessibilityLabel="Restar una unidad"><Minus size={14} color={colors.text} /></Pressable>
                            <Text style={[styles.quantity, { color: colors.text }]}>{quantity}</Text>
                            <Pressable onPress={() => changeQuantity(product, quantity + 1)} disabled={quantity >= Math.min(product.stock, 10)} style={styles.quantityButton} accessibilityRole="button" accessibilityLabel="Agregar una unidad"><Plus size={14} color={colors.text} /></Pressable>
                          </View>
                          <Text style={[styles.cartLineTotal, { color: colors.text }]}>{formatMoney(Number(product.price) * quantity)}</Text>
                        </View>
                        <View style={styles.cartLineActions}>
                          <Pressable onPress={() => setCart((items) => items.filter((item) => item.productId !== product.id))} style={styles.removeButton} accessibilityRole="button" accessibilityLabel={`Quitar ${product.name} del carrito`}><Trash2 size={15} color={colors.muted} /><Text style={[styles.removeButtonText, { color: colors.muted }]}>{'Quitar'}</Text></Pressable>
                          <Pressable onPress={() => void reserve(product, quantity)} disabled={busyId === product.id} style={[styles.reserveCartButton, { backgroundColor: colors.accent, opacity: busyId === product.id ? 0.55 : 1 }]} accessibilityRole="button" accessibilityLabel={`Apartar ${product.name}`}>
                            <Text style={[styles.reserveCartButtonText, { color: colors.accentForeground }]}>{busyId === product.id ? 'Procesando...' : 'Apartar'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>;
                  })}</View>
                  <View style={[styles.cartTotal, { borderTopColor: colors.border }]}><Text style={[styles.muted, { color: colors.muted }]}>{'Total de la selección'}</Text><Text style={[styles.cartTotalValue, { color: colors.text }]}>{formatMoney(cartTotal)}</Text></View>
                  <Text style={[styles.cartNote, { color: colors.muted }]}>{'El apartado dura 24 horas. El pago se realiza al recoger el producto en el local.'}</Text>
                </> : <View style={styles.cartEmpty}>
                  <ShoppingCart size={35} color={colors.muted} />
                  <Text style={[styles.cartEmptyTitle, { color: colors.text }]}>{'Tu carrito está vacío'}</Text>
                  <Text style={[styles.muted, { color: colors.muted, textAlign: 'center' }]}>{'Abre un producto y agrégalo aquí para tenerlo a mano.'}</Text>
                </View>}

                {role === 'client' ? <View style={[styles.reservationsSection, { borderTopColor: colors.border }]}>
                  <View style={styles.reservationsHeading}>
                    <View style={[styles.reservationsIcon, { backgroundColor: colors.glassRaised }]}><PackageCheck size={18} color={colors.accent} /></View>
                    <View style={styles.sheetHeadingCopy}>
                      <Text style={[styles.sheetEyebrow, { color: colors.accent }]}>{'APARTADOS ACTIVOS'}</Text>
                      <Text style={[styles.reservationsTitle, { color: colors.text }]}>{'Mis productos apartados'}</Text>
                    </View>
                    <Text style={[styles.reservationCount, { color: colors.accent, backgroundColor: colors.accentSoft }]}>{reservations.length}</Text>
                  </View>
                  {reservations.length ? reservations.map((reservation) => <View key={reservation.id} style={[styles.reservationLine, { borderBottomColor: colors.border }]}>
                    <View style={styles.reservationCopy}>
                      <Text numberOfLines={1} style={[styles.itemTitle, { color: colors.text }]}>{reservation.products?.name ?? 'Producto'}</Text>
                      <Text style={[styles.muted, { color: colors.muted }]}>{reservation.quantity} unidad(es) · {formatMoney(Number(reservation.price_snapshot) * reservation.quantity)}</Text>
                      <Text style={[styles.muted, { color: colors.muted }]}>{'Vence'} {formatDate(reservation.expires_at, { dateStyle: 'short', timeStyle: 'short' })}</Text>
                    </View>
                    <Pressable onPress={() => Alert.alert('Cancelar apartado', `¿Cancelar el apartado de ${reservation.products?.name ?? 'este producto'}?`, [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar', style: 'destructive', onPress: () => void cancelReservation(reservation) }])} disabled={Boolean(busyId)} style={[styles.cancelReservationButton, { backgroundColor: colors.dangerSoft, opacity: busyId ? 0.55 : 1 }]} accessibilityRole="button" accessibilityLabel={`Cancelar apartado de ${reservation.products?.name ?? 'producto'}`}>
                      <Text style={[styles.cancelReservationText, { color: colors.danger }]}>{busyId === reservation.id ? 'Cancelando...' : 'Cancelar'}</Text>
                    </Pressable>
                  </View>) : <Text style={[styles.muted, styles.reservationsEmpty, { color: colors.muted }]}>{'No tienes productos apartados activos.'}</Text>}
                </View> : null}
              </ScrollView>
              <ActionButton label="Seguir viendo productos" tone="secondary" onPress={closeViewer} />
            </View>
          )}
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  catalogBody: { gap: 14 },
  clientCatalogBody: { paddingHorizontal: 16, paddingTop: 16 },
  catalogFilters: { gap: 11 },
  cartLauncher: { minHeight: 70, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderRadius: 16 },
  cartLauncherIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cartLauncherCopy: { flex: 1, minWidth: 0, gap: 4 },
  cartLauncherTitle: { fontSize: 14, fontWeight: '800' },
  cartLauncherSubtitle: { fontSize: 10, lineHeight: 15 },
  cartLauncherBadge: { minWidth: 44, height: 36, paddingHorizontal: 8, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  cartLauncherCount: { fontSize: 13, fontWeight: '900' },
  categoryList: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  categoryChip: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 17, borderWidth: 1 },
  categoryText: { fontSize: 10, fontWeight: '700' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 10 },
  productCard: { width: '47%', flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start', minWidth: 0, borderWidth: 1, borderRadius: 15, overflow: 'hidden' },
  productCardPress: { width: '100%', minWidth: 0, padding: 9, gap: 7 },
  productImage: { width: '100%', aspectRatio: 0.88, borderRadius: 10 },
  productPlaceholder: { width: '100%', aspectRatio: 0.88, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  imageCount: { position: 'absolute', top: 15, right: 15, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 9 },
  imageCountText: { fontSize: 9, fontWeight: '800' },
  categoryTag: { alignSelf: 'flex-start', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 9, lineHeight: 13, fontWeight: '800' },
  itemTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  productDescription: { minHeight: 28, fontSize: 10, lineHeight: 14 },
  productMeta: { marginTop: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  stockLabel: { fontSize: 9, fontWeight: '600' },
  price: { fontSize: 13, fontWeight: '900' },
  muted: { fontSize: 11, lineHeight: 16 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#000000b8' },
  viewerSheet: { width: '100%', maxHeight: '94%', overflow: 'hidden', borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  detailScroll: { flexShrink: 1 },
  cartSheet: { height: '90%', maxHeight: '92%', padding: 16, gap: 12 },
  detailMedia: { height: 270, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  galleryArrow: { position: 'absolute', top: '48%', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  galleryPrevious: { left: 12 },
  galleryNext: { right: 12 },
  imageCounter: { position: 'absolute', right: 13, bottom: 13, minWidth: 42, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center', borderRadius: 9, opacity: 0.92 },
  imageCounterText: { fontSize: 10, fontWeight: '800' },
  viewerClose: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  productDetails: { padding: 18, gap: 10 },
  detailTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900' },
  detailDescription: { marginBottom: 3, fontSize: 12, lineHeight: 18 },
  detailFact: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  detailFactLabel: { fontSize: 11 },
  detailFactValue: { flexShrink: 1, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  detailPrice: { fontSize: 14, fontWeight: '900' },
  viewerActions: { padding: 14, gap: 9, borderTopWidth: StyleSheet.hairlineWidth },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  sheetHeadingCopy: { flex: 1, minWidth: 0, gap: 3 },
  sheetEyebrow: { fontSize: 8, fontWeight: '900', letterSpacing: 1.35 },
  sheetTitle: { fontSize: 21, lineHeight: 25, fontWeight: '900' },
  sheetClose: { width: 36, height: 36 },
  cartScroll: { flex: 1 },
  cartList: { gap: 0 },
  cartLine: { paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  cartThumb: { width: 54, height: 54, borderRadius: 9, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cartLineCopy: { flex: 1, minWidth: 0, gap: 6 },
  cartLineControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  quantityControl: { minHeight: 33, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 4 },
  quantityButton: { width: 30, height: 29, alignItems: 'center', justifyContent: 'center' },
  quantity: { minWidth: 14, textAlign: 'center', fontSize: 12, fontWeight: '900' },
  cartLineTotal: { fontSize: 11, fontWeight: '800' },
  cartLineActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  removeButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5 },
  removeButtonText: { fontSize: 10, fontWeight: '700' },
  reserveCartButton: { minWidth: 88, minHeight: 34, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  reserveCartButtonText: { fontSize: 11, fontWeight: '900' },
  cartTotal: { marginTop: 12, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: 1 },
  cartTotalValue: { fontSize: 17, fontWeight: '900' },
  cartNote: { marginTop: 7, fontSize: 10, lineHeight: 15 },
  cartEmpty: { minHeight: 155, alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 25 },
  cartEmptyTitle: { fontSize: 14, fontWeight: '800' },
  reservationsSection: { marginTop: 18, paddingTop: 16, gap: 9, borderTopWidth: 1 },
  reservationsHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 2 },
  reservationsIcon: { width: 33, height: 33, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  reservationsTitle: { fontSize: 13, fontWeight: '800' },
  reservationCount: { minWidth: 26, height: 26, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 13, fontSize: 11, lineHeight: 26, fontWeight: '900' },
  reservationLine: { paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  reservationCopy: { flex: 1, minWidth: 0, gap: 3 },
  cancelReservationButton: { minHeight: 34, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  cancelReservationText: { fontSize: 10, fontWeight: '800' },
  reservationsEmpty: { paddingTop: 4 },
});

import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { Images, Scissors } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, palette } from '@/components/ui';
import { clientTabs } from '@/lib/navigation';
import { useSession } from '@/lib/session';
import { publicPage } from '@/lib/links';
import { supabase } from '@/lib/supabase';
import { publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type GalleryPost = { id: string; title: string; description: string | null; image_path: string; image_paths: string[]; source_type: string; source_url: string | null; created_at: string; barber_profiles: { display_name?: string } | null };

export default function ClientGalleryScreen() {
  const { session } = useSession();
  const query = useRemoteData<GalleryPost[]>(async () => {
    if (!session?.user.id) throw new Error('Inicia sesión para ver la galería.');
    const result = await supabase.from('gallery_posts').select('id,title,description,image_path,image_paths,source_type,source_url,created_at,barber_profiles(display_name)')
      .eq('status', 'published').order('featured', { ascending: false }).order('sort_order').order('created_at', { ascending: false }).limit(80);
    return requireData(result) as GalleryPost[];
  }, session?.user.id ?? '');

  return (
    <AppShell title="Galería" roleLabel="INSPIRACIÓN LEGEND" tabs={clientTabs} backHref="/client" onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow="Portafolio del equipo" title="Trabajos Legend" description="Estilos publicados por los peluqueros de LEGEND CLUB." />
      {query.error ? <InlineMessage>{query.error}</InlineMessage> : null}
      {query.data?.length ? query.data.map((post) => {
        const paths = post.image_paths?.length ? post.image_paths : [post.image_path];
        return (
          <Card key={post.id}>
            <CardTitle icon={Images} title={post.title} subtitle={`${post.barber_profiles?.display_name ?? 'Equipo LEGEND'} · ${post.source_type === 'reference' ? 'Referencia' : 'Trabajo propio'}`} />
            <View style={styles.images}>
              {paths.slice(0, 3).map((path, index) => {
                const uri = publicMediaUrl(path);
                return uri ? <Image key={`${path}-${index}`} source={{ uri }} alt={`${post.title}, foto ${index + 1}`} style={styles.image} /> : <View key={`${path}-${index}`} style={styles.imagePlaceholder}><Scissors size={24} color={palette.gold} /></View>;
              })}
            </View>
            {post.description ? <Text style={styles.description}>{post.description}</Text> : null}
            {post.source_type === 'reference' && post.source_url ? <ActionButton label="Ver fuente" icon={Images} compact tone="secondary" onPress={() => void Linking.openURL(post.source_url!)} /> : null}
          </Card>
        );
      }) : !query.loading ? <Card><EmptyState title="La galería está vacía" description="Cuando el equipo publique nuevos trabajos, se mostrarán aquí." /><ActionButton label="Ver sitio público" onPress={() => void Linking.openURL(publicPage())} tone="secondary" /></Card> : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  images: { flexDirection: 'row', gap: 8 },
  image: { flex: 1, height: 170, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  imagePlaceholder: { flex: 1, height: 170, borderRadius: 12, backgroundColor: palette.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  description: { color: palette.muted, fontSize: 13, lineHeight: 19 },
});

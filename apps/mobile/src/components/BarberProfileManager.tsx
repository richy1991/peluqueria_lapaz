import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, History, Images, Link2, UserRoundPen } from 'lucide-react-native';

import { AppShell } from '@/components/AppShell';
import { ActionButton, Card, CardTitle, EmptyState, InlineMessage, PageHeading, SwitchRow, TextField, palette } from '@/components/ui';
import { barberTabs } from '@/lib/navigation';
import { publicPage } from '@/lib/links';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { uploadBarberGalleryImages, uploadBarberImage } from '@/lib/uploads';
import { errorMessage, formatDate, publicMediaUrl, requireData, useRemoteData } from '@/lib/utils';

type BarberProfile = { id: string; display_name: string; bio: string | null; specialties: string[] | null; photo_path: string | null };
type GalleryPost = { id: string; title: string; status: string; source_type: string | null; created_at: string };
type ManagerData = { profile: BarberProfile; gallery: GalleryPost[] };

export function BarberProfileManager({ view }: { view: 'profile' | 'gallery' }) {
  const { barber, session } = useSession();
  const barberId = barber?.id ?? '';
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState('');
  const [profilePhoto, setProfilePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState<'own_work' | 'reference'>('own_work');
  const [sourceUrl, setSourceUrl] = useState('');
  const [clientConsent, setClientConsent] = useState(false);
  const [galleryImages, setGalleryImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const query = useRemoteData<ManagerData>(async () => {
    if (!barberId) throw new Error('No se encontró tu perfil de peluquero.');
    const [profileResult, galleryResult] = await Promise.all([
      supabase.from('barber_profiles').select('id,display_name,bio,specialties,photo_path').eq('id', barberId).single(),
      supabase.from('gallery_posts').select('id,title,status,source_type,created_at').eq('barber_id', barberId).order('created_at', { ascending: false }).limit(30),
    ]);
    const profile = requireData(profileResult) as BarberProfile;
    const gallery = requireData(galleryResult) as GalleryPost[];
    return { profile, gallery };
  }, barberId);

  useEffect(() => {
    if (!query.data?.profile) return;
    const profile = query.data.profile;
    const task = setTimeout(() => {
      setDisplayName(profile.display_name);
      setBio(profile.bio ?? '');
      setSpecialties(profile.specialties?.join(', ') ?? '');
    }, 0);
    return () => clearTimeout(task);
  }, [query.data?.profile]);

  async function chooseProfilePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: true, base64: false });
      if (!result.canceled) setProfilePhoto(result.assets[0] ?? null);
    } catch (reason) { setMessage(errorMessage(reason)); }
  }

  async function chooseGalleryImages() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 3, orderedSelection: true, quality: 1 });
      if (!result.canceled) setGalleryImages(result.assets.slice(0, 3));
    } catch (reason) { setMessage(errorMessage(reason)); }
  }

  async function saveProfile() {
    if (displayName.trim().length < 2 || displayName.trim().length > 80) { setMessage('El nombre público debe tener entre 2 y 80 caracteres.'); return; }
    setBusy(true); setMessage('');
    let uploadedPath: string | null = null;
    try {
      if (profilePhoto) uploadedPath = await uploadBarberImage(profilePhoto, session?.user.id ?? '', 'profile');
      const { error } = await supabase.rpc('update_my_barber_profile', {
        public_name: displayName.trim(),
        biography: bio.trim(),
        barber_specialties: specialties.split(',').map((item) => item.trim()).filter(Boolean),
        profile_photo_path: uploadedPath,
      });
      if (error) throw error;
      setProfilePhoto(null);
      setMessage('Tu perfil público se actualizó correctamente.');
      query.refresh();
    } catch (reason) {
      if (uploadedPath) await supabase.storage.from('public-media').remove([uploadedPath]);
      setMessage(errorMessage(reason));
    } finally { setBusy(false); }
  }

  async function publishGallery() {
    if (title.trim().length < 2 || title.trim().length > 120) { setMessage('El título debe tener entre 2 y 120 caracteres.'); return; }
    if (!galleryImages.length) { setMessage('Selecciona al menos una imagen.'); return; }
    if (sourceType === 'own_work' && !clientConsent) { setMessage('Confirma que tienes autorización del cliente.'); return; }
    if (sourceType === 'reference' && !/^https?:\/\//i.test(sourceUrl.trim())) { setMessage('Una referencia debe incluir un enlace web válido.'); return; }

    setBusy(true); setMessage('');
    let uploadedPaths: string[] = [];
    try {
      uploadedPaths = await uploadBarberGalleryImages(galleryImages, session?.user.id ?? '');
      const { error } = await supabase.rpc('barber_publish_gallery_v2', {
        post_title: title.trim(),
        post_description: description.trim(),
        post_image_paths: uploadedPaths,
        post_source_type: sourceType,
        post_source_url: sourceType === 'reference' ? sourceUrl.trim() : null,
        has_client_consent: sourceType === 'own_work' && clientConsent,
      });
      if (error) throw error;
      setTitle(''); setDescription(''); setSourceUrl(''); setClientConsent(false); setGalleryImages([]);
      setMessage('La publicación se compartió con el sitio público.');
      query.refresh();
    } catch (reason) {
      if (uploadedPaths.length) await supabase.storage.from('public-media').remove(uploadedPaths);
      setMessage(errorMessage(reason));
    } finally { setBusy(false); }
  }

  const profile = query.data?.profile;
  const photo = profilePhoto?.uri ?? publicMediaUrl(profile?.photo_path);
  return (
    <AppShell title={view === 'profile' ? 'Mi perfil' : 'Mis trabajos'} roleLabel="MI ESTACIÓN" activeTab={view === 'profile' ? 'perfil' : 'trabajos'} tabs={barberTabs} onRefresh={query.refresh} refreshing={query.loading}>
      <PageHeading eyebrow={view === 'profile' ? 'Presencia pública' : 'Portafolio'} title={view === 'profile' ? 'Mi perfil público' : 'Publicar trabajos'} description={view === 'profile' ? 'Mantén actualizada la información que ven tus clientes.' : 'Comparte trabajos autorizados o referencias con su fuente.'} />
      {query.error || message ? <InlineMessage tone={message.includes('actualizó') || message.includes('compartió') ? 'success' : 'error'}>{message || query.error}</InlineMessage> : null}

      {view === 'profile' ? (
        <Card>
          <CardTitle icon={UserRoundPen} title="Perfil público" subtitle="Estos datos aparecen en la sección Equipo del sitio." />
          <View style={styles.profilePreview}>
            {photo ? <Image source={{ uri: photo }} alt={`Perfil de ${profile?.display_name ?? barber?.display_name ?? 'peluquero'}`} style={styles.profilePhoto} /> : <View style={styles.photoPlaceholder}><Camera size={23} color={palette.gold} /></View>}
            <View style={{ flex: 1, gap: 4 }}><Text style={styles.itemTitle}>{profile?.display_name ?? barber?.display_name}</Text><Text style={styles.muted}>{profile?.bio || 'Agrega una presentación para que los clientes te conozcan.'}</Text><Text style={styles.muted}>{profile?.specialties?.join(' · ') || 'Especialidades por definir'}</Text></View>
          </View>
          <TextField label="Nombre público" value={displayName} onChangeText={setDisplayName} maxLength={80} />
          <View style={styles.field}><Text style={styles.fieldLabel}>Especialidades separadas por coma</Text><TextInput value={specialties} onChangeText={setSpecialties} placeholder="Degradados, barba, diseño" placeholderTextColor="#82776e" style={styles.input} /></View>
          <View style={styles.field}><Text style={styles.fieldLabel}>Presentación</Text><TextInput value={bio} onChangeText={setBio} maxLength={500} multiline style={[styles.input, styles.multiline]} placeholder="Cuéntales sobre tu experiencia" placeholderTextColor="#82776e" /></View>
          {profilePhoto ? <Image source={{ uri: profilePhoto.uri }} alt="Nueva foto de perfil" style={styles.photoPreview} /> : null}
          <ActionButton label={profilePhoto ? 'Cambiar fotografía seleccionada' : 'Elegir fotografía'} icon={Camera} tone="secondary" onPress={() => void chooseProfilePhoto()} />
          <ActionButton label="Guardar perfil" loading={busy} onPress={() => void saveProfile()} />
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle icon={Images} title="Nueva publicación" subtitle="Se publicará en el portafolio y en el sitio público." />
            <TextField label="Título" value={title} onChangeText={setTitle} maxLength={120} placeholder="Ej. Degradado medio" />
            <View style={styles.field}><Text style={styles.fieldLabel}>Descripción</Text><TextInput value={description} onChangeText={setDescription} maxLength={500} multiline style={[styles.input, styles.multiline]} placeholder="Detalles del corte o estilo" placeholderTextColor="#82776e" /></View>
            <View style={styles.choiceRow}>
              <Pressable style={[styles.choiceButton, sourceType === 'own_work' && styles.choiceActive]} onPress={() => setSourceType('own_work')}><Text style={[styles.choiceText, sourceType === 'own_work' && styles.choiceTextActive]}>Trabajo propio</Text></Pressable>
              <Pressable style={[styles.choiceButton, sourceType === 'reference' && styles.choiceActive]} onPress={() => setSourceType('reference')}><Text style={[styles.choiceText, sourceType === 'reference' && styles.choiceTextActive]}>Referencia</Text></Pressable>
            </View>
            {sourceType === 'reference' ? <TextField label="Enlace de la fuente" value={sourceUrl} onChangeText={setSourceUrl} autoCapitalize="none" keyboardType="url" placeholder="https://…" /> : <SwitchRow label="Tengo autorización del cliente" value={clientConsent} onValueChange={setClientConsent} description="Necesario para compartir trabajos propios." />}
            {galleryImages.length ? <View style={styles.selectedImages}>{galleryImages.map((image, index) => <Image key={`${image.uri}-${index}`} source={{ uri: image.uri }} alt={`Imagen seleccionada ${index + 1}`} style={styles.selectedImage} />)}</View> : null}
            <ActionButton label={galleryImages.length ? `Cambiar imágenes (${galleryImages.length})` : 'Elegir imágenes · máximo 3'} icon={Images} tone="secondary" onPress={() => void chooseGalleryImages()} />
            <ActionButton label="Publicar en la galería" loading={busy} onPress={() => void publishGallery()} />
          </Card>
          <Card>
            <CardTitle icon={History} title="Publicaciones recientes" subtitle="El estado de cada elemento se sincroniza con la galería pública." />
            {query.data?.gallery.length ? query.data.gallery.map((item) => (
              <View key={item.id} style={styles.galleryRow}><View style={{ flex: 1, gap: 4 }}><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.muted}>{item.source_type === 'reference' ? 'Referencia' : 'Trabajo propio'} · {item.status}</Text></View><Text style={styles.date}>{formatDate(item.created_at, { dateStyle: 'medium', timeZone: 'America/La_Paz' })}</Text></View>
            )) : <EmptyState title="Aún no publicaste imágenes" description="Tu primera publicación aparecerá en el sitio público cuando la compartas." />}
            <ActionButton label="Ver sitio público" icon={Link2} tone="secondary" compact onPress={() => void Linking.openURL(publicPage('sitio'))} />
          </Card>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  profilePreview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profilePhoto: { width: 74, height: 74, borderRadius: 19, backgroundColor: palette.surfaceRaised },
  photoPlaceholder: { width: 74, height: 74, borderRadius: 19, backgroundColor: palette.surfaceRaised, borderColor: palette.border, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: 110, height: 110, borderRadius: 16, alignSelf: 'center' },
  itemTitle: { color: palette.text, fontSize: 13, fontWeight: '800' },
  muted: { color: palette.muted, fontSize: 11, lineHeight: 16 },
  field: { gap: 7 },
  fieldLabel: { color: palette.text, fontSize: 12, fontWeight: '700' },
  input: { minHeight: 47, borderRadius: 12, borderWidth: 1, borderColor: palette.border, backgroundColor: '#191512', paddingHorizontal: 13, color: palette.text, fontSize: 14 },
  multiline: { minHeight: 85, textAlignVertical: 'top', paddingTop: 11 },
  choiceRow: { flexDirection: 'row', gap: 8 },
  choiceButton: { flex: 1, minHeight: 43, alignItems: 'center', justifyContent: 'center', borderColor: palette.border, borderWidth: 1, borderRadius: 12, backgroundColor: palette.surfaceRaised },
  choiceActive: { borderColor: palette.gold, backgroundColor: '#3b2e1d' },
  choiceText: { color: palette.muted, fontWeight: '700', fontSize: 12 },
  choiceTextActive: { color: palette.gold },
  selectedImages: { flexDirection: 'row', gap: 8 },
  selectedImage: { flex: 1, height: 90, borderRadius: 10, backgroundColor: palette.surfaceRaised },
  galleryRow: { flexDirection: 'row', alignItems: 'center', borderTopColor: palette.border, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12, gap: 8 },
  date: { color: palette.muted, fontSize: 10 },
});

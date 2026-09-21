// src/screens/Closet/BulkUploadScreen.tsx
// Closet Section board's "Bulk Upload" flow, condensed to one screen:
// a photo grid (camera one-at-a-time, album multi-select, or clipboard
// paste, all add into the same grid) + "Add More images", then ONE
// shared category/color/occasion form applied to every photo in the
// batch. This is a deliberate simplification vs. the board's per-item
// tagging — tagging 10 photos individually one-by-one defeats the
// point of "bulk"; a shared form covers the real use case (someone
// dumping a stack of same-type items, e.g. "these 8 are all tops").
// Items can still be edited individually afterward from Item Details.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { ItemDetailsForm, EMPTY_ITEM_FORM, ItemFormValues } from '../../components/ItemDetailsForm';
import { uploadWardrobeItemsBulk, getAttributeSuggestions, checkPhotoSize } from '../../api/wardrobeApi';
import { checkPhotoBlur } from '../../utils/blurCheck';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const FALLBACK_CATEGORIES = ['top', 'bottom', 'dress', 'shoes', 'bag', 'accessory', 'outerwear'];
const FALLBACK_COLORS = ['black', 'white', 'red', 'blue', 'green', 'pink', 'beige', 'navy'];
const FALLBACK_STYLES = ['casual', 'formal', 'business', 'evening_wear', 'sport', 'party_wear'];
const FALLBACK_SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

interface PickedPhoto {
  uri: string;
  width?: number;
  height?: number;
  blurWarning?: string | null;
}

export default function BulkUploadScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [photos, setPhotos] = useState<PickedPhoto[]>(route.params?.initialPhotos ?? []);
  const [step, setStep] = useState<'picking' | 'tagging' | 'done'>('picking');
  const [form, setForm] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({
    categories: FALLBACK_CATEGORIES, colors: FALLBACK_COLORS, styles: FALLBACK_STYLES, seasons: FALLBACK_SEASONS,
  });

  React.useEffect(() => {
    getAttributeSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  const updateForm = (patch: Partial<ItemFormValues>) => setForm((prev) => ({ ...prev, ...patch }));

  const addPhoto = async (uri: string, width?: number, height?: number, fileSize?: number) => {
    const sizeCheck = checkPhotoSize(fileSize);
    if (!sizeCheck.ok) {
      Alert.alert('Photo skipped', sizeCheck.message);
      return;
    }
    const blur = await checkPhotoBlur(uri, width, height);
    setPhotos((prev) => [...prev, { uri, width, height, blurWarning: blur.looksBlurry ? blur.reason : null }]);
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to take a photo.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) {
      const a = result.assets[0];
      await addPhoto(a.uri, a.width, a.height, a.fileSize);
    }
  };

  const pickFromAlbum = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to add items.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true, selectionLimit: 20 });
    if (!result.canceled) {
      for (const a of result.assets) await addPhoto(a.uri, a.width, a.height, a.fileSize);
    }
  };

  const pickFromClipboard = async () => {
    const hasImage = await Clipboard.hasImageAsync();
    if (!hasImage) return Alert.alert('Nothing to paste', "There's no image on your clipboard right now.");
    const image = await Clipboard.getImageAsync({ format: 'jpeg' });
    if (image?.data) await addPhoto(image.data);
    else Alert.alert("Couldn't paste", 'That clipboard image could not be read.');
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const blurryCount = photos.filter((p) => p.blurWarning).length;

  const handleUpload = async () => {
    if (!form.category || !form.color) return Alert.alert('Missing info', 'Pick a category and color first.');
    setSaving(true);
    try {
      await uploadWardrobeItemsBulk(
        photos.map((p) => ({
          localImageUri: p.uri,
          meta: {
            category: form.category, color: form.color, occasionTags: form.occasionTags,
            name: form.name.trim() || undefined, style: form.style ?? undefined, season: form.season ?? undefined,
            rating: form.rating ?? undefined, brand: form.brand.trim() || undefined,
            price: form.price ? Number(form.price) : undefined, size: form.size.trim() || undefined,
            material: form.material.trim() || undefined,
          },
        }))
      );
      setStep('done');
    } catch (e: any) {
      Alert.alert('Could not upload', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success ?? '#3B8352'} />
          <Text style={[type.h2, { marginTop: spacing.md }]}>Successfully added</Text>
          <Text style={[type.muted, { textAlign: 'center', marginTop: 4 }]}>
            {photos.length} item{photos.length === 1 ? '' : 's'} added to your closet — backgrounds are being cleaned up now, this can take a minute.
          </Text>
          <View style={{ height: spacing.lg }} />
          <Button label="Done" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'picking') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Bulk upload" />
        <FlatList
          data={photos}
          keyExtractor={(_, i) => String(i)}
          numColumns={3}
          columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
          contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.lg }}
          ListHeaderComponent={blurryCount > 0 ? (
            <View style={styles.blurBanner}>
              <Text style={styles.blurBannerText}>
                {blurryCount} photo{blurryCount === 1 ? ' looks' : 's look'} a little soft — you can still upload, or retake below.
              </Text>
            </View>
          ) : null}
          renderItem={({ item, index }) => (
            <View style={styles.photoCell}>
              <Image source={{ uri: item.uri }} style={styles.photoCellImage} />
              {item.blurWarning ? <View style={styles.blurDot} /> : null}
              <TouchableOpacity style={styles.removeBtn} onPress={() => removePhoto(index)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FigmaIcon name="close" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          ListFooterComponent={
            <View style={styles.addMoreRow}>
              <TouchableOpacity style={styles.addMoreTile} onPress={pickFromCamera}>
                <FigmaIcon name="camera" size={22} color={colors.ink} />
                <Text style={styles.addMoreLabel}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addMoreTile} onPress={pickFromAlbum}>
                <FigmaIcon name="album" size={22} color={colors.ink} />
                <Text style={styles.addMoreLabel}>Add more images</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addMoreTile} onPress={pickFromClipboard}>
                <Ionicons name="clipboard-outline" size={22} color={colors.ink} />
                <Text style={styles.addMoreLabel}>Paste</Text>
              </TouchableOpacity>
            </View>
          }
        />
        <View style={styles.footer}>
          <Button
            label={`Bulk Upload${photos.length ? ` (${photos.length})` : ''}`}
            onPress={() => setStep('tagging')}
            disabled={photos.length === 0}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Add details" onBack={() => setStep('picking')} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[type.muted, { marginBottom: spacing.md }]}>
          Applying to all {photos.length} photo{photos.length === 1 ? '' : 's'} — you can fine-tune any single item afterward from its details page.
        </Text>

        <View style={styles.thumbStrip}>
          {photos.slice(0, 6).map((p, i) => <Image key={i} source={{ uri: p.uri }} style={styles.thumbStripImage} />)}
          {photos.length > 6 && <View style={[styles.thumbStripImage, styles.thumbOverflow]}><Text style={{ fontSize: 12, fontWeight: '700' }}>+{photos.length - 6}</Text></View>}
        </View>

        <ItemDetailsForm
          value={form}
          onChange={updateForm}
          categories={suggestions.categories}
          colorOptions={suggestions.colors}
          styleOptions={suggestions.styles}
          seasonOptions={suggestions.seasons}
          categorySearch={categorySearch}
          onCategorySearchChange={setCategorySearch}
        />

        <View style={{ height: spacing.md }} />
        <Button label={saving ? 'Uploading…' : 'Upload'} onPress={handleUpload} loading={saving} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    doneIcon: { fontSize: 56 },
    blurBanner: { backgroundColor: '#FCE8D8', borderRadius: radius.md, padding: spacing.sm, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
    blurBannerText: { fontSize: 12, color: '#7A4A17', fontWeight: '600' },
    photoCell: { width: 100, height: 100, borderRadius: radius.md, overflow: 'hidden', position: 'relative' },
    photoCellImage: { width: '100%', height: '100%' },
    blurDot: { position: 'absolute', bottom: 6, left: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E0873D' },
    removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
    removeBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
    addMoreRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
    addMoreTile: {
      flex: 1, height: 100, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
      backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', gap: 4,
    },
    addMoreLabel: { fontSize: 10, fontWeight: '600', color: colors.ink, textAlign: 'center', paddingHorizontal: 4 },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
    thumbStrip: { flexDirection: 'row', gap: 6, marginBottom: spacing.sm },
    thumbStripImage: { width: 44, height: 44, borderRadius: 8 },
    thumbOverflow: { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  });
}

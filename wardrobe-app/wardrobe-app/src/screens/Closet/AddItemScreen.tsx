import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { ItemDetailsForm, EMPTY_ITEM_FORM, ItemFormValues } from '../../components/ItemDetailsForm';
import { uploadWardrobeItem, getAttributeSuggestions, scanItemTag } from '../../api/wardrobeApi';
import { checkPhotoBlur } from '../../utils/blurCheck';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const FALLBACK_CATEGORIES = ['top', 'bottom', 'dress', 'shoes', 'bag', 'accessory', 'outerwear'];
const FALLBACK_COLORS = ['black', 'white', 'red', 'blue', 'green', 'pink', 'beige', 'navy'];
const FALLBACK_STYLES = ['casual', 'formal', 'business', 'evening_wear', 'sport', 'party_wear'];
const FALLBACK_SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

export default function AddItemScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [blurWarning, setBlurWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [categorySearch, setCategorySearch] = useState('');
  const [savedItem, setSavedItem] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifyNote, setIdentifyNote] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState({
    categories: FALLBACK_CATEGORIES, colors: FALLBACK_COLORS, styles: FALLBACK_STYLES, seasons: FALLBACK_SEASONS,
  });

  React.useEffect(() => {
    getAttributeSuggestions().then(setSuggestions).catch(() => {});
  }, []);

  const updateForm = (patch: Partial<ItemFormValues>) => setForm((prev) => ({ ...prev, ...patch }));

  // Auto-identify: previously the vision scan only ever ran when the
  // person manually tapped "Scan tag" and took a SEPARATE photo of a
  // label — the actual item photo (from Camera/Album/Paste) was never
  // looked at by AI at all, meaning nothing got identified unless you
  // knew to go dig up a care tag. This reuses the same scan-tag vision
  // call against the main photo itself right after it's picked, since
  // that call already guesses category/color when the garment is
  // visible in frame. Genuinely OPTIONAL, not forced: only fills in
  // fields the person hasn't already set themselves, never overwrites
  // a manual choice, and if it can't identify anything confidently it
  // just says so and leaves the form exactly as manual entry would.
  const autoIdentifyItem = async (uri: string, currentForm: ItemFormValues) => {
    setIdentifying(true);
    setIdentifyNote(null);
    try {
      const scanned = await scanItemTag(uri);
      const patch: Partial<ItemFormValues> = {};
      if (!currentForm.category && scanned.category && suggestions.categories.includes(scanned.category)) {
        patch.category = scanned.category;
      }
      if (!currentForm.color && scanned.color && suggestions.colors.includes(scanned.color)) {
        patch.color = scanned.color;
      }
      if (Object.keys(patch).length > 0) {
        updateForm(patch);
        setIdentifyNote(`Ara thinks this looks like a ${[patch.color, patch.category?.replace(/_/g, ' ')].filter(Boolean).join(' ')} — double-check below.`);
      } else {
        setIdentifyNote(null); // couldn't tell confidently — just leave the form for manual entry, no need to announce a non-result
      }
    } catch {
      setIdentifyNote(null); // fail quietly — this is a nice-to-have suggestion, not a required step
    } finally {
      setIdentifying(false);
    }
  };

  // "Scan tag" — photo of the garment's label, read by the same vision
  // model that powers color analysis. Reads real text off the tag
  // (brand, size, material, care line); it does NOT look anything up
  // against a brand database, so an unfamiliar or worn/faded label
  // just comes back with whatever the model could actually make out —
  // low-confidence or unreadable fields stay blank rather than guessed.
  // Extracted fields pre-fill the form below; nothing saves until the
  // person taps "Save to closet" themselves, same as manual entry.
  const scanTag = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to scan a tag.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true });
    if (result.canceled) return;

    setScanning(true);
    setScanNote(null);
    try {
      const scanned = await scanItemTag(result.assets[0].uri);
      const patch: Partial<ItemFormValues> = {};
      if (scanned.brand) patch.brand = scanned.brand;
      if (scanned.size) patch.size = scanned.size;
      if (scanned.material) patch.material = scanned.material;
      // Only accept a scanned category if it's actually in our known
      // vocabulary — otherwise the picker would show a selected value
      // that doesn't match any visible pill, which looks broken.
      if (scanned.category && suggestions.categories.includes(scanned.category)) patch.category = scanned.category;
      if (scanned.color && suggestions.colors.includes(scanned.color)) patch.color = scanned.color;
      updateForm(patch);

      const filledCount = Object.keys(patch).length;
      if (filledCount === 0) {
        setScanNote("Couldn't make out anything on that tag clearly — try a closer, well-lit shot, or fill it in manually.");
      } else if (scanned.confidence === 'low') {
        setScanNote(`Filled in ${filledCount} field${filledCount === 1 ? '' : 's'} from the tag — worth double-checking, the label wasn't fully clear.`);
      } else {
        setScanNote(`Filled in ${filledCount} field${filledCount === 1 ? '' : 's'} from the tag ✓`);
      }
    } catch (e: any) {
      Alert.alert("Couldn't scan tag", e.message ?? 'Something went wrong — try again or fill it in manually.');
    } finally {
      setScanning(false);
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow camera access to take a photo.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [3, 4] });
    if (!result.canceled) {
      const a = result.assets[0];
      setImageUri(a.uri);
      const blur = await checkPhotoBlur(a.uri, a.width, a.height);
      setBlurWarning(blur.looksBlurry ? blur.reason : null);
      autoIdentifyItem(a.uri, form);
    }
  };

  // Multiple photos selected here means the person is adding several
  // items at once — hand off to Bulk Upload (with these photos
  // pre-loaded) instead of only keeping the first one and silently
  // dropping the rest, which is what a single-select flow would do.
  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to add an item.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsMultipleSelection: true, selectionLimit: 20 });
    if (result.canceled || result.assets.length === 0) return;

    if (result.assets.length > 1) {
      const initialPhotos = await Promise.all(result.assets.map(async (a) => {
        const blur = await checkPhotoBlur(a.uri, a.width, a.height);
        return { uri: a.uri, width: a.width, height: a.height, blurWarning: blur.looksBlurry ? blur.reason : null };
      }));
      navigation.navigate('BulkUpload', { initialPhotos });
      return;
    }

    const a = result.assets[0];
    setImageUri(a.uri);
    const blur = await checkPhotoBlur(a.uri, a.width, a.height);
    setBlurWarning(blur.looksBlurry ? blur.reason : null);
    autoIdentifyItem(a.uri, form);
  };

  const pickFromClipboard = async () => {
    const hasImage = await Clipboard.hasImageAsync();
    if (!hasImage) return Alert.alert('Nothing to paste', "There's no image on your clipboard right now.");
    const image = await Clipboard.getImageAsync({ format: 'jpeg' });
    if (!image?.data) return Alert.alert("Couldn't paste", 'That clipboard image could not be read.');
    setImageUri(image.data);
    setBlurWarning(null); // clipboard images don't carry reliable width/height for the heuristic
    autoIdentifyItem(image.data, form);
  };

  const handleSave = async () => {
    if (!form.category || !form.color) return Alert.alert('Missing info', 'Pick a category and color first.');
    setSaving(true);
    try {
      const created = await uploadWardrobeItem(imageUri, {
        category: form.category, color: form.color, occasionTags: form.occasionTags,
        name: form.name.trim() || undefined,
        style: form.style ?? undefined,
        season: form.season ?? undefined,
        rating: form.rating ?? undefined,
        brand: form.brand.trim() || undefined,
        price: form.price ? Number(form.price) : undefined,
        size: form.size.trim() || undefined,
        material: form.material.trim() || undefined,
      });
      setSavedItem(created);
    } catch (e: any) {
      Alert.alert('Could not save', e.message);
    } finally {
      setSaving(false);
    }
  };

  // "Successfully added" confirmation (Closet Section board), with a
  // lightweight poll against the item's own backgroundRemoval.status
  // (already returned by GET /wardrobe/items/:id) so the confirmation
  // can say "still cleaning up the photo" instead of implying it's
  // instant — background removal genuinely takes a few seconds to
  // tens of seconds depending on provider.
  //
  // v2: previously the message never changed no matter how long this
  // ran ("this can take a minute" — still true, unmoving, after 5
  // actual minutes), and the poll had no cap, so a stuck/never-
  // completing status would spin forever with zero signal that
  // anything was unusual. Now shows real elapsed time, escalates the
  // message if it's taking longer than typical, and stops polling
  // after 2 minutes — at that point it's clearly not "any second now,"
  // and the honest thing is to say so and let the person move on
  // rather than keep silently spinning.
  const [bgStatus, setBgStatus] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  React.useEffect(() => {
    if (!savedItem) return;
    setBgStatus(savedItem.backgroundRemoval?.status ?? 'pending');
    setElapsedSec(0);
    const startedAt = Date.now();

    const tick = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);

    const interval = setInterval(async () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > 120_000) {
        clearInterval(interval);
        clearInterval(tick);
        return;
      }
      try {
        const fresh = await (await import('../../api/wardrobeApi')).getWardrobeItem(savedItem.id);
        setBgStatus(fresh.backgroundRemoval?.status ?? 'done');
        if (fresh.backgroundRemoval?.status === 'done' || fresh.backgroundRemoval?.status === 'failed') {
          clearInterval(interval);
          clearInterval(tick);
        }
      } catch { clearInterval(interval); clearInterval(tick); }
    }, 2500);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [savedItem]);

  const bgMessage = () => {
    if (bgStatus === 'done') return 'Background cleanup is done — it looks great!';
    if (bgStatus === 'failed') return "Background cleanup didn't work this time, but your item is saved.";
    if (elapsedSec > 120) return "Still working on this one — it's taking longer than usual. Your item's already saved, so feel free to move on; the photo will update in your closet once it finishes.";
    if (elapsedSec > 30) return `Still cleaning up the background (${elapsedSec}s) — some photos take a bit longer than others.`;
    return `Cleaning up the background now (${elapsedSec}s)…`;
  };

  if (savedItem) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={56} color={colors.success ?? '#3B8352'} />
          <Text style={[type.h2, { marginTop: spacing.md }]}>Successfully added</Text>
          <Text style={[type.muted, { textAlign: 'center', marginTop: 4 }]}>
            {bgMessage()}
          </Text>
          {bgStatus === 'processing' || bgStatus === 'pending' ? (
            <View style={styles.skeletonBox}><ActivityIndicator color={colors.inkMuted} /></View>
          ) : null}
          <View style={{ height: spacing.lg }} />
          <Button label="Done" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <Text style={[type.h1, { marginBottom: spacing.md, textAlign: 'center' }]}>Add to your closet</Text>

        <View style={styles.imageBox}>
          {imageUri ? <Image source={{ uri: imageUri }} style={styles.image} /> : (
            <View style={{ alignItems: 'center' }}>
              <FigmaIcon name="camera" size={28} color={colors.inkMuted} />
              <Text style={{ textAlign: 'center', color: colors.inkMuted, marginTop: 4 }}>No photo yet</Text>
            </View>
          )}
        </View>
        {blurWarning ? (
          <View style={styles.blurBanner}>
            <Text style={styles.blurBannerText}>{blurWarning}</Text>
            <TouchableOpacity onPress={pickFromCamera}><Text style={styles.blurBannerRetake}>Retake photo</Text></TouchableOpacity>
          </View>
        ) : null}
        {identifying ? (
          <View style={styles.identifyBanner}>
            <ActivityIndicator size="small" color={colors.inkMuted} />
            <Text style={styles.identifyBannerText}> Ara's taking a look at this…</Text>
          </View>
        ) : identifyNote ? (
          <View style={styles.identifyBanner}>
            <Text style={styles.identifyBannerText}>{identifyNote}</Text>
          </View>
        ) : null}

        <View style={styles.photoButtonRow}>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromCamera} activeOpacity={0.85}>
            <FigmaIcon name="camera" size={20} color={colors.ink} style={{ marginBottom: 2 }} />
            <Text style={styles.photoButtonText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromGallery} activeOpacity={0.85}>
            <FigmaIcon name="album" size={20} color={colors.ink} style={{ marginBottom: 2 }} />
            <Text style={styles.photoButtonText}>Album</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={pickFromClipboard} activeOpacity={0.85}>
            <Ionicons name="clipboard-outline" size={20} color={colors.ink} style={{ marginBottom: 2 }} />
            <Text style={styles.photoButtonText}>Paste</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.scanButton} onPress={scanTag} activeOpacity={0.85} disabled={scanning}>
          {scanning ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="pricetag-outline" size={16} color={colors.white} />
              <Text style={styles.scanButtonText}>Scan tag — auto-fill brand, size & material</Text>
            </>
          )}
        </TouchableOpacity>
        {scanNote ? <Text style={styles.scanNote}>{scanNote}</Text> : null}

        <TouchableOpacity onPress={() => navigation.navigate('BulkUpload')} style={{ alignSelf: 'center', marginTop: spacing.xs }}>
          <Text style={{ fontSize: 12, color: colors.inkMuted, textDecorationLine: 'underline' }}>Adding several items? Bulk upload instead</Text>
        </TouchableOpacity>

        <View style={{ marginTop: spacing.md }}>
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
        </View>

        <View style={{ height: spacing.md }} />
        <Button label="Save to closet" onPress={handleSave} loading={saving} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    imageBox: {
      height: 200, borderRadius: radius.lg, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.sm,
    },
    image: { width: '100%', height: '100%' },
    blurBanner: {
      backgroundColor: '#FCE8D8', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm,
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm,
    },
    blurBannerText: { fontSize: 12, color: '#7A4A17', fontWeight: '600', flex: 1 },
    blurBannerRetake: { fontSize: 12, color: '#7A4A17', fontWeight: '700', textDecorationLine: 'underline' },
    identifyBanner: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cream, borderRadius: radius.md,
      padding: spacing.sm, marginBottom: spacing.sm,
    },
    identifyBannerText: { fontSize: 12, color: colors.ink, flex: 1, flexWrap: 'wrap' },
    photoButtonRow: { flexDirection: 'row', gap: spacing.sm },
    photoButton: {
      flex: 1, backgroundColor: colors.cream, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      paddingVertical: spacing.sm, alignItems: 'center',
    },
    photoButtonText: { fontSize: 12, fontWeight: '600', color: colors.ink },
    scanButton: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      backgroundColor: colors.black, borderRadius: radius.md, paddingVertical: 12, marginTop: spacing.sm,
    },
    scanButtonText: { color: colors.white, fontSize: 13, fontWeight: '600' },
    scanNote: { fontSize: 12, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.md },
    doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    skeletonBox: { width: 80, height: 80, borderRadius: radius.md, backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  });
}

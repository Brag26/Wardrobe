// src/screens/Closet/ItemDetailsScreen.tsx
// Was read-only (favorite/archive/delete only) with NO way to actually
// edit an item's fields after adding it — even though style, season,
// rating, brand, price, size, and material all existed in the data
// model and displayed here, nothing let a person fill them in or fix
// a typo later. Now a real edit screen: tap "Edit details" to open the
// same form used at creation, pre-filled, saving via PATCH.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { ItemDetailsForm, EMPTY_ITEM_FORM, ItemFormValues } from '../../components/ItemDetailsForm';
import {
  getWardrobeItem, moveItemToBin, setItemFavorite, archiveWardrobeItem, unarchiveWardrobeItem,
  updateWardrobeItem, getAttributeSuggestions, markItemWorn, replaceItemPhoto, checkPhotoSize,
} from '../../api/wardrobeApi';
import * as ImagePicker from 'expo-image-picker';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const FALLBACK_CATEGORIES = ['top', 'bottom', 'dress', 'shoes', 'bag', 'accessory', 'outerwear'];
const FALLBACK_COLORS = ['black', 'white', 'red', 'blue', 'green', 'pink', 'beige', 'navy'];
const FALLBACK_STYLES = ['casual', 'formal', 'business', 'evening_wear', 'sport', 'party_wear'];
const FALLBACK_SEASONS = ['summer', 'autumn', 'winter', 'monsoon', 'spring', 'all_season'];

function itemToForm(item: any): ItemFormValues {
  return {
    name: item.name ?? '', category: item.category ?? null, color: item.color ?? null,
    occasionTags: item.occasionTags ?? [], style: item.style ?? null, season: item.season ?? null,
    rating: item.rating ?? null, brand: item.brand ?? '', price: item.price != null ? String(item.price) : '',
    size: item.size ?? '', material: item.material ?? '',
  };
}

export default function ItemDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { itemId } = route.params;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [item, setItem] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ItemFormValues>(EMPTY_ITEM_FORM);
  const [categorySearch, setCategorySearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({
    categories: FALLBACK_CATEGORIES, colors: FALLBACK_COLORS, styles: FALLBACK_STYLES, seasons: FALLBACK_SEASONS,
  });

  useEffect(() => {
    getWardrobeItem(itemId).then((i) => { setItem(i); setForm(itemToForm(i)); }).catch(() => {});
    getAttributeSuggestions().then(setSuggestions).catch(() => {});
  }, [itemId]);

  const updateForm = (patch: Partial<ItemFormValues>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleDelete = () => {
    Alert.alert('Move to Bin', 'This item will be moved to the Bin and deleted permanently after 30 days.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Move to Bin', style: 'destructive', onPress: async () => { await moveItemToBin(itemId); navigation.goBack(); } },
    ]);
  };

  const handleArchiveToggle = async () => {
    if (item.archivedAt) {
      await unarchiveWardrobeItem(itemId);
      setItem({ ...item, archivedAt: null });
    } else {
      await archiveWardrobeItem(itemId);
      Alert.alert('Archived', 'Moved out of your main closet grid — find it anytime from Archive.');
      navigation.goBack();
    }
  };

  const handleMarkWorn = async () => {
    // Wasn't wired to any UI before — wearCount (and the cost-per-wear
    // stat above) would silently stay at 0 forever since nothing ever
    // called this endpoint.
    await markItemWorn(itemId, item.wearCount ?? 0);
    setItem({ ...item, wearCount: (item.wearCount ?? 0) + 1, lastWornAt: Date.now() });
  };

  const [resaving, setResaving] = useState(false);

  // "Resave" — genuinely fixes a bad photo (wrong crop, background
  // removal that didn't come out clean) by replacing it and re-running
  // removal, rather than the only prior option: delete the whole item
  // and re-add it from scratch just to fix one bad photo.
  const handleResavePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to replace this item\'s picture.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [3, 4] });
    if (result.canceled) return;
    const sizeCheck = checkPhotoSize(result.assets[0].fileSize);
    if (!sizeCheck.ok) return Alert.alert('Photo too large', sizeCheck.message);

    setResaving(true);
    try {
      const updated = await replaceItemPhoto(itemId, result.assets[0].uri);
      setItem(updated);
      Alert.alert('Photo updated', 'Cleaning up the background now — this can take a minute. Pull to refresh in a bit to see the result.');
    } catch (e: any) {
      Alert.alert("Couldn't update photo", e.message);
    } finally {
      setResaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!form.category || !form.color) return Alert.alert('Missing info', 'Category and color are required.');
    setSaving(true);
    try {
      const updated = await updateWardrobeItem(itemId, {
        name: form.name.trim() || null, category: form.category, color: form.color,
        occasionTags: form.occasionTags, style: form.style, season: form.season, rating: form.rating,
        brand: form.brand.trim() || null, price: form.price ? Number(form.price) : null,
        size: form.size.trim() || null, material: form.material.trim() || null,
      });
      setItem(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!item) return <SafeAreaView style={styles.container} />;

  if (editing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Edit details" onBack={() => setEditing(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
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
          <Button label="Save changes" onPress={handleSaveEdit} loading={saving} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Cost-per-wear: a real Gen Z closet-app staple ("is this actually
  // worth it") — pure derived value from data already on the item, no
  // backend change needed. Only shown once there's an actual wear to
  // divide by (cost/0 is meaningless, not "infinite value").
  const costPerWear = item.price && item.wearCount > 0 ? (item.price / item.wearCount) : null;

  const rows = [
    { icon: 'pricetag-outline' as const, label: 'Brand', value: item.brand },
    { icon: 'cash-outline' as const, label: 'Price', value: item.price ? `₹${item.price}` : null },
    { icon: 'resize-outline' as const, label: 'Size', value: item.size },
    { icon: 'shirt-outline' as const, label: 'Material', value: item.material },
    { icon: 'color-palette-outline' as const, label: 'Style', value: item.style },
    { icon: 'partly-sunny-outline' as const, label: 'Season', value: item.season },
    { icon: 'repeat-outline' as const, label: 'Worn', value: `${item.wearCount}×` },
    { icon: 'trending-down-outline' as const, label: 'Cost per wear', value: costPerWear != null ? `₹${costPerWear.toFixed(0)}` : (item.price ? 'Wear it to find out' : null) },
    { icon: 'sparkles-outline' as const, label: 'Status', value: item.backgroundRemoval?.status },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.imageWrap}>
          <ItemThumb item={item} size={280} />
        </View>

        <Text style={[type.h1, { textTransform: 'capitalize', marginBottom: 2, textAlign: 'center' }]}>
          {item.name || `${item.color} ${item.category?.replace(/_/g, ' ')}`}
        </Text>
        {item.rating != null && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 2, marginBottom: spacing.md }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <FigmaIcon key={n} name={n <= item.rating ? "star" : "starOutline"} size={16} color={colors.warning} />
            ))}
          </View>
        )}

        {rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <View style={styles.rowLabelWrap}>
              <Ionicons name={row.icon} size={15} color={colors.inkMuted} />
              <Text style={type.muted}>{row.label}</Text>
            </View>
            <Text style={[type.body, { fontWeight: '600', textTransform: 'capitalize' }]}>{row.value ?? '—'}</Text>
          </View>
        ))}

        <View style={{ height: spacing.lg }} />
        <Button label="I wore this today" onPress={handleMarkWorn} />
        <View style={{ height: spacing.sm }} />
        <Button label={resaving ? 'Updating…' : 'Resave photo'} variant="outline" onPress={handleResavePhoto} loading={resaving} />
        <View style={{ height: spacing.sm }} />
        <Button label="Edit details" variant="outline" onPress={() => { setForm(itemToForm(item)); setEditing(true); }} />
        <View style={{ height: spacing.sm }} />
        <Button label={item.isFavorite ? 'Remove from favorites' : 'Add to favorites'} variant="outline"
          onPress={async () => { await setItemFavorite(itemId, !item.isFavorite); setItem({ ...item, isFavorite: !item.isFavorite }); }} />
        <View style={{ height: spacing.sm }} />
        <Button label={item.archivedAt ? 'Unarchive' : 'Archive'} variant="outline" onPress={handleArchiveToggle} />
        <View style={{ height: spacing.sm }} />
        <Button label="Move to Bin" variant="secondary" onPress={handleDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    imageWrap: { alignItems: 'center', marginBottom: spacing.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  });
}

// src/screens/Outfits/PackingDetailScreen.tsx
// Tapping a trip in "My packing" opens this — cover, dates, packed
// outfits, and the Edit/Delete kebab actions from the board ("Edit
// packing / Delete packing" + "Delete this packing" confirmation).
// v2: "Edit outfits" only ever let you change WHICH outfits were
// packed — there was no way to fix the trip's own name/destination/
// dates/cover after creating it. Added an inline edit mode for that.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, FlatList, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { ItemThumb } from '../../components/ItemThumb';
import { getPacking, deletePacking, updatePacking, uploadPackingCoverImage, getItemsByIds } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function PackingDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { packingId } = route.params;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [packing, setPacking] = useState<any>(null);
  const [outfits, setOutfits] = useState<any[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', destination: '', startDate: '', endDate: '', coverUri: null as string | null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const p = await getPacking(packingId);
    setPacking(p);
    // outfits themselves aren't fetched individually here since
    // getPacking only returns ids — reuse getItemsByIds against
    // /wardrobe/items would be wrong (different resource), so this
    // pulls each outfit's first-item preview lazily via getOutfit.
    const { getOutfit } = await import('../../api/wardrobeApi');
    const fetched = await Promise.all((p.outfitIds ?? []).map((id: string) => getOutfit(id).catch(() => null)));
    const valid = fetched.filter(Boolean);
    setOutfits(valid);
    const allIds = valid.flatMap((o: any) => o.itemIds ?? []).filter(Boolean);
    if (allIds.length) {
      const resolved = await getItemsByIds([...new Set(allIds)] as string[]);
      const map: Record<string, any> = {};
      resolved.forEach((item: any) => { map[item.id] = item; });
      setPreviews(map);
    }
  }, [packingId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = () => {
    Alert.alert('Delete this packing', 'Once deleted, this packing cannot be recovered.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deletePacking(packingId); navigation.goBack(); } },
    ]);
  };

  const startEditing = () => {
    setEditForm({
      name: packing.name ?? '', destination: packing.destination ?? '',
      startDate: packing.startDate ?? '', endDate: packing.endDate ?? '', coverUri: null,
    });
    setEditing(true);
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to change the cover image.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setEditForm((prev) => ({ ...prev, coverUri: result.assets[0].uri }));
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      let coverImageUrl: string | undefined;
      if (editForm.coverUri) coverImageUrl = await uploadPackingCoverImage(editForm.coverUri);
      const updated = await updatePacking(packingId, {
        name: editForm.name.trim() || null,
        destination: editForm.destination.trim() || null,
        startDate: editForm.startDate.trim() || null,
        endDate: editForm.endDate.trim() || null,
        ...(coverImageUrl ? { coverImageUrl } : {}),
      });
      setPacking(updated);
      setEditing(false);
    } catch (e: any) {
      Alert.alert("Couldn't save", e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!packing) return <SafeAreaView style={styles.container} />;

  if (editing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Edit trip" onBack={() => setEditing(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.coverBox} onPress={pickCover} activeOpacity={0.85}>
            {editForm.coverUri ? <Image source={{ uri: editForm.coverUri }} style={styles.coverImage} />
              : packing.coverImageUrl ? <Image source={{ uri: packing.coverImageUrl }} style={styles.coverImage} />
              : <View style={{ alignItems: 'center' }}><Ionicons name="image-outline" size={26} color={colors.inkMuted} /><Text style={{ color: colors.inkMuted, marginTop: 4 }}>Change cover image</Text></View>}
          </TouchableOpacity>

          <Text style={styles.formLabel}>Trip name</Text>
          <TextInput style={styles.input} value={editForm.name} onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))} placeholderTextColor={colors.inkMuted} />
          <Text style={styles.formLabel}>Destination</Text>
          <TextInput style={styles.input} value={editForm.destination} onChangeText={(t) => setEditForm((p) => ({ ...p, destination: t }))} placeholderTextColor={colors.inkMuted} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>Start date</Text>
              <TextInput style={styles.input} value={editForm.startDate} onChangeText={(t) => setEditForm((p) => ({ ...p, startDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formLabel}>End date</Text>
              <TextInput style={styles.input} value={editForm.endDate} onChangeText={(t) => setEditForm((p) => ({ ...p, endDate: t }))} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkMuted} />
            </View>
          </View>
          <View style={{ height: spacing.md }} />
          <Button label="Save changes" onPress={handleSaveEdit} loading={saving} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={packing.name ?? 'Packing'} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <TouchableOpacity onPress={startEditing} activeOpacity={0.85}>
          {packing.coverImageUrl ? (
            <Image source={{ uri: packing.coverImageUrl }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder]}><Ionicons name="briefcase-outline" size={32} color={colors.inkMuted} /></View>
          )}
        </TouchableOpacity>

        {packing.destination ? (
          <View style={styles.metaRow}><Ionicons name="location-outline" size={13} color={colors.inkMuted} /><Text style={styles.meta}> {packing.destination}</Text></View>
        ) : null}
        {(packing.startDate || packing.endDate) && (
          <View style={styles.metaRow}><Ionicons name="calendar-outline" size={13} color={colors.inkMuted} /><Text style={styles.meta}> {packing.startDate ?? '?'} → {packing.endDate ?? '?'}</Text></View>
        )}

        <Text style={[type.h3, { marginTop: spacing.md, marginBottom: spacing.sm }]}>
          {outfits.length} outfit{outfits.length === 1 ? '' : 's'} packing
        </Text>
        <FlatList
          data={outfits}
          keyExtractor={(o) => o.id}
          numColumns={3}
          scrollEnabled={false}
          columnWrapperStyle={{ gap: spacing.sm }}
          contentContainerStyle={{ gap: spacing.sm }}
          renderItem={({ item }) => {
            const preview = item.itemIds?.[0] ? previews[item.itemIds[0]] : null;
            return (
              <View style={styles.outfitCell}>
                <ItemThumb item={preview} size={100} />
                <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Untitled'}</Text>
              </View>
            );
          }}
        />

        <View style={{ height: spacing.lg }} />
        <Button label="Edit trip details" variant="outline" onPress={startEditing} />
        <View style={{ height: spacing.sm }} />
        <Button label="Edit outfits" variant="outline" onPress={() => navigation.navigate('SelectPackingOutfits', { packingId })} />
        <View style={{ height: spacing.sm }} />
        <Button label="Delete packing" variant="secondary" onPress={handleDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    cover: { width: '100%', height: 160, borderRadius: radius.lg, marginBottom: spacing.sm },
    coverPlaceholder: { backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center' },
    coverBox: {
      height: 160, borderRadius: radius.lg, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md,
    },
    coverImage: { width: '100%', height: '100%' },
    formLabel: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, marginBottom: 4, marginTop: spacing.sm },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 12, fontSize: 14, color: colors.ink, backgroundColor: colors.bgSoft,
    },
    meta: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    outfitCell: { width: 100, alignItems: 'center' },
    outfitName: { fontSize: 11, color: colors.ink, marginTop: 4 },
  });
}


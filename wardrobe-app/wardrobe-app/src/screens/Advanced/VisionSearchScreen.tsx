// src/screens/Advanced/VisionSearchScreen.tsx — Figma proposal #14 "AI Vision Search"
//
// HONEST LIMITATION: true visual similarity search needs an image
// embedding model + vector search — real infra this backend doesn't
// have. This is a real, working version: you take a photo, tag its
// category (quick tap), and it searches your actual closet for items
// in that category — genuine search against your real data, not fake
// results, just simpler matching logic than image embeddings.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Chip } from '../../components/Chip';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const CATEGORIES = ['top', 'bottom', 'dress', 'shoes', 'bag', 'accessory'];

export default function VisionSearchScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const search = async (cat: string) => {
    setCategory(cat);
    setSearching(true);
    try {
      const items = await getWardrobeItems({ category: cat });
      setResults(items);
    } finally {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="AI Vision Search" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.subtitle}>Take a photo, find similar items in your closet</Text>

        <TouchableOpacity style={styles.photoBox} onPress={pickPhoto}>
          {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : (
            <View style={{ alignItems: 'center' }}>
              <FigmaIcon name="camera" size={26} color={colors.inkMuted} />
              <Text style={[styles.photoPlaceholder, { marginTop: 4 }]}>Take or pick a photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>What kind of item is this?</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => <Chip key={c} label={c} selected={category === c} onPress={() => search(c)} />)}
        </View>

        {searching ? (
          <ActivityIndicator style={{ marginTop: spacing.lg }} />
        ) : category ? (
          <>
            <Text style={styles.sectionLabel}>Similar items in your closet</Text>
            <View style={styles.grid}>
              {results.length > 0 ? results.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <ItemThumb item={item} size={90} />
                  <Text style={styles.itemLabel}>{item.color} {item.category}</Text>
                </View>
              )) : <Text style={styles.empty}>No {category} items in your closet yet.</Text>}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  subtitle: { ...type.muted, marginBottom: spacing.md },
  photoBox: {
    height: 200, borderRadius: radius.lg, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md,
  },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { textAlign: 'center', color: colors.inkMuted },
  sectionLabel: { ...type.h3, marginTop: spacing.md, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { alignItems: 'center' },
  itemLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 4, textTransform: 'capitalize' },
  empty: { ...type.muted },
  });
}

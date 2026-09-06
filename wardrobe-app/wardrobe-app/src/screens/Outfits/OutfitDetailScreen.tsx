// src/screens/Outfits/OutfitDetailScreen.tsx
// Tapping an outfit card previously jumped straight into the EDIT
// form (category tabs, item-selection grid) — no way to just look at
// your outfit first without landing in editing mode. This is a real
// display-first screen: a large version of the same flat-lay collage
// from the Outfits grid, the outfit's name/rating/tags, and an "Edit
// outfit" button further down that's the ONLY path into the actual
// edit form. Share/Delete live here too, alongside Edit, rather than
// only on the small card.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { Button } from '../../components/Button';
import { getOutfit, getItemsByIds, deleteOutfit } from '../../api/wardrobeApi';
import { collageLayout } from '../../utils/outfitCollage';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function OutfitDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  // Previously destructured route.params directly with no guard —
  // React Navigation's params CAN be undefined depending on how a
  // screen gets reached, and an unguarded destructure of undefined
  // throws immediately. Real crash risk, fixed defensively here even
  // though it's not confirmed as THE cause of the current blank-screen
  // issue (this screen only mounts once actually navigated to, so it
  // wouldn't explain a blank screen right at app launch before any
  // navigation happens).
  const outfitId = route.params?.outfitId;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [outfit, setOutfit] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!outfitId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const o = await getOutfit(outfitId);
      setOutfit(o);
      if (o.itemIds?.length > 0) {
        const resolved = await getItemsByIds(o.itemIds);
        setItems(resolved);
      }
    } catch (e: any) {
      console.error('[OutfitDetailScreen] load failed:', e);
      Alert.alert("Couldn't load this outfit", e.message ?? 'Try again in a bit.');
    } finally {
      setLoading(false);
    }
  }, [outfitId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleShare = async () => {
    if (!outfit) return;
    try {
      await Share.share({ message: `Check out my outfit${outfit.name ? `: ${outfit.name}` : ''}!` });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert('Delete this outfit?', 'This removes it permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteOutfit(outfitId); navigation.goBack(); } },
    ]);
  };

  if (!outfitId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Outfit" />
        <Text style={{ padding: spacing.lg, color: colors.inkMuted }}>Couldn't find that outfit.</Text>
      </SafeAreaView>
    );
  }

  if (loading || !outfit) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Outfit" />
      </SafeAreaView>
    );
  }

  // Previously ALL items went into the overlapping collage regardless
  // of whether their background had actually finished processing —
  // an item whose removal failed or hasn't completed yet still shows
  // its RAW original photo (visible white background, sometimes even
  // the model still in frame). Stacked opaquely on top of other
  // pieces, that doesn't just look wrong on its own — it actively
  // hides whatever's underneath it in the pile, which is exactly what
  // happened here (a watch's un-removed photo covering the dress).
  // Only genuinely background-removed items go into the seamless
  // layered display now; anything still processing/failed shows
  // separately below instead, so it can't corrupt the collage.
  const collageReady = items.filter((i) => i.backgroundRemoval?.status === 'done');
  const notReady = items.filter((i) => i.backgroundRemoval?.status !== 'done');
  const positions = collageReady.length > 1 ? collageLayout(collageReady, 2) : [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title={outfit.name ?? 'Outfit'} />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        <View style={styles.displayWrap}>
          {collageReady.length > 1 ? (
            positions.map((pos, idx) => (
              <View key={collageReady[idx].id ?? idx} style={[styles.collagePiece, { top: pos.top, left: pos.left }]}>
                <ItemThumb item={collageReady[idx]} size={pos.thumbSize} noBorder />
              </View>
            ))
          ) : collageReady.length === 1 ? (
            <ItemThumb item={collageReady[0]} size={300} noBorder />
          ) : (
            <Text style={styles.processingText}>Photos still processing…</Text>
          )}
        </View>

        {notReady.length > 0 && (
          <View style={styles.notReadySection}>
            <Text style={styles.notReadyLabel}>
              {notReady.length} more piece{notReady.length === 1 ? '' : 's'} — photo still processing
            </Text>
            <View style={styles.notReadyRow}>
              {notReady.map((it) => (
                <View key={it.id} style={styles.notReadyThumb}><ItemThumb item={it} size={56} /></View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          {outfit.rating != null && (
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((n) => (
                <FigmaIcon key={n} name={n <= outfit.rating ? 'star' : 'starOutline'} size={18} color={colors.border} />
              ))}
            </View>
          )}
          {outfit.description ? <Text style={styles.description}>{outfit.description}</Text> : null}
          <View style={styles.tagsRow}>
            {outfit.aesthetic && <View style={styles.tag}><Text style={styles.tagText}>{outfit.aesthetic.replace(/_/g, ' ')}</Text></View>}
            {outfit.season && <View style={styles.tag}><Text style={styles.tagText}>{outfit.season}</Text></View>}
            {outfit.category && <View style={styles.tag}><Text style={styles.tagText}>{outfit.category.replace(/_/g, ' ')}</Text></View>}
          </View>
          <Text style={styles.pieceCount}>{items.length} piece{items.length === 1 ? '' : 's'}</Text>
        </View>

        <View style={styles.actions}>
          <Button label="Edit outfit" onPress={() => navigation.navigate('CreateOutfit', { editOutfitId: outfitId })} />
          <View style={{ height: spacing.sm }} />
          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
              <Text style={styles.secondaryBtnText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, styles.deleteBtn]} onPress={handleDelete}>
              <Text style={[styles.secondaryBtnText, styles.deleteBtnText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    displayWrap: {
      width: 300, height: 375, alignSelf: 'center', position: 'relative',
      backgroundColor: colors.cream, borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.md,
    },
    collagePiece: { position: 'absolute' },
    processingText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: colors.inkMuted, fontSize: 13 },
    notReadySection: { paddingHorizontal: spacing.lg, marginTop: spacing.md, alignItems: 'center' },
    notReadyLabel: { fontSize: 11, color: colors.inkMuted, marginBottom: spacing.sm },
    notReadyRow: { flexDirection: 'row', gap: spacing.sm },
    notReadyThumb: { borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    infoSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, alignItems: 'center' },
    starsRow: { flexDirection: 'row', gap: 2, marginBottom: spacing.sm },
    description: { ...type.body, textAlign: 'center', marginBottom: spacing.sm },
    tagsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.sm },
    tag: { backgroundColor: colors.bgSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
    tagText: { fontSize: 11, color: colors.inkMuted, textTransform: 'capitalize' },
    pieceCount: { ...type.muted },
    actions: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
    secondaryRow: { flexDirection: 'row', gap: spacing.sm },
    secondaryBtn: {
      flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.border,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '600', color: colors.ink },
    deleteBtn: { borderColor: colors.danger },
    deleteBtnText: { color: colors.danger },
  });
}

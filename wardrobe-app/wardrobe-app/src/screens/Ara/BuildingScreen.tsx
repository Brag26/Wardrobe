import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemOrbit } from '../../components/ItemOrbit';
import { startStylingSession, generateOutfit, getOutfit, getWardrobeItems } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const HERO_HEIGHT = Math.round(Dimensions.get('window').height * 0.46);

export default function BuildingScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { occasion, mood } = route.params ?? {};
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ session: any; outfit: any } | null>(null);
  const [resolvedItems, setResolvedItems] = useState<any[]>([]);
  const [loadingPreviewItems, setLoadingPreviewItems] = useState<any[]>([]);

  useEffect(() => {
    getWardrobeItems().then((items) => setLoadingPreviewItems(items.slice(0, 6))).catch(() => {});
  }, []);

  useEffect(() => {
    let settled = false;
    const safetyTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setError('This is taking much longer than expected. Check your connection and try again.');
        setLoading(false);
      }
    }, 20_000);

    (async () => {
      try {
        const session = await startStylingSession(occasion, mood);
        const generated = await generateOutfit(session.id);
        if (settled) return;
        setResult(generated);
        if (generated.outfit?.id) {
          const detailed = await getOutfit(generated.outfit.id);
          if (!settled) setResolvedItems(detailed.items ?? []);
        }
      } catch (e: any) {
        if (!settled) {
          settled = true;
          setError(e.message);
        }
      } finally {
        if (!settled) {
          settled = true;
          setLoading(false);
        }
        clearTimeout(safetyTimer);
      }
    })();

    return () => clearTimeout(safetyTimer);
  }, [occasion, mood]);

  if (loading) {
    // Intentionally always dark/starry here, regardless of light/dark
    // mode toggle — this is the "magic" moment visual from the Figma,
    // not a themed content screen.
    return (
      <View style={styles.orbitScreen}>
        <ItemOrbit items={loadingPreviewItems} centerText="Crafting magic just for you ✨" fullBleed />
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ScreenHeader />
        <Text style={type.h2}>Couldn't build a look</Text>
        <Text style={[type.body, { textAlign: 'center', color: colors.danger }]}>{error}</Text>
        <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg }]}>Make sure you have items in your closet first.</Text>
        <Button label="Back to home" onPress={() => navigation.navigate('HomeTab')} variant="outline" />
      </SafeAreaView>
    );
  }

  const outfit = result?.outfit;

  // Full-screen "match" moment, take 2: v1 put the outfit story text
  // directly on top of the moving glow blobs/stars everywhere, which
  // looked cool but made the text genuinely hard to read as the
  // animation drifted behind it. Now the orbit is a full-bleed hero
  // section (not boxed in a small rounded card — still satisfies
  // "full screen"), and the story/reasoning/buttons live below it on
  // a SOLID dark surface — same color family so the transition feels
  // seamless, but nothing is trying to be read over live motion.
  return (
    <View style={styles.orbitScreen}>
      <SafeAreaView style={styles.matchSafeArea} edges={['top']}>
        <View style={styles.heroSection}>
          <ItemOrbit
            items={resolvedItems}
            centerText={outfit?.matchScore != null ? `${outfit.matchScore}% match ✨` : 'Your look ✨'}
            fullBleed
          />
          <View style={styles.heroHeaderOverlay}>
            <ScreenHeader dark />
          </View>
        </View>

        <ScrollView style={styles.contentSheet} contentContainerStyle={{ padding: spacing.lg }}>
          <View style={styles.card}>
            <Text style={[type.body, { fontWeight: '600', color: '#fff' }]}>{outfit?.itemIds?.length ?? 0} pieces selected</Text>
            {outfit?.matchScore != null && <Text style={[type.body, { fontWeight: '700', color: '#8FE3AE' }]}>{outfit.matchScore}% match</Text>}
          </View>

          <View style={styles.card}>
            <Text style={[type.body, { lineHeight: 21, fontStyle: 'italic', color: '#fff' }]}>{outfit?.story ?? 'A look pulled together just for you.'}</Text>
          </View>

          {result?.session?.reasoningSteps?.length ? (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[type.h3, { marginBottom: spacing.sm, color: '#fff' }]}>How Ara thought about it</Text>
              <View style={styles.tagRow}>
                {result.session.reasoningSteps.map((step: string, idx: number) => (
                  <View key={idx} style={styles.tag}><Text style={styles.tagText}>{step}</Text></View>
                ))}
              </View>
            </View>
          ) : null}

          <Button label="Save to closet" onPress={() => navigation.navigate('HomeTab')} />
          <View style={{ height: spacing.sm }} />
          <Button label="See more options" onPress={() => navigation.navigate('Discover', { occasion, mood })} variant="secondary" />
          <View style={{ height: spacing.sm }} />
          <Button label="Try a different mood" onPress={() => navigation.goBack()} variant="outline" />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    orbitScreen: { flex: 1, backgroundColor: '#150C20' },
    matchSafeArea: { flex: 1 },
    heroSection: { height: HERO_HEIGHT, width: '100%' },
    heroHeaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
    // Solid (not translucent) surface for the readable content below
    // the animated hero — same dark family as the orbit background so
    // the seam between "animated" and "static" doesn't look like a
    // hard cut, but nothing here is competing with moving graphics.
    contentSheet: { flex: 1, backgroundColor: '#150C20' },
    centerContainer: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
    card: {
      backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
      borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md,
    },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    tag: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.sm },
    tagText: { fontSize: 11, color: '#fff', fontWeight: '500' },
  });
}

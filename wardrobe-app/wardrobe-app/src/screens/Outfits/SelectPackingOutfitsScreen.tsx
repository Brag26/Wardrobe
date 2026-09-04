// src/screens/Outfits/SelectPackingOutfitsScreen.tsx
// "Select outfit" screen from the Outfit Section board — checkbox grid
// of existing outfits, saved onto the packing trip created by
// StartPackingScreen when "Done" is tapped.
//
// v2: weather-assisted picking. If the trip has a destination, this
// calls OUR OWN backend's /weather/by-place endpoint (which sources
// the actual data internally — see server/src/controllers/
// weather.controller.ts) rather than the app calling a third-party
// weather domain directly, then sorts outfits whose `season` field
// matches to the top with a "Good for the weather" badge. HONEST
// LIMITATION: this is CURRENT weather at the destination, not a real
// forecast for the trip's actual future dates — free weather data only
// reliably covers ~16 days out. Framed to the user as "here's what the
// weather's like there" rather than "here's the forecast for your
// trip," so it doesn't overclaim.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { ItemThumb } from '../../components/ItemThumb';
import { listOutfits, getPacking, updatePacking, getItemsByIds, getWeatherByPlace } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

function weatherLabel(code: number): string {
  if (code === 0) return 'clear';
  if ([1, 2, 3].includes(code)) return 'partly cloudy';
  if ([45, 48].includes(code)) return 'foggy';
  if ([51, 53, 55, 61, 63, 65].includes(code)) return 'rainy';
  if ([71, 73, 75, 77].includes(code)) return 'snowy';
  if ([95, 96, 99].includes(code)) return 'stormy';
  return 'mild';
}

interface DestinationWeather {
  temp: number;
  code: number;
  season: string;
  placeName: string;
}

export default function SelectPackingOutfitsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { packingId } = route.params;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [outfits, setOutfits] = useState<any[]>([]);
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [weather, setWeather] = useState<DestinationWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [outfitData, packing] = await Promise.all([listOutfits('all'), getPacking(packingId)]);
      setOutfits(outfitData);
      setSelected(new Set(packing.outfitIds ?? []));
      const allIds = outfitData.flatMap((o: any) => o.itemIds ?? []).filter(Boolean);
      if (allIds.length) {
        const resolved = await getItemsByIds([...new Set(allIds)] as string[]);
        const map: Record<string, any> = {};
        resolved.forEach((item: any) => { map[item.id] = item; });
        setPreviews(map);
      }

      if (packing.destination) {
        setWeatherLoading(true);
        try {
          const wx = await getWeatherByPlace(packing.destination);
          setWeather(wx);
        } catch {
          setWeather(null);
        } finally {
          setWeatherLoading(false);
        }
      }
    })().catch(() => {});
  }, [packingId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDone = async () => {
    setSaving(true);
    try {
      await updatePacking(packingId, { outfitIds: Array.from(selected) });
      navigation.navigate('OutfitsHome');
    } finally {
      setSaving(false);
    }
  };

  // Weather-matched outfits float to the top so the most relevant
  // choices for the destination are what you see first, without
  // hiding anything else — everything's still here, just reordered.
  const sortedOutfits = weather
    ? [...outfits].sort((a, b) => {
        const aMatch = a.season === weather.season ? 1 : 0;
        const bMatch = b.season === weather.season ? 1 : 0;
        return bMatch - aMatch;
      })
    : outfits;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Select outfit" />

      {weatherLoading ? (
        <View style={styles.weatherBanner}>
          <ActivityIndicator size="small" color={colors.ink} />
          <Text style={styles.weatherBannerText}> Checking the weather for your trip…</Text>
        </View>
      ) : weather ? (
        <View style={styles.weatherBanner}>
          <FigmaIcon name="sun" size={16} />
          <Text style={styles.weatherBannerText}>
            {' '}It's {Math.round(weather.temp)}°C and {weatherLabel(weather.code)} in {weather.placeName} right now — I've put your {weather.season} outfits first.
          </Text>
        </View>
      ) : null}

      <Text style={styles.subtitle}>{selected.size} outfit{selected.size === 1 ? '' : 's'} packing</Text>
      <FlatList
        data={sortedOutfits}
        keyExtractor={(o) => o.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: 100 }}
        ListEmptyComponent={<Text style={styles.empty}>No outfits yet — create one first.</Text>}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          const preview = item.itemIds?.[0] ? previews[item.itemIds[0]] : null;
          const weatherMatch = weather && item.season === weather.season;
          return (
            <TouchableOpacity style={[styles.card, isSelected && styles.cardSelected]} onPress={() => toggle(item.id)} activeOpacity={0.85}>
              <View style={styles.checkbox}>{isSelected && <FigmaIcon name="checkmark" size={12} color={colors.black} />}</View>
              {weatherMatch && (
                <View style={styles.weatherBadge}>
                  <FigmaIcon name="sun" size={10} />
                </View>
              )}
              <ItemThumb item={preview} size={130} />
              <Text style={styles.outfitName} numberOfLines={1}>{item.name ?? 'Untitled outfit'}</Text>
              {weatherMatch && <Text style={styles.weatherMatchLabel}>Good for the weather</Text>}
            </TouchableOpacity>
          );
        }}
      />
      <View style={styles.footer}>
        <Button label="Done" onPress={handleDone} loading={saving} />
      </View>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    subtitle: { fontSize: 12, color: colors.inkMuted, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
    empty: { color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xxl },
    weatherBanner: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cream, borderRadius: radius.md,
      marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: spacing.sm,
    },
    weatherBannerText: { fontSize: 12, color: colors.ink, flex: 1, flexWrap: 'wrap' },
    card: {
      flex: 1, backgroundColor: colors.bgSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      padding: spacing.sm, alignItems: 'center', position: 'relative',
    },
    cardSelected: { borderColor: colors.black, borderWidth: 2 },
    checkbox: {
      position: 'absolute', top: 8, left: 8, zIndex: 2, width: 22, height: 22, borderRadius: 6,
      borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center',
    },
    weatherBadge: {
      position: 'absolute', top: 8, right: 8, zIndex: 2, width: 20, height: 20, borderRadius: 10,
      backgroundColor: '#E0A83D', alignItems: 'center', justifyContent: 'center',
    },
    outfitName: { fontSize: 12, fontWeight: '600', color: colors.ink, marginTop: spacing.xs },
    weatherMatchLabel: { fontSize: 9, color: '#B8862E', fontWeight: '700', marginTop: 2 },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  });
}

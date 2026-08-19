// src/screens/Advanced/WeatherAdaptScreen.tsx — Figma proposal #12 "Weather AI Adaptation"
// Real weather data via the backend's /weather/by-coords proxy (which
// sources from Open-Meteo internally) — the app only ever calls its
// own API, never a third-party weather domain directly. Genuinely
// functional, not a mock.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems, getWeatherByCoords } from '../../api/wardrobeApi';
import { colors, spacing, type, radius } from '../../theme/theme';

function seasonFromTemp(tempC: number): string {
  if (tempC >= 28) return 'summer';
  if (tempC >= 18) return 'spring';
  if (tempC >= 8) return 'autumn';
  return 'winter';
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 61, 63, 65].includes(code)) return 'Rainy';
  if ([71, 73, 75, 77].includes(code)) return 'Snowy';
  if ([95, 96, 99].includes(code)) return 'Stormy';
  return 'Mild';
}

export default function WeatherAdaptScreen() {
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        let lat = 19.076; let lon = 72.877; // Mumbai fallback if location denied
        if (perm.granted) {
          const loc = await Location.getCurrentPositionAsync({});
          lat = loc.coords.latitude;
          lon = loc.coords.longitude;
        }

        const data = await getWeatherByCoords(lat, lon);
        const temp = data.temp;
        const code = data.code;
        setWeather({ temp, code });

        const season = seasonFromTemp(temp);
        const closet = await getWardrobeItems({ season });
        setItems(closet);
      } catch (e: any) {
        setError('Could not load weather — check location permission and internet.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Weather AI Adaptation" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.weatherCard}>
              <Text style={styles.temp}>{Math.round(weather!.temp)}°C</Text>
              <Text style={styles.condition}>{weatherLabel(weather!.code)}</Text>
              <Text style={styles.suggestion}>Suggesting {seasonFromTemp(weather!.temp)} pieces from your closet</Text>
            </View>

            <Text style={styles.sectionLabel}>Matches today's weather</Text>
            <View style={styles.grid}>
              {items.length > 0 ? items.map((item) => (
                <View key={item.id} style={styles.gridItem}>
                  <ItemThumb item={item} size={90} />
                  <Text style={styles.itemLabel}>{item.color} {item.category}</Text>
                </View>
              )) : <Text style={styles.empty}>No items tagged for this season yet — add a season on your item details.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  error: { ...type.body, color: colors.danger, textAlign: 'center', marginTop: spacing.xl },
  weatherCard: { backgroundColor: colors.cream, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.lg },
  temp: { fontSize: 40, fontWeight: '700', color: colors.ink },
  condition: { ...type.body, color: colors.inkMuted, marginTop: 2 },
  suggestion: { ...type.muted, marginTop: spacing.sm, textAlign: 'center' },
  sectionLabel: { ...type.h3, marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  gridItem: { alignItems: 'center' },
  itemLabel: { fontSize: 11, color: colors.inkMuted, marginTop: 4, textTransform: 'capitalize' },
  empty: { ...type.muted },
});

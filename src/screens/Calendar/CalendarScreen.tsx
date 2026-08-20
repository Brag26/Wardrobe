// src/screens/Calendar/CalendarScreen.tsx
// Home board's Calendar screen — month grid, a dot on any date that
// already has an "Outfit of the Day" assigned. Tapping a date opens
// DayOutfitScreen to view/assign/change that day's look. Uses
// react-native-calendars (added as a new dependency) rather than a
// hand-built month grid — a real calendar library handles month
// navigation, locale, and date math correctly instead of reinventing
// it, which is more reliable than what a from-scratch grid would be.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { listCalendarMonth, getTodayOutfit } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [markedDates, setMarkedDates] = useState<Record<string, any>>({});
  // Previously the calendar grid only showed a small dot on days with
  // an assigned outfit — genuinely no way to see WHAT that outfit
  // actually was without tapping into a separate day screen. This
  // shows today's real outfit prominently right here, reusing the
  // same backend endpoint the Home banner uses (same outfit either
  // place — generating/viewing it in one spot keeps the other in
  // sync automatically).
  const [todayOutfit, setTodayOutfit] = useState<any>(null);
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [ootdLoading, setOotdLoading] = useState(false);

  const load = useCallback(async (m: string) => {
    try {
      const entries = await listCalendarMonth(m);
      const marks: Record<string, any> = {};
      entries.forEach((e: any) => {
        marks[e.date] = { marked: true, dotColor: colors.lavenderDeep };
      });
      setMarkedDates(marks);
    } catch {}
  }, [colors.lavenderDeep]);

  const loadTodayOutfit = useCallback(async () => {
    setOotdLoading(true);
    try {
      const result = await getTodayOutfit();
      setTodayOutfit(result.outfit ?? null);
      setTodayItems(result.items ?? []);
    } catch {
      setTodayOutfit(null);
    } finally {
      setOotdLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(month); loadTodayOutfit(); }, [month, load, loadTodayOutfit]));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Calendar" />
      <Text style={[type.muted, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
        Tap any date to log or plan your outfit for that day.
      </Text>
      <Calendar
        current={`${month}-01`}
        onMonthChange={(d: DateData) => setMonth(d.dateString.slice(0, 7))}
        onDayPress={(d: DateData) => navigation.navigate('DayOutfit', { date: d.dateString })}
        markedDates={{
          ...markedDates,
          [todayString()]: { ...(markedDates[todayString()] ?? {}), selected: true, selectedColor: colors.lavender },
        }}
        theme={{
          backgroundColor: colors.bg,
          calendarBackground: colors.bg,
          textSectionTitleColor: colors.inkMuted,
          selectedDayBackgroundColor: colors.lavender,
          selectedDayTextColor: colors.ink,
          todayTextColor: colors.lavenderDeep,
          dayTextColor: colors.ink,
          monthTextColor: colors.ink,
          arrowColor: colors.ink,
          dotColor: colors.lavenderDeep,
        }}
        style={styles.calendar}
      />

      <Text style={styles.todaySectionTitle}>Today's Outfit</Text>
      <TouchableOpacity
        style={styles.todayCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DayOutfit', { date: todayString() })}
      >
        {ootdLoading ? (
          <Text style={styles.todayEmptyText}>Loading…</Text>
        ) : todayOutfit ? (
          <>
            <View style={styles.todayThumbRow}>
              {todayItems.slice(0, 4).map((it, idx) => (
                <View key={it.id ?? idx} style={styles.todayThumbWrap}><ItemThumb item={it} size={64} /></View>
              ))}
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={styles.todayOutfitName} numberOfLines={1}>{todayOutfit.name ?? "Today's pick"}</Text>
              <Text style={styles.todayEmptyText}>{todayItems.length} piece{todayItems.length === 1 ? '' : 's'} — tap to view or change</Text>
            </View>
          </>
        ) : (
          <Text style={styles.todayEmptyText}>Nothing set for today yet — tap to plan one.</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    calendar: { marginHorizontal: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
    todaySectionTitle: { fontSize: 14, fontWeight: '700', color: colors.ink, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
    todayCard: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      borderRadius: radius.lg, marginHorizontal: spacing.lg, padding: spacing.md, minHeight: 80,
    },
    todayThumbRow: { flexDirection: 'row' },
    todayThumbWrap: { marginLeft: -12, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: colors.bg },
    todayOutfitName: { fontSize: 14, fontWeight: '700', color: colors.ink },
    todayEmptyText: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  });
}

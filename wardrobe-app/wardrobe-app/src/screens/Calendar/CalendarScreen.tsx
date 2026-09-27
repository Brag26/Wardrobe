// src/screens/Calendar/CalendarScreen.tsx
// Home board's Calendar screen — month grid where any date with a real
// assigned outfit (set via "Outfit of the Day" on Home, or manually
// from DayOutfitScreen) shows a small dot marker in that cell instead
// of just a number, so the day is flagged as "planned" without
// revealing what the outfit actually is. The actual outfit (photos,
// name, pieces) only shows once the day is tapped open, on
// DayOutfitScreen. Days with nothing set just show the plain date —
// this only ever reflects outfits that genuinely exist, never invents
// placeholder content for empty days.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { PageHeader } from '../../components/PageHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { listCalendarMonth, getTodayOutfitIfSet } from '../../api/wardrobeApi';
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
  // Keyed by date ('YYYY-MM-DD') -> the enriched entry from the
  // backend, which includes previewItems alongside outfitId/date.
  // previewItems is only used to decide whether to show the "planned"
  // dot marker on the grid cell — the actual photos aren't rendered
  // here, only after the day is tapped open (DayOutfitScreen).
  const [entriesByDate, setEntriesByDate] = useState<Record<string, any>>({});
  const [todayOutfit, setTodayOutfit] = useState<any>(null);
  const [todayItems, setTodayItems] = useState<any[]>([]);
  const [ootdLoading, setOotdLoading] = useState(false);

  const load = useCallback(async (m: string) => {
    try {
      const entries = await listCalendarMonth(m);
      const byDate: Record<string, any> = {};
      entries.forEach((e: any) => { byDate[e.date] = e; });
      setEntriesByDate(byDate);
    } catch {}
  }, []);

  // Read-only: shows today's outfit if one is already assigned (set via
  // Home's button or picked manually for today), but never generates and
  // auto-assigns a new one just from the Calendar tab being opened — that
  // used to happen here, so "Today's Outfit" could show a pick the person
  // never actually made or asked for yet.
  const loadTodayOutfit = useCallback(async () => {
    setOotdLoading(true);
    try {
      const result = await getTodayOutfitIfSet();
      setTodayOutfit(result.outfit ?? null);
      setTodayItems(result.items ?? []);
    } catch (e: any) {
      console.error('[CalendarScreen] getTodayOutfit failed:', e);
      setTodayOutfit(null);
    } finally {
      setOotdLoading(false);
    }
  }, []);

  // When "Outfit of the Day" gets triggered on Home, this screen needs
  // to reflect it the next time it's actually viewed — useFocusEffect
  // re-fetches the whole month (and today's outfit) every time this
  // tab comes into focus, so there's nothing stale to worry about.
  useFocusEffect(useCallback(() => { load(month); loadTodayOutfit(); }, [month, load, loadTodayOutfit]));

  const renderDay = ({ date, state }: { date?: DateData; state?: string }) => {
    if (!date) return <View style={styles.dayCell} />;
    const entry = entriesByDate[date.dateString];
    const isToday = date.dateString === todayString();
    const isOtherMonth = state === 'disabled';
    return (
      <TouchableOpacity
        style={[styles.dayCell, isToday && styles.dayCellToday]}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('DayOutfit', { date: date.dateString })}
      >
        <Text style={[styles.dayNumber, isOtherMonth && styles.dayNumberMuted, isToday && styles.dayNumberToday]}>
          {date.day}
        </Text>
        {entry?.previewItems?.length > 0 && (
          <View style={styles.dayDot} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="Calendar" />
      <Text style={[type.muted, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
        Tap any date to log or plan your outfit for that day.
      </Text>
      <Calendar
        current={`${month}-01`}
        onMonthChange={(d: DateData) => setMonth(d.dateString.slice(0, 7))}
        dayComponent={renderDay}
        theme={{
          backgroundColor: colors.bg,
          calendarBackground: colors.bg,
          textSectionTitleColor: colors.inkMuted,
          textDayHeaderFontSize: 12,
          textDayHeaderFontWeight: '600',
          monthTextColor: colors.ink,
          textMonthFontWeight: '700',
          textMonthFontSize: 16,
          arrowColor: colors.inkMuted,
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
    calendar: { marginHorizontal: spacing.sm, borderRadius: radius.lg, overflow: 'hidden' },
    dayCell: {
      width: 46, height: 58, alignItems: 'center', paddingTop: 4, borderRadius: radius.sm, overflow: 'hidden',
    },
    dayCellToday: { backgroundColor: colors.bgSoft },
    dayNumber: { fontSize: 12, color: colors.ink, fontWeight: '500' },
    dayNumberMuted: { color: colors.border },
    dayNumberToday: { color: colors.lavenderDeep, fontWeight: '700' },
    // A plain marker that something is planned for this day — no photo
    // preview in the grid, so the outfit itself only shows once the day
    // is tapped open (see DayOutfitScreen).
    dayDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: colors.lavenderDeep },
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

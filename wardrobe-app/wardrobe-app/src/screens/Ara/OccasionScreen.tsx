import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing, chipPastels as lightChipPastels } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const OCCASIONS = [
  { key: 'office', label: 'Office', emoji: '💼' },
  { key: 'coffee', label: 'Coffee', emoji: '☕' },
  { key: 'date', label: 'Date', emoji: '💗' },
  { key: 'party', label: 'Party', emoji: '🎉' },
  { key: 'wedding', label: 'Wedding', emoji: '💍' },
  { key: 'travel', label: 'Travel', emoji: '✈️' },
  { key: 'brunch', label: 'Brunch', emoji: '🥐' },
  { key: 'beach', label: 'Beach', emoji: '🏖️' },
  { key: 'event', label: 'Event', emoji: '🎫' },
];

export default function OccasionScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [selected, setSelected] = useState<string | null>(null);
  const pastels = [colors.pink, colors.lavender, colors.peach, colors.mint, colors.sky];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Container below carries its own padding for the layout's
          space-between button; canceling it just for the header keeps
          the back button flush-left like every other page instead of
          sitting further in. */}
      <View style={styles.headerRow}>
        <ScreenHeader />
      </View>
      <View style={styles.textBlock}>
        <Text style={type.h1}>Where are we going today?</Text>
        <Text style={[type.muted, { marginTop: 4 }]}>Your mood helps me style the perfect outfit for you</Text>
      </View>
      <View style={styles.grid}>
        {OCCASIONS.map((o, idx) => (
          <View key={o.key} style={styles.item}>
            <Chip
              label={o.label}
              emoji={o.emoji}
              selected={selected === o.key}
              pastelColor={pastels[idx % pastels.length]}
              onPress={() => setSelected(o.key)}
            />
          </View>
        ))}
      </View>
      <Button
        label="Let's Style You →"
        onPress={() => navigation.navigate('Mood', { occasion: selected })}
        disabled={!selected}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'space-between' },
    headerRow: { marginHorizontal: -spacing.lg, marginTop: -spacing.lg },
    textBlock: { marginTop: spacing.md, marginBottom: spacing.lg },
    grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignContent: 'flex-start' },
    item: { marginBottom: spacing.lg },
  });
}

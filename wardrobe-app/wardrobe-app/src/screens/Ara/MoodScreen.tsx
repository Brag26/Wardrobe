import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Chip } from '../../components/Chip';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const MOODS = [
  { key: 'confident', label: 'Confident', emoji: '💪' },
  { key: 'romantic', label: 'Romantic', emoji: '💕' },
  { key: 'elegant', label: 'Elegant', emoji: '✨' },
  { key: 'calm', label: 'Calm', emoji: '🕊️' },
  { key: 'playful', label: 'Playful', emoji: '🎈' },
  { key: 'creative', label: 'Creative', emoji: '🎨' },
];

export default function MoodScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const occasion = route.params?.occasion;
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<string | null>(null);
  const pastels = [colors.pink, colors.lavender, colors.peach, colors.mint, colors.sky];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader />
      <View style={styles.textBlock}>
        <Text style={type.h1}>How do you want to feel?</Text>
        <Text style={[type.muted, { marginTop: 4 }]}>Your mood helps me style the perfect outfit for you</Text>
      </View>
      <View style={styles.grid}>
        {MOODS.map((m, idx) => (
          <View key={m.key} style={styles.item}>
            <Chip
              label={m.label}
              emoji={m.emoji}
              selected={selected === m.key}
              pastelColor={pastels[idx % pastels.length]}
              onPress={() => setSelected(m.key)}
            />
          </View>
        ))}
      </View>
      <Button
        label="Let's Style You →"
        onPress={() => navigation.navigate('Building', { occasion, mood: selected })}
        disabled={!selected}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'space-between' },
    textBlock: { marginTop: spacing.md, marginBottom: spacing.lg },
    grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: spacing.lg, alignContent: 'flex-start' },
    item: {},
  });
}

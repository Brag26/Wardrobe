import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AraMascot } from '../../components/AraMascot';
import { AraBubble } from '../../components/AraBubble';
import { AppHeader } from '../../components/AppHeader';
import { getClosetOverview } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [itemCount, setItemCount] = useState<number | null>(null);

  useEffect(() => { getClosetOverview().then((o) => setItemCount(o.totalItems)).catch(() => {}); }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <AppHeader />
      <View style={styles.center}>
        <AraMascot size={210} />
        <View style={{ height: spacing.lg }} />
        <AraBubble
          text="Hi there! I'm Ara"
          subtext="Your personal AI stylist. I'll get to know your style, mood and preferences to create outfits made just for you."
        />
        <View style={styles.socialProof}>
          <View style={styles.avatarStack}>
            {[colors.pink, colors.lavender, colors.peach].map((c, i) => (
              <View key={i} style={[styles.avatar, { backgroundColor: c, marginLeft: i === 0 ? 0 : -10 }]} />
            ))}
          </View>
          <Text style={type.muted}>
            {itemCount != null ? `${itemCount} items styled so far` : 'Loved by stylish girls everywhere'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={() => navigation.navigate('Occasion')} activeOpacity={0.85}>
        <Text style={styles.startButtonText}>Start Styling →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between', padding: spacing.lg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    socialProof: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
    avatarStack: { flexDirection: 'row', marginRight: spacing.sm },
    avatar: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.white },
    startButton: { backgroundColor: colors.black, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
    startButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  });
}

// src/screens/Profile/StyleProfileHubScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function StyleProfileHubScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Style Profile" />
      <Text style={styles.subtitle}>The more Ara knows, the better she picks for you.</Text>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('BodyShape')} activeOpacity={0.85}>
        <View style={styles.iconWrap}><Ionicons name="body-outline" size={20} color={colors.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Body Shape</Text>
          <Text style={styles.cardDesc}>Pick the silhouette that's most like you</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ColorAnalysis')} activeOpacity={0.85}>
        <View style={styles.iconWrap}><Ionicons name="color-palette-outline" size={20} color={colors.ink} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Color Analysis</Text>
          <Text style={styles.cardDesc}>Real AI reads your undertone from a selfie</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    subtitle: { ...type.muted, marginBottom: spacing.lg },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgSoft,
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    },
    iconWrap: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    cardTitle: { ...type.h3 },
    cardDesc: { ...type.muted, marginTop: 2 },
  });
}

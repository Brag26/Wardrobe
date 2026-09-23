// src/screens/Profile/ColorAnalysisScreen.tsx
// Selfie -> vision AI -> skin undertone + recommended color palette.
// This result then actually influences outfit picking on the backend
// (see aiStylist.service.ts's scoreItem color bonus), not just stored
// and forgotten.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { getProfile, submitColorAnalysis } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const COLOR_HEX: Record<string, string> = {
  black: '#2a2a2a', white: '#eee', cream: '#efe6d3', red: '#b13c3c', pink: '#e8a0b8',
  navy: '#213258', green: '#3f6b3f', blue: '#3a5fa0', beige: '#d8c7a8', grey: '#8a8a8a',
  brown: '#6b4a30', burgundy: '#6b2f3a', olive: '#6b6b3a', orange: '#d97b3f', yellow: '#e5c15c',
  purple: '#7b4fa0', teal: '#2f7a7a', gold: '#c9a227', silver: '#c0c0c0', coral: '#e8836a',
};

export default function ColorAnalysisScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => { getProfile().then((p) => setResult(p.colorProfile)).catch(() => {}); }, []);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access for the color analysis.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const runAnalysis = async () => {
    if (!photoUri) return;
    setAnalyzing(true);
    try {
      const analysis = await submitColorAnalysis(photoUri);
      setResult(analysis);
    } catch (e: any) {
      Alert.alert('Analysis failed', e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Color Analysis" />
      <Text style={styles.subtitle}>
        Upload a clear, well-lit selfie — Ara reads your undertone and suggests colors that'll actually work for you, and starts weighing them into outfit picks automatically.
      </Text>

      <TouchableOpacity style={styles.photoBox} onPress={pickPhoto} activeOpacity={0.85}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photo} /> : (
          <View style={{ alignItems: 'center' }}>
            <FigmaIcon name="camera" size={26} color={colors.inkMuted} />
            <Text style={[styles.photoPlaceholder, { marginTop: 4 }]}>Tap to add a selfie</Text>
          </View>
        )}
      </TouchableOpacity>

      {photoUri && (
        <Button label="Analyze my colors" onPress={runAnalysis} loading={analyzing} />
      )}

      {analyzing && <Text style={styles.analyzingNote}>This can take up to 20 seconds — real vision analysis, not instant.</Text>}

      {result && !analyzing && (
        <View style={styles.resultCard}>
          <Text style={styles.undertone}>{result.undertone?.toUpperCase()} undertone</Text>
          <Text style={styles.explanation}>{result.explanation}</Text>

          <Text style={styles.sectionLabel}>Recommended for you</Text>
          <View style={styles.swatchRow}>
            {(result.recommendedColors ?? []).map((c: string) => (
              <View key={c} style={styles.swatchWrap}>
                <View style={[styles.swatch, { backgroundColor: COLOR_HEX[c] ?? '#999' }]} />
                <Text style={styles.swatchLabel}>{c}</Text>
              </View>
            ))}
          </View>

          {result.avoidColors?.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Best to avoid</Text>
              <View style={styles.swatchRow}>
                {result.avoidColors.map((c: string) => (
                  <View key={c} style={styles.swatchWrap}>
                    <View style={[styles.swatch, styles.swatchAvoid, { backgroundColor: COLOR_HEX[c] ?? '#999' }]} />
                    <Text style={styles.swatchLabel}>{c}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
    subtitle: { ...type.muted, marginBottom: spacing.md, lineHeight: 17 },
    photoBox: {
      height: 220, borderRadius: radius.lg, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md,
    },
    photo: { width: '100%', height: '100%' },
    photoPlaceholder: { textAlign: 'center', color: colors.inkMuted },
    analyzingNote: { ...type.muted, textAlign: 'center', marginTop: spacing.sm },
    resultCard: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.lg },
    undertone: { ...type.h2 },
    explanation: { ...type.body, marginTop: spacing.xs, lineHeight: 19, fontStyle: 'italic' },
    sectionLabel: { ...type.h3, marginTop: spacing.md, marginBottom: spacing.sm },
    swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    swatchWrap: { alignItems: 'center' },
    swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border },
    swatchAvoid: { opacity: 0.4 },
    swatchLabel: { fontSize: 10, color: colors.inkMuted, marginTop: 4, textTransform: 'capitalize' },
  });
}

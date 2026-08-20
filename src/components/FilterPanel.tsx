// src/components/FilterPanel.tsx
// Reusable "Filter" bottom sheet — Season / Color / Style / Rating —
// matching the filter screen shown on both the Closet and Outfit
// Section boards. Used by OutfitsScreen (all four filters) and can be
// reused by ClosetScreen (season/color/style; rating doesn't apply to
// closet items the same way it does outfits, so callers can omit it
// via showRating={false}).
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { FigmaIcon } from './icons/FigmaIcon';
import { TagPill } from './TagPill';
import { Button } from './Button';
import { spacing, radius, COLOR_SWATCHES } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';

export interface FilterValues {
  season?: string;
  color?: string;
  style?: string;
  minRating?: number;
  aesthetic?: string;
}

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterValues) => void;
  initial?: FilterValues;
  seasons: string[];
  colors: string[];
  styles_: string[];
  showRating?: boolean;
  aesthetics?: string[];
}

export function FilterPanel({ visible, onClose, onApply, initial, seasons, colors, styles_, showRating = true, aesthetics }: FilterPanelProps) {
  const { colors: theme } = useAppTheme();
  const [season, setSeason] = useState(initial?.season);
  const [color, setColor] = useState(initial?.color);
  const [style, setStyle] = useState(initial?.style);
  const [minRating, setMinRating] = useState(initial?.minRating ?? 0);
  const [aesthetic, setAesthetic] = useState(initial?.aesthetic);

  useEffect(() => {
    if (visible) {
      setSeason(initial?.season);
      setColor(initial?.color);
      setStyle(initial?.style);
      setMinRating(initial?.minRating ?? 0);
      setAesthetic(initial?.aesthetic);
    }
  }, [visible]);

  const handleReset = () => { setSeason(undefined); setColor(undefined); setStyle(undefined); setMinRating(0); setAesthetic(undefined); };
  const handleApply = () => { onApply({ season, color, style, minRating: minRating > 0 ? minRating : undefined, aesthetic }); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.ink }]}>Filter</Text>
            <TouchableOpacity onPress={onClose}><FigmaIcon name="close" size={16} color={theme.inkMuted} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: spacing.lg }}>
            <Text style={[styles.sectionLabel, { color: theme.ink }]}>Season</Text>
            <View style={styles.pillRow}>
              {seasons.map((s) => (
                <TagPill key={s} label={s.replace(/_/g, ' ')} selected={season === s} onPress={() => setSeason(season === s ? undefined : s)} />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.ink }]}>Color</Text>
            <View style={styles.pillRow}>
              {colors.map((c) => (
                <TagPill key={c} label={c} selected={color === c} onPress={() => setColor(color === c ? undefined : c)} dotColor={COLOR_SWATCHES[c]} />
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.ink }]}>Style</Text>
            <View style={styles.pillRow}>
              {styles_.map((s) => (
                <TagPill key={s} label={s.replace(/_/g, ' ')} selected={style === s} onPress={() => setStyle(style === s ? undefined : s)} />
              ))}
            </View>

            {aesthetics && aesthetics.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.ink }]}>Vibe / aesthetic</Text>
                <View style={styles.pillRow}>
                  {aesthetics.map((a) => (
                    <TagPill key={a} label={a.replace(/_/g, ' ')} selected={aesthetic === a} onPress={() => setAesthetic(aesthetic === a ? undefined : a)} />
                  ))}
                </View>
              </>
            )}

            {showRating && (
              <>
                <Text style={[styles.sectionLabel, { color: theme.ink }]}>Minimum rating</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setMinRating(minRating === n ? 0 : n)}>
                      <FigmaIcon name={n <= minRating ? 'star' : 'starOutline'} size={26} color={theme.border} />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
              <Text style={{ color: theme.inkMuted, fontWeight: '600', fontSize: 13 }}>Reset</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}><Button label="Apply filters" onPress={handleApply} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: spacing.sm },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: 18, fontWeight: '700' },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap' },
  starRow: { flexDirection: 'row', gap: spacing.xs },
  footerRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm },
  resetBtn: { paddingVertical: 14, paddingHorizontal: spacing.sm },
});

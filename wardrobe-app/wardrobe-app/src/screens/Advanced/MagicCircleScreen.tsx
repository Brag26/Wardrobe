// src/screens/Advanced/MagicCircleScreen.tsx — Figma proposal #6 "AI Magic Circle"
//
// HONEST LIMITATION: the original concept shows a 3D-rendered circle of
// garments orbiting in space. Real 3D rendering (three.js / a 3D engine)
// is a genuinely different scope than the rest of this app. This is a
// real, working 2D approximation: actual closet items arranged in a
// circle, rotating continuously, using plain Animated transforms — same
// visual idea (garments orbiting), not the same rendering technology.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { spacing } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const { width } = Dimensions.get('window');
const RADIUS = Math.min(width * 0.35, 130);

export default function MagicCircleScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    getWardrobeItems().then((data) => setItems(data.slice(0, 8))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 18000, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="AI Magic Circle" />
      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} />
      ) : (
        <View style={styles.center}>
          <Text style={styles.hint}>Crafting magic just for you ✨</Text>
          <View style={{ width: RADIUS * 2 + 100, height: RADIUS * 2 + 100, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.orbitWrap, { transform: [{ rotate: spin }] }]}>
              {items.map((item, idx) => {
                const angle = (idx / items.length) * 2 * Math.PI;
                const x = RADIUS * Math.cos(angle);
                const y = RADIUS * Math.sin(angle);
                return (
                  <Animated.View
                    key={item.id}
                    style={[styles.orbitItem, { transform: [{ translateX: x }, { translateY: y }, { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }]}
                  >
                    <ItemThumb item={item} size={54} />
                  </Animated.View>
                );
              })}
            </Animated.View>
            <View style={styles.centerCircle}>
              <Text style={styles.centerText}>Your{'\n'}Closet</Text>
            </View>
          </View>
          {items.length === 0 && <Text style={styles.empty}>Add items to your closet to see them orbit.</Text>}
        </View>
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hint: { color: colors.white, fontSize: 16, fontWeight: '600', marginBottom: spacing.xl },
  orbitWrap: { position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  orbitItem: { position: 'absolute' },
  centerCircle: {
    width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center',
  },
  centerText: { color: colors.white, fontSize: 11, textAlign: 'center', fontWeight: '600' },
  empty: { color: '#999', marginTop: spacing.lg },
  });
}

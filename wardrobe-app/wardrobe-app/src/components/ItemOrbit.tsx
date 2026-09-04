// src/components/ItemOrbit.tsx
// The "Magic Circle" visual from the Figma reference — real selected
// items arranged in a ring on a dark starry-gradient card, slowly
// rotating, with a center message. Reusable: used as the main visual
// on the outfit result screen (not just the hidden Advanced Studio
// version), so this genuinely showcases the pieces that were picked.
//
// v2: previously just a static dark card + one spinning ring, which
// read as flat/boring for a "magic" moment. Now layered: a slowly
// drifting gradient wash, three soft glow blobs that float on their
// own independent loops, twinkling (opacity-pulsing) stars instead of
// static dots, and a double ring (one spinning clockwise, a fainter
// one counter-rotating) so there's always something moving even when
// no items are loaded yet.
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ItemThumb } from './ItemThumb';
import { spacing } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ItemOrbitProps {
  items: { id: string; imageUrl?: string; color: string; category: string }[];
  centerText?: string;
  size?: number; // overall card width; height derives from it
  fullBleed?: boolean; // fills its parent instead of being a fixed-size rounded card
}

function useLoop(duration: number, delay = 0) {
  const val = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [val]);
  return val;
}

function Twinkle({ style, duration, delay }: { style: any; duration: number; delay: number }) {
  const pulse = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.15, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.star, style, { opacity: pulse }]} />;
}

export function ItemOrbit({ items, centerText = "Crafting magic just for you ✨", size, fullBleed }: ItemOrbitProps) {
  const cardSize = size ?? Math.min(SCREEN_WIDTH - spacing.lg * 2, 340);
  const radius = cardSize * 0.32;

  const spinVal = useLoop(22000);
  const counterSpinVal = useLoop(22000);
  const innerRingVal = useLoop(30000);
  const blobA = useLoop(9000);
  const blobB = useLoop(12000, 1500);
  const blobC = useLoop(15000, 3000);
  const pulse = useLoop(3200);

  const spin = spinVal.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const counterSpin = counterSpinVal.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const innerSpin = innerRingVal.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });

  const blobAStyle = {
    transform: [
      { translateX: blobA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-30, 30, -30] }) },
      { translateY: blobA.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-20, 15, -20] }) },
    ],
  };
  const blobBStyle = {
    transform: [
      { translateX: blobB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, -25, 20] }) },
      { translateY: blobB.interpolate({ inputRange: [0, 0.5, 1], outputRange: [25, -10, 25] }) },
    ],
  };
  const blobCStyle = {
    transform: [
      { translateX: blobC.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-15, 25, -15] }) },
      { translateY: blobC.interpolate({ inputRange: [0, 0.5, 1], outputRange: [20, -25, 20] }) },
    ],
  };
  const ringScale = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.6, 0.35] });

  return (
    <View style={[styles.card, fullBleed ? styles.fullBleed : { width: cardSize, height: cardSize }]}>
      <LinearGradient
        colors={['#2A1B42', '#1A1024', '#12081C']}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* floating glow blobs — pure color washes drifting on independent loops */}
      <Animated.View style={[styles.blob, { backgroundColor: '#D8A4FF', width: cardSize * 0.7, height: cardSize * 0.7, top: -cardSize * 0.2, left: -cardSize * 0.1 }, blobAStyle]} />
      <Animated.View style={[styles.blob, { backgroundColor: '#7FA8FF', width: cardSize * 0.55, height: cardSize * 0.55, bottom: -cardSize * 0.15, right: -cardSize * 0.1 }, blobBStyle]} />
      <Animated.View style={[styles.blob, { backgroundColor: '#FF9ED2', width: cardSize * 0.4, height: cardSize * 0.4, top: cardSize * 0.35, right: cardSize * 0.05 }, blobCStyle]} />

      {/* twinkling starfield */}
      {Array.from({ length: 22 }).map((_, i) => (
        <Twinkle
          key={i}
          duration={1400 + ((i * 137) % 1600)}
          delay={(i * 211) % 2000}
          style={{ top: `${(i * 37) % 100}%`, left: `${(i * 53) % 100}%` }}
        />
      ))}

      {/* outer pulsing glow ring */}
      <Animated.View
        style={[
          styles.ring,
          { width: radius * 2 + 70, height: radius * 2 + 70, borderRadius: radius + 35, transform: [{ scale: ringScale }], opacity: ringOpacity },
        ]}
      />
      {/* fainter inner ring, counter-rotating, for depth */}
      <Animated.View
        style={[
          styles.ringInner,
          { width: radius * 2 + 20, height: radius * 2 + 20, borderRadius: radius + 10, transform: [{ rotate: innerSpin }] },
        ]}
      />

      <View style={styles.centerTextWrap}>
        <Text style={styles.centerText}>{centerText}</Text>
      </View>

      <Animated.View style={[styles.orbitWrap, { transform: [{ rotate: spin }] }]}>
        {items.slice(0, 6).map((item, idx) => {
          const angle = (idx / Math.max(items.length, 1)) * 2 * Math.PI - Math.PI / 2;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          return (
            <Animated.View
              key={item.id}
              style={[
                styles.orbitItem,
                { transform: [{ translateX: x }, { translateY: y }, { rotate: counterSpin }] },
              ]}
            >
              <ItemThumb item={item} size={56} />
            </Animated.View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  fullBleed: { width: '100%', height: '100%', borderRadius: 0 },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.28,
  },
  star: {
    position: 'absolute', width: 2.5, height: 2.5, borderRadius: 1.5, backgroundColor: '#fff',
  },
  ring: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: 'rgba(216,164,255,0.5)',
  },
  ringInner: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
  },
  centerTextWrap: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  centerText: {
    color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21,
  },
  orbitWrap: { position: 'absolute', width: 1, height: 1, alignItems: 'center', justifyContent: 'center' },
  orbitItem: { position: 'absolute' },
});

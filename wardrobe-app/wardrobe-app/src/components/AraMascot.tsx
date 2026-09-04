// src/components/AraMascot.tsx
// Real mascot artwork (from the team's design), not hand-built shapes.
// Sparkles are baked into the source image already, so this just
// handles the floating/bob animation and an optional soft circular
// backing for when it sits on dark backgrounds (e.g. the Home banner),
// since the artwork's soft shadow was designed against a light background.
import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import { colors } from '../theme/theme';

const MASCOT_SOURCE = require('../../assets/mascot/ara-mascot.png');
// Source image is 480x280 (after cropping out the chat bubble it
// originally came with) — keep this ratio so it never looks squashed.
const ASPECT_RATIO = 280 / 480;

interface AraMascotProps {
  size?: number; // width in px; height derives from the image's real aspect ratio
  onDarkBackground?: boolean; // adds a soft light backing circle
}

export function AraMascot({ size = 90, onDarkBackground = false }: AraMascotProps) {
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const height = size * ASPECT_RATIO;

  const content = (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <Image
        source={MASCOT_SOURCE}
        style={{ width: size, height }}
        resizeMode="contain"
      />
    </Animated.View>
  );

  if (!onDarkBackground) return content;

  const backingSize = size * 0.78;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.backing, { width: backingSize, height: backingSize, borderRadius: backingSize / 2 }]} />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  backing: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

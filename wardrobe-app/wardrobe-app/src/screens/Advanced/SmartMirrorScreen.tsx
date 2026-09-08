// src/screens/Advanced/SmartMirrorScreen.tsx — Figma proposal #5 "Smart Mirror (AR Try-On)"
//
// HONEST LIMITATION: real AR try-on needs body-tracking (ARKit/ARCore +
// a garment-fitting model) — genuinely different engineering scope than
// this app. This is a real, working camera-overlay version: your live
// camera feed with a semi-transparent outfit thumbnail overlaid on top,
// which you can reposition — same idea (see yourself with the outfit),
// not the same technology (no body tracking, doesn't fit to your pose).

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ItemThumb } from '../../components/ItemThumb';
import { getWardrobeItems } from '../../api/wardrobeApi';
import { spacing } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function SmartMirrorScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [permission, requestPermission] = useCameraPermissions();
  const [items, setItems] = useState<any[]>([]);
  const [activeItem, setActiveItem] = useState<any>(null);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => { getWardrobeItems().then(setItems); }, []);
  useEffect(() => { requestPermission(); }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => pan.extractOffset(),
    })
  ).current;

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScreenHeader title="Smart Mirror" />
        <View style={styles.center}>
          <Text style={styles.permText}>Camera access needed for the mirror view.</Text>
          <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
            <Text style={styles.permButtonText}>Allow Camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="front" />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <ScreenHeader title="Smart Mirror" />

        {activeItem && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.draggableItem, { transform: pan.getTranslateTransform() }]}
          >
            <ItemThumb item={activeItem} size={130} />
          </Animated.View>
        )}

        <View style={styles.itemPicker}>
          {items.slice(0, 6).map((item) => (
            <TouchableOpacity key={item.id} onPress={() => setActiveItem(item)}>
              <ItemThumb item={item} size={50} selected={activeItem?.id === item.id} />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Drag the outfit onto yourself — tap a piece below to try it</Text>
      </SafeAreaView>
    </View>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  // Fixed dark, not colors.black — a camera viewfinder needs to stay
  // dark regardless of app theme, same fix as elsewhere in this pass.
  container: { flex: 1, backgroundColor: '#1A1712' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  permText: { color: '#FFFFFF', textAlign: 'center', marginBottom: spacing.md },
  permButton: { backgroundColor: '#FFFFFF', borderRadius: 20, paddingVertical: 10, paddingHorizontal: spacing.lg },
  permButtonText: { color: '#1A1712', fontWeight: '700' },
  draggableItem: { position: 'absolute', top: '35%', alignSelf: 'center' },
  itemPicker: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingBottom: spacing.sm },
  hint: { color: '#eee', textAlign: 'center', fontSize: 11, paddingBottom: spacing.md },
  });
}

// src/components/FabMenu.tsx
// A reusable version of the expandable "+" action menu first built for
// the Fits home screen — a page-specific set of quick actions behind
// one round button, rather than every screen inventing its own bottom
// bar. Pass whatever actions make sense for that screen; screens that
// already expose their actions another way (a header button, existing
// icon row) don't need this at all.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, StyleSheet as RNStyleSheet } from 'react-native';
import { AppIcon, AppIconName } from './icons/AppIcons';
import { spacing, radius } from '../theme/theme';
import { useAppTheme } from '../theme/ThemeContext';
import { FabButton } from './icons/SuperBaeIcons';

export interface FabMenuAction {
  label: string;
  icon: AppIconName;
  onPress: () => void;
}

export function FabMenu({ actions }: { actions: FabMenuAction[] }) {
  const { colors } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = React.useState(false);
  const anim = React.useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.spring(anim, { toValue: open ? 0 : 1, useNativeDriver: true, friction: 7 }).start();
    setOpen((v) => !v);
  };

  return (
    <>
      {open && (
        <View style={styles.backdrop} pointerEvents="box-none">
          <TouchableOpacity style={RNStyleSheet.absoluteFill} activeOpacity={1} onPress={toggle} />
        </View>
      )}
      <View style={styles.wrap} pointerEvents="box-none">
        {actions.map((action, idx) => {
          const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -(24 + 56 * (idx + 1))] });
          return (
            <Animated.View
              key={action.label}
              style={[styles.action, { transform: [{ translateY }], opacity: anim }]}
              pointerEvents={open ? 'auto' : 'none'}
            >
              <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{action.label}</Text>
              <TouchableOpacity style={styles.actionButton} onPress={() => { toggle(); action.onPress(); }}>
                <AppIcon name={action.icon} size={17} color={colors.ink} />
              </TouchableOpacity>
            </Animated.View>
          );
        })}
        <TouchableOpacity onPress={toggle} activeOpacity={0.85} accessibilityLabel={open ? 'Close menu' : 'Open menu'}>
          <Animated.View style={{ transform: [{ rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <FabButton />
          </Animated.View>
        </TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
    wrap: { position: 'absolute', bottom: 30, right: 19.5, alignItems: 'flex-end' },
    // Same fixed-width, right-justified layout as the Fits screen's own
    // menu — keeps every action's icon anchored to the same spot
    // regardless of how long its label is.
    action: {
      position: 'absolute', bottom: 15.5, right: 15.5, width: 240,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm,
    },
    actionLabel: {
      backgroundColor: colors.card ?? colors.bgSoft, color: colors.ink, fontSize: 12, fontWeight: '600',
      paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
      overflow: 'hidden', flexShrink: 1,
    },
    actionButton: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
    },
  });
}

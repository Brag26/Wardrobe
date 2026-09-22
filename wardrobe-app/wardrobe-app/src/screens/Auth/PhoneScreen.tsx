// src/screens/Auth/PhoneScreen.tsx
// Previously this screen led to a real phone + OTP verification flow
// (PhoneScreen -> OtpScreen), with dev login tucked away behind a
// hidden "Developer options" toggle as a testing shortcut. Real SMS
// delivery was never actually wired up for production use in this
// project, so the OTP step added a screen and a network round trip
// without a working real path behind it. Simplified to a single
// screen: enter a phone number, tap Log in, done — calling the same
// devLogin endpoint that was already doing all the real work.
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AraMascot } from '../../components/AraMascot';
import { Button } from '../../components/Button';
import { devLogin } from '../../api/wardrobeApi';
import { useAuthStore } from '../../store/authStore';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function PhoneScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const [phone, setPhone] = useState('+91');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleLogin = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      Alert.alert('Invalid number', 'Enter your phone number with country code, e.g. +919876543210');
      return;
    }
    setLoading(true);
    try {
      await devLogin(phone);
      signIn(phone);
    } catch (e: any) {
      Alert.alert("Couldn't log in", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'space-between' }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
          <View style={styles.center}>
            <AraMascot size={210} />
            <Text style={styles.title}>Hi! I'm Ara</Text>
            <Text style={styles.subtitle}>Your personal AI stylist{'\n'}Let's get your wardrobe styled just for you</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="+919876543210"
              placeholderTextColor={colors.inkMuted}
            />
            <Button label="Log in" onPress={handleLogin} loading={loading} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    center: { alignItems: 'center', marginTop: spacing.xxl },
    title: { ...type.h1, marginTop: spacing.lg },
    subtitle: { ...type.muted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
    form: { paddingBottom: spacing.lg },
    label: { ...type.muted, marginBottom: spacing.xs },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
      padding: 14, fontSize: 15, color: colors.ink, marginBottom: spacing.md, backgroundColor: colors.bgSoft,
    },
  });
}

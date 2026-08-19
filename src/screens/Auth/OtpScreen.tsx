import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Button } from '../../components/Button';
import { ScreenHeader } from '../../components/ScreenHeader';
import { verifyOtp, requestOtp } from '../../api/wardrobeApi';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, type, radius } from '../../theme/theme';

export default function OtpScreen() {
  const route = useRoute<any>();
  const phone = route.params?.phone ?? '';
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleVerify = async () => {
    if (code.length < 4) return;
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      signIn(phone);
    } catch (e: any) {
      Alert.alert('Incorrect code', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await requestOtp(phone);
      Alert.alert('Code sent', 'Check your phone (or the backend terminal, in dev mode) for the new code.');
    } catch (e: any) {
      Alert.alert('Could not resend', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader />
      {/* Screens nested inside a tab/stack navigator are a well-known
          case where Android's automatic keyboard-resize behavior
          silently stops working — the input ends up hidden behind the
          keyboard with no visual feedback while typing. KeyboardAvoidingView
          handles it manually on both platforms instead of relying on that. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <Text style={styles.title}>Enter the code</Text>
        <Text style={styles.subtitle}>Sent to {phone}</Text>

        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor={colors.inkMuted}
          maxLength={6}
        />
        <Button label="Verify & continue" onPress={handleVerify} loading={loading} />
        <Button label="Resend code" onPress={handleResend} variant="outline" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  keyboardView: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...type.h1, textAlign: 'center' },
  subtitle: { ...type.muted, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.xl },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    padding: 16, fontSize: 22, letterSpacing: 6, textAlign: 'center',
    color: colors.ink, marginBottom: spacing.md, backgroundColor: colors.bgSoft,
  },
});

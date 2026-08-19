import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AraMascot } from '../../components/AraMascot';
import { Button } from '../../components/Button';
import { requestOtp, devLogin } from '../../api/wardrobeApi';
import { useAuthStore } from '../../store/authStore';
import { colors, spacing, type, radius } from '../../theme/theme';

export default function PhoneScreen() {
  const navigation = useNavigation<any>();
  const [phone, setPhone] = useState('+91');
  const [loading, setLoading] = useState(false);
  const [devLoading, setDevLoading] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);

  const handleSend = async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      Alert.alert('Invalid number', 'Enter your phone number with country code, e.g. +919876543210');
      return;
    }
    setLoading(true);
    try {
      await requestOtp(phone);
      navigation.navigate('Otp', { phone });
    } catch (e: any) {
      Alert.alert('Could not send code', e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    setDevLoading(true);
    try {
      await devLogin(phone);
      signIn(phone);
    } catch (e: any) {
      Alert.alert('Dev login unavailable', e.message);
    } finally {
      setDevLoading(false);
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
            <Button label="Send code" onPress={handleSend} loading={loading} />

            {/* Dev-only shortcut — this screen isn't part of the real design
                (your team's login lives elsewhere); this exists purely so
                testing this standalone app doesn't need SNS/OTP set up.
                Only works if the backend has DEV_LOGIN_ENABLED=true. */}
            <TouchableOpacity onPress={() => setShowDev((v) => !v)} style={styles.devToggle}>
              <Text style={styles.devToggleText}>{showDev ? 'Hide' : 'Developer options'}</Text>
            </TouchableOpacity>
            {showDev && (
              <View style={styles.devBox}>
                <Text style={styles.devLabel}>Skip OTP entirely (needs DEV_LOGIN_ENABLED=true on the backend)</Text>
                <Button label="Dev login — no OTP needed" onPress={handleDevLogin} loading={devLoading} variant="outline" />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  devToggle: { alignSelf: 'center', marginTop: spacing.md },
  devToggleText: { fontSize: 11, color: colors.inkMuted, textDecorationLine: 'underline' },
  devBox: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  devLabel: { ...type.muted, marginBottom: spacing.sm },
});

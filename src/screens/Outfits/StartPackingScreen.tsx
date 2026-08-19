// src/screens/Outfits/StartPackingScreen.tsx
// Outfit Section board's "Start packing" screen: cover image, trip
// name, destination, start/end dates, then "Select outfit" to attach
// outfits to the trip.
//
// NOTE on dates: no date-picker library is installed in this project
// (would need a native rebuild to add one), so dates are plain
// YYYY-MM-DD text fields rather than a calendar picker widget. Same
// data shape either way — swap the input for a real date picker later
// without touching the backend.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { createPacking, uploadPackingCoverImage } from '../../api/wardrobeApi';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

export default function StartPackingScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to change the cover image.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) setCoverUri(result.assets[0].uri);
  };

  const handleSelectOutfit = async () => {
    if (!name.trim()) return Alert.alert('Name your trip', 'Give this packing list a name first.');
    setSaving(true);
    try {
      let coverImageUrl: string | null = null;
      if (coverUri) coverImageUrl = await uploadPackingCoverImage(coverUri);
      const packing = await createPacking({
        name: name.trim(), destination: destination.trim() || null,
        startDate: startDate.trim() || null, endDate: endDate.trim() || null, coverImageUrl,
      });
      navigation.replace('SelectPackingOutfits', { packingId: packing.id });
    } catch (e: any) {
      Alert.alert('Could not start packing', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader title="Start packing" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.coverBox} onPress={pickCover} activeOpacity={0.85}>
          {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} /> : (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="image-outline" size={26} color={colors.inkMuted} />
              <Text style={{ color: colors.inkMuted, marginTop: 4 }}>Change cover image</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Trip name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Australia" placeholderTextColor={colors.inkMuted} />

        <Text style={styles.label}>Destination</Text>
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="e.g. Sydney" placeholderTextColor={colors.inkMuted} />

        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start date</Text>
            <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>End date</Text>
            <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.inkMuted} />
          </View>
        </View>

        <View style={{ height: spacing.md }} />
        <Button label="Select outfit" onPress={handleSelectOutfit} loading={saving} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    coverBox: {
      height: 160, borderRadius: radius.lg, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md,
    },
    coverImage: { width: '100%', height: '100%' },
    label: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, marginBottom: 4, marginTop: spacing.sm },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md,
      paddingVertical: 12, fontSize: 14, color: colors.ink, backgroundColor: colors.bgSoft,
    },
    dateRow: { flexDirection: 'row', gap: spacing.sm },
  });
}

// src/screens/Outfits/StartPackingScreen.tsx
// Outfit Section board's "Start packing" screen: cover image, trip
// name, destination, start/end dates, then "Select outfit" to attach
// outfits to the trip.
//
// Dates use a real calendar picker (react-native-calendars, already a
// dependency for the main Calendar tab — no new native module added)
// rather than manual YYYY-MM-DD text entry, which QA flagged as
// error-prone. Past dates are disabled via minDate.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, KeyboardAvoidingView, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { createPacking, uploadPackingCoverImage } from '../../api/wardrobeApi';
import { useUnsavedChangesWarning } from '../../utils/useUnsavedChangesWarning';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';
import { AppIcon } from '../../components/icons/AppIcons';

export default function StartPackingScreen() {
  const navigation = useNavigation<any>();
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pickerFor, setPickerFor] = useState<'start' | 'end' | null>(null);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const [saving, setSaving] = useState(false);
  const savedSuccessfully = React.useRef(false);

  // QA flagged this app-wide — any real input (cover photo, name,
  // destination, either date) counts as something worth warning about
  // before it's lost.
  useUnsavedChangesWarning(React.useCallback(() => {
    if (savedSuccessfully.current) return false;
    return !!coverUri || name.trim() !== '' || destination.trim() !== '' || !!startDate || !!endDate;
  }, [coverUri, name, destination, startDate, endDate]));

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
      savedSuccessfully.current = true;
      navigation.replace('SelectPackingOutfits', { packingId: packing.id });
    } catch (e: any) {
      Alert.alert('Could not start packing', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Start packing" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.coverBox} onPress={pickCover} activeOpacity={0.85}>
          {coverUri ? <Image source={{ uri: coverUri }} style={styles.coverImage} /> : (
            <View style={{ alignItems: 'center' }}>
              <AppIcon name="image" size={26} color={colors.inkMuted} />
              <Text style={{ color: colors.inkMuted, marginTop: 4 }}>Change cover image</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Trip name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Australia" placeholderTextColor={colors.inkMuted} />

        <Text style={styles.label}>Destination</Text>
        <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="e.g. Sydney" placeholderTextColor={colors.inkMuted} />

        {/* QA: some testers still want to type the date directly rather
            than open the calendar every time — keep both. The text
            field accepts manual YYYY-MM-DD entry; the calendar icon
            opens the same picker as before. */}
        <View style={styles.dateRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Start date</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.input, styles.dateTextInput]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inkMuted}
              />
              <TouchableOpacity style={styles.calendarButton} onPress={() => setPickerFor('start')}>
                <AppIcon name="calendar" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>End date</Text>
            <View style={styles.dateInputRow}>
              <TextInput
                style={[styles.input, styles.dateTextInput]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.inkMuted}
              />
              <TouchableOpacity style={styles.calendarButton} onPress={() => setPickerFor('end')}>
                <AppIcon name="calendar" size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* QA flagged the previous manual YYYY-MM-DD text fields —
            error-prone to type correctly, no validation, easy to enter
            an impossible date. Reuses react-native-calendars (already
            a dependency for the main Calendar tab) rather than adding
            a new one — genuinely picking a date from a real calendar,
            with past dates disabled via minDate, and the end-date
            picker additionally floored at whatever start date was
            already chosen so an end date before the trip starts isn't
            selectable either. */}
        <Modal visible={pickerFor !== null} transparent animationType="fade" onRequestClose={() => setPickerFor(null)}>
          <TouchableOpacity style={styles.dateModalBackdrop} activeOpacity={1} onPress={() => setPickerFor(null)}>
            <View style={styles.dateModalCard}>
              <Calendar
                minDate={pickerFor === 'end' && startDate ? startDate : todayISO()}
                onDayPress={(day: DateData) => {
                  if (pickerFor === 'start') {
                    setStartDate(day.dateString);
                    if (endDate && endDate < day.dateString) setEndDate('');
                  } else if (pickerFor === 'end') {
                    setEndDate(day.dateString);
                  }
                  setPickerFor(null);
                }}
                theme={{ todayTextColor: colors.lavenderDeep, arrowColor: colors.inkMuted, selectedDayBackgroundColor: colors.ink }}
              />
            </View>
          </TouchableOpacity>
        </Modal>

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
    dateValueText: { fontSize: 15, color: colors.ink },
    dateValuePlaceholder: { fontSize: 15, color: colors.inkMuted },
    dateInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    dateTextInput: { flex: 1 },
    calendarButton: {
      width: 42, height: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.bgSoft, alignItems: 'center', justifyContent: 'center',
    },
    dateModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
    dateModalCard: { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.sm, width: '90%' },
  });
}

import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { FigmaIcon } from '../../components/icons/FigmaIcon';
import * as ImagePicker from 'expo-image-picker';
import { getChatHistory, sendChatMessage, clearChatHistory, getItemsByIds } from '../../api/wardrobeApi';
import { AraMascot } from '../../components/AraMascot';
import { ItemThumb } from '../../components/ItemThumb';
import { spacing, radius } from '../../theme/theme';
import { useAppTheme } from '../../theme/ThemeContext';

const CHAT_SUGGESTIONS = [
  'What should I wear today?',
  'Suggest an outfit for a date',
  'What goes with black jeans?',
  'Rate my last outfit',
];

export default function ChatScreen() {
  const { colors, type } = useAppTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);
  const navigation = useNavigation<any>();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [itemCache, setItemCache] = useState<Record<string, any>>({});
  const scrollRef = useRef<ScrollView>(null);

  // Ara's replies can now carry referencedItemIds (Ara's text actually
  // names a specific closet item — "your pink dress" etc.) — this
  // resolves those IDs into real item data (photo, color, category) so
  // the chat bubble can show an actual picture instead of leaving it
  // as just a sentence with nothing to look at. Cached across the
  // conversation so re-loading history doesn't re-fetch the same items.
  const resolveReferencedItems = async (msgs: any[]) => {
    const allIds = new Set<string>();
    msgs.forEach((m) => (m.referencedItemIds ?? []).forEach((id: string) => allIds.add(id)));
    const missingIds = [...allIds].filter((id) => !itemCache[id]);
    if (missingIds.length === 0) return;
    try {
      const resolved = await getItemsByIds(missingIds);
      setItemCache((prev) => {
        const next = { ...prev };
        resolved.forEach((item: any) => { next[item.id] = item; });
        return next;
      });
    } catch {}
  };

  const load = async () => {
    try {
      const history = await getChatHistory();
      setMessages(history);
      resolveReferencedItems(history);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

  // "Refresh" — re-syncs from the server, in case anything's out of sync
  const handleRefresh = async () => {
    setRefreshingHistory(true);
    await load();
    setRefreshingHistory(false);
    scrollDown();
  };

  // "Delete" — clears the whole conversation and starts fresh
  const handleDelete = () => {
    Alert.alert('Start a new conversation?', 'This clears your chat history with Ara. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await clearChatHistory();
          setMessages([]);
        },
      },
    ]);
  };

  // Attachment — picks a photo to reference in the message.
  // HONEST NOTE: the photo is attached and shown in the conversation,
  // but the AI does NOT currently "see"/analyze the image — that needs
  // a vision-capable model call (sending image data alongside text),
  // which isn't wired up yet. Right now it just adds "[+ photo]" as a
  // text marker so Ara's reply can't actually reference what's in it.
  const pickAttachment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo access to attach an image.');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!result.canceled) setAttachedPhoto(result.assets[0].uri);
  };

  // Voice input — real speech-to-text needs a native module
  // (@react-native-voice or similar) that requires a custom dev build;
  // Expo Go can't run it. On web, the browser's own Speech Recognition
  // API works natively with zero extra dependencies, so that path is
  // real. On a real device build (not Expo Go), swap this for
  // react-native-voice.
  const handleVoice = () => {
    if (Platform.OS === 'web' && 'webkitSpeechRecognition' in (globalThis as any)) {
      const SpeechRecognition = (globalThis as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onresult = (event: any) => {
        setInput(event.results[0][0].transcript);
      };
      recognition.start();
    } else {
      Alert.alert(
        'Voice input needs a custom build',
        'Real speech-to-text requires a native module that Expo Go can\'t run — this works in a browser right now, or once the app is built as a standalone dev build (not through Expo Go).'
      );
    }
  };

  const send = async (text: string) => {
    if (!text.trim() && !attachedPhoto) return;
    const finalText = attachedPhoto ? `${text} [+ photo attached]` : text;
    setInput('');
    setAttachedPhoto(null);

    const optimisticMessage = { id: `local-${Date.now()}`, role: 'user', text: finalText };
    setMessages((prev) => [...prev, optimisticMessage]);
    setSending(true);
    scrollDown();

    try {
      await sendChatMessage(finalText);
      await load();
    } catch (e: any) {
      // Previously `catch {}` here — a real silent failure. If sending
      // failed for any reason (an expired auth token, a network blip,
      // a backend error), the message just sat there with no reply and
      // no explanation at all, exactly what this looked like from the
      // outside: "Hi" and "What happened" sent, nothing back, nothing
      // wrong-looking on screen either. Now logs the real error and
      // shows an actual error bubble in the thread, so a failure is
      // visibly a failure instead of looking like Ara just went quiet.
      console.error('[ChatScreen] sendChatMessage failed:', e);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          text: e?.message?.includes('token')
            ? "Looks like you got signed out. Try signing out and back in from the menu, then send that again."
            : "Couldn't send that — check your connection and try again.",
        },
      ]);
    } finally {
      setSending(false);
      scrollDown();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <AraMascot size={40} />
          <View style={{ marginLeft: spacing.xs }}>
            <Text style={styles.title}>Ara</Text>
            <Text style={styles.tagline}>Your personal AI stylist</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleRefresh}>
            {refreshingHistory ? <ActivityIndicator size="small" /> : <Ionicons name="refresh" size={15} color={colors.ink} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleDelete}>
            <FigmaIcon name="trash" size={15} color={colors.ink} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Bug fix: this previously set behavior={undefined} on Android
          ("iOS ? 'padding' : undefined"), which makes KeyboardAvoidingView
          a complete no-op — it only ever worked on iOS. That's why this
          screen specifically kept failing even after every other screen
          got the same-looking fix applied. Also widened to wrap the
          message log + suggestion pills too, not just the input row —
          wrapping only the input row isn't enough for it to know how
          much to shift by. */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView ref={scrollRef} style={styles.log} contentContainerStyle={{ padding: spacing.md }}>
          {messages.length === 0 && !sending && (
            <View style={styles.assistantRow}>
              <View style={styles.miniAvatar}><AraMascot size={26} /></View>
              <View style={[styles.bubble, styles.assistantBubble]}>
                <Text style={styles.bubbleText}>Hi, I'm Ara 👋 Tell me what you're dressing for, or tap a suggestion below to get started.</Text>
              </View>
            </View>
          )}
          {messages.map((m) => (
            m.role === 'user' ? (
              <View key={m.id} style={[styles.bubble, styles.userBubble]}>
                <Text style={[styles.bubbleText, styles.userText]}>{m.text}</Text>
              </View>
            ) : (
              <View key={m.id} style={styles.assistantRow}>
                <View style={styles.miniAvatar}><AraMascot size={26} /></View>
                <View>
                  <View style={[styles.bubble, styles.assistantBubble]}>
                    <Text style={styles.bubbleText}>{m.text}</Text>
                  </View>
                  {m.referencedItemIds?.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.referencedItemsRow}>
                      {m.referencedItemIds.map((id: string) => (
                        itemCache[id] ? (
                          <TouchableOpacity
                            key={id}
                            style={styles.referencedItemCard}
                            onPress={() => navigation.navigate('ClosetTab', { screen: 'ItemDetails', params: { itemId: id } })}
                          >
                            <ItemThumb item={itemCache[id]} size={72} />
                          </TouchableOpacity>
                        ) : null
                      ))}
                    </ScrollView>
                  )}
                </View>
              </View>
            )
          ))}
          {sending && (
            <View style={styles.assistantRow}>
              <View style={styles.miniAvatar}><AraMascot size={26} /></View>
              <View style={[styles.bubble, styles.assistantBubble, styles.typingBubble]}>
                <Text style={styles.typingText}>Ara is typing</Text>
                <View style={styles.typingDots}>
                  <View style={styles.dot} /><View style={styles.dot} /><View style={styles.dot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow} contentContainerStyle={{ gap: spacing.xs, paddingHorizontal: spacing.md }}>
          <TouchableOpacity style={[styles.pill, styles.pillAction]} onPress={() => navigation.navigate('OutfitsTab')}>
            <Ionicons name="shirt-outline" size={12} color={colors.white} />
            <Text style={[styles.pillText, styles.pillActionText]}> Show my outfits</Text>
          </TouchableOpacity>
          {CHAT_SUGGESTIONS.map((s) => (
            <TouchableOpacity key={s} style={styles.pill} onPress={() => send(s)} disabled={sending}>
              <Text style={styles.pillText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {attachedPhoto && (
          <View style={styles.attachmentPreview}>
            <Image source={{ uri: attachedPhoto }} style={styles.attachmentThumb} />
            <TouchableOpacity onPress={() => setAttachedPhoto(null)} style={styles.attachmentRemove}>
              <FigmaIcon name="close" size={11} color={colors.white} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity style={styles.iconButton} onPress={pickAttachment}>
            <Ionicons name="attach-outline" size={20} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleVoice}>
            <Ionicons name={listening ? 'radio-button-on' : 'mic-outline'} size={19} color={listening ? colors.danger ?? '#C0433A' : colors.ink} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Ara anything…"
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={() => send(input)}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => send(input)} disabled={sending}>
            <Ionicons name="arrow-forward" size={17} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: any, type: any) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  tagline: { fontSize: 11, color: colors.inkMuted, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  assistantRow: { flexDirection: 'row', alignItems: 'flex-end', maxWidth: '88%', marginBottom: spacing.sm, gap: 6, alignSelf: 'flex-start' },
  miniAvatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerButton: { width: 34, height: 34, borderRadius: radius.pill, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerButtonIcon: { fontSize: 14 },
  log: { flex: 1 },
  bubble: { padding: 14, borderRadius: radius.md, marginBottom: spacing.sm, maxWidth: '80%' },
  referencedItemsRow: { marginTop: -4, marginBottom: spacing.sm },
  referencedItemCard: { marginRight: spacing.xs, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  userBubble: { backgroundColor: '#1A1712', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, alignSelf: 'flex-start' },
  // type.body has no explicit lineHeight — fine for short labels
  // elsewhere in the app, but a real problem for multi-sentence chat
  // replies: without it, React Native falls back to tight default line
  // spacing, which is exactly what made longer replies read as one
  // cramped block of text. 1.5x the font size is a standard readable
  // ratio for actual prose, not just short UI text.
  bubbleText: { ...type.body, lineHeight: 21, letterSpacing: 0.1 },
  userText: { color: '#FFFFFF' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typingText: { ...type.muted },
  typingDots: { flexDirection: 'row', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.inkMuted },
  pillRow: { flexGrow: 0, maxHeight: 44, marginBottom: spacing.sm },
  pill: { backgroundColor: colors.cream, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border },
  pillAction: { backgroundColor: colors.black, borderColor: colors.black, flexDirection: 'row', alignItems: 'center' },
  pillActionText: { color: colors.white },
  pillText: { fontSize: 12, fontWeight: '500', color: colors.ink },
  attachmentPreview: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  attachmentThumb: { width: 44, height: 44, borderRadius: radius.sm },
  attachmentRemove: { marginLeft: -12, marginTop: -30, backgroundColor: colors.black, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  iconButtonText: { fontSize: 18 },
  input: { flex: 1, backgroundColor: colors.bgSoft, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  sendButton: { backgroundColor: colors.black, borderRadius: radius.pill, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: colors.white, fontWeight: '700' },
  });
}

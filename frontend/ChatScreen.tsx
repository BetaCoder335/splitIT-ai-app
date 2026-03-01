// src/screens/ChatScreen.tsx — AI-Powered Group Chat
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { useChatStore, useAuthStore } from '../store';
import { chatAPI, expensesAPI } from '../services/api';
import { onGroupEvent } from '../services/socket';
import { Message } from '../../../shared/types';
import { formatTime } from '../utils/formatters';

const AI_COMMANDS = [
  { cmd: '/split-equal', label: 'Split Equal', icon: '⚖️', desc: 'Split last expense equally' },
  { cmd: '/analyze-bill', label: 'Analyze Bill', icon: '📸', desc: 'Upload & scan a receipt' },
  { cmd: '/assign-items', label: 'Assign Items', icon: '🧾', desc: 'Assign items to people' },
  { cmd: '/summary', label: 'Summary', icon: '📊', desc: 'Show balance summary' },
];

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { groupId } = route.params;

  const { user } = useAuthStore();
  const { messages, isAITyping, addMessage, setMessages, setAITyping } = useChatStore();

  const [input, setInput] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [scanId, setScanId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingDot1 = useRef(new Animated.Value(0)).current;
  const typingDot2 = useRef(new Animated.Value(0)).current;
  const typingDot3 = useRef(new Animated.Value(0)).current;

  // Animate AI typing indicator
  useEffect(() => {
    if (isAITyping) {
      const anim = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(dot, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
            Animated.timing(dot, { toValue: 0, duration: 400, useNativeDriver: true }),
          ])
        );
      const a1 = anim(typingDot1, 0);
      const a2 = anim(typingDot2, 150);
      const a3 = anim(typingDot3, 300);
      a1.start(); a2.start(); a3.start();
      return () => { a1.stop(); a2.stop(); a3.stop(); };
    }
  }, [isAITyping]);

  const loadMessages = useCallback(async () => {
    try {
      const res = await chatAPI.getMessages(groupId);
      setMessages(res.data.data);
    } catch {
      // Fail silently
    }
  }, [groupId]);

  useEffect(() => {
    loadMessages();

    // Real-time message subscription
    const unsubMessage = onGroupEvent('chat:message', (msg: any) => {
      addMessage(msg);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    const unsubTyping = onGroupEvent('ai:typing', ({ typing }: { typing: boolean }) => {
      setAITyping(typing);
    });

    return () => {
      unsubMessage();
      unsubTyping();
    };
  }, [groupId]);

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 300);
  }, [messages.length]);

  const sendMessage = async (content: string, command?: string, billScanId?: string) => {
    if (!content.trim() && !command) return;

    const userMsg = content || command || '';
    setInput('');
    setShowCommands(false);

    // Optimistic message
    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      group_id: groupId,
      user_id: user?.id,
      content: userMsg,
      type: 'user',
      created_at: new Date().toISOString(),
      user: user ? { ...user, created_at: '' } : undefined,
    };
    addMessage(tempMsg);

    try {
      if (command || userMsg.startsWith('/')) {
        await chatAPI.sendAICommand(groupId, {
          command: command || userMsg.split(' ')[0],
          content: userMsg,
          bill_scan_id: billScanId || scanId || undefined,
        });
      } else {
        await chatAPI.sendMessage(groupId, userMsg);

        // Check if AI should respond to user_response in assignment flow
        const lastAIMsg = [...messages].reverse().find((m) => m.type === 'ai');
        if (lastAIMsg?.metadata?.ai_state?.phase === 'assigning_items') {
          await chatAPI.sendAICommand(groupId, { user_response: userMsg });
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const pickBillImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to scan bills');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      try {
        const res = await expensesAPI.scanBill(groupId, result.assets[0].uri);
        const newScanId = res.data.data.id;
        setScanId(newScanId);

        // Notify AI about the scan
        await chatAPI.sendAICommand(groupId, {
          command: '/analyze-bill',
          bill_scan_id: newScanId,
        });

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Alert.alert('Error', 'Failed to scan bill. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => (
    <MessageBubble
      message={item}
      isOwn={item.user_id === user?.id}
      showAvatar={
        index === 0 ||
        messages[index - 1]?.user_id !== item.user_id ||
        messages[index - 1]?.type !== item.type
      }
    />
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <View style={styles.aiIndicator}>
          <View style={styles.aiDot} />
          <Text style={styles.aiLabel}>AI Assistant</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Welcome Banner */}
      {messages.length === 0 && (
        <View style={styles.welcomeBanner}>
          <Text style={styles.welcomeTitle}>AI Split Assistant</Text>
          <Text style={styles.welcomeText}>
            Upload a bill or type a command to get started
          </Text>
          <View style={styles.commandGrid}>
            {AI_COMMANDS.slice(0, 4).map((cmd) => (
              <TouchableOpacity
                key={cmd.cmd}
                style={styles.commandChip}
                onPress={() => sendMessage(cmd.cmd, cmd.cmd)}
              >
                <Text style={styles.commandChipIcon}>{cmd.icon}</Text>
                <Text style={styles.commandChipLabel}>{cmd.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* AI Typing Indicator */}
      {isAITyping && (
        <View style={styles.typingContainer}>
          <View style={styles.typingBubble}>
            {[typingDot1, typingDot2, typingDot3].map((dot, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.typingDot,
                  { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] },
                ]}
              />
            ))}
          </View>
          <Text style={styles.typingLabel}>AI is thinking...</Text>
        </View>
      )}

      {/* Command Suggestions */}
      {showCommands && (
        <View style={styles.commandsList}>
          {AI_COMMANDS.filter((c) => c.cmd.startsWith(input)).map((cmd) => (
            <TouchableOpacity
              key={cmd.cmd}
              style={styles.commandOption}
              onPress={() => sendMessage(cmd.cmd, cmd.cmd)}
            >
              <Text style={styles.commandOptionIcon}>{cmd.icon}</Text>
              <View>
                <Text style={styles.commandOptionLabel}>{cmd.cmd}</Text>
                <Text style={styles.commandOptionDesc}>{cmd.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input Bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputBar}>
          {/* Camera button */}
          <TouchableOpacity
            style={styles.iconButton}
            onPress={pickBillImage}
            disabled={isUploading}
          >
            {isUploading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Ionicons name="camera-outline" size={22} color={Colors.textSecondary} />
            )}
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            value={input}
            onChangeText={(text) => {
              setInput(text);
              setShowCommands(text.startsWith('/'));
            }}
            placeholder="Message or /command..."
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(input)}
          />

          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim()}
          >
            <Ionicons name="arrow-up" size={18} color={input.trim() ? Colors.black : Colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────

function MessageBubble({
  message,
  isOwn,
  showAvatar,
}: {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
}) {
  const isAI = message.type === 'ai';
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <View style={styles.systemMessage}>
        <Text style={styles.systemMessageText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
      {/* Avatar */}
      {!isOwn && showAvatar && (
        <View style={[styles.msgAvatar, isAI && styles.aiAvatar]}>
          <Text style={styles.msgAvatarText}>{isAI ? '⬡' : message.user?.name?.[0] || '?'}</Text>
        </View>
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarSpacer} />}

      {/* Bubble */}
      <View style={[
        styles.bubble,
        isOwn ? styles.bubbleOwn : isAI ? styles.bubbleAI : styles.bubbleOther,
        { maxWidth: '75%' },
      ]}>
        {!isOwn && showAvatar && (
          <Text style={styles.bubbleSender}>
            {isAI ? 'AI Assistant' : message.user?.name}
          </Text>
        )}
        <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>
          {message.content}
        </Text>
        <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingHorizontal: Spacing['5'], paddingBottom: Spacing['3'],
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  aiIndicator: { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'] },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  aiLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.white },
  welcomeBanner: {
    margin: Spacing['5'],
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['6'],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing['4'],
  },
  welcomeTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.white },
  welcomeText: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: 22 },
  commandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2'] },
  commandChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing['2'],
    backgroundColor: Colors.gray200, borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'],
    borderWidth: 1, borderColor: Colors.border,
  },
  commandChipIcon: { fontSize: 14 },
  commandChipLabel: { fontSize: Typography.sm, color: Colors.white, fontWeight: Typography.medium },
  messageList: { paddingHorizontal: Spacing['4'], paddingVertical: Spacing['4'], gap: Spacing['2'] },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2'], marginBottom: Spacing['2'] },
  messageRowOwn: { flexDirection: 'row-reverse' },
  msgAvatar: {
    width: 32, height: 32, borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray400, alignItems: 'center', justifyContent: 'center',
  },
  aiAvatar: { backgroundColor: Colors.white },
  msgAvatarText: { fontSize: 14, fontWeight: Typography.bold, color: Colors.black },
  avatarSpacer: { width: 32 },
  bubble: {
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    gap: 2,
  },
  bubbleOwn: { backgroundColor: Colors.white },
  bubbleAI: { backgroundColor: Colors.gray200, borderWidth: 1, borderColor: Colors.border },
  bubbleOther: { backgroundColor: Colors.gray300 },
  bubbleSender: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary, marginBottom: 2 },
  bubbleText: { fontSize: Typography.base, color: Colors.white, lineHeight: 22 },
  bubbleTextOwn: { color: Colors.black },
  bubbleTime: { fontSize: 10, color: Colors.textTertiary, alignSelf: 'flex-end', marginTop: 2 },
  bubbleTimeOwn: { color: 'rgba(0,0,0,0.4)' },
  systemMessage: { alignSelf: 'center', paddingVertical: Spacing['2'] },
  systemMessageText: { fontSize: Typography.xs, color: Colors.textTertiary },
  typingContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing['5'], paddingBottom: Spacing['2'], gap: Spacing['3'] },
  typingBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.gray200, borderRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing['4'], paddingVertical: Spacing['3'],
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.textSecondary },
  typingLabel: { fontSize: Typography.xs, color: Colors.textTertiary },
  commandsList: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  commandOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing['3'],
    padding: Spacing['4'], borderBottomWidth: 1, borderBottomColor: Colors.borderSubtle,
  },
  commandOptionIcon: { fontSize: 22 },
  commandOptionLabel: { fontSize: Typography.base, color: Colors.white, fontWeight: Typography.medium },
  commandOptionDesc: { fontSize: Typography.xs, color: Colors.textTertiary },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2'],
    padding: Spacing['3'],
    paddingHorizontal: Spacing['4'],
    borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.black,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  textInput: {
    flex: 1, minHeight: 40, maxHeight: 120,
    backgroundColor: Colors.gray200,
    borderRadius: BorderRadius['2xl'],
    paddingHorizontal: Spacing['4'],
    paddingVertical: Spacing['3'],
    fontSize: Typography.base, color: Colors.white,
    borderWidth: 1, borderColor: Colors.border,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: Colors.gray300 },
});

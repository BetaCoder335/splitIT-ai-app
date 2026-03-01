// src/screens/SettlementScreen.tsx — Settle Up with Animation
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { settlementsAPI } from '../services/api';
import { Avatar, GlassCard, Button } from '../components';
import { formatCurrency } from '../utils/formatters';

type SettlementStep = 'confirm' | 'processing' | 'success';

export default function SettlementScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { groupId, toUserId, toUserName, toUserAvatar, amount, currency = 'USD' } =
    route.params || {};

  const [step, setStep] = useState<SettlementStep>('confirm');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0)).current;
  const ringOpacity = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const playSuccessAnimation = () => {
    // Fade out form
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setStep('success');
      // Ring expand
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 3,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();

      // Check mark
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(checkScale, {
            toValue: 1,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
          Animated.timing(checkOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);
    });
  };

  const handleConfirm = async () => {
    setStep('processing');
    try {
      await settlementsAPI.create({
        group_id: groupId,
        to_user_id: toUserId,
        amount,
        payment_method: paymentMethod,
      });
      playSuccessAnimation();
    } catch {
      setStep('confirm');
      Alert.alert('Error', 'Failed to record settlement. Please try again.');
    }
  };

  const handleDone = () => {
    navigation.goBack();
  };

  const PAYMENT_METHODS = [
    { id: 'cash', label: 'Cash', icon: 'cash-outline' },
    { id: 'bank', label: 'Bank Transfer', icon: 'card-outline' },
    { id: 'paypal', label: 'PayPal', icon: 'logo-paypal' },
    { id: 'venmo', label: 'Venmo', icon: 'phone-portrait-outline' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.closeBtn}
      >
        <Ionicons name="close" size={22} color={Colors.white} />
      </TouchableOpacity>

      {/* Success State */}
      {step === 'success' && (
        <View style={styles.successContainer}>
          <View style={styles.successCircleWrapper}>
            <Animated.View
              style={[
                styles.successRing,
                { transform: [{ scale: ringScale }], opacity: ringOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.successCircle,
                { transform: [{ scale: checkScale }], opacity: checkOpacity },
              ]}
            >
              <Ionicons name="checkmark" size={48} color={Colors.black} />
            </Animated.View>
          </View>
          <Text style={styles.successTitle}>Payment Recorded!</Text>
          <Text style={styles.successSubtitle}>
            {formatCurrency(amount, currency)} settled with {toUserName}
          </Text>
          <Button
            label="Done"
            onPress={handleDone}
            style={styles.doneBtn}
            size="lg"
          />
        </View>
      )}

      {/* Confirm / Processing State */}
      {step !== 'success' && (
        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          <Text style={styles.title}>Settle Up</Text>

          {/* Recipient */}
          <GlassCard style={styles.recipientCard}>
            <Avatar name={toUserName || 'U'} size={60} uri={toUserAvatar} />
            <View style={styles.recipientInfo}>
              <Text style={styles.recipientLabel}>PAYING</Text>
              <Text style={styles.recipientName}>{toUserName}</Text>
            </View>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>AMOUNT</Text>
              <Text style={styles.amountValue}>{formatCurrency(amount, currency)}</Text>
            </View>
          </GlassCard>

          {/* Payment Method */}
          <Text style={styles.sectionLabel}>PAYMENT METHOD</Text>
          <View style={styles.methodGrid}>
            {PAYMENT_METHODS.map((method) => (
              <TouchableOpacity
                key={method.id}
                onPress={() => setPaymentMethod(method.id)}
                style={[
                  styles.methodBtn,
                  paymentMethod === method.id && styles.methodBtnActive,
                ]}
              >
                <Ionicons
                  name={method.icon as any}
                  size={22}
                  color={paymentMethod === method.id ? Colors.black : Colors.white}
                />
                <Text
                  style={[
                    styles.methodLabel,
                    paymentMethod === method.id && styles.methodLabelActive,
                  ]}
                >
                  {method.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.disclaimer}>
            This only records the payment in SplitAI. Please send the actual payment
            through your chosen method.
          </Text>

          <Button
            label={step === 'processing' ? 'Recording...' : `Confirm ${formatCurrency(amount, currency)} Payment`}
            onPress={handleConfirm}
            isLoading={step === 'processing'}
            style={styles.confirmBtn}
            size="lg"
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
    paddingHorizontal: Spacing['5'],
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['4'],
    alignSelf: 'flex-end',
  },

  // Content
  content: { flex: 1, paddingTop: Spacing['6'] },
  title: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    color: Colors.white,
    marginBottom: Spacing['6'],
    letterSpacing: Typography.tight,
  },

  // Recipient
  recipientCard: {
    flexDirection: 'row',
    padding: Spacing['5'],
    alignItems: 'center',
    gap: Spacing['4'],
    marginBottom: Spacing['6'],
  },
  recipientInfo: { flex: 1 },
  recipientLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.gray600,
    letterSpacing: Typography.widest,
    marginBottom: 4,
  },
  recipientName: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.white },
  amountBox: { alignItems: 'flex-end' },
  amountLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.gray600,
    letterSpacing: Typography.widest,
    marginBottom: 4,
  },
  amountValue: { fontSize: Typography['2xl'], fontWeight: Typography.bold, color: Colors.white },

  // Methods
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.gray600,
    letterSpacing: Typography.widest,
    marginBottom: Spacing['3'],
  },
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing['3'],
    marginBottom: Spacing['6'],
  },
  methodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing['2'],
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gray200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  methodBtnActive: { backgroundColor: Colors.white, borderColor: Colors.white },
  methodLabel: { fontSize: Typography.sm, color: Colors.white, fontWeight: Typography.medium },
  methodLabelActive: { color: Colors.black, fontWeight: Typography.semibold },

  disclaimer: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: Spacing['8'],
  },
  confirmBtn: {},

  // Success
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['8'],
  },
  successCircleWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['8'],
  },
  successRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: Colors.success,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: Typography['2xl'],
    fontWeight: Typography.bold,
    color: Colors.white,
    marginBottom: Spacing['2'],
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing['10'],
    lineHeight: 22,
  },
  doneBtn: { width: 200 },
});

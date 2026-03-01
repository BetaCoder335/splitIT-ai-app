// src/screens/HomeScreen.tsx — Groups Dashboard
import React, { useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, GlassCard } from '../theme';
import { useGroupsStore, useAuthStore } from '../store';
import { groupsAPI } from '../services/api';
import { Group } from '../../../shared/types';
import { formatCurrency, formatRelativeTime } from '../utils/formatters';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuthStore();
  const { groups, isLoading, setGroups, setLoading } = useGroupsStore();
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const loadGroups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await groupsAPI.getAll();
      setGroups(res.data.data);
    } catch {
      Alert.alert('Error', 'Failed to load groups');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, []);

  const renderGroup = ({ item, index }: { item: Group; index: number }) => (
    <GroupCard group={item} index={index} onPress={() => navigation.navigate('Group', { groupId: item.id })} />
  );

  const totalBalance = groups.reduce((sum, g) => sum + (g.balance_summary?.your_balance || 0), 0);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Sticky header on scroll */}
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <Text style={styles.stickyTitle}>SplitAI</Text>
      </Animated.View>

      <Animated.FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroup}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={loadGroups} tintColor={Colors.white} />
        }
        ListHeaderComponent={
          <HomeHeader user={user} totalBalance={totalBalance} />
        }
        ListEmptyComponent={
          !isLoading ? <EmptyState onPress={() => navigation.navigate('CreateGroup')} /> : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={Colors.black} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Sub-Components ───────────────────────────────────────────

function HomeHeader({ user, totalBalance }: { user: any; totalBalance: number }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
          <Text style={styles.userName}>{user?.name?.split(' ')[0] || 'there'}</Text>
        </View>
        <TouchableOpacity style={styles.avatarButton}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.[0]?.toUpperCase() || '?'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Total Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>TOTAL BALANCE</Text>
        <Text style={[
          styles.balanceAmount,
          totalBalance > 0 ? styles.positiveBalance : totalBalance < 0 ? styles.negativeBalance : {},
        ]}>
          {totalBalance > 0 ? '+' : ''}{formatCurrency(totalBalance)}
        </Text>
        <Text style={styles.balanceSubtext}>
          {totalBalance > 0
            ? 'you are owed overall'
            : totalBalance < 0
            ? 'you owe overall'
            : 'all settled up'}
        </Text>
      </View>

      <Text style={styles.sectionTitle}>YOUR GROUPS</Text>
    </View>
  );
}

function GroupCard({ group, index, onPress }: { group: Group; index: number; onPress: () => void }) {
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 60,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        delay: index * 60,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const balance = group.balance_summary?.your_balance || 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: opacityAnim }}>
      <TouchableOpacity style={styles.groupCard} onPress={onPress} activeOpacity={0.8}>
        {/* Group Initial */}
        <View style={styles.groupAvatar}>
          <Text style={styles.groupAvatarText}>
            {group.name[0]?.toUpperCase()}
          </Text>
        </View>

        <View style={styles.groupInfo}>
          <Text style={styles.groupName} numberOfLines={1}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={styles.groupBalance}>
          <Text style={[
            styles.groupBalanceAmount,
            balance > 0 ? styles.positiveBalance : balance < 0 ? styles.negativeBalance : {},
          ]}>
            {balance === 0 ? 'Settled' : `${balance > 0 ? '+' : ''}${formatCurrency(Math.abs(balance))}`}
          </Text>
          {balance !== 0 && (
            <Text style={styles.groupBalanceLabel}>
              {balance > 0 ? 'you get' : 'you owe'}
            </Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyState({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>⬡</Text>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtext}>Create a group to start splitting expenses with friends</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onPress}>
        <Text style={styles.emptyButtonText}>Create First Group</Text>
      </TouchableOpacity>
    </View>
  );
}

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  stickyHeader: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingTop: 60,
    paddingBottom: Spacing['3'],
    paddingHorizontal: Spacing['6'],
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  stickyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: Typography.wider,
  },
  listContent: {
    paddingBottom: 100,
  },
  header: {
    paddingTop: 80,
    paddingHorizontal: Spacing['6'],
    paddingBottom: Spacing['4'],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing['6'],
  },
  greeting: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  userName: {
    fontSize: Typography['3xl'],
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: Typography.tight,
  },
  avatarButton: {},
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray300,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  balanceCard: {
    backgroundColor: Colors.gray200,
    borderRadius: BorderRadius['3xl'],
    padding: Spacing['6'],
    marginBottom: Spacing['8'],
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: Typography.widest,
    marginBottom: Spacing['2'],
  },
  balanceAmount: {
    fontSize: Typography['4xl'],
    fontWeight: Typography.bold,
    color: Colors.white,
    letterSpacing: Typography.tight,
    marginBottom: Spacing['1'],
  },
  positiveBalance: { color: Colors.success },
  negativeBalance: { color: Colors.danger },
  balanceSubtext: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  sectionTitle: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: Typography.widest,
    marginBottom: Spacing['3'],
    paddingHorizontal: 0,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing['6'],
    marginBottom: Spacing['3'],
    borderRadius: BorderRadius['2xl'],
    padding: Spacing['4'],
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing['3'],
  },
  groupAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupAvatarText: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  groupInfo: { flex: 1 },
  groupName: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
    marginBottom: 2,
  },
  groupMeta: { fontSize: Typography.sm, color: Colors.textTertiary },
  groupBalance: { alignItems: 'flex-end' },
  groupBalanceAmount: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
  groupBalanceLabel: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing['8'],
    right: Spacing['6'],
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.white,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: Spacing['10'],
    paddingTop: Spacing['12'],
    gap: Spacing['3'],
  },
  emptyIcon: { fontSize: 48, marginBottom: Spacing['2'] },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.semibold,
    color: Colors.white,
  },
  emptySubtext: {
    fontSize: Typography.base,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: Spacing['4'],
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing['6'],
    paddingVertical: Spacing['3'],
  },
  emptyButtonText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.black,
  },
});

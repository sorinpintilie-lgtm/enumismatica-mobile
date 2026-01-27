import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import InlineBackButton from '../../components/InlineBackButton';
import { formatRON } from '../../utils/currency';
import { RootStackParamList } from '../../navigationTypes';

type Transaction = {
  id: string;
  status: string;
  type: string;
  amount: number;
  createdAt: Date;
  userId: string;
  description?: string;
};

async function getTransactions(page: number, pageSize: number): Promise<Transaction[]> {
  // Mobile admin transactions are not yet wired to a shared service.
  // Return an empty list to avoid runtime errors while keeping the screen functional.
  console.warn('[TransactionsScreen] getTransactions is not implemented in mobile build');
  return [];
}

const TransactionsScreen = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchTransactions = async (pageNum: number = 1) => {
    try {
      setLoading(pageNum === 1);
      const data = await getTransactions(pageNum, 20);
      
      if (pageNum === 1) {
        setTransactions(data);
      } else {
        setTransactions(prev => [...prev, ...data]);
      }
      
      setHasMore(data.length === 20);
      setError(null);
    } catch (err) {
      setError('Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions(1);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore && !refreshing) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchTransactions(nextPage);
    }
  };

  const renderTransactionItem = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionId}>#{item.id}</Text>
        <Text style={[styles.statusBadge, item.status === 'completed' ? styles.completed : styles.pending]}>
          {item.status}
        </Text>
      </View>
      
      <View style={styles.transactionDetails}>
        <Text style={styles.transactionType}>{item.type}</Text>
        <Text style={styles.transactionAmount}>{formatRON(item.amount)}</Text>
      </View>

      <View style={styles.transactionMeta}>
        <Text style={styles.transactionDate}>{item.createdAt.toLocaleString('ro-RO')}</Text>
        <Text style={styles.transactionUser}>User: {item.userId}</Text>
      </View>

      {item.description && (
        <Text style={styles.transactionDescription}>{item.description}</Text>
      )}
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchTransactions(1)}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('AdminDashboard' as never)} />
        <Text style={styles.headerTitle}>Transactions</Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransactionItem}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No transactions found</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginBottom: 15,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  transactionItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    marginHorizontal: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionId: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  completed: {
    backgroundColor: '#10b981',
    color: 'white',
  },
  pending: {
    backgroundColor: '#f59e0b',
    color: 'white',
  },
  transactionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionType: {
    fontSize: 14,
    color: '#6b7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  transactionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  transactionUser: {
    fontSize: 12,
    color: '#9ca3af',
  },
  transactionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
  },
  listContent: {
    paddingBottom: 20,
  },
});

export default TransactionsScreen;

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../navigationTypes';
import { isAdmin, isSuperAdmin, getAllConversations, getConversationMessages, deleteConversation } from '@shared/adminService';
import { Conversation, ChatMessage } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import InlineBackButton from '../../components/InlineBackButton';

type ConversationsScreenNavigationProp = StackNavigationProp<RootStackParamList>;

export default function ConversationsScreen() {
  const { user, loading: authLoading } = useAuth();
  const navigation = useNavigation<ConversationsScreenNavigationProp>();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigation.navigate('Login' as never);
        return;
      }

      const adminStatus = await isAdmin(user.uid);
      if (!adminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      // Full conversation monitoring/deletion is restricted to super-admins.
      const superAdminStatus = await isSuperAdmin(user.uid);
      if (!superAdminStatus) {
        navigation.navigate('Dashboard' as never);
        return;
      }

      setIsAdminUser(true);
      await loadConversations();
      setLoading(false);
    };

    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigation]);

  const loadConversations = async () => {
    const allConversations = await getAllConversations();
    setConversations(allConversations);
  };

  const loadMessages = async (conversationId: string) => {
    const msgs = await getConversationMessages(conversationId);
    setMessages(msgs);
    setSelectedConversation(conversationId);
  };

  const handleDelete = async (conversationId: string) => {
    const result = await deleteConversation(conversationId);
    if (result.success) {
      await loadConversations();
      if (selectedConversation === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } else {
      console.error('Error deleting conversation:', result.error);
    }
  };

  const filteredConversations = conversations.filter((conv: Conversation) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const buyerId = conv.buyerId ?? '';
    const sellerId = conv.sellerId ?? '';
    const lastMessage = conv.lastMessage ?? '';
    return (
      conv.id.toLowerCase().includes(search) ||
      buyerId.toLowerCase().includes(search) ||
      sellerId.toLowerCase().includes(search) ||
      lastMessage.toLowerCase().includes(search)
    );
  });

  if (authLoading || loading || !isAdminUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <InlineBackButton label="Înapoi la Admin" onPress={() => navigation.navigate('Dashboard' as never)} />
            <Text style={styles.title}>Toate Conversațiile</Text>
            <Text style={styles.subtitle}>Monitorizează toate conversațiile private din platformă</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Caută conversații..."
          />
        </View>

        <View style={styles.conversationsContainer}>
          {/* Conversations List */}
          <View style={styles.conversationsList}>
            <View style={styles.conversationsListHeader}>
              <Text style={styles.conversationsListHeaderTitle}>Conversații ({filteredConversations.length})</Text>
            </View>
            <View style={styles.conversationsListContent}>
              {filteredConversations.length === 0 ? (
                <Text style={styles.emptyText}>
                  {searchTerm ? 'Niciun rezultat găsit' : 'Nicio conversație'}
                </Text>
              ) : (
                 filteredConversations.map((conv: Conversation) => (
                  <TouchableOpacity
                    key={conv.id}
                    style={[styles.conversationItem, 
                      selectedConversation === conv.id ? styles.conversationItemActive : styles.conversationItemInactive
                    ]}
                    onPress={() => loadMessages(conv.id)}
                  >
                    <View style={styles.conversationItemHeader}>
                      <View style={styles.conversationItemInfo}>
                        <Text style={styles.conversationItemTitle}>Conversație #{conv.id.slice(-6)}</Text>
                         <View style={styles.conversationItemUsers}>
                           <Text style={styles.conversationItemUser}>
                             Cumpărător: {conv.buyerId ? conv.buyerId.slice(-6) : 'N/A'}
                           </Text>
                           <Text style={styles.conversationItemUser}>
                             Vânzător: {conv.sellerId ? conv.sellerId.slice(-6) : 'N/A'}
                           </Text>
                         </View>
                         {conv.auctionId && (
                           <TouchableOpacity
                             onPress={(e: any) => {
                               e.stopPropagation();
                               navigation.navigate('AuctionDetails', { auctionId: conv.auctionId! } as never);
                             }}
                           >
                            <Text style={styles.conversationItemAuction}>Licitație: {conv.auctionId.slice(-6)}</Text>
                          </TouchableOpacity>
                        )}
                        {conv.lastMessage && (
                          <Text style={styles.conversationItemLastMessage}>{conv.lastMessage}</Text>
                        )}
                        {conv.lastMessageAt && (
                          <Text style={styles.conversationItemTimestamp}>
                            {formatDistanceToNow(conv.lastMessageAt, { addSuffix: true, locale: ro })}
                          </Text>
                        )}
                      </View>
                       <TouchableOpacity
                         style={styles.conversationItemDelete}
                         onPress={(e: any) => {
                           e.stopPropagation();
                           handleDelete(conv.id);
                         }}
                       >
                        <Text style={styles.conversationItemDeleteText}>Șterge</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.conversationItemStatus}>
                      <Text style={[styles.conversationItemStatusText, 
                        conv.status === 'active' ? styles.conversationItemStatusActive :
                        conv.status === 'archived' ? styles.conversationItemStatusArchived :
                        styles.conversationItemStatusOther
                      ]}>
                        {conv.status}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>

          {/* Messages View */}
          <View style={styles.messagesView}>
            <View style={styles.messagesViewHeader}>
              <Text style={styles.messagesViewHeaderTitle}>
                {selectedConversation ? `Mesaje Conversație #${selectedConversation.slice(-6)}` : 'Selectează o conversație'}
              </Text>
            </View>
            <View style={styles.messagesViewContent}>
              {!selectedConversation ? (
                <View style={styles.messagesViewEmpty}>
                  <Text style={styles.messagesViewEmptyText}>Selectează o conversație pentru a vedea mesajele</Text>
                </View>
              ) : messages.length === 0 ? (
                <View style={styles.messagesViewEmpty}>
                  <Text style={styles.messagesViewEmptyText}>Niciun mesaj în această conversație</Text>
                </View>
              ) : (
                <View style={styles.messagesList}>
                  {messages.map((msg: ChatMessage) => (
                    <View key={msg.id} style={styles.messageItem}>
                      <View style={styles.messageItemHeader}>
                        <View style={styles.messageItemSender}>
                          {msg.senderAvatar && (
                            <View style={styles.messageItemAvatar} />
                          )}
                          <View>
                            <Text style={styles.messageItemSenderName}>{msg.senderName || 'Unknown User'}</Text>
                            <Text style={styles.messageItemSenderId}>ID: {msg.senderId.slice(-8)}</Text>
                          </View>
                        </View>
                        <Text style={styles.messageItemTimestamp}>{msg.timestamp.toLocaleString()}</Text>
                      </View>
                      <Text style={styles.messageItemContent}>{msg.message}</Text>
                      {msg.edited && (
                        <Text style={styles.messageItemEdited}>(Editat)</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000940',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchInput: {
    padding: 12,
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    color: '#1f2937',
  },
  conversationsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  conversationsList: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  conversationsListHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  conversationsListHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  conversationsListContent: {
    padding: 8,
    gap: 8,
  },
  conversationItem: {
    padding: 12,
    borderRadius: 8,
  },
  conversationItemActive: {
    backgroundColor: '#dbeafe',
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  conversationItemInactive: {
    backgroundColor: '#fff',
  },
  conversationItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  conversationItemInfo: {
    flex: 1,
  },
  conversationItemTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  conversationItemUsers: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  conversationItemUser: {
    fontSize: 10,
    color: '#6b7280',
  },
  conversationItemAuction: {
    fontSize: 10,
    color: '#3b82f6',
    marginTop: 4,
  },
  conversationItemLastMessage: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 4,
  },
  conversationItemTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 4,
  },
  conversationItemDelete: {
    justifyContent: 'center',
  },
  conversationItemDeleteText: {
    color: '#ef4444',
    fontSize: 10,
  },
  conversationItemStatus: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  conversationItemStatusText: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: 'bold',
  },
  conversationItemStatusActive: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  conversationItemStatusArchived: {
    backgroundColor: '#e5e7eb',
    color: '#374151',
  },
  conversationItemStatusOther: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  messagesView: {
    flex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  messagesViewHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  messagesViewHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  messagesViewContent: {
    flex: 1,
    padding: 12,
  },
  messagesViewEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesViewEmptyText: {
    color: '#6b7280',
  },
  messagesList: {
    gap: 16,
  },
  messageItem: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
  },
  messageItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  messageItemSender: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  messageItemAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  messageItemSenderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  messageItemSenderId: {
    fontSize: 10,
    color: '#6b7280',
  },
  messageItemTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
  },
  messageItemContent: {
    fontSize: 12,
    color: '#1f2937',
  },
  messageItemEdited: {
    fontSize: 10,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 4,
  },
  emptyText: {
    color: '#6b7280',
    padding: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000940',
  },
});

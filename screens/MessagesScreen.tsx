import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, KeyboardAvoidingView, Keyboard, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import { Conversation, ChatMessage } from '@shared/types';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { subscribeToUserConversations, subscribeToConversationMessages, sendPrivateMessage, markConversationAsRead } from '@shared/chatService';
import { sharedStyles, colors } from '../styles/sharedStyles';
import InlineBackButton from '../components/InlineBackButton';

// Web container wrapper - move outside component to prevent re-rendering
const WebContainer = ({ children }: { children: React.ReactNode }) => {
  if (Platform.OS === 'web') {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: colors.background,
      }}>
        {children}
      </div>
    );
  }
  return <>{children}</>;
};

const MessagesScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const messagesContainerRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  // Web-specific styling adjustments
  const isWeb = Platform.OS === 'web';

  // Keyboard height tracking
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        // Scroll to bottom when keyboard opens
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
      }
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Load user conversations
    const unsubscribeConversations = subscribeToUserConversations(user.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
    });

    return () => {
      unsubscribeConversations();
    };
  }, [user]);

  useEffect(() => {
    if (!selectedConversationId || !user) return;

    // Mark conversation as read when selected
    const markRead = async () => {
      try {
        await markConversationAsRead(selectedConversationId, user.uid);
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    };
    markRead();

    // Subscribe to messages
    const unsubscribeMessages = subscribeToConversationMessages(selectedConversationId, (msgs) => {
      setMessages(msgs);
      // Auto-scroll to bottom when new messages arrive
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    });

    return () => {
      unsubscribeMessages();
    };
  }, [selectedConversationId, user]);

  const handleSendMessage = async () => {
    if (!messageText.trim() || !user || !selectedConversationId) return;

    setSending(true);
    try {
      await sendPrivateMessage(selectedConversationId, user.uid, messageText);
      setMessageText('');
      // Re-focus the input after sending
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const getOtherUserName = (conversation: Conversation) => {
    const currentUserId = user?.uid;
    const otherUserId = conversation.participants.find((id) => id !== currentUserId);

    if (conversation.isAdminSupport) {
      return currentUserId ? 'Suport Admin' : `Utilizator (${otherUserId?.slice(-4)})`;
    }

    const short = otherUserId ? otherUserId.slice(-4) : '????';

    if (currentUserId && conversation.buyerId && conversation.sellerId) {
      const otherIsBuyer = otherUserId === conversation.buyerId;
      const name = otherIsBuyer ? conversation.buyerName : conversation.sellerName;
      if (name) return `${name} (${short})`;
    }

    return `Utilizator (${short})`;
  };

  const filteredConversations = conversations.filter(conv => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const otherUserName = getOtherUserName(conv).toLowerCase();
    return (
      otherUserName.includes(search) ||
      conv.lastMessage?.toLowerCase().includes(search)
    );
  });

  // Add missing color definitions
  const textTertiary = '#6b7280';
  const disabledButton = '#4b5563';

  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 16 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary, textAlign: 'center' }}>Autentificare necesară</Text>
        <Text style={{ marginTop: 8, color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>Este necesară autentificarea pentru a accesa mesajele.</Text>
        <TouchableOpacity
          style={[sharedStyles.button, { backgroundColor: colors.primary, marginTop: 16 }]}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={sharedStyles.buttonText}>Autentifică-te</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 16, color: colors.textSecondary }}>Se încarcă...</Text>
      </View>
    );
  }

  // Mobile layout - split view for larger screens, stacked for mobile
  const isLargeScreen = isWeb ? true : false;

  return (
    <WebContainer>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {isLargeScreen ? (
          // Desktop/Web layout - split view
          <View style={styles.desktopContainer}>
            {/* Conversations List - Left Sidebar */}
            <View style={[styles.conversationsListContainer, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.conversationsHeader}>
                <Text style={[styles.conversationsHeaderTitle, { color: colors.textPrimary }]}>Mesajele Mele</Text>
                  <Text style={[styles.conversationsHeaderSubtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    Conversații cu vânzători și cumpărători
                  </Text>
              </View>

              <View style={styles.searchContainer}>
                <TextInput
                  style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Caută conversații..."
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <ScrollView style={styles.conversationsScroll} contentContainerStyle={styles.conversationsScrollContent}>
                {filteredConversations.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {searchTerm ? 'Niciun rezultat găsit' : 'Nicio conversație'}
                  </Text>
                ) : (
                  filteredConversations.map((conversation) => {
                    const isSelected = conversation.id === selectedConversationId;
                    const unreadCount = typeof conversation.unreadCount === 'object' && user?.uid
                      ? (conversation.unreadCount[user.uid] || 0)
                      : 0;
                    const isAdminChat = conversation.isAdminSupport;

                    return (
                      <TouchableOpacity
                        key={conversation.id}
                        onPress={() => setSelectedConversationId(conversation.id)}
                        style={[styles.conversationItem,
                          isSelected ? styles.conversationItemActive : styles.conversationItemInactive,
                          isAdminChat ? styles.conversationItemAdmin : null
                        ]}
                      >
                        <View style={styles.conversationItemHeader}>
                          <View style={styles.conversationItemInfo}>
                            <Text style={[styles.conversationItemTitle, { color: colors.textPrimary }]}>
                              {getOtherUserName(conversation)}
                            </Text>
                            {conversation.lastMessage && (
                              <Text style={[styles.conversationItemLastMessage, { color: colors.textSecondary }]}>
                                {conversation.lastMessage}
                              </Text>
                            )}
										{conversation.lastMessageAt && (
										<Text style={[styles.conversationItemTimestamp, { color: textTertiary }]}>
                                {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true, locale: ro })}
                              </Text>
                            )}
                          </View>
                          {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Chat Area - Main Content */}
            <View style={[styles.chatContainer, { backgroundColor: colors.cardBackground }]}>
              {!selectedConversationId ? (
                <View style={styles.chatEmptyContainer}>
                  <Text style={[styles.chatEmptyTitle, { color: colors.textPrimary }]}>Selectează o conversație</Text>
                  <Text style={[styles.chatEmptySubtitle, { color: colors.textSecondary }]}>
                    Alege o conversație din listă pentru a începe să trimiți mesaje
                  </Text>
                </View>
              ) : (
                <KeyboardAvoidingView
                  style={styles.chatContent}
                  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                  keyboardVerticalOffset={Platform.OS === 'ios' ? 110 : 0}
                  enabled={!isWeb}
                >
                  {/* Chat Header */}
                  <View style={[styles.chatHeader, { borderBottomColor: colors.borderColor }]}>
                    <Text style={[styles.chatHeaderTitle, { color: colors.textPrimary }]}>
                      {conversations.find(c => c.id === selectedConversationId)?.isAdminSupport ? 'Suport Admin' : 'Conversație Privată'}
                    </Text>
                  </View>

                  {/* Messages Area */}
                  <ScrollView
                    ref={messagesContainerRef}
                    style={styles.messagesArea}
                    contentContainerStyle={styles.messagesContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onContentSizeChange={() => messagesContainerRef.current?.scrollToEnd({ animated: true })}
                  >
                    {messages.length === 0 ? (
                      <View style={styles.messagesEmpty}>
                        <Text style={[styles.messagesEmptyText, { color: colors.textSecondary }]}>Niciun mesaj încă</Text>
                        <Text style={[styles.messagesEmptySubtext, { color: textTertiary }]}>Începe conversația trimițând un mesaj!</Text>
                      </View>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.senderId === user?.uid;
                        const isRead = message.readBy && message.readBy.length > 1;

                        return (
                          <View
                            key={message.id}
                            style={[styles.messageBubbleContainer, isOwnMessage ? styles.messageBubbleContainerOwn : styles.messageBubbleContainerOther]}
                          >
                            <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
                              <Text style={[styles.messageSender, { color: textTertiary }]}>
                                {message.senderName || 'Utilizator'}
                              </Text>
                              <Text style={[styles.messageText, { color: isOwnMessage ? colors.primaryText : colors.textPrimary }]}>
                                {message.message}
                              </Text>
                              <View style={styles.messageFooter}>
                                <Text style={[styles.messageTimestamp, { color: textTertiary }]}>
                                  {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: ro })}
                                </Text>
                                {isOwnMessage && isRead && (
                                  <Text style={[styles.messageReadReceipt, { color: colors.primary }]}>✓✓</Text>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  {/* Input Area */}
                  <View style={[styles.inputContainer, { borderTopColor: colors.borderColor, paddingBottom: keyboardHeight > 0 ? keyboardHeight / 2 : 12 }]}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                      value={messageText}
                      onChangeText={setMessageText}
                      placeholder="Scrie un mesaj..."
                      placeholderTextColor={colors.textSecondary}
                      editable={!sending}
                      maxLength={500}
                      returnKeyType="send"
                      blurOnSubmit={true}
                      onSubmitEditing={handleSendMessage}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, { backgroundColor: messageText.trim() ? colors.primary : disabledButton }]}
                      onPress={handleSendMessage}
                      disabled={!messageText.trim() || sending}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color={colors.primaryText} />
                      ) : (
                        <Text style={[styles.sendButtonText, { color: colors.primaryText }]}>Trimite</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </KeyboardAvoidingView>
              )}
            </View>
          </View>
        ) : (
          // Mobile layout - stacked view
          <View style={styles.mobileContainer}>
            {!selectedConversationId ? (
              // Conversations List View
              <View style={styles.mobileConversationsContainer}>
                <View style={styles.conversationsHeader}>
                  <InlineBackButton />
                  <Text style={[styles.conversationsHeaderTitle, { color: colors.textPrimary }]}>Mesajele Mele</Text>
                  <Text style={[styles.conversationsHeaderSubtitle, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="tail">
                    Conversații cu vânzători și cumpărători
                  </Text>
                </View>

                <View style={styles.searchContainer}>
                  <TextInput
                    style={[styles.searchInput, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                    value={searchTerm}
                    onChangeText={setSearchTerm}
                    placeholder="Caută conversații..."
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <ScrollView style={styles.conversationsScroll} contentContainerStyle={styles.conversationsScrollContent}>
                  {filteredConversations.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      {searchTerm ? 'Niciun rezultat găsit' : 'Nicio conversație'}
                    </Text>
                  ) : (
                    filteredConversations.map((conversation) => {
                      const isSelected = conversation.id === selectedConversationId;
                      const unreadCount = typeof conversation.unreadCount === 'object' && user?.uid
                        ? (conversation.unreadCount[user.uid] || 0)
                        : 0;
                      const isAdminChat = conversation.isAdminSupport;

                      return (
                        <TouchableOpacity
                          key={conversation.id}
                          onPress={() => setSelectedConversationId(conversation.id)}
                          style={[styles.conversationItem,
                            isSelected ? styles.conversationItemActive : styles.conversationItemInactive,
                            isAdminChat ? styles.conversationItemAdmin : null
                          ]}
                        >
                          <View style={styles.conversationItemHeader}>
                            <View style={styles.conversationItemInfo}>
                              <Text style={[styles.conversationItemTitle, { color: colors.textPrimary }]}>
                                {getOtherUserName(conversation)}
                              </Text>
                              {conversation.lastMessage && (
                                <Text style={[styles.conversationItemLastMessage, { color: colors.textSecondary }]}>
                                  {conversation.lastMessage}
                                </Text>
                              )}
									{conversation.lastMessageAt && (
										<Text style={[styles.conversationItemTimestamp, { color: textTertiary }]}>
                                  {formatDistanceToNow(conversation.lastMessageAt, { addSuffix: true, locale: ro })}
                                </Text>
                              )}
                            </View>
                            {unreadCount > 0 && (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            ) : (
              // Chat View
              <KeyboardAvoidingView
                style={styles.mobileChatContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                enabled={!isWeb}
              >
                <View style={[styles.chatHeader, { borderBottomColor: colors.borderColor }]}>
                  <InlineBackButton onPress={() => setSelectedConversationId(null)} />
                  <Text style={[styles.chatHeaderTitle, { color: colors.textPrimary }]}>
                    {conversations.find(c => c.id === selectedConversationId)?.isAdminSupport ? 'Suport Admin' : getOtherUserName(conversations.find(c => c.id === selectedConversationId) as Conversation)}
                  </Text>
                </View>

                <View style={styles.mobileMessagesWrapper}>
                  <ScrollView
                    ref={messagesContainerRef}
                    style={styles.messagesArea}
                    contentContainerStyle={styles.messagesContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    onContentSizeChange={() => messagesContainerRef.current?.scrollToEnd({ animated: true })}
                    nestedScrollEnabled={true}
                  >
                    {messages.length === 0 ? (
                      <View style={styles.messagesEmpty}>
                        <Text style={[styles.messagesEmptyText, { color: colors.textSecondary }]}>Niciun mesaj încă</Text>
                        <Text style={[styles.messagesEmptySubtext, { color: textTertiary }]}>Începe conversația trimițând un mesaj!</Text>
                      </View>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.senderId === user?.uid;
                        const isRead = message.readBy && message.readBy.length > 1;

                        return (
                          <View
                            key={message.id}
                            style={[styles.messageBubbleContainer, isOwnMessage ? styles.messageBubbleContainerOwn : styles.messageBubbleContainerOther]}
                          >
                            <View style={[styles.messageBubble, isOwnMessage ? styles.messageBubbleOwn : styles.messageBubbleOther]}>
                              <Text style={[styles.messageSender, { color: textTertiary }]}>
                                {message.senderName || 'Utilizator'}
                              </Text>
                              <Text style={[styles.messageText, { color: isOwnMessage ? colors.primaryText : colors.textPrimary }]}>
                                {message.message}
                              </Text>
                              <View style={styles.messageFooter}>
                                <Text style={[styles.messageTimestamp, { color: textTertiary }]}>
                                  {formatDistanceToNow(message.timestamp, { addSuffix: true, locale: ro })}
                                </Text>
                                {isOwnMessage && isRead && (
                                  <Text style={[styles.messageReadReceipt, { color: colors.primary }]}>✓✓</Text>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  <View style={[styles.inputContainer, { borderTopColor: colors.borderColor, paddingBottom: keyboardHeight > 0 ? keyboardHeight / 2 : 12 }]}>
                    <TextInput
                      ref={inputRef}
                      style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.textPrimary }]}
                      value={messageText}
                      onChangeText={setMessageText}
                      placeholder="Scrie un mesaj..."
                      placeholderTextColor={colors.textSecondary}
                      editable={!sending}
                      maxLength={500}
                      returnKeyType="send"
                      blurOnSubmit={true}
                      onSubmitEditing={handleSendMessage}
                      enablesReturnKeyAutomatically={true}
                    />
                    <TouchableOpacity
                      style={[styles.sendButton, { backgroundColor: messageText.trim() ? colors.primary : disabledButton }]}
                      onPress={handleSendMessage}
                      disabled={!messageText.trim() || sending}
                    >
                      {sending ? (
                        <ActivityIndicator size="small" color={colors.primaryText} />
                      ) : (
                        <Text style={[styles.sendButtonText, { color: colors.primaryText }]}>Trimite</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </KeyboardAvoidingView>
            )}
          </View>
        )}
      </View>
    </WebContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
    padding: 16,
  },
  conversationsListContainer: {
    flex: 1,
    maxWidth: 350,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  conversationsHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  conversationsHeaderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  conversationsHeaderSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  searchContainer: {
    padding: 12,
  },
  searchInput: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    fontSize: 14,
  },
  conversationsScroll: {
    flex: 1,
  },
  conversationsScrollContent: {
    padding: 8,
    gap: 8,
  },
  conversationItem: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  conversationItemActive: {
    backgroundColor: 'rgba(231, 183, 60, 0.15)',
    borderColor: 'rgba(231, 183, 60, 0.6)',
    borderLeftWidth: 4,
    borderLeftColor: '#e7b73c',
  },
  conversationItemInactive: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  conversationItemAdmin: {
    backgroundColor: 'rgba(231, 183, 60, 0.1)',
    borderRightWidth: 3,
    borderRightColor: '#e7b73c',
  },
  conversationItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  conversationItemInfo: {
    flex: 1,
  },
  conversationItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  conversationItemLastMessage: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  conversationItemTimestamp: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: '500',
  },
  unreadBadge: {
    backgroundColor: '#E7B73C',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 20,
  },
  unreadBadgeText: {
    color: '#000940',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatContainer: {
    flex: 2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  chatEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  chatEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatEmptySubtitle: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  chatContent: {
    flex: 1,
    flexDirection: 'column',
  },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  messagesArea: {
    flex: 1,
    flexGrow: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 16,
  },
  messagesEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesEmptyText: {
    fontSize: 16,
  },
  messagesEmptySubtext: {
    fontSize: 12,
    marginTop: 8,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
  },
  messageBubbleContainerOwn: {
    justifyContent: 'flex-end',
  },
  messageBubbleContainerOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  messageBubbleOwn: {
    backgroundColor: '#e7b73c',
  },
  messageBubbleOther: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
  },
  messageSender: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  messageTimestamp: {
    fontSize: 11,
    fontWeight: '500',
  },
  messageReadReceipt: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    gap: 8,
    backgroundColor: colors.cardBackground,
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    maxHeight: 100,
  },
  sendButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontWeight: '600',
  },
  emptyText: {
    color: '#6b7280',
    padding: 16,
    textAlign: 'center',
  },
  mobileContainer: {
    flex: 1,
  },
  mobileConversationsContainer: {
    flex: 1,
    padding: 16,
  },
  mobileChatContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  mobileMessagesWrapper: {
    flex: 1,
    flexDirection: 'column',
  },
});

export default MessagesScreen;


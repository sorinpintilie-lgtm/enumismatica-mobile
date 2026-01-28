import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Button, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView } from 'react-native';
import { HelpArticle, HelpCategory } from '@shared/types';
import { getHelpArticles, getHelpCategories, searchHelpContent } from '@shared/helpService';
import { sharedStyles, colors } from '../styles/sharedStyles';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigationTypes';
import InlineBackButton from '../components/InlineBackButton';
import { useAuth } from '../context/AuthContext';
import { useConversations } from '../hooks/useChat';
import { SUPPORT_ADMIN_UID } from '@shared/adminService';
import { sendPrivateMessage } from '@shared/chatService';

export default function HelpCenterScreen() {
  const { user } = useAuth();
  const { startConversation } = useConversations(user?.uid ?? null);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<'ro' | 'en'>('en');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Load categories
        const categoriesResult = await getHelpCategories();
        if (categoriesResult.success && categoriesResult.categories) {
          setCategories(categoriesResult.categories);
        }

        // Load articles
        const articlesResult = await getHelpArticles({
          language,
          status: 'published'
        });

        if (articlesResult.success && articlesResult.articles) {
          setArticles(articlesResult.articles);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading help center data:', err);
        setError('Failed to load help center data');
        setLoading(false);
      }
    }

    loadData();
  }, [language]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      const result = await searchHelpContent(searchQuery, language);

      if (result.success && result.results) {
        // Convert search results to articles
        const articleIds = result.results.map(r => r.articleId);
        const articlesResult = await getHelpArticles({
          language,
          status: 'published'
        });

        if (articlesResult.success && articlesResult.articles) {
          const filteredArticles = articlesResult.articles.filter(article =>
            articleIds.includes(article.id)
          );
          setSearchResults(filteredArticles);
        }
      } else {
        setSearchResults([]);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error searching help content:', err);
      setError('Failed to search help content');
      setLoading(false);
    }
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId === selectedCategory ? null : categoryId);
    setSearchQuery('');
    setSearchResults([]);
  };

  const filteredArticles = selectedCategory
    ? articles.filter(article => article.categoryId === selectedCategory)
    : searchResults.length > 0
      ? searchResults
      : articles;

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'General';
  };

  const renderArticleItem = ({ item }: { item: HelpArticle }) => (
    <TouchableOpacity
      style={styles.articleItem}
      onPress={() => navigation.navigate('HelpArticle', { articleId: item.id })}
    >
      <View style={styles.articleHeader}>
        <Text style={styles.articleTitle}>{item.title}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>{getCategoryName(item.categoryId)}</Text>
        </View>
      </View>

      <Text style={styles.articlePreview}>
        {item.content.replace(/<[^>]*>/g, '').substring(0, 100)}...
      </Text>

      <View style={styles.articleMeta}>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>👁️</Text>
          <Text style={styles.metaText}>{item.views} views</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaIcon}>👍</Text>
          <Text style={styles.metaText}>{item.helpfulCount} helpful</Text>
        </View>
      </View>

      <View style={styles.tagsContainer}>
        {item.tags.map((tag, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );

  const faqItems = [
    {
      question: 'Cum cumpăr o monedă din Magazin?',
      answer: 'Deschide produsul, apasă „Cumpără acum”, confirmă comanda și vei primi detaliile în Istoricul Comenzilor.',
    },
    {
      question: 'Cum particip la o licitație?',
      answer: 'Intră în Licitații, alege o licitație activă și plasează o ofertă cel puțin egală cu oferta minimă.',
    },
    {
      question: 'Cum creez o listare?',
      answer: 'Din tab-ul principal apasă butonul „Vinde” și alege tipul de listare: preț fix sau licitație.',
    },
    {
      question: 'Cum contactez un vânzător?',
      answer: 'Din pagina produsului poți iniția o conversație; toate mesajele sunt în secțiunea Mesaje.',
    },
    {
      question: 'Ce înseamnă produsele „promovate”?',
      answer: 'Sunt listări evidențiate pentru vizibilitate sporită; nu există costuri suplimentare pentru cumpărători.',
    },
  ];

  const handleStartSupport = async () => {
    if (!user) {
      Alert.alert('Autentificare necesară', 'Trebuie să fie autentificat pentru a contacta suportul.');
      return;
    }

    if (!supportMessage.trim()) {
      Alert.alert('Mesaj gol', 'Scrieți un mesaj pentru echipa de suport.');
      return;
    }

    try {
      setSupportSending(true);
      const conversationId = await startConversation(SUPPORT_ADMIN_UID, undefined, undefined, true);
      await sendPrivateMessage(conversationId, user.uid, supportMessage.trim());
      setSupportMessage('');
      navigation.navigate('Messages', { conversationId });
    } catch (err) {
      console.error('Failed to start support conversation', err);
      Alert.alert('Eroare', 'Nu s-a putut trimite mesajul către suport. Încearcă din nou.');
    } finally {
      setSupportSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <InlineBackButton />
          <Text style={[styles.title, { marginTop: 12 }]}>Help Center</Text>

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.supportCard}>
            <Text style={styles.supportTitle}>Este nevoie de ajutor?</Text>
            <Text style={styles.supportSubtitle}>
              Trimite un mesaj echipei de suport. Un admin va prelua conversația.
            </Text>
            <TextInput
              style={styles.supportInput}
              value={supportMessage}
              onChangeText={setSupportMessage}
              placeholder="Scrieți mesajul..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.supportButton, supportMessage.trim() ? null : styles.supportButtonDisabled]}
              onPress={handleStartSupport}
              disabled={!supportMessage.trim() || supportSending}
            >
              <Text style={styles.supportButtonText}>
                {supportSending ? 'Se trimite...' : 'Trimite mesaj către suport'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Search and Language Selection */}
          <View style={styles.searchContainer}>
            <View style={styles.languageSelector}>
              <Text style={styles.languageLabel}>Language:</Text>
              <View style={styles.languageButtons}>
                <Button
                  title="English"
                  onPress={() => setLanguage('en')}
                  color={language === 'en' ? '#3b82f6' : '#d1d5db'}
                />
                <Button
                  title="Română"
                  onPress={() => setLanguage('ro')}
                  color={language === 'ro' ? '#3b82f6' : '#d1d5db'}
                />
              </View>
            </View>

            <View style={styles.searchInputContainer}>
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search help articles..."
                placeholderTextColor={colors.textSecondary}
              />
              <Button
                title="Search"
                onPress={handleSearch}
                disabled={!searchQuery.trim()}
              />
            </View>
          </View>

          {/* Categories */}
          <View style={styles.categoriesContainer}>
            <Text style={styles.sectionTitle}>Categories</Text>
            <FlatList
              horizontal
              data={categories.filter(cat => cat.language === language)}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    selectedCategory === item.id && styles.selectedCategory
                  ]}
                  onPress={() => handleCategorySelect(item.id)}
                >
                  <Text style={[
                    styles.categoryText,
                    selectedCategory === item.id && styles.selectedCategoryText
                  ]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.categoriesList}
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>

          {/* Articles List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading help articles...</Text>
            </View>
          ) : filteredArticles.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? 'No articles match your search. Try different keywords.'
                  : 'No articles available in this category.'}
              </Text>
            </View>
          ) : (
            <View style={styles.articlesListContainer}>
              {filteredArticles.map((item) => (
                <View key={item.id}>{renderArticleItem({ item })}</View>
              ))}
            </View>
          )}

          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>FAQ</Text>
            <View style={styles.faqList}>
              {faqItems.map((item) => (
                <View key={item.question} style={styles.faqItem}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.background
  },
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: colors.primary
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: colors.error,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  errorText: {
    color: colors.error,
    textAlign: 'center'
  },
  supportCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.3)',
    marginBottom: 16,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 8,
  },
  supportSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  supportInput: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  supportButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  supportButtonDisabled: {
    opacity: 0.6,
  },
  supportButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  searchContainer: {
    marginBottom: 16,
    gap: 12
  },
  languageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  languageLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 8
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 8
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary
  },
  categoriesContainer: {
    marginBottom: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: colors.primary
  },
  categoriesList: {
    gap: 8
  },
  categoryItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.borderColor
  },
  selectedCategory: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryText: {
    color: colors.textPrimary
  },
  selectedCategoryText: {
    color: colors.primaryText
  },
  articleItem: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderColor,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  articleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1
  },
  categoryBadge: {
    backgroundColor: 'rgba(231, 183, 60, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderColor
  },
  categoryBadgeText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500'
  },
  articlePreview: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
    lineHeight: 20
  },
  articleMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaIcon: {
    fontSize: 14
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)'
  },
  tagText: {
    fontSize: 10,
    color: colors.textSecondary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24
  },
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center'
  },
  articlesList: {
    paddingBottom: 24
  },
  articlesListContainer: {
    paddingBottom: 24,
  },
  faqSection: {
    marginTop: 16,
    paddingBottom: 24,
  },
  faqList: {
    gap: 12,
  },
  faqItem: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderColor,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  faqAnswer: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});

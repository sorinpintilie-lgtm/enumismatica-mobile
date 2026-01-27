import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { HelpArticle, HelpCategory } from '@shared/types';
import { getHelpArticle, getHelpCategories, submitHelpFeedback } from '@shared/helpService';
import { useNavigation, useRoute } from '@react-navigation/native';
import InlineBackButton from '../components/InlineBackButton';

export default function HelpArticleScreen() {
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<'helpful' | 'not_helpful' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigation = useNavigation();
  const route = useRoute();
  const { articleId } = route.params as { articleId: string };

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // Load article
        const articleResult = await getHelpArticle(articleId);
        if (articleResult.success && articleResult.article) {
          setArticle(articleResult.article);
        } else {
          setError('Article not found');
        }

        // Load categories for display
        const categoriesResult = await getHelpCategories();
        if (categoriesResult.success && categoriesResult.categories) {
          setCategories(categoriesResult.categories);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading help article:', err);
        setError('Failed to load help article');
        setLoading(false);
      }
    }

    loadData();
  }, [articleId]);

  const handleFeedbackSubmit = async () => {
    if (!feedbackRating || !article) return;

    try {
      setIsSubmitting(true);
      const result = await submitHelpFeedback(
        article.id,
        'current-user-id', // In real app, this would be the actual user ID
        feedbackRating,
        feedbackComment
      );

      if (result.success) {
        setFeedbackSubmitted(true);
        // Update local state to reflect the feedback
        setArticle(prev => prev ? {
          ...prev,
          [feedbackRating === 'helpful' ? 'helpfulCount' : 'notHelpfulCount']:
            prev[feedbackRating === 'helpful' ? 'helpfulCount' : 'notHelpfulCount'] + 1
        } : null);
      } else {
        setError('Failed to submit feedback');
      }
      setIsSubmitting(false);
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setError('Failed to submit feedback');
      setIsSubmitting(false);
    }
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'General';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading article...</Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>Error</Text>
        <Text style={styles.errorText}>{error || 'Article not found'}</Text>
        <InlineBackButton />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <InlineBackButton />
        <Text style={styles.categoryText}>{getCategoryName(article.categoryId)}</Text>
      </View>

      <View style={styles.articleContainer}>
        <Text style={styles.articleTitle}>{article.title}</Text>

        <View style={styles.articleMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>👁️</Text>
            <Text style={styles.metaText}>{article.views} views</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>👍</Text>
            <Text style={styles.metaText}>{article.helpfulCount} helpful</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaIcon}>👎</Text>
            <Text style={styles.metaText}>{article.notHelpfulCount} not helpful</Text>
          </View>
        </View>

        {/* Article Content */}
        <View style={styles.articleContent}>
          <Text style={styles.articleContentText}>
            {article.content.replace(/<[^>]*>/g, '')}
          </Text>
        </View>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            <Text style={styles.tagsTitle}>Tags</Text>
            <View style={styles.tagsList}>
              {article.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Feedback Section */}
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackTitle}>Was this article helpful?</Text>

          {feedbackSubmitted ? (
            <View style={styles.feedbackSuccess}>
              <Text style={styles.feedbackSuccessText}>Thank you for your feedback!</Text>
            </View>
          ) : (
            <View style={styles.feedbackForm}>
              <View style={styles.feedbackButtons}>
                <TouchableOpacity
                  style={[
                    styles.feedbackButton,
                    feedbackRating === 'helpful' && styles.feedbackButtonSelected,
                    feedbackRating === 'helpful' && styles.feedbackButtonHelpful
                  ]}
                  onPress={() => setFeedbackRating('helpful')}
                >
                  <Text style={[
                    styles.feedbackButtonText,
                    feedbackRating === 'helpful' && styles.feedbackButtonTextSelected
                  ]}>
                    Yes, helpful 👍
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.feedbackButton,
                    feedbackRating === 'not_helpful' && styles.feedbackButtonSelected,
                    feedbackRating === 'not_helpful' && styles.feedbackButtonNotHelpful
                  ]}
                  onPress={() => setFeedbackRating('not_helpful')}
                >
                  <Text style={[
                    styles.feedbackButtonText,
                    feedbackRating === 'not_helpful' && styles.feedbackButtonTextSelected
                  ]}>
                    No, not helpful 👎
                  </Text>
                </TouchableOpacity>
              </View>

              {feedbackRating === 'not_helpful' && (
                <View style={styles.feedbackCommentContainer}>
                  <Text style={styles.feedbackCommentLabel}>
                    How can we improve this article? (optional)
                  </Text>
                  <TextInput
                    style={styles.feedbackCommentInput}
                    value={feedbackComment}
                    onChangeText={setFeedbackComment}
                    placeholder="What information are you missing? What could be clearer?"
                    multiline
                    numberOfLines={4}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!feedbackRating || isSubmitting) && styles.submitButtonDisabled
                ]}
                onPress={handleFeedbackSubmit}
                disabled={!feedbackRating || isSubmitting}
              >
                <Text style={styles.submitButtonText}>
                  {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5'
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280'
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5'
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 8
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 24
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  categoryText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500'
  },
  articleContainer: {
    padding: 16,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 16
  },
  articleMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 16
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  metaIcon: {
    fontSize: 16
  },
  metaText: {
    fontSize: 14,
    color: '#6b7280'
  },
  articleContent: {
    marginBottom: 24
  },
  articleContentText: {
    fontSize: 16,
    color: '#1f2937',
    lineHeight: 24
  },
  tagsContainer: {
    marginBottom: 24
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  tagText: {
    fontSize: 12,
    color: '#6b7280'
  },
  feedbackContainer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb'
  },
  feedbackTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 16
  },
  feedbackSuccess: {
    backgroundColor: '#d1fae5',
    borderColor: '#6ee7b7',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16
  },
  feedbackSuccessText: {
    color: '#065f46',
    textAlign: 'center',
    fontWeight: '500'
  },
  feedbackForm: {
    gap: 16
  },
  feedbackButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16
  },
  feedbackButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center'
  },
  feedbackButtonSelected: {
    borderWidth: 2
  },
  feedbackButtonHelpful: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981'
  },
  feedbackButtonNotHelpful: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444'
  },
  feedbackButtonText: {
    fontSize: 14,
    fontWeight: '500'
  },
  feedbackButtonTextSelected: {
    color: '#1e40af'
  },
  feedbackCommentContainer: {
    gap: 8
  },
  feedbackCommentLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e40af'
  },
  feedbackCommentInput: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center'
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af'
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  }
});
import { StyleSheet } from 'react-native';

// Shared color palette from LoginScreen
export const colors = {
  background: '#00020d',
  primary: '#e7b73c',
  textPrimary: 'white',
  textSecondary: '#94a3b8',
  textTertiary: '#6b7280',
  error: '#ef4444',
  errorLight: '#fecaca',
  success: '#10b981',
  cardBackground: 'rgba(255, 255, 255, 0.1)',
  inputBackground: 'rgba(255, 255, 255, 0.05)',
  borderColor: 'rgba(231, 183, 60, 0.3)',
  primaryText: '#000940',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  primaryLight: '#fef3c7',
  border: '#d1d5db',
  navy900: '#00020d',
  navy800: '#020617',
  navy700: '#111827',
  slate800: '#1f2937',
  slate700: '#374151',
  slate600: '#4b5563',
  slate500: '#6b7280',
  slate400: '#94a3b8',
  slate300: '#cbd5e1',
  slate200: '#e2e8f0',
  slate100: '#f1f5f9',
  gold500: '#e7b73c',
  gold400: '#facc6b',
  emerald500: '#10b981',
  emerald300: '#6ee7b7',
  green500: '#22c55e',
  red500: '#ef4444',
  red200: '#fecaca',
  blue500: '#3b82f6',
  disabledButton: '#4b5563',
};

// Shared styles
export const sharedStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  
  formContainer: {
    width: '100%',
    maxWidth: 400,
  },
  
  header: {
    marginBottom: 32,
  },
  
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  
  subtitle: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 14,
  },
  
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  
  input: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
  },
  
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  
  primaryButton: {
    width: '100%',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  
  buttonText: {
    color: colors.primaryText,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  secondaryButton: {
    width: '100%',
    borderWidth: 2,
    borderColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  
  secondaryButtonText: {
    color: colors.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  linkText: {
    color: colors.primary,
    fontSize: 14,
  },
  
  text: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  
  // New shared styles for consistency
  screenContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    padding: 16,
    marginBottom: 16,
  },
  
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  
  cardSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  
  headerContainer: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(231, 183, 60, 0.4)',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.9,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 4,
  },
  
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  
  resultsSummary: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  
  resultsHighlight: {
    fontWeight: '600',
    color: colors.gold400,
  },
  
  searchInput: {
    width: '100%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.4)',
    backgroundColor: 'rgba(0, 2, 13, 0.7)',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  
  filtersButton: {
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  
  filtersButtonText: {
    color: colors.primaryText,
    textAlign: 'center',
    fontWeight: '600',
  },
  
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 16,
  },
  
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  
  emptyButtonText: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.background,
  },
  
  loadingTitle: {
    marginTop: 16,
    color: colors.textPrimary,
    textAlign: 'center',
    fontSize: 16,
  },
  
  loadingSubtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 14,
  },
  
  errorMessage: {
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
});
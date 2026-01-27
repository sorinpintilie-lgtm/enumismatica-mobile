import React, { useCallback, useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useToast } from '../context/ToastContext';
import { colors } from '../styles/sharedStyles';
import { requestPullback, PullbackItemType } from '../services/pullbackApi';

type Props = {
  itemId: string;
  itemType: PullbackItemType;
  disabled?: boolean;
  onPullbackSuccess?: () => void;
  style?: StyleProp<ViewStyle>;
};

export default function PullbackButton({
  itemId,
  itemType,
  disabled = false,
  onPullbackSuccess,
  style,
}: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  const doPullback = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    try {
      const res = await requestPullback(itemType, itemId);
      showToast({
        type: 'success',
        title: 'Succes',
        message: res.message || 'Articolul a fost returnat în colecție cu succes',
      });
      onPullbackSuccess?.();
    } catch (err: any) {
      const message = err instanceof Error ? err.message : 'Eroare la returnarea în colecție';
      showToast({
        type: 'error',
        title: 'Eroare',
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [itemId, itemType, loading, onPullbackSuccess, showToast]);

  const confirm = useCallback(() => {
    Alert.alert(
      'Confirmă retragerea',
      `Ești sigur că dorești să retragi acest ${itemType === 'product' ? 'produs' : 'licitație'} în colecția ta personală?\n\nNotă: această acțiune este imediată.`,
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: loading ? 'Se procesează...' : 'Confirmă',
          style: 'destructive',
          onPress: doPullback,
        },
      ],
      { cancelable: true },
    );
  }, [doPullback, itemType, loading]);

  return (
    <TouchableOpacity
      onPress={confirm}
      disabled={disabled || loading}
      style={[styles.button, (disabled || loading) && styles.buttonDisabled, style]}
    >
      {loading ? (
        <>
          <ActivityIndicator size="small" color={colors.textPrimary} />
          <Text style={styles.text}>Se procesează...</Text>
        </>
      ) : (
        <Text style={styles.text}>Retrage în colecție</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.55)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
});


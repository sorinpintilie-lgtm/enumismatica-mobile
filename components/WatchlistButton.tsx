import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';
import { useWatchlist } from '../hooks/useWatchlist';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface WatchlistButtonProps {
  itemType: 'product' | 'auction';
  itemId: string;
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

export const WatchlistButton: React.FC<WatchlistButtonProps> = ({
  itemType,
  itemId,
  size = 'medium',
  showText = false
}) => {
  const { user } = useAuth();
  const { checkWatchlistStatus, addToWatchlist, removeFromWatchlist } = useWatchlist();
  const { showToast } = useToast();
  const [isInWatchlist, setIsInWatchlist] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [checked, setChecked] = useState<boolean>(false);

  // Check initial watchlist status
  useEffect(() => {
    if (user && !checked) {
      const checkStatus = async () => {
        try {
          const result = await checkWatchlistStatus(itemId);
          setIsInWatchlist(result.exists);
          setChecked(true);
        } catch (error) {
          console.error('Error checking watchlist status:', error);
          setChecked(true);
        }
      };

      checkStatus();
    }
  }, [user, itemId, checkWatchlistStatus, checked]);

  const handleToggleWatchlist = async () => {
    if (!user) {
      showToast({
        type: 'error',
        title: 'Autentificare necesară',
        message: 'Trebuie să te autentifici pentru a adăuga la lista de urmărire.',
      });
      return;
    }

    if (loading) return;

    setLoading(true);
    try {
      if (isInWatchlist) {
        // Remove from watchlist
        const result = await removeFromWatchlist(itemId);
        if (result.success) {
          setIsInWatchlist(false);
          showToast({
            type: 'success',
            title: 'Îndepărtat din lista de urmărire',
            message: 'Articolul a fost îndepărtat din lista de urmărire.',
          });
        } else {
          showToast({
            type: 'error',
            title: 'Eroare la îndepărtare',
            message: result.error || 'A apărut o eroare la îndepărtarea din lista de urmărire.',
          });
        }
      } else {
        // Add to watchlist
        const result = await addToWatchlist(itemType, itemId);
        if (result.success) {
          setIsInWatchlist(true);
          showToast({
            type: 'success',
            title: 'Adăugat la lista de urmărire',
            message: 'Articolul a fost adăugat la lista de urmărire.',
          });
        } else {
          showToast({
            type: 'error',
            title: 'Eroare la adăugare',
            message: result.error || 'A apărut o eroare la adăugarea în lista de urmărire.',
          });
        }
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      showToast({
        type: 'error',
        title: 'Eroare la actualizare',
        message: 'A apărut o eroare la actualizarea listei de urmărire.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Determine button size and styling
  const getButtonSize = () => {
    switch (size) {
      case 'small':
        return { padding: 4, iconSize: 16 };
      case 'large':
        return { padding: 12, iconSize: 24 };
      case 'medium':
      default:
        return { padding: 8, iconSize: 20 };
    }
  };

  const { padding, iconSize } = getButtonSize();

  // Determine button styling based on state
  const getButtonStyle = () => {
    if (isInWatchlist) {
      return {
        backgroundColor: showText ? '#d4af37' : 'rgba(212, 175, 55, 0.9)',
        borderColor: showText ? '#d4af37' : 'rgba(212, 175, 55, 0.6)',
        borderWidth: 1,
      };
    } else {
      return {
        backgroundColor: showText ? '#4b5563' : 'rgba(0, 0, 0, 0.45)',
        borderColor: showText ? '#4b5563' : 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
      };
    }
  };

  const getTextColor = () => {
    return isInWatchlist ? (showText ? '#ffffff' : '#000940') : '#f3f4f6';
  };

  return (
    <TouchableOpacity
      onPress={handleToggleWatchlist}
      disabled={loading}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          padding: padding,
          borderRadius: showText ? 8 : 20,
          gap: showText ? 4 : 0,
        },
        getButtonStyle(),
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : isInWatchlist ? (
        <Text style={{ color: getTextColor(), fontSize: iconSize }}>★</Text>
      ) : (
        <Text style={{ color: getTextColor(), fontSize: iconSize }}>☆</Text>
      )}
      {showText && (
        <Text style={{ color: getTextColor(), fontSize: size === 'small' ? 12 : 14 }}>
          {isInWatchlist ? 'În listă' : 'Urmărește'}
        </Text>
      )}
    </TouchableOpacity>
  );
};
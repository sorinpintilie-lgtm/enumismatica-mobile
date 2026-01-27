import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getOffersForSeller, acceptOffer, rejectOffer } from '../../shared/offerService';
import { createOrGetConversation } from '../../shared/chatService';
import { formatEUR } from '../utils/currency';
import type { Offer } from '../../shared/types';

interface OfferManagementProps {
  productId?: string;
  auctionId?: string;
  productName?: string;
  onClose: () => void;
  onNavigateToMessages?: (conversationId: string) => void;
}

export default function OfferManagement({
  productId,
  auctionId,
  productName,
  onClose,
  onNavigateToMessages,
}: OfferManagementProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingOffer, setProcessingOffer] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const loadOffers = async () => {
      try {
        setLoading(true);
        const sellerOffers = await getOffersForSeller(user.uid);
        
        // Filter offers for this specific item
        const filteredOffers = sellerOffers.filter(offer => {
          if (productId && offer.itemType === 'product') {
            return offer.itemId === productId;
          }
          if (auctionId && offer.itemType === 'auction') {
            return offer.itemId === auctionId;
          }
          return false;
        });

        setOffers(filteredOffers);
      } catch (error) {
        console.error('Failed to load offers:', error);
        showToast({ message: 'Nu s-au putut încărca ofertele.', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    loadOffers();
  }, [user?.uid, productId, auctionId]);

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setProcessingOffer(offerId);
      await acceptOffer(offerId);
      
      // Update local state
      setOffers(prev => prev.map(offer => 
        offer.id === offerId ? { ...offer, status: 'accepted' as const } : offer
      ));

      showToast({ message: 'Ai acceptat oferta cu succes.', type: 'success' });
    } catch (error) {
      console.error('Failed to accept offer:', error);
      showToast({ message: 'Nu s-a putut accepta oferta.', type: 'error' });
    } finally {
      setProcessingOffer(null);
    }
  };

  const handleRejectOffer = async (offerId: string) => {
    try {
      setProcessingOffer(offerId);
      await rejectOffer(offerId);
      
      // Update local state
      setOffers(prev => prev.map(offer => 
        offer.id === offerId ? { ...offer, status: 'rejected' as const } : offer
      ));

      showToast({ message: 'Ai respins oferta cu succes.', type: 'success' });
    } catch (error) {
      console.error('Failed to reject offer:', error);
      showToast({ message: 'Nu s-a putut respinge oferta.', type: 'error' });
    } finally {
      setProcessingOffer(null);
    }
  };

  const handleOpenConversation = async (offer: Offer) => {
    if (!user?.uid) return;

    try {
      const sellerId = user.uid;
      const buyerId = offer.buyerId;

      const conversationId = await createOrGetConversation(
        buyerId,
        sellerId,
        offer.itemType === "auction" ? offer.itemId : undefined,
        offer.itemType === "product" ? offer.itemId : undefined,
        false,
      );

      onClose();
      if (onNavigateToMessages) {
        onNavigateToMessages(conversationId);
      }
    } catch (error: any) {
      console.error("Failed to open conversation from offer:", error);
      showToast({
        message: error?.message || "Nu s-a putut deschide conversația cu cumpărătorul.",
        type: 'error'
      });
    }
  };

  const getStatusColor = (status: Offer['status']) => {
    switch (status) {
      case 'pending':
        return styles.statusPending;
      case 'accepted':
        return styles.statusAccepted;
      case 'rejected':
        return styles.statusRejected;
      case 'expired':
        return styles.statusExpired;
      default:
        return styles.statusDefault;
    }
  };

  const getStatusText = (status: Offer['status']) => {
    switch (status) {
      case 'pending':
        return 'În așteptare';
      case 'accepted':
        return 'Acceptată';
      case 'rejected':
        return 'Respinsă';
      case 'expired':
        return 'Expirată';
      default:
        return String(status || 'Necunoscut');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.modal}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Se încarcă ofertele...</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.modal}>
        <View style={styles.header}>
          <Text style={styles.title}>
            Oferte pentru {productName || 'piesa ta'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          {offers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Nu ai primit încă nicio ofertă</Text>
              <Text style={styles.emptyStateText}>
                Ofertele vor apărea aici când cumpărătorii vor fi interesați de piesa ta.
              </Text>
            </View>
          ) : (
            <View style={styles.offersList}>
              {offers.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={styles.offerHeader}>
                    <View>
                      <Text style={styles.offerAmount}>
                        {formatEUR(offer.offerAmount)}
                      </Text>
                      <Text style={styles.offerDate}>
                        Ofertă din {offer.createdAt.toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, getStatusColor(offer.status)]}>
                      <Text style={styles.statusText}>{getStatusText(offer.status)}</Text>
                    </View>
                  </View>

                  {offer.message && (
                    <View style={styles.messageContainer}>
                      <Text style={styles.messageLabel}>Mesaj: </Text>
                      <Text style={styles.messageText}>{offer.message}</Text>
                    </View>
                  )}

                  <View style={styles.offerFooter}>
                    <View style={styles.offerInfo}>
                      {offer.expiresAt && (
                        <Text style={styles.expiryText}>
                          Expiră: {offer.expiresAt.toLocaleDateString()}
                        </Text>
                      )}
                      <TouchableOpacity onPress={() => handleOpenConversation(offer)}>
                        <Text style={styles.conversationLink}>
                          Deschide conversația cu cumpărătorul
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {offer.status === "pending" && (
                      <View style={styles.actionButtons}>
                        <TouchableOpacity
                          onPress={() => handleRejectOffer(offer.id)}
                          disabled={processingOffer === offer.id}
                          style={[styles.button, styles.rejectButton, processingOffer === offer.id && styles.buttonDisabled]}
                        >
                          <Text style={styles.buttonText}>
                            {processingOffer === offer.id ? "Se procesează..." : "Respinge"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleAcceptOffer(offer.id)}
                          disabled={processingOffer === offer.id}
                          style={[styles.button, styles.acceptButton, processingOffer === offer.id && styles.buttonDisabled]}
                        >
                          <Text style={styles.buttonText}>
                            {processingOffer === offer.id ? "Se procesează..." : "Acceptă"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.closeFooterButton}>
            <Text style={styles.closeFooterButtonText}>Închide</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: '#1a2332',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    overflow: 'hidden',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#cbd5e1',
    marginLeft: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.2)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#94a3b8',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  offersList: {
    gap: 16,
  },
  offerCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    padding: 16,
    marginBottom: 16,
  },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  offerAmount: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  offerDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusPending: {
    backgroundColor: 'rgba(202, 138, 4, 0.4)',
    borderColor: 'rgba(234, 179, 8, 0.5)',
  },
  statusAccepted: {
    backgroundColor: 'rgba(5, 150, 105, 0.4)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  statusRejected: {
    backgroundColor: 'rgba(185, 28, 28, 0.4)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  statusExpired: {
    backgroundColor: 'rgba(55, 65, 81, 0.4)',
    borderColor: 'rgba(107, 114, 128, 0.5)',
  },
  statusDefault: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderColor: 'rgba(100, 116, 139, 0.5)',
  },
  messageContainer: {
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
  },
  messageText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  offerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  offerInfo: {
    flex: 1,
  },
  expiryText: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  conversationLink: {
    fontSize: 12,
    color: '#D4AF37',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rejectButton: {
    backgroundColor: '#dc2626',
  },
  acceptButton: {
    backgroundColor: '#059669',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212, 175, 55, 0.2)',
  },
  closeFooterButton: {
    backgroundColor: '#334155',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

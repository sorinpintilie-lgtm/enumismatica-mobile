import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';
import InlineBackButton from '../components/InlineBackButton';
import { colors } from '../styles/sharedStyles';
import { useAuth } from '../context/AuthContext';
import { getUserCredits } from '@shared/creditService';
import { getNetopiaPaymentStatus, initNetopiaCreditPayment, NetopiaPaymentStatus } from '@shared/paymentService';

const PRESET_RON_AMOUNTS = [20, 50, 100, 200];

const BuyCreditsScreen: React.FC = () => {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);
  const [lastStatus, setLastStatus] = useState<NetopiaPaymentStatus | null>(null);

  const estimatedCredits = useMemo(() => selectedAmount, [selectedAmount]);

  const refreshCredits = useCallback(async () => {
    if (!user?.uid) return;
    const credits = await getUserCredits(user.uid);
    setCurrentCredits(credits);
  }, [user?.uid]);

  React.useEffect(() => {
    refreshCredits().catch((err) => {
      console.warn('[BuyCreditsScreen] Failed to fetch credits:', err);
    });
  }, [refreshCredits]);

  const handleStartPayment = async () => {
    if (!Number.isFinite(selectedAmount) || selectedAmount <= 0) {
      Alert.alert('Sumă invalidă', 'Introdu o sumă mai mare decât 0 RON.');
      return;
    }

    try {
      setProcessing(true);
      const init = await initNetopiaCreditPayment(selectedAmount);
      setLastPaymentId(init.paymentId);
      setLastStatus(null);

      const canOpen = await Linking.canOpenURL(init.paymentUrl);
      if (!canOpen) {
        throw new Error('Nu s-a putut deschide pagina de plată.');
      }

      await Linking.openURL(init.paymentUrl);
      Alert.alert(
        'Plată inițiată',
        'Fereastra de plată a fost deschisă. După finalizare, revino în aplicație și apasă "Verifică plata".',
      );
    } catch (err: any) {
      Alert.alert('Eroare plată', err?.message || 'Nu s-a putut iniția plata Netopia.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!lastPaymentId) {
      Alert.alert('Informație', 'Nu există o plată inițiată recent.');
      return;
    }

    try {
      setCheckingStatus(true);
      const status = await getNetopiaPaymentStatus(lastPaymentId);
      setLastStatus(status);

      if (status.status === 'paid') {
        await refreshCredits();
        Alert.alert('Succes', `Plata a fost confirmată. S-au adăugat ${status.creditsAdded} credite.`);
      } else if (status.status === 'failed' || status.status === 'cancelled') {
        Alert.alert('Plată nefinalizată', `Status actual: ${status.status}.`);
      } else {
        Alert.alert('În procesare', 'Plata este încă în procesare. Reîncearcă în câteva secunde.');
      }
    } catch (err: any) {
      Alert.alert('Eroare', err?.message || 'Nu s-a putut verifica statusul plății.');
    } finally {
      setCheckingStatus(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <InlineBackButton />

      <Text style={styles.title}>Cumpărare credite</Text>
      <Text style={styles.subtitle}>Creditele sunt folosite pentru promovări, listări și licitații.</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Cum funcționează creditele</Text>
        <Text style={styles.infoLine}>• 1 RON = 1 credit</Text>
        <Text style={styles.infoLine}>• Creditele sunt adăugate după confirmarea plății</Text>
        <Text style={styles.infoLine}>• Pot fi folosite pentru boost, promovare și publicare</Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Sold curent</Text>
        <Text style={styles.balanceValue}>{currentCredits === null ? '—' : `${currentCredits} credite`}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alege suma (RON)</Text>
        <View style={styles.amountGrid}>
          {PRESET_RON_AMOUNTS.map((amount) => {
            const selected = selectedAmount === amount;
            return (
              <TouchableOpacity
                key={amount}
                style={[styles.amountButton, selected && styles.amountButtonSelected]}
                onPress={() => {
                  setSelectedAmount(amount);
                  setCustomAmount('');
                }}
              >
                <Text style={[styles.amountText, selected && styles.amountTextSelected]}>{amount} RON</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 14, marginBottom: 8 }]}>Sau introdu sumă personalizată</Text>
        <TextInput
          style={styles.customInput}
          placeholder="Ex: 75"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          value={customAmount}
          onChangeText={(text) => {
            const cleaned = text.replace(/[^0-9]/g, '');
            setCustomAmount(cleaned);
            const value = Number(cleaned || 0);
            if (value > 0) {
              setSelectedAmount(value);
            }
          }}
        />
        <Text style={styles.estimateText}>Primești {estimatedCredits} credite (1 RON / credit).</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} disabled={processing} onPress={handleStartPayment}>
        {processing ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.primaryButtonText}>Plătește cu Netopia</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} disabled={checkingStatus} onPress={handleCheckPayment}>
        {checkingStatus ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryButtonText}>Verifică plata</Text>}
      </TouchableOpacity>

      {lastStatus ? (
        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>Ultima tranzacție</Text>
          <Text style={styles.statusLine}>Status: {lastStatus.status}</Text>
          <Text style={styles.statusLine}>Sumă: {lastStatus.ronAmount} RON</Text>
          <Text style={styles.statusLine}>Credite: {lastStatus.creditsAdded}</Text>
          <Text style={styles.statusLine}>Ref: {lastStatus.paymentReference}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 96,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoCard: {
    borderWidth: 1,
    borderColor: 'rgba(231, 183, 60, 0.35)',
    backgroundColor: 'rgba(231, 183, 60, 0.08)',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoLine: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  balanceCard: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
  },
  balanceLabel: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  balanceValue: {
    color: colors.primary,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  amountGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  amountButton: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  amountButtonSelected: {
    backgroundColor: colors.primary,
  },
  amountText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  amountTextSelected: {
    color: colors.primaryText,
  },
  estimateText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 12,
  },
  customInput: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '700',
  },
  statusCard: {
    borderWidth: 1,
    borderColor: colors.borderColor,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  statusTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: 8,
  },
  statusLine: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});

export default BuyCreditsScreen;


import { useState, useEffect, useMemo } from 'react';

// Romanian coin data structure (matches products.json structure on web)
interface RomanianCoin {
  id: number;
  face_value: string;
  issue_year: string;
  diameter: string;
  weight: string;
  metal: string;
  mint_or_theme: string;
  era: string;
}

// Small in-app fallback dataset so the assistant still has selectable values
// even if fetching products.json fails.
const FALLBACK_COINS: RomanianCoin[] = [
  {
    id: 1,
    face_value: '1 Leu',
    issue_year: '2005',
    diameter: '23 mm',
    weight: '4.2 g',
    metal: 'Cupru-Nichel',
    mint_or_theme: 'România',
    era: 'Republica Română',
  },
  {
    id: 2,
    face_value: '50 Bani',
    issue_year: '2005',
    diameter: '23.75 mm',
    weight: '6.1 g',
    metal: 'Alamă',
    mint_or_theme: 'România',
    era: 'Republica Română',
  },
];

export function useCoinAutocomplete() {
  const [selectedDenomination, setSelectedDenomination] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMint, setSelectedMint] = useState('');
  const [coinsData, setCoinsData] = useState<RomanianCoin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCoinsData = async () => {
      try {
        const baseUrl = process.env.EXPO_PUBLIC_SITE_URL || 'https://enumismatica.ro';
        const response = await fetch(`${baseUrl}/products.json`);
        if (!response.ok) {
          throw new Error(`Failed to fetch products.json: ${response.status}`);
        }
        const data: RomanianCoin[] = await response.json();
        setCoinsData(data);
      } catch (error) {
        console.error('Failed to fetch coins data for autocomplete:', error);
        // Fallback to small built-in dataset so assistant is still usable
        setCoinsData(FALLBACK_COINS);
      } finally {
        setLoading(false);
      }
    };

    fetchCoinsData();
  }, []);

  const availableDenominations = useMemo(() => {
    if (loading) return [];
    const denominations = [...new Set(coinsData.map((coin) => coin.face_value))];
    return denominations.sort();
  }, [coinsData, loading]);

  const availableYears = useMemo(() => {
    if (!selectedDenomination || loading) return [];
    const years = coinsData
      .filter((coin) => coin.face_value === selectedDenomination)
      .map((coin) => coin.issue_year)
      .filter((year, index, arr) => arr.indexOf(year) === index)
      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    return years;
  }, [selectedDenomination, coinsData, loading]);

  const availableMints = useMemo(() => {
    if (!selectedDenomination || !selectedYear || loading) return [];
    const mints = coinsData
      .filter(
        (coin) =>
          coin.face_value === selectedDenomination && coin.issue_year === selectedYear,
      )
      .map((coin) => coin.mint_or_theme)
      .filter((mint, index, arr) => arr.indexOf(mint) === index && mint)
      .sort();
    return mints;
  }, [selectedDenomination, selectedYear, coinsData, loading]);

  const matchedCoin = useMemo(() => {
    if (!selectedDenomination || !selectedYear || !selectedMint || loading) return null;
    return (
      coinsData.find(
        (coin) =>
          coin.face_value === selectedDenomination &&
          coin.issue_year === selectedYear &&
          coin.mint_or_theme === selectedMint,
      ) || null
    );
  }, [selectedDenomination, selectedYear, selectedMint, coinsData, loading]);

  const reset = () => {
    setSelectedDenomination('');
    setSelectedYear('');
    setSelectedMint('');
  };

  useEffect(() => {
    if (selectedDenomination && !availableYears.includes(selectedYear)) {
      setSelectedYear('');
      setSelectedMint('');
    }
  }, [selectedDenomination, availableYears, selectedYear]);

  useEffect(() => {
    if (selectedYear && !availableMints.includes(selectedMint)) {
      setSelectedMint('');
    }
  }, [selectedYear, availableMints, selectedMint]);

  return {
    selectedDenomination,
    setSelectedDenomination,
    selectedYear,
    setSelectedYear,
    selectedMint,
    setSelectedMint,
    matchedCoin,
    availableDenominations,
    availableYears,
    availableMints,
    reset,
    loading,
  };
}

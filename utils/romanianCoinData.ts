import productsData from '../../data/products.json';

// Extract unique values for each filter from the products data
export const romanianCoinOptions = {
  faceValues: ['Toate Valorile', ...new Set(productsData.map((item: any) => item.face_value))],
  issueYears: ['Toți Anii', ...new Set(productsData.map((item: any) => item.issue_year))],
  diameters: ['Toate Diametrele', ...new Set(productsData.map((item: any) => item.diameter))],
  weights: ['Toate Greutățile', ...new Set(productsData.map((item: any) => item.weight))],
  mints: ['Toate Monetăriile', ...new Set(productsData.map((item: any) => item.mint_or_theme))],
  eras: ['Toate Epocile', ...new Set(productsData.map((item: any) => item.era))],
};

export type RomanianCoinFilters = {
  faceValue: string;
  issueYear: string;
  diameter: string;
  weight: string;
  mint: string;
  era: string;
};

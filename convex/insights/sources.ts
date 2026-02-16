// Curated market data sources by region
// These are high-quality sources that work well with Jina Reader

export interface MarketSource {
  name: string;
  url: string;
  categories: Array<'home_prices' | 'inventory' | 'mortgage_rates' | 'market_trend' | 'new_construction' | 'rental'>;
  national?: boolean; // If true, applies to all regions
}

// Canadian national sources (mortgage rates, national trends)
export const NATIONAL_SOURCES: MarketSource[] = [
  {
    name: 'Bank of Canada Interest Rates',
    url: 'https://www.bankofcanada.ca/core-functions/monetary-policy/key-interest-rate/',
    categories: ['mortgage_rates'],
    national: true,
  },
  {
    name: 'Realtor.ca Market News',
    url: 'https://www.realtor.ca/news/',
    categories: ['market_trend', 'home_prices'],
    national: true,
  },
  {
    name: 'CREA Market Analysis',
    url: 'https://www.crea.ca/housing-market-stats/',
    categories: ['market_trend', 'home_prices'],
    national: true,
  },
  {
    name: 'Better Dwelling',
    url: 'https://betterdwelling.com/',
    categories: ['market_trend', 'home_prices', 'mortgage_rates'],
    national: true,
  },
  {
    name: 'Ratehub Mortgage Rates',
    url: 'https://www.ratehub.ca/mortgage-rates',
    categories: ['mortgage_rates'],
    national: true,
  },
];

// British Columbia city-specific sources
export const CITY_SOURCES: Record<string, MarketSource[]> = {
  // Lower Mainland
  'vancouver-bc-ca': [
    {
      name: 'Realtor.ca Vancouver',
      url: 'https://www.realtor.ca/vancouver-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Vancouver Real Estate Board Stats',
      url: 'https://www.rebgv.org/market-watch',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Vancouver',
      url: 'https://www.zoocasa.com/vancouver-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
    {
      name: 'Royal LePage Vancouver',
      url: 'https://www.royallepage.ca/en/bc/vancouver/real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'surrey-bc-ca': [
    {
      name: 'Realtor.ca Surrey',
      url: 'https://www.realtor.ca/surrey-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Surrey Real Estate Board',
      url: 'https://www.rebgv.org/market-watch',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Surrey',
      url: 'https://www.zoocasa.com/surrey-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'burnaby-bc-ca': [
    {
      name: 'Realtor.ca Burnaby',
      url: 'https://www.realtor.ca/burnaby-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Burnaby',
      url: 'https://www.zoocasa.com/burnaby-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'richmond-bc-ca': [
    {
      name: 'Realtor.ca Richmond',
      url: 'https://www.realtor.ca/richmond-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Richmond',
      url: 'https://www.zoocasa.com/richmond-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'coquitlam-bc-ca': [
    {
      name: 'Realtor.ca Coquitlam',
      url: 'https://www.realtor.ca/coquitlam-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Coquitlam',
      url: 'https://www.zoocasa.com/coquitlam-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'langley-bc-ca': [
    {
      name: 'Realtor.ca Langley',
      url: 'https://www.realtor.ca/langley-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Langley',
      url: 'https://www.zoocasa.com/langley-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'abbotsford-bc-ca': [
    {
      name: 'Realtor.ca Abbotsford',
      url: 'https://www.realtor.ca/abbotsford-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Fraser Valley Real Estate Board',
      url: 'https://fvrebgv.stats.showingtime.com/infosparks/',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
  ],
  // Vancouver Island
  'victoria-bc-ca': [
    {
      name: 'Realtor.ca Victoria',
      url: 'https://www.realtor.ca/victoria-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Victoria Real Estate Board',
      url: 'https://vreb.org/market-statistics/',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Victoria',
      url: 'https://www.zoocasa.com/victoria-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  'saanich-bc-ca': [
    {
      name: 'Realtor.ca Saanich',
      url: 'https://www.realtor.ca/saanich-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Saanich',
      url: 'https://www.zoocasa.com/saanich-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
  // Interior
  'kelowna-bc-ca': [
    {
      name: 'Realtor.ca Kelowna',
      url: 'https://www.realtor.ca/kelowna-bc',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Okanagan Mainline Real Estate Board',
      url: 'https://omreb.com/market-statistics/',
      categories: ['home_prices', 'inventory', 'market_trend'],
    },
    {
      name: 'Zoocasa Kelowna',
      url: 'https://www.zoocasa.com/kelowna-bc-real-estate/',
      categories: ['home_prices', 'market_trend'],
    },
  ],
};

// Helper to get sources for a region
export function getSourcesForRegion(city: string, state?: string, country: string = 'CA'): MarketSource[] {
  const province = state || 'bc';
  const key = `${city.toLowerCase().replace(/\s+/g, '-')}-${province.toLowerCase()}-${country.toLowerCase()}`;
  const citySpecific = CITY_SOURCES[key] || [];
  
  return [...NATIONAL_SOURCES, ...citySpecific];
}

// Helper to get all unique region keys that have sources
export function getSupportedRegions(): Array<{ city: string; state?: string; country: string; key: string }> {
  return Object.keys(CITY_SOURCES).map(key => {
    const parts = key.split('-');
    const country = parts.pop() || 'ca';
    const province = parts.pop() || 'bc';
    const city = parts.join('-');
    
    return {
      city: city.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      state: province.toUpperCase(),
      country: country.toUpperCase(),
      key,
    };
  });
}

// Check if we have sources for a region
export function hasSourcesForRegion(city: string, state?: string, country: string = 'CA'): boolean {
  const province = state || 'bc';
  const key = `${city.toLowerCase().replace(/\s+/g, '-')}-${province.toLowerCase()}-${country.toLowerCase()}`;
  return key in CITY_SOURCES || NATIONAL_SOURCES.length > 0;
}

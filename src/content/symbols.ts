import type { Ticker } from '@/lib/symbolSearch';
import type { Localized, MaybeLocalized, TrustLabel } from './types';

export type SymbolNews = {
  label: Extract<TrustLabel, 'fact' | 'analysis' | 'communityOpinion' | 'sponsored'>;
  source: string;
  time: string;
  title: Localized;
};

export type SymbolData = {
  ticker: Ticker;
  type: Localized;
  name: Localized;
  price: string;
  change: string;
  up: boolean;
  why: Localized;
  tech: Localized;
  event: Localized;
  facts: Array<{ k: Localized; v: MaybeLocalized }>;
  news: SymbolNews[];
  related: Ticker[];
};

/**
 * Demo market data from the design prototype. Figures are illustrative and frozen —
 * they exist to show the shape of the screen, not to be traded on.
 */
export const SYMBOLS: Record<Ticker, SymbolData> = {
  TSLA: {
    ticker: 'TSLA',
    type: { en: 'Stock · NASDAQ', ru: 'Акция · NASDAQ' },
    name: { en: 'Tesla', ru: 'Tesla' },
    price: '$317.42',
    change: '+2.9%',
    up: true,
    why: {
      en: 'Shares climbed after Q2 deliveries beat consensus by 4% and management confirmed the launch window for the next mass-market model. Analysts at two banks raised price targets this morning.',
      ru: 'Акции выросли после того, как поставки за второй квартал превысили консенсус на 4%, а руководство подтвердило сроки запуска следующей массовой модели. Аналитики двух банков этим утром повысили целевые цены.',
    },
    tech: {
      en: 'Trading above its 50-day average with rising volume. RSI at 63 — momentum is positive but not yet overheated. Nearest resistance around $330.',
      ru: 'Торгуется выше 50-дневной средней на растущем объёме. RSI 63 — импульс положительный, но до перегрева ещё далеко. Ближайшее сопротивление около $330.',
    },
    event: {
      en: 'Q2 earnings call — Tuesday, Aug 4, after US market close. Consensus EPS $0.92.',
      ru: 'Отчёт за второй квартал — вторник, 4 августа, после закрытия рынка США. Консенсус EPS $0,92.',
    },
    facts: [
      { k: { en: 'Market cap', ru: 'Капитализация' }, v: '$1.01T' },
      { k: { en: 'P/E (TTM)', ru: 'P/E (TTM)' }, v: '68.4' },
      { k: { en: '52-week range', ru: 'Диапазон за 52 недели' }, v: '$182–$389' },
      {
        k: { en: 'Sector', ru: 'Сектор' },
        v: { en: 'Consumer discretionary', ru: 'Потребительские товары второй необходимости' },
      },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:12',
        title: {
          en: 'Tesla Q2 deliveries beat estimates at 462,000 vehicles',
          ru: 'Поставки Tesla за второй квартал превзошли прогнозы — 462 000 автомобилей',
        },
      },
      {
        label: 'analysis',
        source: 'Barron’s',
        time: '08:40',
        title: {
          en: 'Why the next model matters more than this quarter',
          ru: 'Почему следующая модель важнее, чем текущий квартал',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:55',
        title: {
          en: 'TSLA breakout thesis: the range is resolving upward',
          ru: 'Тезис по TSLA: диапазон разрешается вверх',
        },
      },
    ],
    related: ['NVDA', 'SPX', 'BTC'],
  },

  SPX: {
    ticker: 'SPX',
    type: { en: 'Index', ru: 'Индекс' },
    name: { en: 'S&P 500', ru: 'S&P 500' },
    price: '6,412.8',
    change: '+0.4%',
    up: true,
    why: {
      en: 'The index edges higher as mega-cap earnings continue to beat and traders position ahead of Thursday’s CPI release. Breadth is narrow — 6 stocks account for most of the gain.',
      ru: 'Индекс подрастает: отчётности мегакапов продолжают выходить лучше прогнозов, а трейдеры занимают позиции перед публикацией CPI в четверг. Ширина роста узкая — на 6 акций приходится большая часть подъёма.',
    },
    tech: {
      en: 'Grinding along all-time highs. 14-day volatility is near its yearly low, which historically precedes larger moves.',
      ru: 'Медленно идёт вдоль исторических максимумов. 14-дневная волатильность у годового минимума, а это исторически предшествует более крупным движениям.',
    },
    event: {
      en: 'US CPI release — Thursday 12:30 UTC. Consensus 2.6% YoY.',
      ru: 'Публикация CPI США — четверг, 12:30 UTC. Консенсус 2,6% г/г.',
    },
    facts: [
      { k: { en: 'YTD return', ru: 'Доходность с начала года' }, v: '+11.2%' },
      { k: { en: 'P/E (fwd)', ru: 'P/E (прогнозный)' }, v: '22.1' },
      { k: { en: 'Dividend yield', ru: 'Дивидендная доходность' }, v: '1.3%' },
      { k: { en: 'Constituents', ru: 'Число компаний' }, v: '503' },
    ],
    news: [
      {
        label: 'fact',
        source: 'Bloomberg',
        time: '09:05',
        title: {
          en: 'S&P 500 futures rise ahead of inflation data',
          ru: 'Фьючерсы на S&P 500 растут перед данными по инфляции',
        },
      },
      {
        label: 'analysis',
        source: 'FT',
        time: '08:20',
        title: {
          en: 'Narrow breadth: should index investors worry?',
          ru: 'Узкая ширина рынка: стоит ли беспокоиться индексным инвесторам?',
        },
      },
      {
        label: 'sponsored',
        source: 'Partner',
        time: '08:00',
        title: {
          en: 'Five ETFs for broad US exposure',
          ru: 'Пять ETF для широкой экспозиции на рынок США',
        },
      },
    ],
    related: ['NVDA', 'TSLA', 'GOLD'],
  },

  BTC: {
    ticker: 'BTC',
    type: { en: 'Crypto', ru: 'Криптовалюта' },
    name: { en: 'Bitcoin', ru: 'Bitcoin' },
    price: '$118,240',
    change: '−1.2%',
    up: false,
    why: {
      en: 'Bitcoin pulls back as ETF inflows slowed for a third day and a large wallet moved 8,000 BTC to an exchange. The move stays inside the two-week consolidation range.',
      ru: 'Bitcoin откатывается: приток средств в ETF замедляется третий день подряд, а крупный кошелёк перевёл 8 000 BTC на биржу. Движение остаётся внутри двухнедельного диапазона консолидации.',
    },
    tech: {
      en: 'Holding above the 100-day average. Support at $114k has been tested twice this month and held both times.',
      ru: 'Держится выше 100-дневной средней. Поддержку на $114k в этом месяце тестировали дважды — оба раза она устояла.',
    },
    event: {
      en: 'US spot-ETF monthly flow report — Friday.',
      ru: 'Месячный отчёт о потоках в спотовые ETF США — пятница.',
    },
    facts: [
      { k: { en: 'Market cap', ru: 'Капитализация' }, v: '$2.33T' },
      { k: { en: '24h volume', ru: 'Объём за 24 ч' }, v: '$41B' },
      { k: { en: 'Circulating supply', ru: 'Оборотное предложение' }, v: '19.9M BTC' },
      { k: { en: 'All-time high', ru: 'Исторический максимум' }, v: '$126,900' },
    ],
    news: [
      {
        label: 'fact',
        source: 'CoinDesk',
        time: '09:30',
        title: {
          en: 'Bitcoin slips as ETF inflows cool',
          ru: 'Bitcoin снижается на фоне остывающих притоков в ETF',
        },
      },
      {
        label: 'analysis',
        source: 'The Block',
        time: '08:10',
        title: {
          en: 'What on-chain data says about the current range',
          ru: 'Что ончейн-данные говорят о текущем диапазоне',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:20',
        title: {
          en: 'BTC: waiting for the range break',
          ru: 'BTC: ждём выхода из диапазона',
        },
      },
    ],
    related: ['GOLD', 'SPX', 'NVDA'],
  },

  GOLD: {
    ticker: 'GOLD',
    type: { en: 'Commodity', ru: 'Сырьевой товар' },
    name: { en: 'Gold', ru: 'Золото' },
    price: '$2,986',
    change: '+0.8%',
    up: true,
    why: {
      en: 'Gold rises as real yields drift lower ahead of the CPI print and two central banks reported adding to reserves in June. A weaker dollar adds support.',
      ru: 'Золото растёт: реальные доходности снижаются перед публикацией CPI, а два центробанка отчитались о пополнении резервов в июне. Ослабление доллара добавляет поддержки.',
    },
    tech: {
      en: 'Third consecutive week above $2,900. Momentum steady; the metal tends to move sharply around inflation releases.',
      ru: 'Третью неделю подряд выше $2 900. Импульс ровный; металл обычно резко реагирует на публикации по инфляции.',
    },
    event: {
      en: 'US CPI release — Thursday 12:30 UTC.',
      ru: 'Публикация CPI США — четверг, 12:30 UTC.',
    },
    facts: [
      { k: { en: 'YTD return', ru: 'Доходность с начала года' }, v: '+13.6%' },
      { k: { en: '52-week range', ru: 'Диапазон за 52 недели' }, v: '$2,310–$3,041' },
      { k: { en: 'Correlation to SPX', ru: 'Корреляция с SPX' }, v: '−0.12' },
      { k: { en: 'Unit', ru: 'Единица' }, v: 'USD / troy oz' },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:20',
        title: {
          en: 'Gold gains as yields ease before CPI',
          ru: 'Золото прибавляет на фоне снижения доходностей перед CPI',
        },
      },
      {
        label: 'analysis',
        source: 'WSJ',
        time: '08:35',
        title: {
          en: 'Central-bank buying: the quiet driver of the gold bid',
          ru: 'Покупки центробанков: тихий драйвер спроса на золото',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:40',
        title: {
          en: 'Gold vs bonds as an inflation hedge',
          ru: 'Золото против облигаций как защита от инфляции',
        },
      },
    ],
    related: ['SPX', 'BTC', 'TSLA'],
  },

  NVDA: {
    ticker: 'NVDA',
    type: { en: 'Stock · NASDAQ', ru: 'Акция · NASDAQ' },
    name: { en: 'NVIDIA', ru: 'NVIDIA' },
    price: '$172.10',
    change: '+1.6%',
    up: true,
    why: {
      en: 'NVIDIA advances after a major cloud provider raised its capex guidance, reinforcing demand visibility for AI accelerators into 2027.',
      ru: 'NVIDIA растёт после того, как крупный облачный провайдер повысил прогноз капитальных затрат, — это укрепляет видимость спроса на AI-ускорители вплоть до 2027 года.',
    },
    tech: {
      en: 'Uptrend intact above the 20-day average. RSI 68 — approaching overbought territory.',
      ru: 'Восходящий тренд не нарушен, цена выше 20-дневной средней. RSI 68 — подходит к зоне перекупленности.',
    },
    event: {
      en: 'Q2 earnings — Wednesday, Aug 27, after close.',
      ru: 'Отчёт за второй квартал — среда, 27 августа, после закрытия.',
    },
    facts: [
      { k: { en: 'Market cap', ru: 'Капитализация' }, v: '$4.2T' },
      { k: { en: 'P/E (TTM)', ru: 'P/E (TTM)' }, v: '54.2' },
      { k: { en: '52-week range', ru: 'Диапазон за 52 недели' }, v: '$98–$181' },
      {
        k: { en: 'Sector', ru: 'Сектор' },
        v: { en: 'Information technology', ru: 'Информационные технологии' },
      },
    ],
    news: [
      {
        label: 'fact',
        source: 'Reuters',
        time: '09:00',
        title: {
          en: 'Cloud capex guidance lifts chip stocks',
          ru: 'Прогноз по капзатратам облачных компаний поднимает акции чипмейкеров',
        },
      },
      {
        label: 'analysis',
        source: 'Semafor',
        time: '08:15',
        title: {
          en: 'How long can AI infrastructure spending grow?',
          ru: 'Как долго могут расти расходы на AI-инфраструктуру?',
        },
      },
      {
        label: 'communityOpinion',
        source: 'TradingNew Ideas',
        time: '07:30',
        title: {
          en: 'NVDA: riding the trend with a defined invalidation',
          ru: 'NVDA: идём по тренду с чётким уровнем отмены идеи',
        },
      },
    ],
    related: ['TSLA', 'SPX', 'BTC'],
  },
};

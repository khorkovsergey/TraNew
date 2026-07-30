import type { Ticker } from '@/lib/symbolSearch';
import type { Localized, TrustLabel } from './types';

export type NewsItem = {
  id: string;
  label: Extract<TrustLabel, 'fact' | 'analysis' | 'communityOpinion' | 'sponsored'>;
  source: string;
  time: Localized;
  title: Localized;
  summary: Localized;
  /** The line that separates this portal from a wire feed. */
  whyItMatters: Localized;
  related: Ticker[];
};

export const NEWS_TABS = [
  { id: 'foryou', label: { en: 'For you', ru: 'Для вас' } },
  { id: 'top', label: { en: 'Top stories', ru: 'Главное' } },
  { id: 'markets', label: { en: 'Markets', ru: 'Рынки' } },
  { id: 'economy', label: { en: 'Economy', ru: 'Экономика' } },
  { id: 'stocks', label: { en: 'Stocks', ru: 'Акции' } },
  { id: 'crypto', label: { en: 'Crypto', ru: 'Криптовалюты' } },
  { id: 'earnings', label: { en: 'Earnings', ru: 'Отчётности' } },
  { id: 'watchlist', label: { en: 'My watchlist', ru: 'Мой список' } },
];

export const NEWS: NewsItem[] = [
  {
    id: 'cpi',
    label: 'fact',
    source: 'Reuters',
    time: { en: '09:12', ru: '09:12' },
    title: {
      en: 'US inflation cools to 2.6% ahead of Thursday release',
      ru: 'Инфляция в США замедлилась до 2,6% перед публикацией в четверг',
    },
    summary: {
      en: 'Consensus now sits at 2.6% year on year, down from 2.9% in the previous print. Core services remain the stickiest component.',
      ru: 'Консенсус сейчас 2,6% год к году против 2,9% в предыдущей публикации. Самой инертной составляющей остаются базовые услуги.',
    },
    whyItMatters: {
      en: 'Rate expectations drive almost everything else this week. A softer number supports long-duration bonds and rate-sensitive equities; a hotter one does the opposite.',
      ru: 'На этой неделе ожидания по ставкам двигают почти всё остальное. Более мягкая цифра поддержит длинные облигации и чувствительные к ставкам акции, более жёсткая — наоборот.',
    },
    related: ['SPX', 'GOLD'],
  },
  {
    id: 'tesla',
    label: 'fact',
    source: 'Reuters',
    time: { en: '09:12', ru: '09:12' },
    title: {
      en: 'Tesla Q2 deliveries beat estimates at 462,000 vehicles',
      ru: 'Поставки Tesla за второй квартал превзошли прогнозы — 462 000 автомобилей',
    },
    summary: {
      en: 'Deliveries came in 4% above consensus. Management confirmed the launch window for the next mass-market model.',
      ru: 'Поставки оказались на 4% выше консенсуса. Руководство подтвердило сроки запуска следующей массовой модели.',
    },
    whyItMatters: {
      en: 'Deliveries are the number the market prices Tesla on. A beat resets near-term expectations, but the next model matters more for the multi-year case.',
      ru: 'Поставки — та цифра, по которой рынок оценивает Tesla. Превышение сбрасывает краткосрочные ожидания, но для многолетнего сценария важнее следующая модель.',
    },
    related: ['TSLA'],
  },
  {
    id: 'chips',
    label: 'analysis',
    source: 'Semafor',
    time: { en: '08:15', ru: '08:15' },
    title: {
      en: 'How long can AI infrastructure spending grow?',
      ru: 'Как долго могут расти расходы на AI-инфраструктуру?',
    },
    summary: {
      en: 'Cloud capex guidance keeps rising, but the customer base behind it is narrow — a handful of buyers account for most accelerator demand.',
      ru: 'Прогнозы по капзатратам облачных компаний продолжают расти, но клиентская база узкая: на несколько покупателей приходится большая часть спроса на ускорители.',
    },
    whyItMatters: {
      en: 'Concentration cuts both ways. The same handful of buyers that drove the rally can pause it, and their capex plans are published quarterly.',
      ru: 'Концентрация работает в обе стороны. Те же несколько покупателей, что подняли рынок, могут его и остановить, а их планы по капзатратам публикуются ежеквартально.',
    },
    related: ['NVDA', 'SPX'],
  },
  {
    id: 'btc',
    label: 'fact',
    source: 'CoinDesk',
    time: { en: '09:30', ru: '09:30' },
    title: {
      en: 'Bitcoin slips as ETF inflows cool',
      ru: 'Bitcoin снижается на фоне остывающих притоков в ETF',
    },
    summary: {
      en: 'A third consecutive day of slower inflows, plus a large wallet transfer to an exchange, pushed the price to the lower half of its two-week range.',
      ru: 'Третий день подряд замедления притоков и перевод крупного кошелька на биржу опустили цену в нижнюю половину двухнедельного диапазона.',
    },
    whyItMatters: {
      en: 'ETF flows have become the clearest read on institutional demand. The move stayed inside the existing range, so nothing structural has changed yet.',
      ru: 'Потоки в ETF стали самым понятным индикатором институционального спроса. Движение осталось внутри диапазона, так что структурно пока ничего не изменилось.',
    },
    related: ['BTC', 'GOLD'],
  },
  {
    id: 'gold',
    label: 'analysis',
    source: 'WSJ',
    time: { en: '08:35', ru: '08:35' },
    title: {
      en: 'Central-bank buying: the quiet driver of the gold bid',
      ru: 'Покупки центробанков: тихий драйвер спроса на золото',
    },
    summary: {
      en: 'Two more central banks reported adding to reserves in June, continuing a pattern that has run for several years.',
      ru: 'Ещё два центробанка отчитались о пополнении резервов в июне, продолжая тенденцию, которая длится уже несколько лет.',
    },
    whyItMatters: {
      en: 'Official-sector demand is slower and less price-sensitive than investor demand, which changes how gold behaves around inflation releases.',
      ru: 'Спрос официального сектора медленнее и менее чувствителен к цене, чем инвесторский, — это меняет поведение золота вокруг публикаций по инфляции.',
    },
    related: ['GOLD'],
  },
  {
    id: 'etfs',
    label: 'sponsored',
    source: 'Partner',
    time: { en: '08:00', ru: '08:00' },
    title: {
      en: 'Five ETFs for broad US exposure',
      ru: 'Пять ETF для широкой экспозиции на рынок США',
    },
    summary: {
      en: 'A partner overview of low-cost funds tracking the largest US indices.',
      ru: 'Обзор партнёра о фондах с низкими издержками, отслеживающих крупнейшие индексы США.',
    },
    whyItMatters: {
      en: 'Marked as sponsored because it is paid placement. Compare cost, domicile and tracking difference yourself before acting on any list.',
      ru: 'Помечено как реклама, потому что это оплаченное размещение. Сравнивайте издержки, домициль и ошибку слежения самостоятельно, прежде чем действовать по любому списку.',
    },
    related: ['SPX'],
  },
];

export const IDEA_TABS = [
  { id: 'editors', label: { en: "Editors' picks", ru: 'Выбор редакции' } },
  { id: 'foryou', label: { en: 'For you', ru: 'Для вас' } },
  { id: 'following', label: { en: 'Following', ru: 'Подписки' } },
  { id: 'popular', label: { en: 'Popular', ru: 'Популярное' } },
  { id: 'newest', label: { en: 'Newest', ru: 'Новые' } },
  { id: 'all', label: { en: 'All', ru: 'Все' } },
];

export type Idea = {
  id: string;
  author: string;
  time: Localized;
  ticker: Ticker;
  horizon: Localized;
  status: 'active' | 'invalidated';
  thesis: Localized;
  since: string;
  sinceUp: boolean;
  discloses: boolean;
};

export const IDEAS: Idea[] = [
  {
    id: 'tsla-breakout',
    author: 'm_ivanova',
    time: { en: '2h ago', ru: '2 ч назад' },
    ticker: 'TSLA',
    horizon: { en: 'Medium term', ru: 'Среднесрочно' },
    status: 'active',
    thesis: {
      en: 'The two-month range is resolving upward on rising volume. Invalidation is a close back below the range midpoint.',
      ru: 'Двухмесячный диапазон разрешается вверх на растущем объёме. Идея отменяется при закрытии обратно ниже середины диапазона.',
    },
    since: '+4.2%',
    sinceUp: true,
    discloses: true,
  },
  {
    id: 'btc-range',
    author: 'range_trader',
    time: { en: '5h ago', ru: '5 ч назад' },
    ticker: 'BTC',
    horizon: { en: 'Short term', ru: 'Краткосрочно' },
    status: 'active',
    thesis: {
      en: 'Waiting for a decisive break of the two-week consolidation before committing either way. Support at $114k has held twice.',
      ru: 'Жду решительного выхода из двухнедельной консолидации, прежде чем занимать сторону. Поддержка $114k устояла дважды.',
    },
    since: '−1.1%',
    sinceUp: false,
    discloses: false,
  },
  {
    id: 'gold-hedge',
    author: 'macro_notes',
    time: { en: '1d ago', ru: '1 д назад' },
    ticker: 'GOLD',
    horizon: { en: 'Long term', ru: 'Долгосрочно' },
    status: 'active',
    thesis: {
      en: 'Central-bank demand plus falling real yields keeps the structural case intact regardless of the next CPI print.',
      ru: 'Спрос центробанков и снижение реальных доходностей сохраняют структурный сценарий независимо от следующей публикации CPI.',
    },
    since: '+2.8%',
    sinceUp: true,
    discloses: true,
  },
  {
    id: 'nvda-trend',
    author: 'trend_follow',
    time: { en: '2d ago', ru: '2 д назад' },
    ticker: 'NVDA',
    horizon: { en: 'Medium term', ru: 'Среднесрочно' },
    status: 'invalidated',
    thesis: {
      en: 'Trend-following entry above the 20-day average. The stop level was hit intraday, so the idea is closed.',
      ru: 'Вход по тренду выше 20-дневной средней. Стоп был задет внутри дня, поэтому идея закрыта.',
    },
    since: '−3.4%',
    sinceUp: false,
    discloses: false,
  },
];

export type MarketMove = {
  ticker: Ticker;
  reason: Localized;
  source: string;
  time: Localized;
};

export const TOP_MOVES: MarketMove[] = [
  {
    ticker: 'TSLA',
    reason: {
      en: 'Q2 deliveries beat consensus by 4%; two banks raised price targets.',
      ru: 'Поставки за второй квартал превысили консенсус на 4%; два банка повысили целевые цены.',
    },
    source: 'Reuters',
    time: { en: '09:12', ru: '09:12' },
  },
  {
    ticker: 'NVDA',
    reason: {
      en: 'A major cloud provider raised capex guidance, extending demand visibility.',
      ru: 'Крупный облачный провайдер повысил прогноз капзатрат, продлив видимость спроса.',
    },
    source: 'Reuters',
    time: { en: '09:00', ru: '09:00' },
  },
  {
    ticker: 'BTC',
    reason: {
      en: 'ETF inflows slowed for a third day and a large wallet moved 8,000 BTC to an exchange.',
      ru: 'Притоки в ETF замедляются третий день, крупный кошелёк перевёл 8 000 BTC на биржу.',
    },
    source: 'CoinDesk',
    time: { en: '09:30', ru: '09:30' },
  },
];

export const MARKET_EVENTS: Array<{ title: Localized; when: Localized }> = [
  {
    title: { en: 'US CPI release', ru: 'Публикация CPI США' },
    when: { en: 'Thursday 12:30 UTC', ru: 'Четверг, 12:30 UTC' },
  },
  {
    title: { en: 'ECB rate decision', ru: 'Решение ЕЦБ по ставке' },
    when: { en: 'Friday 12:15 UTC', ru: 'Пятница, 12:15 UTC' },
  },
  {
    title: { en: 'Apple earnings', ru: 'Отчётность Apple' },
    when: { en: 'Thursday, after close', ru: 'Четверг, после закрытия' },
  },
  {
    title: { en: 'NVIDIA earnings', ru: 'Отчётность NVIDIA' },
    when: { en: 'Aug 27, after close', ru: '27 августа, после закрытия' },
  },
];

export const WATCH_NEXT: Localized[] = [
  { en: 'Core services inflation', ru: 'Инфляция в базовых услугах' },
  { en: 'Cloud capex guidance', ru: 'Прогнозы по капзатратам облачных компаний' },
  { en: 'ETF flow reports', ru: 'Отчёты о потоках в ETF' },
  { en: 'Real yields', ru: 'Реальные доходности' },
  { en: 'Index breadth', ru: 'Ширина рынка' },
];

export const ASSET_CLASSES: Localized[] = [
  { en: 'Indices', ru: 'Индексы' },
  { en: 'Stocks', ru: 'Акции' },
  { en: 'Crypto', ru: 'Криптовалюты' },
  { en: 'Forex', ru: 'Форекс' },
  { en: 'Bonds', ru: 'Облигации' },
  { en: 'ETFs', ru: 'ETF' },
  { en: 'Commodities', ru: 'Сырьевые товары' },
  { en: 'Futures', ru: 'Фьючерсы' },
];

export const EXPLORE_GOALS: Localized[] = [
  { en: 'Beat inflation', ru: 'Обогнать инфляцию' },
  { en: 'Generate income', ru: 'Получать доход' },
  { en: 'Grow long term', ru: 'Расти вдолгую' },
  { en: 'Reduce risk', ru: 'Снизить риск' },
  { en: 'Diversify', ru: 'Диверсифицировать' },
  { en: 'Follow a theme', ru: 'Следовать теме' },
];

import type { Localized } from './types';

export type DiagOption = {
  id: string;
  label: Localized;
  /** Only the first question's options carry a description card. */
  desc?: Localized;
};

export type DiagQuestion = {
  id: string;
  title: Localized;
  sub?: Localized;
  multi: boolean;
  max?: number;
  options: DiagOption[];
};

export const DIAGNOSTIC: DiagQuestion[] = [
  {
    id: 'level',
    title: {
      en: 'How familiar are you with investing?',
      ru: 'Насколько вы знакомы с инвестициями?',
    },
    multi: false,
    options: [
      {
        id: 'new',
        label: { en: "I'm completely new", ru: 'Я совсем новичок' },
        desc: {
          en: "I don't yet understand assets, markets or investing terminology.",
          ru: 'Пока не разбираюсь в активах, рынках и инвестиционной терминологии.',
        },
      },
      {
        id: 'basics',
        label: { en: 'I know a few basics', ru: 'Знаю основы' },
        desc: {
          en: "I've heard about stocks, bonds or ETFs, but I'm not confident yet.",
          ru: 'Слышал(а) об акциях, облигациях или ETF, но уверенности пока нет.',
        },
      },
      {
        id: 'tried',
        label: { en: 'I have tried investing', ru: 'Уже пробовал(а) инвестировать' },
        desc: {
          en: 'I already own something or have used a broker before.',
          ru: 'У меня уже что-то есть или я пользовался(ась) брокером.',
        },
      },
      {
        id: 'check',
        label: {
          en: 'Let me take a quick knowledge check',
          ru: 'Хочу быструю проверку знаний',
        },
        desc: {
          en: "Answer five simple questions and we'll suggest a starting point.",
          ru: 'Ответьте на пять простых вопросов — мы предложим точку старта.',
        },
      },
    ],
  },
  {
    id: 'topics',
    title: {
      en: 'What would you most like to understand?',
      ru: 'Что вы больше всего хотите понять?',
    },
    sub: { en: 'Choose as many as apply', ru: 'Выберите всё, что подходит' },
    multi: true,
    options: [
      { id: 'how', label: { en: 'How investing works', ru: 'Как работают инвестиции' } },
      { id: 'assets', label: { en: 'What different assets are', ru: 'Какие бывают активы' } },
      {
        id: 'choose',
        label: { en: 'How to choose an investment', ru: 'Как выбрать инвестицию' },
      },
      {
        id: 'read',
        label: {
          en: 'How to read market information',
          ru: 'Как читать рыночную информацию',
        },
      },
      { id: 'risk', label: { en: 'How to manage risk', ru: 'Как управлять риском' } },
      {
        id: 'portfolio',
        label: {
          en: 'How to build a simple portfolio',
          ru: 'Как собрать простой портфель',
        },
      },
      {
        id: 'product',
        label: { en: 'How to use TradingNew', ru: 'Как пользоваться TradingNew' },
      },
      { id: 'unsure', label: { en: "I'm not sure yet", ru: 'Пока не знаю' } },
    ],
  },
  {
    id: 'why',
    title: { en: 'Why are you learning now?', ru: 'Почему вы учитесь сейчас?' },
    multi: false,
    options: [
      {
        id: 'start',
        label: { en: 'I want to start investing', ru: 'Хочу начать инвестировать' },
      },
      {
        id: 'savings',
        label: {
          en: 'I already have savings and want to understand my options',
          ru: 'У меня есть сбережения, хочу понять варианты',
        },
      },
      {
        id: 'news',
        label: {
          en: 'I want to understand financial news',
          ru: 'Хочу понимать финансовые новости',
        },
      },
      {
        id: 'manage',
        label: {
          en: 'I want to manage my existing investments better',
          ru: 'Хочу лучше управлять текущими инвестициями',
        },
      },
      {
        id: 'curiosity',
        label: { en: "I'm learning out of curiosity", ru: 'Учусь из любопытства' },
      },
    ],
  },
  {
    id: 'time',
    title: {
      en: 'How much time would you like to spend?',
      ru: 'Сколько времени готовы уделять?',
    },
    multi: false,
    options: [
      { id: '5min', label: { en: '5 minutes a day', ru: '5 минут в день' } },
      { id: '15min', label: { en: '15 minutes a day', ru: '15 минут в день' } },
      {
        id: '30min',
        label: {
          en: '30 minutes a few times a week',
          ru: '30 минут несколько раз в неделю',
        },
      },
      { id: 'free', label: { en: 'No fixed schedule', ru: 'Без фиксированного графика' } },
    ],
  },
  {
    id: 'format',
    title: { en: 'How do you prefer to learn?', ru: 'Как вам удобнее учиться?' },
    sub: { en: 'Choose up to two', ru: 'Выберите не более двух' },
    multi: true,
    max: 2,
    options: [
      { id: 'short', label: { en: 'Short explanations', ru: 'Короткие объяснения' } },
      {
        id: 'interactive',
        label: { en: 'Interactive exercises', ru: 'Интерактивные упражнения' },
      },
      {
        id: 'examples',
        label: { en: 'Real market examples', ru: 'Примеры с реальных рынков' },
      },
      { id: 'video', label: { en: 'Video lessons', ru: 'Видеоуроки' } },
      {
        id: 'practice',
        label: { en: 'Practice inside the product', ru: 'Практика внутри продукта' },
      },
      { id: 'ai', label: { en: 'Ask questions to AI', ru: 'Задавать вопросы AI' } },
    ],
  },
];

export type Stage = {
  name: Localized;
  outcome: Localized;
  lessons: Localized[];
};

export const STAGES: Stage[] = [
  {
    name: { en: 'Stage 1 — Understand the basics', ru: 'Стадия 1 — Понять основы' },
    outcome: {
      en: 'Know why people invest and how investing differs from trading.',
      ru: 'Понять, зачем люди инвестируют и чем инвестиции отличаются от трейдинга.',
    },
    lessons: [
      { en: 'Why people invest', ru: 'Зачем люди инвестируют' },
      { en: 'Inflation and purchasing power', ru: 'Инфляция и покупательная способность' },
      { en: 'Risk and return', ru: 'Риск и доходность' },
      { en: 'Investing versus trading', ru: 'Инвестиции против трейдинга' },
      { en: 'Time horizon and liquidity', ru: 'Горизонт и ликвидность' },
    ],
  },
  {
    name: { en: 'Stage 2 — Understand the main assets', ru: 'Стадия 2 — Разобраться в активах' },
    outcome: {
      en: 'Recognize every major asset class and its risks.',
      ru: 'Различать основные классы активов и их риски.',
    },
    lessons: [
      { en: 'Cash and deposits', ru: 'Наличные и депозиты' },
      { en: 'Bonds', ru: 'Облигации' },
      { en: 'Stocks', ru: 'Акции' },
      { en: 'ETFs', ru: 'ETF' },
      { en: 'Indices', ru: 'Индексы' },
      { en: 'Commodities and gold', ru: 'Сырьё и золото' },
      { en: 'Currencies', ru: 'Валюты' },
      { en: 'Crypto assets', ru: 'Криптоактивы' },
    ],
  },
  {
    name: { en: 'Stage 3 — Learn how to research', ru: 'Стадия 3 — Научиться исследовать' },
    outcome: {
      en: 'Run your own research session on a real asset.',
      ru: 'Самостоятельно исследовать реальный актив.',
    },
    lessons: [
      { en: 'How to read a Symbol Page', ru: 'Как читать страницу актива' },
      { en: 'Price and performance', ru: 'Цена и доходность' },
      { en: 'Fundamental information', ru: 'Фундаментальная информация' },
      { en: 'News and events', ru: 'Новости и события' },
      { en: 'Simple chart reading', ru: 'Простое чтение графика' },
      { en: 'Understanding volatility', ru: 'Понимание волатильности' },
      { en: 'Comparing assets', ru: 'Сравнение активов' },
      { en: 'How screeners work', ru: 'Как работают скринеры' },
      {
        en: 'Technical signals and their limitations',
        ru: 'Технические сигналы и их ограничения',
      },
      { en: 'Community ideas and opinions', ru: 'Идеи и мнения сообщества' },
    ],
  },
  {
    name: { en: 'Stage 4 — Build a simple approach', ru: 'Стадия 4 — Собрать простой подход' },
    outcome: {
      en: 'Assemble principles into a simple personal approach.',
      ru: 'Сложить принципы в простой личный подход.',
    },
    lessons: [
      { en: 'Goals and horizon', ru: 'Цели и горизонт' },
      { en: 'Risk tolerance', ru: 'Толерантность к риску' },
      { en: 'Diversification', ru: 'Диверсификация' },
      { en: 'Asset allocation', ru: 'Распределение активов' },
      { en: 'Regular investing', ru: 'Регулярные инвестиции' },
      { en: 'Rebalancing', ru: 'Ребалансировка' },
      { en: 'Fees and taxes', ru: 'Комиссии и налоги' },
      { en: 'Common behavioural mistakes', ru: 'Типичные поведенческие ошибки' },
    ],
  },
  {
    name: { en: 'Stage 5 — Practise without risk', ru: 'Стадия 5 — Практика без риска' },
    outcome: {
      en: 'Complete your first research-to-decision journey.',
      ru: 'Пройти путь от исследования до решения целиком.',
    },
    lessons: [
      { en: 'Create a practice watchlist', ru: 'Создать учебный список отслеживания' },
      { en: 'Add several asset classes', ru: 'Добавить несколько классов активов' },
      { en: 'Set a price or event alert', ru: 'Настроить алерт по цене или событию' },
      { en: 'Create a virtual portfolio', ru: 'Создать виртуальный портфель' },
      { en: 'Make a Paper Trading transaction', ru: 'Совершить сделку на Paper Trading' },
      { en: 'Record your reasoning', ru: 'Записать своё обоснование' },
      { en: 'Review the outcome', ru: 'Разобрать результат' },
    ],
  },
];

export type QuizOption = { id: string; label: Localized; correct: boolean };

/** The first lesson — the only one built out in full in the prototype. */
export const FIRST_LESSON = {
  slug: 'why-people-invest',
  title: { en: 'Why people invest', ru: 'Зачем люди инвестируют' },
  minutes: 8,
  objective: {
    en: "By the end of this lesson, you'll understand why people invest and how inflation, time and goals shape investment decisions.",
    ru: 'К концу урока вы поймёте, зачем люди инвестируют и как инфляция, время и цели влияют на инвестиционные решения.',
  },
  ideaTitle: { en: 'The idea in plain words', ru: 'Идея простыми словами' },
  paragraphs: [
    {
      en: "Money kept in cash slowly loses buying power because prices rise over time — that's inflation. Investing means putting money into assets that can grow or pay income, so your savings keep up with — or outgrow — rising prices.",
      ru: 'Деньги, лежащие наличными, постепенно теряют покупательную способность, потому что цены со временем растут, — это инфляция. Инвестировать значит вкладывать деньги в активы, которые могут расти или приносить доход, чтобы сбережения успевали за ростом цен или обгоняли его.',
    },
    {
      en: 'The trade-off: assets that can grow can also fall in price. How much movement you can accept depends on your goals and how long you can leave the money invested.',
      ru: 'Компромисс: активы, которые могут расти, могут и падать в цене. Сколько колебаний вы готовы принять, зависит от ваших целей и того, насколько долго вы можете не трогать деньги.',
    },
  ],
  keyTermsLabel: { en: 'Key terms:', ru: 'Ключевые термины:' },
  glossary: [
    {
      id: 'stock',
      term: { en: 'stock', ru: 'акция' },
      definition: {
        en: "A share of ownership in a company. Its price changes with the company's results and investor expectations.",
        ru: 'Доля владения в компании. Её цена меняется вслед за результатами компании и ожиданиями инвесторов.',
      },
    },
    {
      id: 'dividend',
      term: { en: 'dividend', ru: 'дивиденд' },
      definition: {
        en: 'A portion of company profit paid to shareholders, usually quarterly.',
        ru: 'Часть прибыли компании, выплачиваемая акционерам, обычно ежеквартально.',
      },
    },
    {
      id: 'volatility',
      term: { en: 'volatility', ru: 'волатильность' },
      definition: {
        en: 'How much and how fast a price moves. Higher volatility means larger swings in both directions.',
        ru: 'Насколько сильно и быстро движется цена. Высокая волатильность означает более широкие колебания в обе стороны.',
      },
    },
  ],
  exampleTitle: { en: 'Real market example', ru: 'Реальный рыночный пример' },
  exampleLabels: [
    { en: 'Real market data', ru: 'Реальные рыночные данные' },
    { en: 'Updated 09:45 UTC', ru: 'Обновлено 09:45 UTC' },
    { en: 'Illustrative example', ru: 'Иллюстративный пример' },
    { en: 'Not investment advice', ru: 'Не инвестиционная рекомендация' },
  ],
  exampleText: {
    en: 'The S&P 500 — a basket of 500 large US companies — is up +11.2% this year, while US inflation runs near 2.6%. Cash left in a drawer lost buying power; money in the index grew faster than prices rose.',
    ru: 'S&P 500 — корзина из 500 крупных американских компаний — вырос на +11,2% с начала года, тогда как инфляция в США держится около 2,6%. Деньги, оставленные в тумбочке, потеряли покупательную способность; деньги в индексе росли быстрее, чем росли цены.',
  },
  interactive: {
    title: { en: 'Try it: which of these is a stock?', ru: 'Попробуйте: что из этого акция?' },
    options: [
      { id: 'apple', label: { en: 'Apple shares', ru: 'Акции Apple' }, correct: true },
      { id: 'btc', label: { en: 'Bitcoin', ru: 'Bitcoin' }, correct: false },
      { id: 'gold', label: { en: 'A gold bar', ru: 'Слиток золота' }, correct: false },
      {
        id: 'bond',
        label: { en: 'A government bond', ru: 'Государственная облигация' },
        correct: false,
      },
    ] as QuizOption[],
    correctMessage: {
      en: 'Correct — a share of Apple is a small ownership stake in the company.',
      ru: 'Верно — акция Apple это небольшая доля владения компанией.',
    },
    wrongMessage: {
      en: 'Not quite. That is an asset, but not a share of ownership in a company. Try again.',
      ru: 'Не совсем. Это актив, но не доля владения компанией. Попробуйте ещё раз.',
    },
  },
  practice: {
    title: { en: 'Try it in TradingNew', ru: 'Попробуйте в TradingNew' },
    text: {
      en: "Open Tesla in Simple Mode, find today's price change and add it to your practice watchlist.",
      ru: 'Откройте Tesla в простом режиме, найдите изменение цены за сегодня и добавьте её в учебный список отслеживания.',
    },
    cta: { en: 'Open Tesla in Simple Mode', ru: 'Открыть Tesla в простом режиме' },
    done: { en: '✓ Task completed', ru: '✓ Задание выполнено' },
  },
  quickCheck: {
    title: { en: 'Quick check', ru: 'Быстрая проверка' },
    question: { en: 'Owning a stock means…', ru: 'Владеть акцией значит…' },
    options: [
      {
        id: 'lend',
        label: {
          en: 'You lend money to the company',
          ru: 'Вы одалживаете компании деньги',
        },
        correct: false,
      },
      {
        id: 'own',
        label: {
          en: 'You own a small share of the company',
          ru: 'Вы владеете небольшой долей компании',
        },
        correct: true,
      },
      {
        id: 'guaranteed',
        label: {
          en: 'You are guaranteed dividends',
          ru: 'Вам гарантированы дивиденды',
        },
        correct: false,
      },
    ] as QuizOption[],
    correctMessage: {
      en: 'Correct. A stock is ownership — dividends are possible, never guaranteed.',
      ru: 'Верно. Акция — это владение; дивиденды возможны, но никогда не гарантированы.',
    },
    wrongMessage: {
      en: "Not quite. Here's the key difference: lending money to a company is a bond. A stock makes you a part-owner, and dividends are never guaranteed.",
      ru: 'Не совсем. Ключевое отличие: одалживать деньги компании — это облигация. Акция делает вас совладельцем, а дивиденды никогда не гарантированы.',
    },
  },
  completion: {
    title: { en: 'Lesson complete', ru: 'Урок пройден' },
    text: {
      en: 'You can now explain why people invest, how inflation erodes savings, and what a stock represents.',
      ru: 'Теперь вы можете объяснить, зачем люди инвестируют, как инфляция съедает сбережения и что представляет собой акция.',
    },
  },
  ask: {
    title: { en: 'Ask about this lesson', ru: 'Спросить об этом уроке' },
    chips: [
      {
        id: 'simpler',
        label: { en: 'Explain more simply', ru: 'Объясни проще' },
        answer: {
          en: 'Investing means putting money into something that can grow or pay you back more later — instead of letting inflation slowly shrink it.',
          ru: 'Инвестировать — значит вложить деньги во что-то, что может вырасти или вернуть больше позже, вместо того чтобы позволять инфляции медленно их обесценивать.',
        },
      },
      {
        id: 'example',
        label: { en: 'Give me another example', ru: 'Дай другой пример' },
        answer: {
          en: 'If you had put $100 into a broad S&P 500 fund in 2016, it would be worth roughly $330 today. The same $100 in cash buys about 25% less than it did then.',
          ru: 'Если бы вы вложили $100 в широкий фонд на S&P 500 в 2016 году, сегодня они стоили бы примерно $330. Те же $100 наличными покупают примерно на 25% меньше, чем тогда.',
        },
      },
      {
        id: 'matters',
        label: { en: 'Why does this matter?', ru: 'Почему это важно?' },
        answer: {
          en: 'Because cash quietly loses buying power every year. Investing is the main tool ordinary people have to keep and grow long-term savings.',
          ru: 'Потому что наличные незаметно теряют покупательную способность каждый год. Инвестиции — основной инструмент, которым обычные люди могут сохранять и наращивать долгосрочные сбережения.',
        },
      },
      {
        id: 'quiz',
        label: { en: 'Quiz me', ru: 'Проверь меня' },
        answer: {
          en: 'Quick one: if inflation is 3% and your savings earn 1%, is your money growing or shrinking in real terms? — Shrinking, by about 2% a year.',
          ru: 'Быстрый вопрос: если инфляция 3%, а сбережения приносят 1%, ваши деньги растут или уменьшаются в реальном выражении? — Уменьшаются, примерно на 2% в год.',
        },
      },
    ],
  },
};

/** Profile summary rows on the "learning path ready" screen. */
export const PROFILE_FALLBACKS = {
  level: { en: 'Complete beginner', ru: 'Полный новичок' },
  goal: { en: 'Understand how to start investing', ru: 'Понять, как начать инвестировать' },
  format: {
    en: 'Interactive lessons and real examples',
    ru: 'Интерактивные уроки и реальные примеры',
  },
  pace: { en: '15 minutes a day', ru: '15 минут в день' },
  estimate: { en: '3–4 weeks', ru: '3–4 недели' },
};

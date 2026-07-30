import type { Localized } from './types';

/**
 * Credential status is stated honestly and never softened. "Verified" is reserved
 * for a credential actually checked against a regulator's registry.
 */
export type CredentialStatus =
  | 'verified'
  | 'verification_pending'
  | 'self_declared'
  | 'not_applicable'
  | 'demo';

/** Match quality is a band, never a percentage — a number would imply false precision. */
export type MatchBand = 'best' | 'strong' | 'suitable';

export type Expert = {
  id: string;
  initials: string;
  name: string;
  provider: Localized;
  credential: CredentialStatus;
  band: MatchBand;
  jurisdiction: Localized;
  languages: string;
  rating: string;
  consultations: number;
  price: string;
  duration: Localized;
  availability: Localized;
  tile: string;
  color: string;
  reasons: Localized[];
  about: Localized;
  suited: Localized;
  expertise: Localized[];
  credentials: Array<{ k: Localized; v: Localized }>;
  packages: Array<{ id: string; label: Localized; price: string }>;
  reviews: Array<{ rating: string; text: Localized; meta: Localized }>;
  disclosures: Localized[];
};

export const EXPERTS: Expert[] = [
  {
    id: 'ak',
    initials: 'AK',
    name: 'Anna Keller',
    provider: {
      en: 'Regulated investment adviser',
      ru: 'Регулируемый инвестиционный советник',
    },
    credential: 'verified',
    band: 'best',
    jurisdiction: { en: 'Cyprus / EU', ru: 'Кипр / ЕС' },
    languages: 'EN · RU',
    rating: '4.9',
    consultations: 214,
    price: '€120',
    duration: { en: '60 min', ru: '60 мин' },
    availability: { en: 'Tomorrow, 14:00', ru: 'Завтра, 14:00' },
    tile: 'var(--tn-blue-tint)',
    color: 'var(--tn-blue)',
    reasons: [
      { en: 'Works with first-time investors', ru: 'Работает с начинающими инвесторами' },
      {
        en: 'Licensed for clients in your jurisdiction',
        ru: 'Лицензирована для клиентов в вашей юрисдикции',
      },
      {
        en: 'Specialises in long-term portfolio construction',
        ru: 'Специализируется на построении долгосрочных портфелей',
      },
      { en: 'Consults in Russian and English', ru: 'Консультирует на русском и английском' },
    ],
    about: {
      en: 'Independent adviser focused on long-term, low-cost portfolios. Starts every engagement from goals and risk capacity, not from products.',
      ru: 'Независимый советник, специализируется на долгосрочных портфелях с низкими издержками. Начинает работу с целей и допустимого риска, а не с продуктов.',
    },
    suited: {
      en: 'First-time investors and professionals with idle capital who want a clear, diversified starting plan.',
      ru: 'Начинающим инвесторам и специалистам со свободным капиталом, которым нужен понятный диверсифицированный стартовый план.',
    },
    expertise: [
      { en: 'Financial planning', ru: 'Финансовое планирование' },
      { en: 'Long-term investing', ru: 'Долгосрочные инвестиции' },
      { en: 'Portfolio review', ru: 'Разбор портфеля' },
      { en: 'ETFs', ru: 'ETF' },
      { en: 'Fixed income', ru: 'Облигации' },
      { en: 'Retirement planning', ru: 'Пенсионное планирование' },
    ],
    credentials: [
      {
        k: { en: 'Provider type', ru: 'Тип поставщика услуг' },
        v: { en: 'Regulated investment adviser', ru: 'Регулируемый инвестиционный советник' },
      },
      { k: { en: 'Regulator', ru: 'Регулятор' }, v: { en: 'CySEC', ru: 'CySEC' } },
      { k: { en: 'Jurisdiction', ru: 'Юрисдикция' }, v: { en: 'Cyprus / EU', ru: 'Кипр / ЕС' } },
      {
        k: { en: 'Licence', ru: 'Лицензия' },
        v: { en: 'CIF 214/13 · registry link', ru: 'CIF 214/13 · ссылка на реестр' },
      },
      {
        k: { en: 'Last verified', ru: 'Последняя проверка' },
        v: { en: 'Jul 12, 2026', ru: '12 июля 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute introductory call', ru: '30-минутный вводный звонок' },
        price: '€60',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation', ru: '60-минутная консультация' },
        price: '€120',
      },
      {
        id: 'written',
        label: { en: 'Written portfolio review', ru: 'Письменный разбор портфеля' },
        price: '€90',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Clear plan and honest about risks. Exactly what I needed to start.”',
          ru: '«Понятный план и честно о рисках. Ровно то, что нужно было для старта.»',
        },
        meta: { en: 'Verified client · Jun 2026', ru: 'Подтверждённый клиент · июнь 2026' },
      },
      {
        rating: '4.8',
        text: {
          en: '“Explained allocation trade-offs in plain language.”',
          ru: '«Объяснила компромиссы в распределении простым языком.»',
        },
        meta: { en: 'Verified client · May 2026', ru: 'Подтверждённый клиент · май 2026' },
      },
    ],
    disclosures: [
      {
        en: 'No commissions from products discussed',
        ru: 'Не получает комиссий с обсуждаемых продуктов',
      },
      { en: 'Not affiliated with any broker', ru: 'Не аффилирована ни с одним брокером' },
      { en: 'Not a sponsored placement', ru: 'Не рекламное размещение' },
      { en: 'Serves EU residents only', ru: 'Работает только с резидентами ЕС' },
    ],
  },

  {
    id: 'mo',
    initials: 'MO',
    name: 'Marcus Okafor',
    provider: { en: 'Financial planner', ru: 'Финансовый планировщик' },
    credential: 'self_declared',
    band: 'strong',
    jurisdiction: { en: 'United Kingdom', ru: 'Великобритания' },
    languages: 'EN · FR',
    rating: '4.8',
    consultations: 167,
    price: '€95',
    duration: { en: '60 min', ru: '60 мин' },
    availability: { en: 'Fri, 10:00', ru: 'Пт, 10:00' },
    tile: 'var(--tn-green-tint)',
    color: 'var(--tn-green)',
    reasons: [
      {
        en: 'Specialises in multi-asset portfolio reviews',
        ru: 'Специализируется на разборе мультиактивных портфелей',
      },
      { en: 'Strong focus on risk analysis', ru: 'Сильный фокус на анализе рисков' },
      {
        en: 'Experience with cross-border situations',
        ru: 'Опыт работы с трансграничными ситуациями',
      },
    ],
    about: {
      en: 'Financial planner working with households and expats. Builds full financial pictures: cash flow, goals, existing portfolios and pensions.',
      ru: 'Финансовый планировщик, работает с семьями и экспатами. Строит полную финансовую картину: денежный поток, цели, существующие портфели и пенсии.',
    },
    suited: {
      en: 'People who already invest and want an independent, structured second opinion on their portfolio.',
      ru: 'Тем, кто уже инвестирует и хочет независимое структурированное второе мнение по портфелю.',
    },
    expertise: [
      { en: 'Portfolio review', ru: 'Разбор портфеля' },
      { en: 'Risk analysis', ru: 'Анализ рисков' },
      { en: 'Budgeting', ru: 'Бюджетирование' },
      { en: 'Pensions', ru: 'Пенсии' },
      { en: 'Multi-asset allocation', ru: 'Мультиактивное распределение' },
    ],
    credentials: [
      {
        k: { en: 'Provider type', ru: 'Тип поставщика услуг' },
        v: { en: 'Financial planner', ru: 'Финансовый планировщик' },
      },
      {
        k: { en: 'Status', ru: 'Статус' },
        v: {
          en: 'Self-declared, verification pending',
          ru: 'Заявлено самостоятельно, проверка не завершена',
        },
      },
      {
        k: { en: 'Jurisdiction', ru: 'Юрисдикция' },
        v: { en: 'United Kingdom', ru: 'Великобритания' },
      },
      {
        k: { en: 'Membership', ru: 'Членство' },
        v: { en: 'CISI (declared)', ru: 'CISI (заявлено)' },
      },
      {
        k: { en: 'Last check', ru: 'Последняя сверка' },
        v: {
          en: 'Not yet verified against registry',
          ru: 'Ещё не сверено с реестром',
        },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '30-minute introductory call', ru: '30-минутный вводный звонок' },
        price: '€45',
      },
      {
        id: 'full',
        label: { en: '60-minute consultation', ru: '60-минутная консультация' },
        price: '€95',
      },
      {
        id: 'written',
        label: { en: 'Written portfolio review', ru: 'Письменный разбор портфеля' },
        price: '€75',
      },
    ],
    reviews: [
      {
        rating: '4.9',
        text: {
          en: '“Found two concentration risks I had completely missed.”',
          ru: '«Нашёл два риска концентрации, которые я полностью упустил.»',
        },
        meta: { en: 'Verified client · Jul 2026', ru: 'Подтверждённый клиент · июль 2026' },
      },
    ],
    disclosures: [
      { en: 'Accepts no product commissions', ru: 'Не принимает комиссий с продуктов' },
      {
        en: 'Independent — no broker affiliation',
        ru: 'Независим — без брокерской аффилиации',
      },
      { en: 'Not a sponsored placement', ru: 'Не рекламное размещение' },
    ],
  },

  {
    id: 'sl',
    initials: 'SL',
    name: 'Sofia Lindqvist',
    provider: {
      en: 'TradingNew platform specialist',
      ru: 'Специалист по платформе TradingNew',
    },
    credential: 'not_applicable',
    band: 'suitable',
    jurisdiction: { en: 'Sweden / EU', ru: 'Швеция / ЕС' },
    languages: 'EN · SV',
    rating: '5.0',
    consultations: 98,
    price: '€40',
    duration: { en: '45 min', ru: '45 мин' },
    availability: { en: 'Mon, 09:30', ru: 'Пн, 09:30' },
    tile: 'var(--tn-purple-tint)',
    color: 'var(--tn-purple)',
    reasons: [
      {
        en: 'Helps set up screeners, watchlists and alerts',
        ru: 'Помогает настроить скринеры, списки отслеживания и алерты',
      },
      {
        en: 'Ideal for getting productive with TradingNew tools',
        ru: 'Идеально, чтобы быстро начать работать с инструментами TradingNew',
      },
      {
        en: 'Not an investment adviser — platform guidance only',
        ru: 'Не инвестиционный советник — только помощь по платформе',
      },
    ],
    about: {
      en: 'Platform specialist helping users get the most out of TradingNew: charts, screeners, alerts, portfolios and research workflows.',
      ru: 'Специалист по платформе, помогает выжать максимум из TradingNew: графики, скринеры, алерты, портфели и исследовательские процессы.',
    },
    suited: {
      en: 'Users who want to master the platform itself, not receive financial advice.',
      ru: 'Тем, кто хочет освоить саму платформу, а не получить финансовый совет.',
    },
    expertise: [
      { en: 'Supercharts', ru: 'Supercharts' },
      { en: 'Screeners', ru: 'Скринеры' },
      { en: 'Alerts & watchlists', ru: 'Алерты и списки отслеживания' },
      { en: 'Portfolio tools', ru: 'Инструменты портфеля' },
      { en: 'Research workflow', ru: 'Исследовательский процесс' },
    ],
    credentials: [
      {
        k: { en: 'Provider type', ru: 'Тип поставщика услуг' },
        v: { en: 'Platform specialist', ru: 'Специалист по платформе' },
      },
      {
        k: { en: 'Status', ru: 'Статус' },
        v: {
          en: 'No licence required for this service',
          ru: 'Для этой услуги лицензия не требуется',
        },
      },
      { k: { en: 'Jurisdiction', ru: 'Юрисдикция' }, v: { en: 'EU', ru: 'ЕС' } },
      {
        k: { en: 'Employer', ru: 'Работодатель' },
        v: { en: 'TradingNew certified partner', ru: 'Сертифицированный партнёр TradingNew' },
      },
      {
        k: { en: 'Last verified', ru: 'Последняя проверка' },
        v: { en: 'Jun 30, 2026', ru: '30 июня 2026' },
      },
    ],
    packages: [
      {
        id: 'intro',
        label: { en: '45-minute platform session', ru: '45-минутная сессия по платформе' },
        price: '€40',
      },
      {
        id: 'full',
        label: { en: '90-minute deep dive', ru: '90-минутное глубокое погружение' },
        price: '€70',
      },
      {
        id: 'written',
        label: { en: 'Written setup review', ru: 'Письменный разбор настроек' },
        price: '€35',
      },
    ],
    reviews: [
      {
        rating: '5.0',
        text: {
          en: '“Set up my entire research workflow in one session.”',
          ru: '«Настроила весь мой исследовательский процесс за одну сессию.»',
        },
        meta: { en: 'Verified client · Jun 2026', ru: 'Подтверждённый клиент · июнь 2026' },
      },
    ],
    disclosures: [
      {
        en: 'Does not provide investment advice',
        ru: 'Не предоставляет инвестиционных рекомендаций',
      },
      { en: 'TradingNew certified partner', ru: 'Сертифицированный партнёр TradingNew' },
      { en: 'Not a sponsored placement', ru: 'Не рекламное размещение' },
    ],
  },
];

export const EXPERT_TASKS = [
  {
    id: 'strategy',
    title: { en: 'Build my investment strategy', ru: 'Собрать инвестиционную стратегию' },
    desc: {
      en: 'For users who have capital but are unsure how to allocate it.',
      ru: 'Для тех, у кого есть капитал, но нет ясности, как его распределить.',
    },
  },
  {
    id: 'review',
    title: { en: 'Review my portfolio', ru: 'Разобрать мой портфель' },
    desc: {
      en: 'For users who already invest and want an independent professional perspective.',
      ru: 'Для тех, кто уже инвестирует и хочет независимый профессиональный взгляд.',
    },
  },
  {
    id: 'finances',
    title: { en: 'Plan my finances', ru: 'Спланировать финансы' },
    desc: {
      en: 'For budgeting, financial planning, debt, savings and long-term goals.',
      ru: 'Бюджет, финансовое планирование, долги, сбережения и долгосрочные цели.',
    },
  },
  {
    id: 'market',
    title: { en: 'Understand a market or asset', ru: 'Разобраться в рынке или активе' },
    desc: {
      en: 'For a focused consultation about an industry, market or asset class.',
      ru: 'Точечная консультация по отрасли, рынку или классу активов.',
    },
  },
];

export type IntakeQuestion = {
  key: string;
  question: Localized;
  hint?: Localized;
  options: Localized[];
};

export const INTAKE: IntakeQuestion[] = [
  {
    key: 'task',
    question: { en: 'What would you like help with?', ru: 'С чем вам нужна помощь?' },
    options: [
      ...EXPERT_TASKS.map((task) => task.title),
      { en: 'Something else', ru: 'Что-то другое' },
    ],
  },
  {
    key: 'outcome',
    question: {
      en: 'What outcome are you looking for?',
      ru: 'Какого результата вы ждёте?',
    },
    options: [
      { en: 'A clear plan I can follow', ru: 'Понятный план, которому можно следовать' },
      { en: 'An independent second opinion', ru: 'Независимое второе мнение' },
      { en: 'Understanding my options', ru: 'Понимание доступных вариантов' },
      { en: 'Help with a specific question', ru: 'Помощь с конкретным вопросом' },
    ],
  },
  {
    key: 'experience',
    question: { en: 'Have you invested before?', ru: 'Вы инвестировали раньше?' },
    options: [
      { en: 'No, never', ru: 'Нет, никогда' },
      { en: 'A little', ru: 'Немного' },
      { en: 'Regularly', ru: 'Регулярно' },
    ],
  },
  {
    key: 'country',
    question: { en: 'Which country do you live in?', ru: 'В какой стране вы живёте?' },
    options: [
      { en: 'Cyprus', ru: 'Кипр' },
      { en: 'Germany', ru: 'Германия' },
      { en: 'United Kingdom', ru: 'Великобритания' },
      { en: 'Other EU', ru: 'Другая страна ЕС' },
    ],
  },
  {
    key: 'language',
    question: {
      en: 'Which language would you prefer?',
      ru: 'На каком языке вам удобнее?',
    },
    options: [
      { en: 'English', ru: 'English' },
      { en: 'Русский', ru: 'Русский' },
      { en: 'Both', ru: 'Оба' },
    ],
  },
  {
    key: 'amount',
    question: {
      en: 'What approximate amount is relevant?',
      ru: 'О какой примерно сумме идёт речь?',
    },
    hint: {
      en: 'Capital range helps us find experts who normally work with situations similar to yours. You do not need to share an exact amount.',
      ru: 'Диапазон капитала помогает найти экспертов, которые обычно работают с похожими ситуациями. Точную сумму называть не нужно.',
    },
    options: [
      { en: 'Under €10,000', ru: 'Менее €10 000' },
      { en: '€10,000 – €50,000', ru: '€10 000 – €50 000' },
      { en: '€50,000 – €250,000', ru: '€50 000 – €250 000' },
      { en: 'Over €250,000', ru: 'Более €250 000' },
      { en: 'Prefer to skip', ru: 'Предпочитаю не отвечать' },
    ],
  },
  {
    key: 'format',
    question: {
      en: 'Would you like a video call, chat or written review?',
      ru: 'Вам удобнее видеозвонок, чат или письменный разбор?',
    },
    options: [
      { en: 'Video call', ru: 'Видеозвонок' },
      { en: 'Chat', ru: 'Чат' },
      { en: 'Written review', ru: 'Письменный разбор' },
    ],
  },
];

/** Everything a consultation could expose. All default to off, without exception. */
export const SHARING_ITEMS = [
  { id: 'brief', label: { en: 'Consultation brief', ru: 'Бриф консультации' } },
  { id: 'portfolio', label: { en: 'Portfolio overview', ru: 'Обзор портфеля' } },
  { id: 'holdings', label: { en: 'Individual holdings', ru: 'Отдельные позиции' } },
  { id: 'goals', label: { en: 'Goals and risk profile', ru: 'Цели и риск-профиль' } },
  { id: 'research', label: { en: 'Saved research', ru: 'Сохранённые исследования' } },
  { id: 'copilot', label: { en: 'Copilot thread', ru: 'Тред с Copilot' } },
  { id: 'documents', label: { en: 'Uploaded documents', ru: 'Загруженные документы' } },
];

export const NEVER_SHARED = [
  { en: 'Your login credentials', ru: 'Ваши учётные данные' },
  { en: 'Transaction history', ru: 'История транзакций' },
  { en: 'Copilot threads you did not select', ru: 'Треды Copilot, которые вы не выбрали' },
  { en: 'Payment details', ru: 'Платёжные данные' },
];

/** Four separate consents — bundling them would make any single one unprovable. */
export const CONSENTS = [
  {
    id: 'ai',
    label: {
      en: 'I agree that AI may process my brief to prepare this consultation.',
      ru: 'Я согласен(на), что AI может обработать мой бриф для подготовки консультации.',
    },
  },
  {
    id: 'sharing',
    label: {
      en: 'I agree to share the data I selected with this expert.',
      ru: 'Я согласен(на) передать выбранные мной данные этому эксперту.',
    },
  },
  {
    id: 'terms',
    label: {
      en: 'I accept the Marketplace terms of service.',
      ru: 'Я принимаю условия использования маркетплейса.',
    },
  },
  {
    id: 'cancellation',
    label: {
      en: 'I have read the cancellation and refund policy.',
      ru: 'Я ознакомился(ась) с политикой отмены и возврата.',
    },
  },
];

export const SLOTS: Localized[] = [
  { en: 'Tomorrow, 14:00', ru: 'Завтра, 14:00' },
  { en: 'Tomorrow, 16:30', ru: 'Завтра, 16:30' },
  { en: 'Thu, 11:00', ru: 'Чт, 11:00' },
  { en: 'Fri, 09:30', ru: 'Пт, 09:30' },
];

export const BOOKING_REFERENCE = 'TN-8347';

/** The nine sections of the post-consultation summary. */
export const SUMMARY_SECTIONS: Array<{ id: string; title: Localized; body: Localized }> = [
  {
    id: 'question',
    title: { en: 'Your original question', ru: 'Ваш исходный вопрос' },
    body: {
      en: 'How should I start investing €40,000 that is currently sitting in a savings account, with a horizon of about ten years?',
      ru: 'Как начать инвестировать €40 000, которые сейчас лежат на сберегательном счёте, с горизонтом около десяти лет?',
    },
  },
  {
    id: 'context',
    title: { en: 'Context reviewed', ru: 'Рассмотренный контекст' },
    body: {
      en: 'Consultation brief, goals and risk profile. No individual holdings or documents were shared for this session.',
      ru: 'Бриф консультации, цели и риск-профиль. Отдельные позиции и документы для этой сессии не передавались.',
    },
  },
  {
    id: 'observations',
    title: { en: 'Key observations', ru: 'Ключевые наблюдения' },
    body: {
      en: 'The full amount sits in one currency and one account. A ten-year horizon allows more equity exposure than currently held, but the absence of an emergency reserve is the more pressing gap.',
      ru: 'Вся сумма находится в одной валюте и на одном счёте. Десятилетний горизонт допускает большую долю акций, чем сейчас, но отсутствие резервного фонда — более срочный пробел.',
    },
  },
  {
    id: 'risks',
    title: { en: 'Risks', ru: 'Риски' },
    body: {
      en: 'Concentration in a single currency; sensitivity of long-duration bonds to rate changes; behavioural risk of reacting to short-term drawdowns.',
      ru: 'Концентрация в одной валюте; чувствительность длинных облигаций к изменению ставок; поведенческий риск реакции на краткосрочные просадки.',
    },
  },
  {
    id: 'options',
    title: { en: 'Options discussed', ru: 'Обсуждённые варианты' },
    body: {
      en: 'Phased entry over six to twelve months versus a single allocation; broad index funds versus a mixed core-satellite structure; holding three to six months of expenses in cash first.',
      ru: 'Поэтапный вход за шесть-двенадцать месяцев против единовременного размещения; широкие индексные фонды против структуры «ядро + сателлиты»; сначала держать три-шесть месяцев расходов в наличных.',
    },
  },
  {
    id: 'next',
    title: { en: 'Suggested next steps', ru: 'Предлагаемые следующие шаги' },
    body: {
      en: 'These are research directions, not instructions to buy: size an emergency reserve, compare two broad index funds on cost and domicile, and decide on an entry schedule before choosing instruments.',
      ru: 'Это направления для исследования, а не указания что покупать: определить размер резервного фонда, сравнить два широких индексных фонда по издержкам и домицилю, выбрать график входа до выбора инструментов.',
    },
  },
  {
    id: 'documents',
    title: { en: 'Documents', ru: 'Документы' },
    body: {
      en: 'Allocation range worksheet (PDF) · Session notes (PDF)',
      ru: 'Таблица диапазонов распределения (PDF) · Заметки сессии (PDF)',
    },
  },
  {
    id: 'disclosures',
    title: { en: 'Expert disclosures', ru: 'Раскрытия эксперта' },
    body: {
      en: 'No commissions from any product discussed. Not affiliated with any broker. Not a sponsored placement.',
      ru: 'Никаких комиссий с обсуждавшихся продуктов. Не аффилирована ни с одним брокером. Не рекламное размещение.',
    },
  },
  {
    id: 'followup',
    title: { en: 'Follow-up', ru: 'Дальнейшие шаги' },
    body: {
      en: 'A follow-up session is optional. Book one when you have made the entry-schedule decision, not before.',
      ru: 'Повторная сессия по желанию. Записывайтесь, когда определитесь с графиком входа, — не раньше.',
    },
  },
];

export function expertById(id: string): Expert | undefined {
  return EXPERTS.find((expert) => expert.id === id);
}

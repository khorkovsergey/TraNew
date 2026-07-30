import type { Locale } from '@/i18n/routing';

/** A string that exists in both locales. Demo content is authored bilingually. */
export type Localized = { en: string; ru: string };

/** Locale-independent values (tickers, prices, dates) may be plain strings. */
export type MaybeLocalized = Localized | string;

export function pick(value: MaybeLocalized, locale: Locale): string {
  return typeof value === 'string' ? value : value[locale];
}

/**
 * Trust-first content labels. Every content block in the portal carries one, so a
 * reader always knows whether they are looking at data, an AI summary, a technical
 * reading or somebody's opinion.
 */
export type TrustLabel =
  | 'marketData'
  | 'aiExplanation'
  | 'technicalSignal'
  | 'communityOpinion'
  | 'sponsored'
  | 'fact'
  | 'analysis';

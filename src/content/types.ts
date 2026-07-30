import type { Locale } from '@/i18n/routing';

/**
 * A content string. The portal is English-only; the wrapper stays so demo content
 * keeps a single shape and a second language can be reintroduced by widening this
 * type rather than rewriting every content module.
 */
export type Localized = { en: string };

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

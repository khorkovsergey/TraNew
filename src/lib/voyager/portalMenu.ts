import { MENUS } from '@/components/shell/menu';
import type { MenuRow } from './portal';

/**
 * The header menu, flattened to the two fields portal knowledge needs.
 *
 * The whole of Voyager's coupling to the shell section is this file. `portal.ts`
 * holds the table and takes the menu as an argument, so it stays pure and
 * testable; this is the one place that reaches into somebody else's module, and
 * it takes nothing but a label and whether the row goes anywhere.
 *
 * That narrowness is the point. Shell owns the menus and changes them often;
 * what Voyager depends on is the invariant they are built around — a row is
 * either a link or marked `Coming soon`, never both — rather than their shape.
 * If that invariant ever needs to change, this file is the conversation.
 *
 * Read-only. A menu row Voyager wants is a request to the shell section, never
 * an edit from here.
 */

export function headerMenuRows(): MenuRow[] {
  return Object.values(MENUS).flatMap((groups) =>
    groups.flatMap((group) => group.items.map((item) => ({ label: item.label, kind: item.kind })))
  );
}

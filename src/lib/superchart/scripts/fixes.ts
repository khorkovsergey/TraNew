import type { Diagnostic } from './diagnostics';

/**
 * Repairs Voyager offers for a diagnostic.
 *
 * Every fix here is a text edit derived from the diagnostic that produced it —
 * a line removed, a bracket balanced, a directive moved. None of it is
 * generated, and none of it is applied without the diff being shown first,
 * which is the rule the design states for this panel.
 *
 * The restraint is deliberate. A model rewriting somebody's script to make a
 * warning go away is the failure mode: the warning disappears, the script now
 * does something else, and the diff is long enough that nobody reads it. So a
 * fix is offered only where the diagnostic identifies exactly what to change,
 * and it touches one line.
 *
 * Import-free beyond a type, so the harness compiles it alone.
 */

export type ScriptFix = {
  diagnostic: Diagnostic;
  title: string;
  /** What this changes and what it costs — never only the benefit. */
  detail: string;
  apply: (source: string) => string;
};

function replaceLine(source: string, line: number, replacement: string | null): string {
  const lines = source.split('\n');
  if (line < 1 || line > lines.length) return source;

  if (replacement === null) lines.splice(line - 1, 1);
  else lines[line - 1] = replacement;

  return lines.join('\n');
}

export function fixesFor(source: string, diagnostics: Diagnostic[]): ScriptFix[] {
  const lines = source.split('\n');
  const fixes: ScriptFix[] = [];

  for (const diagnostic of diagnostics) {
    const text = lines[diagnostic.line - 1] ?? '';

    /* --------------------------------------------- A missing version line */

    if (/No \/\/@version=/.test(diagnostic.message)) {
      fixes.push({
        diagnostic,
        title: 'Add the //@version=6 directive',
        detail: 'Adds one line at the top. Nothing else moves.',
        apply: (current) => `//@version=6\n${current}`,
      });
      continue;
    }

    /* ------------------------------------------------ One in the wrong place */

    if (/has to be the first line/.test(diagnostic.message)) {
      fixes.push({
        diagnostic,
        title: 'Move the directive to the first line',
        detail: 'Takes the line from where it is and puts it at the top.',
        apply: (current) => {
          const without = replaceLine(current, diagnostic.line, null);
          return `${text.trim()}\n${without}`;
        },
      });
      continue;
    }

    /* -------------------------------------------------- An unsupported call */

    if (/does not fetch|does not implement|does not render|never does/.test(diagnostic.message)) {
      const name = diagnostic.message.split('(')[0];

      fixes.push({
        diagnostic,
        title: `Comment out the ${name}() line`,
        detail:
          'Keeps the line in the file, commented, so nothing is lost — but whatever used its ' +
          'result will now be missing a value, and that is a second thing to fix.',
        apply: (current) => replaceLine(current, diagnostic.line, `// ${text.trim()}`),
      });
      continue;
    }

    /* ------------------------------------------------------ A stray bracket */

    if (/closing bracket here has no opening/.test(diagnostic.message)) {
      fixes.push({
        diagnostic,
        title: 'Remove the extra closing bracket',
        detail: 'Deletes one `)` from the end of the line. Check that it was the right one.',
        apply: (current) => replaceLine(current, diagnostic.line, text.replace(/\)(\s*)$/, '$1')),
      });
      continue;
    }

    /* ------------------------------------------------------ A second declaration */

    if (/declarations\. Pine allows exactly one/.test(diagnostic.message)) {
      fixes.push({
        diagnostic,
        title: 'Comment out the second declaration',
        detail:
          'Leaves one declaration live. The rest of that indicator stays in the file and will ' +
          'no longer be attached to anything.',
        apply: (current) => replaceLine(current, diagnostic.line, `// ${text.trim()}`),
      });
    }
  }

  return fixes;
}

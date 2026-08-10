/**
 * A real multi-turn conversation, with the tool trace of every turn printed.
 *
 * This is the live half of §29 and the only one that can answer the question
 * the unit suite cannot: *did the planner actually reach for the chart it
 * already had?* The rule it applies is proved deterministically in
 * `test-events.mjs`, which is where the counts live. What this adds is that a
 * real model, given a real brief, chooses the edit — and that a follow-up asked
 * in Russian chooses it too.
 *
 * So it drives the deployed route rather than a stub: one conversation, each
 * turn quoting the artifact identifier the previous answer returned, exactly as
 * the browser does. The chips that come back are the evidence, because they are
 * built from the calls that actually ran rather than from what the model says
 * it did.
 *
 * **It spends real questions from the daily allowance** — eight of them, one
 * per turn, counted against this address like anybody else's. There is no
 * bypass and this script does not want one: a run that did not spend a question
 * would not be exercising the path anybody uses. Run it deliberately.
 *
 * It is a smoke rather than a gate. A model may reasonably answer "show one
 * year" by fetching a year, or by fetching and then trimming, and both are
 * correct; the assertions below are about the property that matters — an edit
 * that needs no data makes no market request — and everything else is printed
 * for reading.
 *
 *   npm run dev -- -p 3401
 *   BASE_URL=http://localhost:3401 node scripts/verify-voyager-artifacts.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3401';

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
  if (ok) {
    passed += 1;
    console.log(`     ok   ${name}`);
  } else {
    failed += 1;
    console.log(`     FAIL ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

const CONTEXT = {
  screen: 'generic',
  subject: 'the markets',
  prompt: 'Ask Voyager',
  quick: [],
};

/** Everything said so far, in the shape the browser sends. */
const history = [];
let artifact;

/** Did this turn ask a provider for price history? */
function fetchedHistory(chips) {
  return chips.some((chip) => /^history\(|^compare\(/.test(chip));
}

function reusedSomething(chips) {
  return chips.some((chip) => /^reuse-history\(|^chart-edit\(/.test(chip));
}

async function ask(question) {
  const response = await fetch(`${BASE}/api/voyager`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      question,
      context: CONTEXT,
      disabledSources: [],
      history: history.slice(-8),
      ...(artifact ? { artifact } : {}),
    }),
  });

  if (!response.ok) throw new Error(`voyager ${response.status}`);
  const payload = await response.json();

  if (payload.quotaReached) {
    console.log('\n  The daily allowance is spent — this run cannot continue.');
    console.log('  Nothing here bypasses it, by design. Try again after 00:00 UTC.');
    process.exit(2);
  }

  const answer = payload.answer ?? {};
  const chips = answer.tools ?? [];

  history.push({ role: 'user', text: question });
  history.push({ role: 'assistant', text: answer.text ?? '' });

  /* The chart this answer drew, by name — the same thing the browser keeps. */
  if (typeof answer.artifactId === 'string') artifact = answer.artifactId;

  return {
    chips,
    answer,
    chart: answer.chart ?? null,
    scripted: answer.simulated === true,
  };
}

async function turn(label, question, expectations) {
  console.log(`\n  ${label}`);
  console.log(`  > ${question}`);

  const result = await ask(question);

  console.log(`    trace: ${result.chips.length ? result.chips.join('  ') : '(no tools ran)'}`);
  if (result.chart) {
    const spec = result.chart.spec;
    console.log(
      `    chart: ${spec.series.map((entry) => entry.symbol).join(', ')} · ${spec.kind} · ` +
        `${spec.sourceMeta.firstObservation} to ${spec.sourceMeta.lastObservation} · ` +
        `${spec.studies.map((study) => study.id).join(', ') || 'no studies'}`
    );
  }
  if (result.scripted) {
    console.log('    (no answer was produced — the model call did not complete)');
  }

  expectations(result);
  return result;
}

/* ------------------------------------------------------------------- Run */

console.log('Voyager artifact reuse — a real conversation, eight questions of the allowance.');

/*
 * A deployment without a key answers every question from the scripted layer,
 * which calls no tools at all. Every assertion below would then fail for a
 * reason that has nothing to do with artifacts, and a red run that means
 * "no key here" is worse than no run: somebody will read it as a regression.
 *
 * So this stops before spending anything and says which environment it needs.
 */
{
  const probe = await fetch(`${BASE}/api/voyager?screen=generic&subject=check`);
  const state = probe.ok ? await probe.json() : {};

  if (state.modelConfigured !== true) {
    console.log('\n  No model is configured on this deployment, so no tool ever runs here.');
    console.log('  This suite needs an environment with ANTHROPIC_API_KEY — the deployed one.');
    console.log('  Nothing was asked and nothing was spent.');
    process.exit(2);
  }

  console.log(`  Allowance before this run: ${state.used} of ${state.total} spent today.`);
}

await turn('1. The first chart, which has to be fetched', 'Show NVDA for the last 3 months', (result) => {
  check('history was fetched, because nothing was held yet', fetchedHistory(result.chips), result.chips.join(' '));
  check('and a chart came back to follow up on', Boolean(result.chart));
  check('which the server kept', Boolean(artifact));
});

await turn('2. The same data, drawn differently — in Russian', 'покажи свечами', (result) => {
  check('no market request', !fetchedHistory(result.chips), result.chips.join(' '));
  check('the chart was redrawn from what was held', reusedSomething(result.chips), result.chips.join(' '));
  check('and it is candles now', result.chart?.spec.kind === 'candles', result.chart?.spec.kind);
});

await turn('3. A study, computed from the bars already held — in Russian', 'добавь RSI', (result) => {
  check('no market request', !fetchedHistory(result.chips), result.chips.join(' '));
  check(
    'RSI is on the chart',
    Boolean(result.chart?.spec.studies.some((study) => study.id === 'rsi')),
    JSON.stringify(result.chart?.spec.studies ?? [])
  );
});

await turn('4. And off again', 'Remove RSI', (result) => {
  check('no market request', !fetchedHistory(result.chips), result.chips.join(' '));
  check(
    'RSI is gone',
    !result.chart?.spec.studies.some((study) => study.id === 'rsi'),
    JSON.stringify(result.chart?.spec.studies ?? [])
  );
});

await turn('5. A period the held bars cannot reach', 'Show one year', (result) => {
  check('this one does fetch, because it has to', fetchedHistory(result.chips), result.chips.join(' '));
  check(
    'and the chart reaches further back than three months',
    Boolean(result.chart) && result.chart.spec.sourceMeta.firstObservation < '2026-03-01',
    result.chart?.spec.sourceMeta.firstObservation
  );
});

await turn('6. A period inside the one now held', 'Only show the last three months', (result) => {
  check('no market request', !fetchedHistory(result.chips), result.chips.join(' '));
  check('the chart was cut out of what was held', reusedSomething(result.chips), result.chips.join(' '));
});

await turn('7. A comparison, which needs the second instrument', 'Compare NVDA and AMD', (result) => {
  check('this fetches', fetchedHistory(result.chips), result.chips.join(' '));
  check(
    'and both are on it',
    (result.chart?.spec.series.length ?? 0) >= 2,
    JSON.stringify(result.chart?.spec.series.map((entry) => entry.symbol) ?? [])
  );
});

await turn('8. One more instrument — only the missing one should be fetched', 'Add Microsoft', (result) => {
  const symbols = result.chart?.spec.series.map((entry) => entry.symbol) ?? [];
  check('all three are on the chart', symbols.length === 3, symbols.join(','));
  check(
    'the two already held were reused',
    result.chips.some((chip) => /^reuse-history\(/.test(chip)),
    result.chips.join(' ')
  );
  check(
    'and the fetch names only what was missing',
    result.chips.every((chip) => !/^history\(/.test(chip) || /MSFT/i.test(chip)),
    result.chips.join(' ')
  );
});

console.log(`\n${passed}/${passed + failed} passed`);
process.exit(failed === 0 ? 0 : 1);

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * One section, one worktree.
 *
 * Several sessions develop this portal at the same time. Sharing one working
 * tree means sharing one index and one HEAD, and the failure that follows is
 * not subtle: whoever commits first sweeps up everybody else's half-finished
 * files, and whoever runs `git checkout --` deletes them. A git worktree gives
 * each session its own directory, its own index and its own branch over the
 * same object store, which is the isolation the sessions were assuming they
 * already had.
 *
 * What this script does beyond `git worktree add` is the two things that make a
 * Next.js worktree actually runnable: dependencies are installed for real, and
 * `.env.local` is copied — it is gitignored, so a fresh worktree has none — with
 * its two URL variables rewritten to the section's own port. better-auth
 * answers 403 to a POST from an origin it does not trust, so a copied 3210 in a
 * tree served on 3401 breaks sign-in in a way that looks like a bug in the
 * section.
 *
 * Dependencies used to be a junction to the integration tree's node_modules,
 * which was faster and wrong: Turbopack refuses a symlink that leaves the
 * project root — "Symlink [project]/node_modules is invalid, it points out of
 * the filesystem root" — so both `next build` and `next dev` died, and the
 * workaround was `--webpack`, a different bundler from the one Railway ships
 * with. A section cannot verify its own build against a bundler production does
 * not use. 400MB and half a minute per worktree buys that back.
 *
 *   node scripts/ops/worktree.mjs new voyager
 *   node scripts/ops/worktree.mjs list
 *   node scripts/ops/worktree.mjs rm voyager
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..', '..');
const REGISTRY = join(REPO, '.claude', 'skills', 'tn-flow', 'sections.json');

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', ...opts }).trim();
}

function tryGit(args) {
  try {
    return { ok: true, out: git(args, { stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (error) {
    return { ok: false, out: String(error.stderr ?? error.message).trim() };
  }
}

function die(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const registry = JSON.parse(readFileSync(REGISTRY, 'utf8'));
const WORKTREE_ROOT = resolve(REPO, '..', registry.worktreeRoot);

function section(name) {
  const found = registry.sections[name];
  if (!found) {
    die(
      `Unknown section "${name}".\n  Known: ${Object.keys(registry.sections).join(', ')}\n` +
        `  A genuinely new section is added to ${REGISTRY} first — the registry is what the\n` +
        `  orchestrator reads to know which branch to merge and which route to smoke-test.`,
    );
  }
  return { name, path: join(WORKTREE_ROOT, name), ...found };
}

/* The env file is gitignored, so a new worktree starts without one and the app
   will not boot. Copy it, then point the two origin variables at this port. */
function seedEnv(target, port) {
  const source = join(REPO, '.env.local');
  if (!existsSync(source)) {
    console.log('  .env.local  — none in the integration tree, skipped');
    return;
  }
  const destination = join(target, '.env.local');
  copyFileSync(source, destination);
  const rewritten = readFileSync(destination, 'utf8')
    .split('\n')
    .map((line) => {
      if (line.startsWith('BETTER_AUTH_URL=')) return `BETTER_AUTH_URL=http://localhost:${port}`;
      if (line.startsWith('NEXT_PUBLIC_SITE_URL=')) return `NEXT_PUBLIC_SITE_URL=http://localhost:${port}`;
      return line;
    })
    .join('\n');
  writeFileSync(destination, rewritten);
  console.log(`  .env.local  — copied, origins rewritten to :${port}`);
}

/* A real install, from the same lockfile. `ci` rather than `install` so a
   worktree can never drift to a different dependency tree than the one main
   builds against — and so `package.json` stays orchestrator-only in practice
   and not just in the registry. */
function installModules(target) {
  dropModules(target);
  console.log('  node_modules — installing from the lockfile (npm ci)…');
  try {
    /* `shell` on Windows: npm is a .cmd, and since Node 20.12 execFile refuses
       to spawn one directly — it fails with EINVAL, which reads like npm broke
       rather than like the call did. */
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], {
      cwd: target,
      stdio: ['ignore', 'ignore', 'inherit'],
      shell: process.platform === 'win32',
    });
    console.log('  node_modules — installed');
  } catch (error) {
    console.log(`  node_modules — \`npm ci\` failed (${error.message.split('\n')[0]})`);
    console.log('                 run it by hand in the worktree before starting');
  }
}

/* Worktrees made before dependencies were installed for real still hold a
   junction, and `git worktree remove` will not delete a reparse point: it walks
   into it, deletes the integration tree's dependencies on the way, and then
   fails on the link itself. So a link is unlinked, never recursed into; a real
   directory is deleted outright, which is also faster than letting git walk
   400MB of it. */
function dropModules(target) {
  const path = join(target, 'node_modules');
  let stat;
  try {
    stat = lstatSync(path);
  } catch {
    return;
  }
  if (stat.isSymbolicLink()) {
    try {
      unlinkSync(path);
    } catch {
      rmdirSync(path);
    }
    console.log('  node_modules — junction removed (it was made by an older version of this script)');
    return;
  }
  rmSync(path, { recursive: true, force: true });
  console.log('  node_modules — removed');
}

function create(name) {
  const target = section(name);
  if (existsSync(target.path)) die(`${target.path} already exists. Use it, or remove it with \`rm ${name}\`.`);

  console.log(`\n  Fetching…`);
  git(['fetch', 'origin', '--prune']);

  mkdirSync(WORKTREE_ROOT, { recursive: true });

  const remote = tryGit(['rev-parse', '--verify', `origin/${target.branch}`]);
  const local = tryGit(['rev-parse', '--verify', target.branch]);

  let add;
  if (local.ok) {
    add = ['worktree', 'add', target.path, target.branch];
    console.log(`  Branch ${target.branch} exists locally — checking it out into the worktree.`);
  } else if (remote.ok) {
    add = ['worktree', 'add', '--track', '-b', target.branch, target.path, `origin/${target.branch}`];
    console.log(`  Branch ${target.branch} exists on origin — tracking it.`);
  } else {
    add = ['worktree', 'add', '-b', target.branch, target.path, `origin/${registry.deployBranch}`];
    console.log(`  New branch ${target.branch}, cut from origin/${registry.deployBranch}.`);
  }

  const added = tryGit(add);
  if (!added.ok) die(`git worktree add failed:\n  ${added.out}`);

  installModules(target.path);
  seedEnv(target.path, target.port);

  console.log(`\n  ${name} is ready.\n`);
  console.log(`    cd ${target.path}`);
  console.log(`    npm run dev -- -p ${target.port}`);
  console.log(`\n  Turbopack, the same bundler Railway builds with — so \`npm run build\` here means`);
  console.log(`  something. \`next dev --webpack\` is no longer needed and no longer proves anything.`);
  console.log(`\n  This worktree owns, and only owns:`);
  for (const owned of target.owns) console.log(`    ${owned}`);
  console.log(`\n  Smoke routes the orchestrator will check after deploy:`);
  for (const route of target.smoke) console.log(`    ${registry.productionUrl}${route}`);
  console.log('');
}

function list() {
  git(['fetch', 'origin', '--prune']);
  const trees = git(['worktree', 'list', '--porcelain'])
    .split('\n\n')
    .map((block) => Object.fromEntries(block.split('\n').map((line) => line.split(' '))))
    .filter((tree) => tree.worktree);

  console.log('');
  for (const tree of trees) {
    const path = tree.worktree.replace(/\//g, '\\');
    const branch = (tree.branch ?? 'detached').replace('refs/heads/', '');
    const dirty = tryGit(['-C', path, 'status', '--porcelain']);
    const changed = dirty.ok && dirty.out ? dirty.out.split('\n').length : 0;

    const counts = tryGit(['rev-list', '--left-right', '--count', `origin/${registry.deployBranch}...${branch}`]);
    const [behind, ahead] = counts.ok ? counts.out.split(/\s+/) : ['?', '?'];

    const pushed = tryGit(['rev-parse', '--verify', `origin/${branch}`]);
    const unpushed = pushed.ok
      ? tryGit(['rev-list', '--count', `origin/${branch}..${branch}`]).out
      : 'no remote branch';

    console.log(`  ${branch}`);
    console.log(`    ${path}`);
    console.log(`    ${ahead} ahead / ${behind} behind ${registry.deployBranch}   ·   ${changed} uncommitted   ·   unpushed: ${unpushed}`);
  }
  console.log('');
}

function remove(name) {
  const target = section(name);
  if (!existsSync(target.path)) die(`No worktree at ${target.path}.`);

  const dirty = tryGit(['-C', target.path, 'status', '--porcelain']);
  if (dirty.ok && dirty.out) {
    die(`${name} has uncommitted changes. Commit or discard them deliberately first:\n\n${dirty.out}`);
  }

  /* Unreachable work is the only thing worth refusing over. A branch with a
     remote is measured against it; one without is measured against main, so a
     worktree that was created and never used can simply be removed. */
  const pushed = tryGit(['rev-parse', '--verify', `origin/${target.branch}`]);
  const against = pushed.ok ? `origin/${target.branch}` : `origin/${registry.deployBranch}`;
  const unpushed = tryGit(['rev-list', '--count', `${against}..${target.branch}`]).out;
  if (unpushed !== '0') {
    die(
      `${target.branch} has ${unpushed} commit(s) not on ${against}.\n` +
        `  Push them before removing the worktree — removing it is how they become unreachable.`,
    );
  }

  dropModules(target.path);
  /* `git worktree remove` deletes what git knows about and then rmdirs, so a
     leftover `.next` or `.env.local` stops it with "Directory not empty". The
     dirty check above already refused if anything untracked survived, so by
     here the only things left are ignored build artefacts — which is exactly
     what `clean -xdf` is for. */
  tryGit(['-C', target.path, 'clean', '-xdfq']);

  /* A `remove` that failed halfway deregisters the worktree and leaves the
     directory, so the next attempt is told it is "not a working tree" and the
     directory outlives every retry. Finish the job either way. */
  const removed = tryGit(['worktree', 'remove', target.path]);
  if (!removed.ok) {
    rmSync(target.path, { recursive: true, force: true });
    git(['worktree', 'prune']);
  }
  console.log(`\n  Removed ${target.path}. The branch ${target.branch} still exists.\n`);
}

const [command, argument] = process.argv.slice(2);
if (command === 'new' && argument) create(argument);
else if (command === 'list') list();
else if (command === 'rm' && argument) remove(argument);
else {
  console.log(`
  node scripts/ops/worktree.mjs new <section>   create the worktree, branch, node_modules link and .env.local
  node scripts/ops/worktree.mjs list            every worktree, its branch, and how far it has drifted
  node scripts/ops/worktree.mjs rm <section>    remove a worktree once its work is committed and pushed

  Sections: ${Object.keys(registry.sections).join(', ')}
`);
}

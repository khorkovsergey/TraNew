---
name: tn-flow
description: "The binding branch, commit, merge and deploy protocol for the TradingNew portal, which several Claude sessions develop at the same time. Use at the START of any session that will change code in tradingnew-portal, and whenever the task is to commit, push, merge, deploy to Railway, resolve a conflict between sessions, or work out why a change is not on the live site. Answers: which branch am I on, which files may I touch, what may I commit, who pushes to main."
---

# tn-flow — one section, one worktree, one branch

Several sessions build this portal at once. This file is how they stay out of
each other's way, and how work reaches `tradingnew.space`.

**Read this before touching a file. Not after.** Every rule below exists
because its absence has already cost work.

## The one rule

**A session never shares a working tree with another session, and never pushes
to `main`.**

Everything else follows. `tradingnew-portal/` is the *integration tree* — it
sits on `main` and only the orchestrator commits there. Section work happens in
`../worktrees/<section>/`, one directory per section, each with its own index,
its own branch, its own port.

## Which role am I?

| You were asked to… | Role | Read |
| --- | --- | --- |
| build, redesign or fix a section | **worker** | §Worker |
| commit, merge, push, deploy, "выложи на прод", "почему нет на сайте" | **orchestrator** | §Orchestrator |

One session is one role for its whole life. A worker that starts merging
branches is the failure this document prevents.

`sections.json`, beside this file, is the registry: every section's branch,
port, owned paths and smoke routes. It is authoritative — if a section is not
in it, it does not exist yet, and adding it is an orchestrator action.

## Worker

### Start

```
cd tradingnew-portal
node scripts/ops/worktree.mjs new <section>
cd ../worktrees/<section>
npm run dev -- -p <the port it printed>
```

That is the whole setup. The script cuts the branch from `origin/main`,
junctions `node_modules`, and copies `.env.local` with the origins rewritten to
your port. If the worktree already exists, use it — do not make a second one.

Then, before writing anything:

```
git fetch origin && git merge origin/main
```

Start from what is live. A branch cut days ago is a merge conflict you have not
met yet.

### Boundaries

**Change files your section owns.** The `owns` list in `sections.json` is the
boundary. Something outside it that genuinely needs to change:

- in `shared` → change it, under the append-only protocol below;
- in `orchestratorOnly` (`package.json`, `db/schema.ts`, `drizzle/`, build
  config) → **stop and ask the orchestrator**. A dependency or a migration
  added on one branch breaks every other worktree, because they share one
  `node_modules` and one database;
- owned by another section → **do not touch it**. Say what needs to change and
  why, and let it be routed. A drive-by fix in somebody else's file is a merge
  conflict in work you cannot see.

Do not fix the lint errors in `lintBaseline`. They are known, they are on
`main`, and they belong to their section's owner.

### Commit

```
git add <explicit paths>          ← the files you changed, named
git commit
```

**Never `git add -A`, `git add .`, `git commit -a`.** In a private worktree they
are less lethal than they were in the shared tree, but they still sweep up
half-written files and stray scripts. Name what you commit.

Before every commit, from the worktree:

```
npx tsc --noEmit
node scripts/test-events.mjs
```

Both must be clean. `npm run lint` is red on `main` already (see
`lintBaseline`) — read its output, confirm nothing new is yours, and say so in
the handoff rather than pretending it passed.

Once before handing off, also:

```
npm run build
```

The worktree installs its own dependencies, so this is Turbopack — the same
bundler Railway builds with — and a green build here means the deploy will
build. `next dev --webpack` was a workaround for a junctioned `node_modules`
and is no longer needed; it also proves nothing about the deploy, and the
webpack build has a separate failure of its own on `main`.

Commit in the repository's voice: a sentence that says what changed and why,
present tense, no ticket numbers, and the trailer the CLI adds. Small commits,
often. A branch that holds a day of work in one commit cannot be partially
shipped when half of it turns out to be wrong.

### Hand off

```
git fetch origin && git merge origin/main    ← again, right before pushing
npx tsc --noEmit && node scripts/test-events.mjs
git push -u origin <your branch>
```

Then tell the orchestrator, in these words: **the branch, what shipped, which
routes to check, and anything you deliberately left undone.** A handoff without
routes to check is how a section quietly fails to deploy.

**A worker's job ends at `git push` of its own branch.** Not at main, not at
Railway.

### Removing a worktree

```
node scripts/ops/worktree.mjs rm <section>
```

**Never `git worktree remove` by hand.** It stops on the first thing it did not
put there — a `.next`, an `.env.local` — with "Directory not empty", and a
half-finished remove deregisters the worktree while leaving the directory, so
every retry is then told it is "not a working tree". The script clears the
ignored artefacts first and finishes the job either way.

Worktrees made before 8 August 2026 hold a **junction** to the integration
tree's `node_modules` instead of their own install. Git's recursive delete walks
straight through a junction and deletes the real dependencies on its way, which
breaks every other session at once. The script unlinks before removing; if it
has already happened, `npm install` in `tradingnew-portal` puts back what was
taken. To convert an old worktree in place, delete the junction (do not use a
recursive delete on it) and run `npm ci`.

## Orchestrator

### Integrate

Only in `tradingnew-portal/`, only on `main`:

```
cd tradingnew-portal
git checkout main && git fetch origin && git pull --ff-only
node scripts/ops/worktree.mjs list          ← what is ready, what has drifted
```

Merge **one branch at a time**, gate after each, never in a batch:

```
git merge --no-ff origin/feat/<section>
npx tsc --noEmit && node scripts/test-events.mjs
```

`--no-ff` keeps each section a legible unit, so one bad section can be reverted
without unpicking the others. Always merge, never rebase — this history already
contains cherry-picked duplicates, and a rebase replays them into conflicts
against themselves.

If a gate fails: **do not fix it yourself.** Reset the merge and send it back to
the section's session. You cannot know what the change was trying to do.

```
git merge --abort        # or: git reset --hard HEAD
```

### Conflicts

Only in `shared` files, if the append-only protocol below was kept — and then
the resolution is **union**: keep both additions. Anywhere else, a conflict
means two sections edited the same code, which the registry is supposed to
prevent. Stop, name both sections, and ask which one is right. Never guess, and
never resolve by taking one side wholesale.

### Deploy

```
git push origin main
```

That is the deploy. Railway builds from GitHub on every push to `main`; there
is no `railway up` in this project. Then, and this is not optional:

```
railway deployment list --service tradingnew-portal     ← wait for SUCCESS
curl https://tradingnew.space/api/health                ← 200 {"status":"ok"}
```

**Then smoke every merged section's routes from `sections.json`.** Health is
the app answering, not the section shipping. A green health check on a build
that never contained your section is exactly the reassurance that hid the
Voyager rollback for an hour.

If a route 404s, the section is not on `main` — go back and look at what was
merged, do not redeploy and hope.

### Close the loop

After a successful deploy, bring every live branch back up to date, so no
worktree keeps working against a portal that has moved:

```
git -C ../worktrees/<section> merge origin/main
```

Then tell each session its branch has been merged and synced. A worker that
does not know its work shipped will push it again.

### Never

- `git push --force` to any shared branch. Ever.
- Push to `main` while a section's push is in flight — `git ls-remote` first.
- Commit in a section's worktree. It is not yours.
- Deploy without knowing which sections are in the build.

## Shared files: append-only

`src/messages/en.json`, `Icon.tsx`, `routing.ts`, `sitemap.ts`,
`analytics.ts`, the shell components, `next.config.ts` — every section touches
these, so every section can break every other one here.

1. **Add at the end of your section's block**, in the place the file already
   groups your section's entries.
2. **Never reorder, never reformat, never re-sort keys.** A formatter run on
   `en.json` is a conflict in every open branch simultaneously.
3. **Never delete another section's entry**, even if it looks dead. Say it looks
   dead instead.
4. Keep the addition minimal — one key, one icon path, one route, one event.

Follow this and a conflict here resolves by keeping both sides. Break it and
someone loses a day.

## Why this exists

On 8 August 2026, four sessions shared one working tree on one branch. The
sequence was:

- Sessions staged work into **one shared index**, so each `git commit` picked up
  whatever the others had left half-finished.
- The Academy session merged to `main` and deployed. Voyager's work was
  committed to `events-redesign`, which was never merged.
- `main` deployed twice more. `/en/voyager/research` returned **404 in
  production** while `/api/health` returned 200, and the Voyager work looked
  reverted to its previous version.

Nothing was actually lost — it was one branch away the whole time. But an hour
went into finding that out, and the next time the same setup will lose
something for real: one `git checkout --` in a shared tree, and unstaged work
from three sessions is gone with no reflog to recover it from.

The isolation is the point. The smoke test after deploy is the second point.

#!/usr/bin/env node

import cp from "node:child_process";
/**
 * Automated release helper.
 *
 * Responsibilities:
 *  - Parse required --version=<semver> flag.
 *  - Detect previous git tag (sorted by version) matching pattern v<semver>.
 *  - Collect commits between previous tag (exclusive) and HEAD.
 *  - Categorize commits into Added / Changed / Fixed / Removed / Performance / Security / Docs / Chore / Tests / Other
 *    using conventional commit style prefixes (feat, fix, perf, docs, chore, refactor, test, build, ci, style, revert).
 *  - Generate a CHANGELOG section matching existing style: `## [<version>] - YYYY-MM-DD` with subsections only if content exists.
 *  - Insert new section ABOVE the previous released version (after Unreleased block if present) in CHANGELOG.md.
 *  - Update package.json & package-lock.json version fields.
 *  - (Optional) Dry run with --dry-run (no file writes) (not required by request, but low-cost addition).
 *
 * Notes:
 *  - Exits non-zero on missing flag or invalid semver.
 *  - Leaves tagging / pushing to caller.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function die(msg) {
  console.error(`[release] ${msg}`);
  process.exit(1);
}

function parseArgs() {
  const raw = process.argv.slice(2);
  const out = {
    version: null,
    dryRun: false,
    noCommit: false,
    force: false,
    bump: null,
    push: false,
    tag: false,
    verbose: false,
    help: false,
  };
  // Support both --flag=value and --flag value styles.
  for (let i = 0; i < raw.length; i++) {
    let a = raw[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a.startsWith("--version=")) {
      out.version = a.split("=")[1];
      continue;
    }
    if (a === "--version") {
      out.version = raw[i + 1];
      i++;
      continue;
    }
    if (a === "--dry-run") {
      out.dryRun = true;
      continue;
    }
    if (a === "--no-commit") {
      out.noCommit = true;
      continue;
    }
    if (a === "--force") {
      out.force = true;
      continue;
    }
    if (a.startsWith("--bump=")) {
      out.bump = a.split("=")[1];
      continue;
    }
    if (a === "--bump") {
      out.bump = raw[i + 1];
      i++;
      continue;
    }
    if (a === "--push") {
      out.push = true;
      continue;
    }
    if (a === "--tag") {
      out.tag = true;
      continue;
    }
    if (a === "--verbose") {
      out.verbose = true;
      continue;
    }
  }
  if (out.help) {
    console.log(
      `Usage: generate_release.mjs [--version <x.y.z> | --bump <patch|minor|major>] [options]\n\nOptions:\n  --version <semver>        Explicit version (also --version=x.y.z)\n  --bump <part>             Derive next version from current package.json (part: patch|minor|major)\n  --dry-run                 Show changes without writing files\n  --no-commit               Do not create git commit/tag/push\n  --force                   Allow reuse of existing tag / changelog section\n  --push                    After commit, create and push git tag and branch\n  --verbose                 Extra diagnostic logging\n  --help, -h                Show this help\n`,
      `Usage: generate_release.mjs [--version <x.y.z> | --bump <patch|minor|major>] [options]\n\nOptions:\n  --version <semver>        Explicit version (also --version=x.y.z)\n  --bump <part>             Derive next version from current package.json (part: patch|minor|major)\n  --dry-run                 Show changes without writing files\n  --no-commit               Do not create git commit/push/tag\n  --force                   Allow reuse of existing tag / changelog section\n  --tag                     Create a tag for the release (no push unless --push)\n  --push                    Push branch (and tag if created with --tag)\n  --verbose                 Extra diagnostic logging\n  --help, -h                Show this help\n`,
    );
    process.exit(0);
  }
  if (out.bump) {
    if (!["patch", "minor", "major"].includes(out.bump)) die(`Invalid bump type: ${out.bump}`);
  }
  if (!out.version && !out.bump) die("Provide either --version=<semver> or --bump=patch|minor|major");
  if (out.version && !/^\d+\.\d+\.\d+$/.test(out.version)) die(`Invalid semver: ${out.version}`);
  return out;
}

function exec(cmd) {
  try {
    return cp.execSync(cmd, { encoding: "utf8" }).trim();
  } catch (e) {
    die(`Command failed: ${cmd}\n${e.message}`);
  }
}

function getTags() {
  const raw = exec("git tag");
  return raw
    .split(/\n/)
    .filter(Boolean)
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => {
      const pa = a.slice(1).split(".").map(Number);
      const pb = b.slice(1).split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
      }
      return 0;
    });
}

function getPreviousTag(tags, version) {
  // previous tag is the greatest tag < target
  const sem = version.split(".").map(Number);
  let prev = null;
  for (const t of tags) {
    const parts = t.slice(1).split(".").map(Number);
    let lt = false;
    let gt = false;
    for (let i = 0; i < 3; i++) {
      if (parts[i] < sem[i]) {
        lt = true;
        break;
      } else if (parts[i] > sem[i]) {
        gt = true;
        break;
      }
    }
    if (lt && !gt) prev = t; // update candidate
    if (gt) break; // tags sorted ascending
  }
  return prev;
}

function collectCommits(sinceTag) {
  const range = sinceTag ? `${sinceTag}..HEAD` : "";
  const raw = exec(`git log --pretty=format:%H:::%s ${range}`);
  if (!raw) return [];
  return raw
    .split(/\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split(":::");
      return { hash, subject };
    });
}

function categorize(commits) {
  const buckets = {
    Added: [],
    Changed: [],
    Fixed: [],
    Removed: [],
    Performance: [],
    Security: [],
    Documentation: [],
    Tests: [],
    Chore: [],
    Other: [],
  };
  for (const c of commits) {
    const s = c.subject;
    const entry = `- ${s}`;
    if (/^(feat|add)(\(|:)/i.test(s)) buckets.Added.push(entry);
    else if (/^(fix)(\(|:)/i.test(s)) buckets.Fixed.push(entry);
    else if (/^(perf)(\(|:)/i.test(s)) buckets.Performance.push(entry);
    else if (/^(docs?)(\(|:)/i.test(s)) buckets.Documentation.push(entry);
    else if (/^(chore)(\(|:)/i.test(s)) buckets.Chore.push(entry);
    else if (/^(test|tests)(\(|:)/i.test(s)) buckets.Tests.push(entry);
    else if (/^(refactor)(\(|:)/i.test(s)) buckets.Changed.push(entry);
    else if (/^(remove|delete)(\(|:)/i.test(s)) buckets.Removed.push(entry);
    else if (/^(sec|security)(\(|:)/i.test(s)) buckets.Security.push(entry);
    else if (/^(change|update)(\(|:)/i.test(s)) buckets.Changed.push(entry);
    else buckets.Other.push(entry);
  }
  return buckets;
}

function buildSection(version, buckets) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`## [${version}] - ${date}`, "");
  const order = [
    ["Added", "Added"],
    ["Changed", "Changed"],
    ["Fixed", "Fixed"],
    ["Removed", "Removed"],
    ["Performance", "Performance"],
    ["Security", "Security"],
    ["Documentation", "Documentation"],
    ["Tests", "Testing"],
    ["Chore", "Chore"],
    ["Other", "Misc"],
  ];
  for (const [key, heading] of order) {
    if (buckets[key].length) {
      lines.push(`### ${heading}`, "");
      lines.push(...buckets[key], "");
    }
  }
  return lines.join("\n");
}

function updateChangelog(section) {
  const changelogPath = path.resolve("CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) die("CHANGELOG.md not found");
  const original = fs.readFileSync(changelogPath, "utf8");
  const lines = original.split(/\n/);
  // Find insertion point: after "## [Unreleased]" block if exists, else after header lines.
  let insertIdx = -1;
  const unreleasedIdx = lines.findIndex((l) => /^## \[Unreleased\]/.test(l));
  if (unreleasedIdx !== -1) {
    // Insert after the Unreleased block (scan until next heading or end) leaving one blank line before new section
    for (let i = unreleasedIdx + 1; i < lines.length; i++) {
      if (/^## \[/.test(lines[i])) {
        insertIdx = i;
        break;
      }
    }
    if (insertIdx === -1) insertIdx = lines.length;
  } else {
    // after first heading line (# Changelog) and descriptive paragraphs
    insertIdx = lines.findIndex((l) => /^## \[/.test(l));
    if (insertIdx === -1) insertIdx = lines.length; // append
  }
  const before = lines.slice(0, insertIdx).join("\n");
  const after = lines.slice(insertIdx).join("\n");
  const updated = `${before}\n\n${section}\n\n${after}`.replace(/\n{3,}/g, "\n\n");
  return { updated, original };
}

function bumpPackageJson(version) {
  const pkgPath = path.resolve("package.json");
  const lockPath = path.resolve("package-lock.json");
  if (!fs.existsSync(pkgPath)) die("package.json missing");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  if (fs.existsSync(lockPath)) {
    try {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
      if (lock.version) lock.version = version;
      if (lock.packages && lock.packages[""]) lock.packages[""].version = version;
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + "\n");
    } catch (e) {
      console.warn("[release] failed to update package-lock.json:", e.message);
    }
  }
}

function updateReadmeBadge(version) {
  const readmePath = path.resolve("README.md");
  if (!fs.existsSync(readmePath)) {
    console.warn("[release] README.md not found; skipping badge update");
    return false;
  }
  const original = fs.readFileSync(readmePath, "utf8");
  // Replace version in shields.io badge like: version-1.5.1-blue.svg
  const updated = original.replace(/(\bversion-)(\d+\.\d+\.\d+)(-blue\.svg)/i, `$1${version}$3`);
  if (updated !== original) {
    fs.writeFileSync(readmePath, updated, "utf8");
    console.log("[release] README.md npm version badge updated to", version);
    return true;
  }
  console.warn("[release] No npm version badge pattern found in README.md");
  return false;
}

function logv(verbose, msg) {
  if (verbose) console.log(msg);
}

async function createOrUpdateRelease(owner, repo, tag, name, body, token, force) {
  if (!token) throw new Error("Missing GitHub token");
  const existingUrl = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodeURIComponent(tag)}`;
  // check existing
  let existing = null;
  try {
    const res = await fetch(existingUrl, { method: "GET", headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` } });
    if (res.status === 200) existing = await res.json();
    else if (res.status !== 404) {
      const j = await res.json().catch(() => ({}));
      throw new Error(`Failed to query existing release: ${res.status} ${j && j.message}`);
    }
  } catch (e) {
    throw new Error(`Failed to query release: ${e && e.message}`, { cause: e });
  }

  if (existing && !force) {
    console.log(`[release] Release for ${tag} already exists (id=${existing.id}), skipping (use --force to update)`);
    return existing;
  }

  const url = existing ? `https://api.github.com/repos/${owner}/${repo}/releases/${existing.id}` : `https://api.github.com/repos/${owner}/${repo}/releases`;
  const method = existing ? "PATCH" : "POST";
  const payload = { tag_name: tag, name: name || tag, body: body || "", draft: false, prerelease: false };
  const res2 = await fetch(url, { method, headers: { "Content-Type": "application/json", Accept: "application/vnd.github+json", Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  const j2 = await res2.json().catch(() => ({}));
  if (!res2.ok) throw new Error(`Failed to create/update release: ${res2.status} ${j2 && j2.message}`);
  console.log((existing ? "Updated" : "Created") + ` release for ${tag} -> ${j2.html_url}`);
  return j2;
}

(async function main() {
  const { version: explicitVersion, dryRun, noCommit, force, bump, push, tag, verbose } = parseArgs();
  let version = explicitVersion;
  if (!version && bump) {
    // derive from current package.json version
    const pkgPath = path.resolve("package.json");
    if (!fs.existsSync(pkgPath)) die("package.json missing for bump");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const cur = pkg.version;
    if (!/^\d+\.\d+\.\d+$/.test(cur)) die(`Current package.json version not semver: ${cur}`);
    const parts = cur.split(".").map(Number);
    if (bump === "patch") {
      parts[2]++;
    } else if (bump === "minor") {
      parts[1]++;
      parts[2] = 0;
    } else if (bump === "major") {
      parts[0]++;
      parts[1] = 0;
      parts[2] = 0;
    }
    version = parts.join(".");
    console.log(`[release] Derived version ${version} from bump=${bump}`);
  }
  const tags = getTags();
  const tagName = `v${version}`;
  if (!force && tags.includes(tagName)) die(`Tag ${tagName} already exists (use --force to override)`);
  const prev = getPreviousTag(tags, version);
  console.log(`[release] Preparing ${version} (previous tag: ${prev || "none"})`);
  const commits = collectCommits(prev);
  // Remove commits produced by previous automated release commits like
  // "Release: v1.2.3" so they don't appear in the generated changelog.
  const filteredCommits = commits.filter((c) => {
    // Trim subject and ignore simple Release: vX.Y.Z lines
    const s = (c.subject || "").trim();
    if (/^Release:\s*v\d+\.\d+\.\d+$/i.test(s)) return false;
    return true;
  });
  logv(verbose, `[release][debug] Collected ${commits.length} commits, ${filteredCommits.length} after filtering release commits`);
  if (!commits.length) console.warn("[release] No commits found since previous tag; changelog will still be created");
  const buckets = categorize(filteredCommits);
  if (verbose) {
    const counts = Object.entries(buckets)
      .map(([k, v]) => `${k}=${v.length}`)
      .join(", ");
    console.log("[release][debug] Bucket counts:", counts);
  }
  const section = buildSection(version, buckets);
  const changelogPath = path.resolve("CHANGELOG.md");
  if (!fs.existsSync(changelogPath)) die("CHANGELOG.md not found");
  const existing = fs.readFileSync(changelogPath, "utf8");
  const headingRe = new RegExp(`^## \\[${version}\\] `, "m");
  if (!force && headingRe.test(existing)) die(`CHANGELOG already has section for ${version} (use --force to override)`);
  const { updated } = updateChangelog(section);
  if (verbose) {
    const insertionIndex = existing.indexOf("## [Unreleased]") !== -1 ? "after Unreleased block" : "top before previous releases";
    console.log("[release][debug] Insertion point determined:", insertionIndex);
  }
  if (dryRun) {
    console.log("----- NEW CHANGELOG SECTION (dry-run) -----");
    console.log(section);
    console.log("----- END SECTION -----");
    return; // do not write files
  }
  fs.writeFileSync(path.resolve("CHANGELOG.md"), updated);
  bumpPackageJson(version);
  updateReadmeBadge(version);
  console.log("[release] CHANGELOG.md updated");
  console.log("[release] package.json (and lock if present) bumped to", version);
  if (!noCommit) {
    try {
      // stage files
      exec("git add CHANGELOG.md README.md package.json package-lock.json 2>/dev/null || git add CHANGELOG.md README.md package.json");
      // check if there is something to commit
      const diff = exec("git diff --cached --name-only");
      if (!diff) {
        console.log("[release] No staged changes to commit");
      } else {
        const msg = `Release: v${version}`;
        exec(`git commit -m "${msg.replace(/"/g, '\\"')}"`);
        console.log("[release] Created commit:", msg);
        // Tag only if --tag provided
        let createdTag = false;
        if (tag) {
          try {
            if (verbose) console.log("[release][debug] Attempting annotated tag creation");
            try {
              cp.execSync(`git tag -a ${tagName} -m "Release ${version}"`, {
                stdio: "pipe",
              });
              console.log("[release] Created annotated tag", tagName);
            } catch (tagErr) {
              console.warn(`[release] Annotated tag failed (${tagErr.message.trim()}); falling back to lightweight tag`);
              cp.execSync(`git tag ${tagName}`, { stdio: "pipe" });
              console.log("[release] Created lightweight tag", tagName);
            }
            createdTag = true;
          } catch (e) {
            console.warn("[release] Tag creation failed:", e.message);
          }
        } else if (verbose) {
          console.log("[release][debug] Skipping tag creation (no --tag)");
        }
        if (push) {
          try {
            if (verbose) console.log("[release][debug] Pushing branch");
            exec("git push");
            if (createdTag) {
              if (verbose) console.log("[release][debug] Pushing tag");
              exec(`git push origin ${tagName}`);
              console.log("[release] Pushed tag", tagName);
            }
            console.log("[release] Pushed branch");
          } catch (e) {
            console.warn("[release] push failed:", e.message);
            if (createdTag) console.warn(`[release] Manual tag push: git push origin ${tagName}`);
          }
        }
      }
    } catch (e) {
      console.warn("[release] auto-commit failed:", e.message);
    }
  } else {
    console.log("[release] Skipped commit (--no-commit)");
  }
  // If we pushed and we have a GitHub token, attempt to create/update the release
  if (push) {
    const token = process.env.GITHUB_ADMIN_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    // derive owner/repo from package.json if possible
    let owner = null;
    let repo = null;
    try {
      const pkg = JSON.parse(fs.readFileSync(path.resolve("package.json"), "utf8"));
      if (pkg.repository && pkg.repository.url) {
        const m = pkg.repository.url.match(/github.com[:/](.+?)\/(.+?)(?:\.git)?$/i);
        if (m) {
          owner = m[1];
          repo = m[2];
        }
      }
    } catch {
      // ignore
    }
    if (token && owner && repo) {
      try {
        // ensure fetch is available (Node 18+). Throw helpful error if not.
        if (typeof globalThis.fetch !== "function") throw new Error("fetch API not available in this Node runtime");
        // Prepare release name (tag) and body.
        // Use the raw section slice from CHANGELOG.md to preserve subsection headings like '###'.
        let bodyForRelease = "";
        try {
          const changelogRaw = fs.readFileSync(path.resolve("CHANGELOG.md"), "utf8");
          // Robustly capture the changelog section for this version up to the next '## [' heading or EOF.
          // This regex matches the heading line '## [X.Y.Z]' and greedily captures everything until the next '## [' at line-start or EOF.
          try {
            // Robust extraction without complex regexes:
            // Find the heading line that starts with '## [version]' and slice until the next '## [' or EOF.
            const heading = `## [${version}]`;
            const startIdx = changelogRaw.indexOf(heading);
            if (startIdx !== -1) {
              // find the next '## [' after startIdx+heading.length
              const rest = changelogRaw.slice(startIdx + heading.length);
              const nextHeadingIdxInRest = rest.search(/\n## \[/);
              if (nextHeadingIdxInRest !== -1) {
                bodyForRelease = changelogRaw.slice(startIdx, startIdx + heading.length + nextHeadingIdxInRest).trim();
              } else {
                // until EOF
                bodyForRelease = changelogRaw.slice(startIdx).trim();
              }
            } else if (section && typeof section === "string") {
              bodyForRelease = section.trim();
            } else {
              bodyForRelease = section || `Release ${tagName}`;
            }
          } catch (_e) {
            console.warn("[release] Failed to extract changelog section using regex, falling back to in-memory section", _e && _e.message ? _e.message : _e);
            if (section && typeof section === "string") bodyForRelease = section.trim();
            else bodyForRelease = section || `Release ${tagName}`;
          }
        } catch {
          // On any error, fallback to the in-memory section
          if (section && typeof section === "string") bodyForRelease = section.trim();
          else bodyForRelease = section || `Release ${tagName}`;
        }

        // Use tagName (e.g. v1.2.3) as the release title
        await createOrUpdateRelease(owner, repo, tagName, tagName, bodyForRelease, token, force);
      } catch (e) {
        console.warn("[release] Failed to create/update GitHub release:", e && e.message);
      }
    } else if (push) {
      if (!token) console.log("[release] Skipping GitHub release creation: no token in env");
      else console.log("[release] Skipping GitHub release creation: owner/repo not determined from package.json");
    }
  }
})();

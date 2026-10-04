import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const appPath = join(projectDir, "app.json");
const app = JSON.parse(readFileSync(appPath, "utf8"));
const token = process.env.EXPO_TOKEN;
if (!token) throw new Error("EXPO_TOKEN is required; configure the GitHub Actions secret.");
if (app.expo.slug !== "hala" || app.expo.ios?.bundleIdentifier !== "com.noortoona.hala") {
  throw new Error("Refusing to link a different Hala slug or iOS bundle identifier.");
}

// Read the same account/project fields used by EAS CLI. Never send the token to
// any host other than Expo, and never include it in logs or generated files.
async function query(queryText, variables = {}, allowMissing = false) {
  const response = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: queryText, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Expo API returned HTTP ${response.status}.`);
  const result = await response.json();
  if (result.errors?.length) {
    if (allowMissing && result.errors.every(error => error.extensions?.errorCode === "EXPERIENCE_NOT_FOUND")) return null;
    throw new Error(result.errors.map(error => error.message).join("; "));
  }
  if (!result.data) throw new Error("Expo API returned no data.");
  return result.data;
}

const projectFields = "id slug ownerAccount { name }";
let existing;
const configuredId = app.expo.extra?.eas?.projectId;
if (configuredId) {
  const data = await query(`query HalaProject($id: String!) { app { byId(appId: $id) { ${projectFields} } } }`, { id: configuredId });
  existing = data.app.byId;
} else {
  const data = await query(`query HalaAccounts {
    meActor {
      accounts { name viewerUserPermission { role } }
      ... on UserActor { username }
    }
  }`);
  const actor = data.meActor;
  if (!actor?.accounts?.length) throw new Error("The Expo token cannot access an account.");

  // Search every accessible account before creating anything. A failed lookup
  // must not be interpreted as permission to create another project.
  const matches = [];
  for (const account of actor.accounts) {
    const found = await query(`query HalaByName($name: String!) { app { byFullName(fullName: $name) { ${projectFields} } } }`, { name: `@${account.name}/hala` }, true);
    if (found?.app?.byFullName) matches.push(found.app.byFullName);
  }
  const candidates = app.expo.owner ? matches.filter(project => project.ownerAccount.name === app.expo.owner) : matches;
  if (candidates.length > 1) throw new Error("Multiple existing Hala projects found. Set expo.owner or extra.eas.projectId; no project was created.");
  existing = candidates[0];
  if (!existing) {
    if (matches.length) throw new Error("Hala already exists under a different Expo owner. No duplicate was created.");
    const writable = actor.accounts.filter(account => account.viewerUserPermission?.role !== "VIEW_ONLY");
    const owner = app.expo.owner || writable.find(account => account.name === actor.username)?.name || (writable.length === 1 ? writable[0].name : undefined);
    if (!owner || !writable.some(account => account.name === owner)) {
      throw new Error("Set expo.owner to an account with project creation permissions; no project was created.");
    }
    app.expo.owner = owner;
  }
}

if (existing && (existing.slug !== "hala" || (app.expo.owner && app.expo.owner !== existing.ownerAccount.name))) {
  throw new Error("The saved EAS project ID does not match the configured Hala owner/slug.");
}

// Initialize against a temporary static config because app.config.js cannot be
// rewritten by EAS. Copy only the verified owner and ID into the real config.
const bootstrapDir = mkdtempSync(join(projectDir, ".eas-bootstrap-"));
let linked;
try {
  const pkg = JSON.parse(readFileSync(join(projectDir, "package.json"), "utf8"));
  writeFileSync(join(bootstrapDir, "package.json"), JSON.stringify({ name: "hala-eas-link", private: true, dependencies: { expo: pkg.dependencies.expo } }));
  writeFileSync(join(bootstrapDir, "app.json"), JSON.stringify({ expo: { name: app.expo.name, slug: "hala", owner: existing?.ownerAccount.name || app.expo.owner } }));
  const args = ["init", existing ? "--id" : "--account", existing?.id || app.expo.owner, "--non-interactive", "--json", "--no-icon"];
  linked = JSON.parse(execFileSync("eas", args, { cwd: bootstrapDir, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
} finally {
  rmSync(bootstrapDir, { recursive: true, force: true });
}
if (linked.slug !== "hala" || !linked.projectId || linked.owner !== (existing?.ownerAccount.name || app.expo.owner)) {
  throw new Error("Unexpected EAS link result; the real app config was not changed.");
}
app.expo.owner = linked.owner;
app.expo.extra = { ...app.expo.extra, eas: { ...app.expo.extra?.eas, projectId: linked.projectId } };
writeFileSync(appPath, JSON.stringify(app, null, 2) + "\n");
writeFileSync(join(projectDir, "eas-project.json"), JSON.stringify(linked, null, 2) + "\n");
console.log(JSON.stringify(linked, null, 2));

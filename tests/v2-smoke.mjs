// Smoke test of the new Planka v2 tools against a live Planka, without restarting
// Claude Desktop. It starts dist/index.js as a child process and talks MCP to it.
//
// Credentials: taken from the "kanban" server of claude_desktop_config.json (never
// printed), or from PLANKA_BASE_URL / PLANKA_AGENT_EMAIL / PLANKA_AGENT_PASSWORD.
//
// Usage: node tests/v2-smoke.mjs <boardId>
// The board must be a disposable test board: the test creates and deletes lists,
// cards, task lists, tasks and attachments on it.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "..", "dist", "index.js");
const boardId = process.argv[2];
if (!boardId) {
  console.error("Usage: node tests/v2-smoke.mjs <boardId>");
  process.exit(2);
}

function loadEnv() {
  const need = ["PLANKA_BASE_URL", "PLANKA_AGENT_EMAIL", "PLANKA_AGENT_PASSWORD"];
  if (need.every((k) => process.env[k])) return {};
  const roots = [
    process.env.APPDATA && join(process.env.APPDATA, "Claude"),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, "Claude-Data"),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, "Packages"),
  ].filter(Boolean);
  const found = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let entries = [];
    try {
      entries = require_fs().readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isFile() && e.name === "claude_desktop_config.json") found.push(p);
      else if (e.isDirectory() && !e.name.startsWith("node_modules")) {
        walk(p, depth + 1);
      }
    }
  };
  for (const r of roots) walk(r, 0);
  for (const file of found) {
    const cfg = JSON.parse(readFileSync(file, "utf8"));
    const servers = cfg.mcpServers || {};
    const key = Object.keys(servers).find((k) => /kanban|planka/i.test(k));
    if (key && servers[key].env) return servers[key].env;
  }
  throw new Error("Credentials not found: set PLANKA_* environment variables");
}

import * as fs from "node:fs";
function require_fs() {
  return fs;
}

const child = spawn(process.execPath, [entry], {
  env: { ...process.env, ...loadEnv() },
  stdio: ["pipe", "pipe", "inherit"],
});

let nextId = 1;
const pending = new Map();
let buffer = "";
child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((res) => {
    pending.set(id, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

async function call(tool, args) {
  const msg = await rpc("tools/call", { name: tool, arguments: args });
  if (msg.error) return { error: msg.error.message };
  const text = msg.result?.content?.[0]?.text ?? "";
  if (msg.result?.isError) return { error: text };
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let passed = 0;
let failed = 0;
function check(name, ok, detail) {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + JSON.stringify(detail)}`);
}
const isErr = (r) => r && typeof r === "object" && "error" in r;

// ---------------------------------------------------------------------------
const created = { lists: [], cards: [] };
const dir = process.env.PLANKA_ATTACHMENTS_DIR ||
  join(homedir(), "kanban-mcp-attachments");

try {
  await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "v2-smoke", version: "1" },
  });
  child.stdin.write(
    JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
  );

  const tools = (await rpc("tools/list", {})).result.tools.map((t) => t.name);
  for (const t of [
    "mcp_kanban_card_membership_manager",
    "mcp_kanban_task_list_manager",
    "mcp_kanban_attachment_manager",
  ]) {
    check(`tool registered: ${t}`, tools.includes(t), tools);
  }

  // --- board lists (archive / trash) --------------------------------------
  const summary = await call("mcp_kanban_project_board_manager", {
    action: "get_board_summary",
    boardId,
  });
  const archive = summary.lists?.find((l) => l.type === "archive");
  const trash = summary.lists?.find((l) => l.type === "trash");
  check("board has archive and trash lists", !!archive && !!trash, summary);

  // --- lists: types, sort, move_cards, clear --------------------------------
  const work = await call("mcp_kanban_list_manager", {
    action: "create", boardId, name: "SMOKE work", position: 65535,
  });
  check("list create (active)", !isErr(work), work);
  created.lists.push(work.id);

  const closed = await call("mcp_kanban_list_manager", {
    action: "create", boardId, name: "SMOKE closed", position: 131070, type: "closed",
  });
  check("list create (type closed)", !isErr(closed), closed);
  if (!isErr(closed)) created.lists.push(closed.id);

  const mk = async (listId, name, position, extra = {}) => {
    const c = await call("mcp_kanban_card_manager", {
      action: "create", listId, name, position, ...extra,
    });
    if (!isErr(c)) created.cards.push(c.id);
    return c;
  };
  const cB = await mk(work.id, "B card", 65535);
  const cA = await mk(work.id, "A card", 131070);
  const cC = await mk(work.id, "C card", 196605);
  check("cards created", ![cA, cB, cC].some(isErr), [cA, cB, cC]);

  const sorted = await call("mcp_kanban_list_manager", {
    action: "sort", id: work.id, fieldName: "name", order: "asc",
  });
  check(
    "list sort by name asc",
    !isErr(sorted) && sorted.cards?.length === 3,
    sorted,
  );
  const afterSort = await call("mcp_kanban_card_manager", {
    action: "get_all", listId: work.id,
  });
  const names = Array.isArray(afterSort)
    ? [...afterSort].sort((a, b) => a.position - b.position).map((c) => c.name)
    : afterSort;
  check(
    "cards are in sorted order",
    JSON.stringify(names) === JSON.stringify(["A card", "B card", "C card"]),
    names,
  );

  const sortedDesc = await call("mcp_kanban_list_manager", {
    action: "sort", id: work.id, fieldName: "name", order: "desc",
  });
  check("list sort by name desc", !isErr(sortedDesc), sortedDesc);

  if (!isErr(closed) && archive) {
    const mv = await call("mcp_kanban_card_manager", {
      action: "move", id: cC.id, listId: closed.id, position: 65535,
    });
    check("card moved to the closed list", !isErr(mv), mv);
    const moved = await call("mcp_kanban_list_manager", {
      action: "move_cards", id: closed.id, targetListId: archive.id,
    });
    check(
      "move_cards: closed list -> archive",
      !isErr(moved) && moved.cards?.length === 1,
      moved,
    );
  }

  if (trash) {
    const toTrash = await call("mcp_kanban_card_manager", {
      action: "move", id: cB.id, listId: trash.id, position: 65535,
    });
    check("card moved to trash", !isErr(toTrash), toTrash);
    const cleared = await call("mcp_kanban_list_manager", {
      action: "clear", id: trash.id,
    });
    check("clear trash list", !isErr(cleared), cleared);
  }
  const notTrash = await call("mcp_kanban_list_manager", {
    action: "clear", id: work.id,
  });
  check("clear refuses a non-trash list", isErr(notTrash), notTrash);

  // --- card memberships -------------------------------------------------------
  const users = await call("mcp_kanban_card_membership_manager", {
    action: "get_board_users", boardId,
  });
  check("board users listed", Array.isArray(users) && users.length > 0, users);
  const userId = Array.isArray(users) ? users[0]?.id : undefined;
  if (userId) {
    const add = await call("mcp_kanban_card_membership_manager", {
      action: "add", cardId: cA.id, userId,
    });
    check("card member added", !isErr(add), add);
    const all = await call("mcp_kanban_card_membership_manager", {
      action: "get_all", cardId: cA.id,
    });
    check(
      "card members listed",
      Array.isArray(all) && all.some((m) => m.userId === userId),
      all,
    );
    const rm = await call("mcp_kanban_card_membership_manager", {
      action: "remove", cardId: cA.id, userId,
    });
    check("card member removed", !isErr(rm), rm);
    const after = await call("mcp_kanban_card_membership_manager", {
      action: "get_all", cardId: cA.id,
    });
    check("card has no members after removal", Array.isArray(after) && after.length === 0, after);
  }

  // --- task lists ------------------------------------------------------------
  const tl1 = await call("mcp_kanban_task_list_manager", {
    action: "create", cardId: cA.id, name: "Design", position: 65535,
  });
  const tl2 = await call("mcp_kanban_task_list_manager", {
    action: "create", cardId: cA.id, name: "Build", position: 131070,
    showOnFrontOfCard: true,
  });
  check("task lists created", !isErr(tl1) && !isErr(tl2), [tl1, tl2]);
  const upd = await call("mcp_kanban_task_list_manager", {
    action: "update", id: tl1.id, name: "Design (renamed)", hideCompletedTasks: true,
  });
  check("task list updated", !isErr(upd) && upd.name === "Design (renamed)", upd);

  const t1 = await call("mcp_kanban_task_manager", {
    action: "create", cardId: cA.id, taskListId: tl2.id, name: "in Build", position: 65535,
  });
  check("task created in a chosen task list", !isErr(t1) && t1.taskListId === tl2.id, t1);
  const t2 = await call("mcp_kanban_task_manager", {
    action: "create", cardId: cA.id, name: "default list", position: 65535,
  });
  check("task created without taskListId", !isErr(t2), t2);

  const tlAll = await call("mcp_kanban_task_list_manager", {
    action: "get_all", cardId: cA.id,
  });
  check("task lists listed", Array.isArray(tlAll) && tlAll.length >= 2, tlAll);
  const tlOne = await call("mcp_kanban_task_list_manager", {
    action: "get_one", id: tl2.id,
  });
  check(
    "task list get_one returns its tasks",
    !isErr(tlOne) && tlOne.tasks?.some((t) => t.id === t1.id),
    tlOne,
  );
  const tlDel = await call("mcp_kanban_task_list_manager", {
    action: "delete", id: tl1.id,
  });
  check("task list deleted", !isErr(tlDel), tlDel);

  // --- attachments ----------------------------------------------------------
  const folder = await call("mcp_kanban_attachment_manager", { action: "get_folder" });
  check("attachments folder reported", !isErr(folder) && !!folder.folder, folder);

  mkdirSync(dir, { recursive: true });
  const fileName = "smoke-test.txt";
  writeFileSync(join(dir, fileName), "hello from the smoke test\n");

  const up = await call("mcp_kanban_attachment_manager", {
    action: "upload", cardId: cA.id, filePath: fileName,
  });
  check("file uploaded", !isErr(up) && up.type === "file", up);
  const link = await call("mcp_kanban_attachment_manager", {
    action: "add_link", cardId: cA.id, name: "Planka", url: "https://planka.app/",
  });
  check("link added", !isErr(link) && link.type === "link", link);
  const atts = await call("mcp_kanban_attachment_manager", {
    action: "get_all", cardId: cA.id,
  });
  check("attachments listed", Array.isArray(atts) && atts.length === 2, atts);
  const ren = await call("mcp_kanban_attachment_manager", {
    action: "update", id: up.id, name: "renamed.txt",
  });
  check("attachment renamed", !isErr(ren) && ren.name === "renamed.txt", ren);

  rmSync(join(dir, fileName), { force: true });
  const dl = await call("mcp_kanban_attachment_manager", {
    action: "download", cardId: cA.id, id: up.id, filePath: "downloaded.txt",
  });
  check("attachment downloaded", !isErr(dl), dl);
  if (!isErr(dl)) {
    const text = readFileSync(join(dir, "downloaded.txt"), "utf8");
    check("downloaded content matches", text === "hello from the smoke test\n", text);
    rmSync(join(dir, "downloaded.txt"), { force: true });
  }

  const outside = await call("mcp_kanban_attachment_manager", {
    action: "upload", cardId: cA.id, filePath: join(homedir(), "..", "x.txt"),
  });
  check("upload outside the folder is refused", isErr(outside), outside);
  const traversal = await call("mcp_kanban_attachment_manager", {
    action: "download", cardId: cA.id, id: up.id, filePath: "../escape.txt",
  });
  check("download outside the folder is refused", isErr(traversal), traversal);

  const delAtt = await call("mcp_kanban_attachment_manager", {
    action: "delete", id: link.id,
  });
  check("attachment deleted", !isErr(delAtt), delAtt);
} catch (error) {
  failed++;
  console.log("FAIL  unexpected error:", error);
} finally {
  // --- cleanup: only what this test created --------------------------------
  for (const id of created.cards) {
    await call("mcp_kanban_card_manager", { action: "delete", id });
  }
  for (const id of created.lists) {
    await call("mcp_kanban_list_manager", { action: "delete", id });
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  child.kill();
  process.exit(failed ? 1 : 0);
}

import { randomUUID } from 'node:crypto';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from './schema.js';

const dialect = new PgDialect();

const tables = [
  schema.users,
  schema.sessions,
  schema.invitations,
  schema.invitationContents,
  schema.invitationAssets,
  schema.rsvps,
  schema.guestMessages,
  schema.appSettings,
  schema.invitationGuests,
  schema.projectTelemetry,
];

const tableMeta = new Map();
for (const tbl of tables) {
  const name = getTableName(tbl);
  const cols = getTableColumns(tbl);
  const sqlToJs = new Map();
  for (const [jsKey, col] of Object.entries(cols)) {
    sqlToJs.set(col.name, jsKey);
  }
  tableMeta.set(name, { name, cols, sqlToJs });
}

const store = new Map(tables.map((t) => [getTableName(t), []]));

function applyDefaults(tableName, values) {
  const now = new Date();
  const base = { ...values };
  if (tableName === 'users') {
    base.id ??= randomUUID();
    base.role ??= 'user';
    base.isActive ??= true;
    base.createdAt ??= now;
  } else if (tableName === 'sessions') {
    base.createdAt ??= now;
  } else if (tableName === 'invitations') {
    base.id ??= randomUUID();
    base.status ??= 'draft';
    base.templateKey ??= 'classic';
    base.isDisabled ??= false;
    base.publishedAt ??= null;
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (tableName === 'invitation_contents') {
    base.id ??= randomUUID();
    base.content ??= {};
    base.updatedAt ??= now;
  } else if (tableName === 'invitation_assets') {
    base.id ??= randomUUID();
    base.width ??= null;
    base.height ??= null;
    base.createdAt ??= now;
  } else if (tableName === 'rsvps') {
    base.id ??= randomUUID();
    base.guestCount ??= 1;
    base.createdAt ??= now;
  } else if (tableName === 'guest_messages') {
    base.id ??= randomUUID();
    base.createdAt ??= now;
  } else if (tableName === 'app_settings') {
    base.updatedAt ??= now;
  } else if (tableName === 'invitation_guests') {
    base.id ??= randomUUID();
    base.phone ??= '';
    base.sentAt ??= null;
    base.createdAt ??= now;
  } else if (tableName === 'project_telemetry') {
    base.version ??= '0.0.1';
    base.os ??= 'unknown';
    base.nodeVersion ??= '';
    base.mode ??= 'local';
    base.pingCount ??= 1;
    base.firstSeenAt ??= now;
    base.lastSeenAt ??= now;
  }
  return base;
}

function getColValue(ctx, tableName, sqlCol) {
  const meta = tableMeta.get(tableName);
  const row = ctx[tableName];
  if (!row || !meta) return undefined;
  const jsKey = meta.sqlToJs.get(sqlCol) ?? sqlCol;
  return row[jsKey];
}

function evalSqlPredicate(sqlStr, params, ctx) {
  if (!sqlStr) return true;
  let s = sqlStr.trim();

  while (s.startsWith('(') && s.endsWith(')')) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      if (depth === 0 && i < s.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (!wrapsAll) break;
    s = s.slice(1, -1).trim();
  }

  // Split top-level ` and `
  const parts = [];
  let depth = 0;
  let start = 0;
  let inQuote = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') inQuote = !inQuote;
    if (inQuote) continue;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && s.slice(i, i + 5).toLowerCase() === ' and ') {
      parts.push(s.slice(start, i));
      start = i + 5;
      i += 4;
    }
  }
  if (parts.length > 0) {
    parts.push(s.slice(start));
    return parts.every((p) => evalSqlPredicate(p, params, ctx));
  }

  // Column-to-column comparison (e.g., innerJoin ON)
  const colCol = /^"([^"]+)"\."([^"]+)"\s*(=|<>)\s*"([^"]+)"\."([^"]+)"$/i.exec(s);
  if (colCol) {
    const [, t1, c1, op, t2, c2] = colCol;
    const v1 = getColValue(ctx, t1, c1);
    const v2 = getColValue(ctx, t2, c2);
    return op === '=' ? v1 === v2 : v1 !== v2;
  }

  // Column-to-param comparison
  const colParam = /^"([^"]+)"\."([^"]+)"\s*(=|<>|like)\s*\$(\d+)$/i.exec(s);
  if (colParam) {
    const [, tbl, col, op, idxStr] = colParam;
    const val = getColValue(ctx, tbl, col);
    const param = params[Number(idxStr) - 1];
    const lowerOp = op.toLowerCase();
    if (lowerOp === '=') return val === param;
    if (lowerOp === '<>') return val !== param;
    if (lowerOp === 'like') {
      const escaped = String(param ?? '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      return new RegExp(`^${escaped}$`).test(String(val ?? ''));
    }
  }

  return true;
}

function projectRow(projection, mainTable, ctx) {
  if (!projection) {
    return { ...ctx[mainTable] };
  }
  const out = {};
  for (const [key, spec] of Object.entries(projection)) {
    if (spec && typeof spec === 'object' && spec.name && spec.table) {
      const tName = getTableName(spec.table);
      const meta = tableMeta.get(tName);
      const jsKey = meta?.sqlToJs.get(spec.name) ?? spec.name;
      out[key] = ctx[tName]?.[jsKey];
    } else if (spec && typeof spec === 'object' && spec.queryChunks) {
      // e.g. count()
      out[key] = 0;
    } else if (spec && typeof spec === 'object') {
      // Whole table reference (e.g. { session: sessions, user: users })
      try {
        const tName = getTableName(spec);
        out[key] = ctx[tName] ? { ...ctx[tName] } : null;
      } catch {
        out[key] = null;
      }
    }
  }
  return out;
}

function isCountProjection(projection) {
  if (!projection || typeof projection !== 'object') return false;
  return Object.values(projection).some((spec) => {
    if (!spec || typeof spec !== 'object' || !spec.queryChunks) return false;
    const q = dialect.sqlToQuery(spec);
    return q.sql.toLowerCase().includes('count(');
  });
}

function cascadeDelete(tableName, deletedRows) {
  if (tableName === 'users') {
    const ids = new Set(deletedRows.map((r) => r.id));
    store.set('sessions', store.get('sessions').filter((r) => !ids.has(r.userId)));
    const invs = store.get('invitations').filter((r) => ids.has(r.userId));
    if (invs.length) {
      store.set('invitations', store.get('invitations').filter((r) => !ids.has(r.userId)));
      cascadeDelete('invitations', invs);
    }
  } else if (tableName === 'invitations') {
    const ids = new Set(deletedRows.map((r) => r.id));
    for (const child of ['invitation_contents', 'invitation_assets', 'rsvps', 'guest_messages', 'invitation_guests']) {
      store.set(child, store.get(child).filter((r) => !ids.has(r.invitationId)));
    }
  }
}

function createSelectBuilder(projection) {
  const state = {
    tableName: null,
    joins: [],
    whereExpr: null,
    orders: [],
    limitVal: null,
    offsetVal: 0,
  };

  const run = async () => {
    const baseRows = store.get(state.tableName) ?? [];
    let contexts = baseRows.map((r) => ({ [state.tableName]: r }));

    for (const j of state.joins) {
      const joinRows = store.get(j.tableName) ?? [];
      const onQ = j.onExpr ? dialect.sqlToQuery(j.onExpr) : null;
      const nextContexts = [];
      for (const ctx of contexts) {
        for (const jr of joinRows) {
          const merged = { ...ctx, [j.tableName]: jr };
          if (!onQ || evalSqlPredicate(onQ.sql, onQ.params, merged)) {
            nextContexts.push(merged);
          }
        }
      }
      contexts = nextContexts;
    }

    if (state.whereExpr) {
      const wq = dialect.sqlToQuery(state.whereExpr);
      contexts = contexts.filter((ctx) => evalSqlPredicate(wq.sql, wq.params, ctx));
    }

    if (isCountProjection(projection)) {
      const out = {};
      for (const [k, spec] of Object.entries(projection)) {
        if (spec?.queryChunks) out[k] = contexts.length;
        else out[k] = null;
      }
      return [out];
    }

    if (state.orders.length > 0) {
      const parsedOrders = state.orders.map((o) => {
        const q = dialect.sqlToQuery(o);
        const m = /^"([^"]+)"\."([^"]+)"(?:\s+(asc|desc))?$/i.exec(q.sql.trim());
        return m ? { tbl: m[1], col: m[2], dir: (m[3] || 'asc').toLowerCase() } : null;
      }).filter(Boolean);

      contexts.sort((a, b) => {
        for (const o of parsedOrders) {
          const va = getColValue(a, o.tbl, o.col);
          const vb = getColValue(b, o.tbl, o.col);
          if (va === vb) continue;
          const na = va instanceof Date ? va.getTime() : va;
          const nb = vb instanceof Date ? vb.getTime() : vb;
          const cmp = na < nb ? -1 : 1;
          return o.dir === 'desc' ? -cmp : cmp;
        }
        return 0;
      });
    }

    if (state.offsetVal) contexts = contexts.slice(state.offsetVal);
    if (state.limitVal != null) contexts = contexts.slice(0, state.limitVal);

    return contexts.map((ctx) => projectRow(projection, state.tableName, ctx));
  };

  const builder = {
    from(tbl) {
      state.tableName = getTableName(tbl);
      return builder;
    },
    innerJoin(tbl, onExpr) {
      state.joins.push({ tableName: getTableName(tbl), onExpr });
      return builder;
    },
    where(expr) {
      state.whereExpr = expr;
      return builder;
    },
    orderBy(...orders) {
      state.orders = orders;
      return builder;
    },
    limit(n) {
      state.limitVal = n;
      return builder;
    },
    offset(n) {
      state.offsetVal = n;
      return builder;
    },
    for() {
      return builder;
    },
    then(resolve, reject) {
      return run().then(resolve, reject);
    },
  };
  return builder;
}

function createInsertBuilder(tbl) {
  const tableName = getTableName(tbl);
  const state = { rows: [], conflict: null, returningProj: undefined };

  const run = async () => {
    const list = store.get(tableName) ?? [];
    const inserted = [];
    for (const raw of state.rows) {
      const row = applyDefaults(tableName, raw);
      if (state.conflict) {
        const targetCol = state.conflict.target?.name;
        const meta = tableMeta.get(tableName);
        const targetJs = meta?.sqlToJs.get(targetCol) ?? targetCol;
        const existing = list.find((r) => r[targetJs] === row[targetJs]);
        if (existing) {
          Object.assign(existing, state.conflict.set);
          inserted.push(existing);
          continue;
        }
      }
      list.push(row);
      inserted.push(row);
    }
    if (state.returningProj !== undefined) {
      return inserted.map((r) => projectRow(state.returningProj, tableName, { [tableName]: r }));
    }
    return inserted;
  };

  const builder = {
    values(vals) {
      state.rows = Array.isArray(vals) ? vals : [vals];
      return builder;
    },
    onConflictDoUpdate(cfg) {
      state.conflict = cfg;
      return builder;
    },
    returning(proj = null) {
      state.returningProj = proj;
      return builder;
    },
    then(resolve, reject) {
      return run().then(resolve, reject);
    },
  };
  return builder;
}

function createUpdateBuilder(tbl) {
  const tableName = getTableName(tbl);
  const state = { setVals: {}, whereExpr: null, returningProj: undefined };

  const run = async () => {
    const list = store.get(tableName) ?? [];
    const wq = state.whereExpr ? dialect.sqlToQuery(state.whereExpr) : null;
    const updated = [];
    for (const row of list) {
      const ctx = { [tableName]: row };
      if (!wq || evalSqlPredicate(wq.sql, wq.params, ctx)) {
        Object.assign(row, state.setVals);
        if (tableName === 'invitations' || tableName === 'invitation_contents' || tableName === 'app_settings') {
          if (!('updatedAt' in state.setVals)) row.updatedAt = new Date();
        }
        updated.push(row);
      }
    }
    if (state.returningProj !== undefined) {
      return updated.map((r) => projectRow(state.returningProj, tableName, { [tableName]: r }));
    }
    return updated;
  };

  const builder = {
    set(vals) {
      state.setVals = vals;
      return builder;
    },
    where(expr) {
      state.whereExpr = expr;
      return builder;
    },
    returning(proj = null) {
      state.returningProj = proj;
      return builder;
    },
    then(resolve, reject) {
      return run().then(resolve, reject);
    },
  };
  return builder;
}

function createDeleteBuilder(tbl) {
  const tableName = getTableName(tbl);
  const state = { whereExpr: null, returningProj: undefined };

  const run = async () => {
    const list = store.get(tableName) ?? [];
    const wq = state.whereExpr ? dialect.sqlToQuery(state.whereExpr) : null;
    const kept = [];
    const removed = [];
    for (const row of list) {
      const ctx = { [tableName]: row };
      if (!wq || evalSqlPredicate(wq.sql, wq.params, ctx)) {
        removed.push(row);
      } else {
        kept.push(row);
      }
    }
    store.set(tableName, kept);
    if (removed.length) cascadeDelete(tableName, removed);

    if (state.returningProj !== undefined) {
      return removed.map((r) => projectRow(state.returningProj, tableName, { [tableName]: r }));
    }
    return removed;
  };

  const builder = {
    where(expr) {
      state.whereExpr = expr;
      return builder;
    },
    returning(proj = null) {
      state.returningProj = proj;
      return builder;
    },
    then(resolve, reject) {
      return run().then(resolve, reject);
    },
  };
  return builder;
}

export const mockDb = {
  select: (proj = null) => createSelectBuilder(proj),
  insert: (tbl) => createInsertBuilder(tbl),
  update: (tbl) => createUpdateBuilder(tbl),
  delete: (tbl) => createDeleteBuilder(tbl),
  transaction: async (fn) => fn(mockDb),
  execute: async () => ({ rows: [{ '?column?': 1 }] }),
};

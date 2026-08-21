import hana from '@sap/hana-client';
import type { Connection } from '@sap/hana-client';

export type IntercompanyRow = {
  DocEntry: number;
  DocNum: number;
  CardCode: string;
  'Del.Date': string | null;
  InvoiceNumber: number | string | null;
  'Invoice Date': string | null;
  Target: string | null;
  IntegrationStatus: string | null;
  'Target Company': string | null;
  POSupplier: string | null;
  PONUM: number | string | null;
  PODocDate: string | null;
  SDDocNum: number | string | null;
  SDDocDate: string | null;
  'DEC.DOCNUM': number | string | null;
  GRPOBOEDOCNUM: number | string | null;
  GRPONUMBER: number | string | null;
  EPL1: number | string | null;
  EPL1Date: string | null;
  EPL1Status: string | null;
  EPL2: number | string | null;
  EPL2Date: string | null;
  EPL2Status: string | null;
  CONTAINERNUM: string | null;
  DraftGRPO: number | string | null;
};

const SCHEMAS = ['BI_NEGT_KSAISUZU', 'BI_NEGT_KSAPARTS'] as const;

function connectConfig() {
  return {
    serverNode: process.env.SERVER_NODE!,
    uid: process.env.SAP_HANA_USER!,
    pwd: process.env.SAP_HANA_PASSWORD!,
    currentSchema: process.env.SAP_HANA_DATABASE!,
    pooling: true,
    connectionLifetime: 1800,
  };
}

function exec<T>(conn: Connection, sql: string): Promise<T> {
  return new Promise((resolve, reject) => {
    conn.exec(sql, [], (err, result) => {
      if (err) reject(err);
      else resolve(result as T);
    });
  });
}

function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

function callSchema(schema: string): Promise<IntercompanyRow[]> {
  const conn = hana.createConnection();
  return new Promise((resolve, reject) => {
    conn.connect(connectConfig(), async (err) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const rows = await exec<IntercompanyRow[]>(conn, `CALL "${schema}".BI_ICAUTO_10001`);
        resolve(rows ?? []);
      } catch (e) {
        reject(e);
      } finally {
        conn.disconnect();
      }
    });
  });
}

/** Fetch from both ISUZU + Parts schemas and dedupe by DocEntry. */
export async function callIntercompanyKsa(): Promise<IntercompanyRow[]> {
  const results = await Promise.allSettled(SCHEMAS.map((s) => callSchema(s)));
  const map = new Map<number, IntercompanyRow>();

  for (const r of results) {
    if (r.status !== 'fulfilled') {
      console.warn('Intercompany SP call failed:', r.reason instanceof Error ? r.reason.message : r.reason);
      continue;
    }
    for (const row of r.value) {
      map.set(row.DocEntry, row);
    }
  }

  if (!map.size) {
    const firstErr = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (firstErr) throw firstErr.reason;
  }

  return [...map.values()].sort((a, b) => {
    const da = String(a['Invoice Date'] ?? '');
    const db = String(b['Invoice Date'] ?? '');
    return db.localeCompare(da) || b.DocEntry - a.DocEntry;
  });
}

export const PIPELINE_STAGES = [
  { id: 'invoice', label: 'Invoice', field: 'InvoiceNumber' },
  { id: 'po', label: 'Purchase Order', field: 'PONUM' },
  { id: 'sd', label: 'Stock Delivery', field: 'SDDocNum' },
  { id: 'dec', label: 'Declaration', field: 'DEC.DOCNUM' },
  { id: 'epl1', label: 'EPL 1', field: 'EPL1' },
  { id: 'epl2', label: 'EPL 2', field: 'EPL2' },
  { id: 'container', label: 'Container', field: 'CONTAINERNUM' },
  { id: 'draftGrpo', label: 'Draft GRPO', field: 'DraftGRPO' },
  { id: 'grpoBoe', label: 'GRPO BOE', field: 'GRPOBOEDOCNUM' },
  { id: 'grpo', label: 'GRPO', field: 'GRPONUMBER' },
] as const;

export function rowStageProgress(row: IntercompanyRow) {
  const done: string[] = [];
  let current: string | null = null;
  for (const stage of PIPELINE_STAGES) {
    const ok = hasValue((row as Record<string, unknown>)[stage.field]);
    if (ok) done.push(stage.id);
    else if (!current) current = stage.id;
  }
  return {
    done,
    current,
    completedCount: done.length,
    total: PIPELINE_STAGES.length,
    pct: Math.round((done.length / PIPELINE_STAGES.length) * 100),
  };
}

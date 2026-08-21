import type { Filters, IntercompanyRow, StageId } from '../types';
import { PIPELINE_STAGES } from '../types';

export function hasValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string' && v.trim() === '') return false;
  return true;
}

export function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(String(v).slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(v: string | null | undefined): string {
  const d = parseDate(v);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtNum(v: unknown): string {
  if (!hasValue(v)) return '—';
  return String(v);
}

export function companyLabel(code: string | null | undefined): string {
  if (!code) return 'Unknown';
  if (code.includes('ISUZU')) return 'ISUZU';
  if (code.includes('PARTS') || code.includes('SP')) return 'Parts';
  return code;
}

export function rowProgress(row: IntercompanyRow) {
  const done: StageId[] = [];
  let current: StageId | null = null;
  for (const stage of PIPELINE_STAGES) {
    const ok = hasValue(row[stage.field]);
    if (ok) done.push(stage.id);
    else if (!current) current = stage.id;
  }
  return {
    done,
    current,
    completedCount: done.length,
    total: PIPELINE_STAGES.length,
    pct: Math.round((done.length / PIPELINE_STAGES.length) * 100),
    isComplete: done.length === PIPELINE_STAGES.length,
  };
}

function dateKey(v: string | null | undefined): string {
  return String(v ?? '').slice(0, 10);
}

export function filterRows(rows: IntercompanyRow[], f: Filters): IntercompanyRow[] {
  const q = f.search.trim().toLowerCase();
  return rows.filter((r) => {
    if (f.company && r['Target Company'] !== f.company) return false;
    if (f.cardCode && r.CardCode !== f.cardCode) return false;
    if (f.status && (r.IntegrationStatus ?? '') !== f.status) return false;
    if (f.epl1Status && (r.EPL1Status ?? '') !== f.epl1Status) return false;
    if (f.epl2Status && (r.EPL2Status ?? '') !== f.epl2Status) return false;
    if (f.supplier && (r.POSupplier ?? '') !== f.supplier) return false;
    if (f.stage) {
      const p = rowProgress(r);
      if (f.stage === 'complete') {
        if (!p.isComplete) return false;
      } else if (f.stage === 'awaiting_grpo') {
        if (!(hasValue(r.EPL1) && !hasValue(r.GRPONUMBER))) return false;
      } else if (f.stage === 'in_transit') {
        if (p.isComplete) return false;
      } else {
        if (p.current !== f.stage) return false;
      }
    }
    if (f.fromDate) {
      const inv = dateKey(r['Invoice Date']);
      if (!inv || inv < f.fromDate) return false;
    }
    if (f.toDate) {
      const inv = dateKey(r['Invoice Date']);
      if (!inv || inv > f.toDate) return false;
    }
    if (q) {
      const hay = [
        r.DocNum,
        r.InvoiceNumber,
        r.CardCode,
        r['Target Company'],
        r.POSupplier,
        r.PONUM,
        r.SDDocNum,
        r.EPL1,
        r.EPL2,
        r.CONTAINERNUM,
        r.GRPONUMBER,
        r.IntegrationStatus,
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueSorted(rows: IntercompanyRow[], pick: (r: IntercompanyRow) => string | null | undefined) {
  return [...new Set(rows.map((r) => pick(r)).filter((v): v is string => !!v && v.trim() !== ''))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export type Kpis = {
  total: number;
  isuzu: number;
  parts: number;
  completed: number;
  inTransit: number;
  awaitingGrpo: number;
  withEpl1: number;
  withContainer: number;
  avgProgress: number;
};

export function buildKpis(rows: IntercompanyRow[]): Kpis {
  let isuzu = 0;
  let parts = 0;
  let completed = 0;
  let awaitingGrpo = 0;
  let withEpl1 = 0;
  let withContainer = 0;
  let progressSum = 0;

  for (const r of rows) {
    const co = r['Target Company'] ?? '';
    if (co.includes('ISUZU')) isuzu++;
    else if (co.includes('PARTS')) parts++;
    const p = rowProgress(r);
    progressSum += p.pct;
    if (p.isComplete) completed++;
    if (hasValue(r.EPL1) && !hasValue(r.GRPONUMBER)) awaitingGrpo++;
    if (hasValue(r.EPL1)) withEpl1++;
    if (hasValue(r.CONTAINERNUM)) withContainer++;
  }

  return {
    total: rows.length,
    isuzu,
    parts,
    completed,
    inTransit: rows.length - completed,
    awaitingGrpo,
    withEpl1,
    withContainer,
    avgProgress: rows.length ? Math.round(progressSum / rows.length) : 0,
  };
}

export function buildCompanyChart(rows: IntercompanyRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = companyLabel(r['Target Company']);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

export function buildStatusChart(rows: IntercompanyRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.IntegrationStatus || 'Unknown';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

export function buildStageFunnel(rows: IntercompanyRow[]) {
  return PIPELINE_STAGES.map((stage) => {
    const count = rows.filter((r) => hasValue(r[stage.field])).length;
    return {
      id: stage.id,
      name: stage.short,
      label: stage.label,
      count,
      pct: rows.length ? Math.round((count / rows.length) * 100) : 0,
    };
  });
}

export function rowsReachedStage(rows: IntercompanyRow[], stageId: StageId): IntercompanyRow[] {
  const stage = PIPELINE_STAGES.find((s) => s.id === stageId);
  if (!stage) return [];
  return rows.filter((r) => hasValue(r[stage.field]));
}

export function countStuckAtStage(rows: IntercompanyRow[], stageId: StageId): number {
  return rows.filter((r) => rowProgress(r).current === stageId).length;
}

export function buildDailyTrend(rows: IntercompanyRow[]) {
  const map = new Map<string, { date: string; total: number; isuzu: number; parts: number }>();
  for (const r of rows) {
    const d = dateKey(r['Invoice Date']);
    if (!d) continue;
    const cur = map.get(d) ?? { date: d, total: 0, isuzu: 0, parts: 0 };
    cur.total++;
    const co = r['Target Company'] ?? '';
    if (co.includes('ISUZU')) cur.isuzu++;
    else if (co.includes('PARTS')) cur.parts++;
    map.set(d, cur);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildStuckAtChart(rows: IntercompanyRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const p = rowProgress(r);
    if (p.isComplete) {
      map.set('Complete', (map.get('Complete') ?? 0) + 1);
    } else if (p.current) {
      const label = PIPELINE_STAGES.find((s) => s.id === p.current)?.short ?? p.current;
      map.set(label, (map.get(label) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export function buildSupplierChart(rows: IntercompanyRow[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = r.POSupplier || 'Unknown';
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

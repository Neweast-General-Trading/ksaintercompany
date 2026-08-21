import * as XLSX from 'xlsx';
import type { IntercompanyRow } from '../types';
import {
  buildKpis,
  buildStageFunnel,
  buildStuckAtChart,
  companyLabel,
  fmtDate,
  fmtNum,
  hasValue,
  rowProgress,
} from './analytics';
import { PIPELINE_STAGES } from '../types';

function stamp() {
  return new Date().toISOString().slice(0, 10);
}

function toDetailRows(rows: IntercompanyRow[]) {
  return rows.map((r) => {
    const p = rowProgress(r);
    return {
      DocEntry: r.DocEntry,
      DocNum: r.DocNum,
      InvoiceNumber: fmtNum(r.InvoiceNumber),
      InvoiceDate: fmtDate(r['Invoice Date']),
      DelDate: fmtDate(r['Del.Date']),
      CardCode: r.CardCode,
      Target: r.Target,
      TargetCompany: companyLabel(r['Target Company']),
      TargetCompanyCode: r['Target Company'],
      IntegrationStatus: r.IntegrationStatus,
      POSupplier: r.POSupplier,
      PONUM: fmtNum(r.PONUM),
      PODocDate: fmtDate(r.PODocDate),
      SDDocNum: fmtNum(r.SDDocNum),
      SDDocDate: fmtDate(r.SDDocDate),
      DecDocNum: fmtNum(r['DEC.DOCNUM']),
      EPL1: fmtNum(r.EPL1),
      EPL1Date: fmtDate(r.EPL1Date),
      EPL1Status: r.EPL1Status,
      EPL2: fmtNum(r.EPL2),
      EPL2Date: fmtDate(r.EPL2Date),
      EPL2Status: r.EPL2Status,
      Container: r.CONTAINERNUM,
      DraftGRPO: fmtNum(r.DraftGRPO),
      GRPOBOE: fmtNum(r.GRPOBOEDOCNUM),
      GRPO: fmtNum(r.GRPONUMBER),
      ProgressPct: p.pct,
      CurrentStage: p.current
        ? PIPELINE_STAGES.find((s) => s.id === p.current)?.label ?? p.current
        : 'Complete',
    };
  });
}

function downloadWorkbook(sheets: { name: string; rows: Record<string, unknown>[] }[], filename: string) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const safeName = sheet.name.slice(0, 31);
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{ Note: 'No rows' }]);
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportIntercompany(rows: IntercompanyRow[], filename: string) {
  downloadWorkbook([{ name: 'Intercompany', rows: toDetailRows(rows) }], filename);
}

export type ExportOptionId =
  | 'filtered'
  | 'all'
  | 'isuzu'
  | 'parts'
  | 'in_transit'
  | 'awaiting_grpo'
  | 'full_pack';

export type ExportOption = {
  id: ExportOptionId;
  label: string;
  hint: string;
  disabled?: boolean;
};

function isuzuRows(rows: IntercompanyRow[]) {
  return rows.filter((r) => (r['Target Company'] ?? '').includes('ISUZU'));
}

function partsRows(rows: IntercompanyRow[]) {
  return rows.filter((r) => {
    const c = r['Target Company'] ?? '';
    return c.includes('PARTS') || c.includes('SP');
  });
}

function inTransitRows(rows: IntercompanyRow[]) {
  return rows.filter((r) => !rowProgress(r).isComplete);
}

function awaitingGrpoRows(rows: IntercompanyRow[]) {
  return rows.filter((r) => hasValue(r.EPL1) && !hasValue(r.GRPONUMBER));
}

export function buildExportOptions(allRows: IntercompanyRow[], filteredRows: IntercompanyRow[]): ExportOption[] {
  const isuzu = isuzuRows(allRows);
  const parts = partsRows(allRows);
  const inTransit = inTransitRows(filteredRows);
  const awaiting = awaitingGrpoRows(filteredRows);

  return [
    {
      id: 'filtered',
      label: 'Filtered results',
      hint: `${filteredRows.length} rows · current filters`,
      disabled: filteredRows.length === 0,
    },
    {
      id: 'all',
      label: 'All documents',
      hint: `${allRows.length} rows · no filters`,
      disabled: allRows.length === 0,
    },
    {
      id: 'isuzu',
      label: 'ISUZU only',
      hint: `${isuzu.length} rows`,
      disabled: isuzu.length === 0,
    },
    {
      id: 'parts',
      label: 'Parts only',
      hint: `${parts.length} rows`,
      disabled: parts.length === 0,
    },
    {
      id: 'in_transit',
      label: 'In transit (filtered)',
      hint: `${inTransit.length} incomplete docs`,
      disabled: inTransit.length === 0,
    },
    {
      id: 'awaiting_grpo',
      label: 'Awaiting GRPO (filtered)',
      hint: `${awaiting.length} rows`,
      disabled: awaiting.length === 0,
    },
    {
      id: 'full_pack',
      label: 'Full pack (multi-sheet)',
      hint: 'Details + KPIs + funnel + stuck',
      disabled: filteredRows.length === 0,
    },
  ];
}

export function runExportOption(
  id: ExportOptionId,
  allRows: IntercompanyRow[],
  filteredRows: IntercompanyRow[],
) {
  const day = stamp();

  switch (id) {
    case 'filtered':
      exportIntercompany(filteredRows, `IC_KSA_Filtered_${day}`);
      break;
    case 'all':
      exportIntercompany(allRows, `IC_KSA_All_${day}`);
      break;
    case 'isuzu':
      exportIntercompany(isuzuRows(allRows), `IC_KSA_ISUZU_${day}`);
      break;
    case 'parts':
      exportIntercompany(partsRows(allRows), `IC_KSA_Parts_${day}`);
      break;
    case 'in_transit':
      exportIntercompany(inTransitRows(filteredRows), `IC_KSA_InTransit_${day}`);
      break;
    case 'awaiting_grpo':
      exportIntercompany(awaitingGrpoRows(filteredRows), `IC_KSA_AwaitingGRPO_${day}`);
      break;
    case 'full_pack': {
      const kpis = buildKpis(filteredRows);
      const funnel = buildStageFunnel(filteredRows);
      const stuck = buildStuckAtChart(filteredRows);
      downloadWorkbook(
        [
          { name: 'Details', rows: toDetailRows(filteredRows) },
          {
            name: 'KPIs',
            rows: [
              { Metric: 'Total', Value: kpis.total },
              { Metric: 'ISUZU', Value: kpis.isuzu },
              { Metric: 'Parts', Value: kpis.parts },
              { Metric: 'Completed', Value: kpis.completed },
              { Metric: 'In transit', Value: kpis.inTransit },
              { Metric: 'Awaiting GRPO', Value: kpis.awaitingGrpo },
              { Metric: 'With EPL1', Value: kpis.withEpl1 },
              { Metric: 'With container', Value: kpis.withContainer },
              { Metric: 'Avg progress %', Value: kpis.avgProgress },
            ],
          },
          {
            name: 'Funnel',
            rows: funnel.map((s) => ({
              Stage: s.label,
              Short: s.name,
              Count: s.count,
              Pct: s.pct,
            })),
          },
          {
            name: 'StuckAt',
            rows: stuck.map((s) => ({ Stage: s.name, Count: s.value })),
          },
        ],
        `IC_KSA_FullPack_${day}`,
      );
      break;
    }
  }
}

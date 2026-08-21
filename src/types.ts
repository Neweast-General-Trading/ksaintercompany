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

export type ApiResponse = {
  cachedAt: string;
  rowCount: number;
  rows: IntercompanyRow[];
  source: string;
  schemas: string[];
};

export type Filters = {
  company: string;
  cardCode: string;
  status: string;
  epl1Status: string;
  epl2Status: string;
  supplier: string;
  stage: string;
  fromDate: string;
  toDate: string;
  search: string;
};

export const emptyFilters = (): Filters => ({
  company: '',
  cardCode: '',
  status: '',
  epl1Status: '',
  epl2Status: '',
  supplier: '',
  stage: '',
  fromDate: '',
  toDate: '',
  search: '',
});

export const PIPELINE_STAGES = [
  { id: 'invoice', label: 'Invoice', short: 'INV', field: 'InvoiceNumber' as const },
  { id: 'po', label: 'Purchase Order', short: 'PO', field: 'PONUM' as const },
  { id: 'sd', label: 'Stock Delivery', short: 'SD', field: 'SDDocNum' as const },
  { id: 'dec', label: 'Declaration', short: 'DEC', field: 'DEC.DOCNUM' as const },
  { id: 'epl1', label: 'EPL 1', short: 'EPL1', field: 'EPL1' as const },
  { id: 'epl2', label: 'EPL 2', short: 'EPL2', field: 'EPL2' as const },
  { id: 'container', label: 'Container', short: 'CNT', field: 'CONTAINERNUM' as const },
  { id: 'draftGrpo', label: 'Draft GRPO', short: 'DRF', field: 'DraftGRPO' as const },
  { id: 'grpoBoe', label: 'GRPO BOE', short: 'BOE', field: 'GRPOBOEDOCNUM' as const },
  { id: 'grpo', label: 'GRPO', short: 'GRPO', field: 'GRPONUMBER' as const },
] as const;

export type StageId = (typeof PIPELINE_STAGES)[number]['id'];

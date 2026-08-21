export const SECTION_HELP = {
  filters:
    'Narrow the intercompany pipeline by company, customer card, integration outcome, pipeline stage, supplier, EPL statuses, invoice dates, or free-text search. Set values then click Apply.',
  kpis:
    'Summary counts for the current filter. Click a card to apply that filter instantly — e.g. ISUZU, Parts, in transit, or awaiting GRPO.',
  overviewTrend:
    'Daily count of intercompany invoices by invoice date, split between ISUZU (NEKSAISUZU) and Parts (NEKSAPARTS). Use this to spot volume spikes or quiet days.',
  overviewCompany:
    'Share of filtered documents by target company. Click a slice or legend item to filter the dashboard to that company only.',
  overviewCompanyIntegration:
    'Target company mix (ISUZU / Parts) plus SAP IntegrationStatus for the same filtered documents. Click a company slice or an integration chip to filter the dashboard.',
  overviewStuck:
    'Shows where documents are waiting in the pipeline — the first missing stage after invoice, or Complete if all stages are filled. Click a bar to filter by that stage.',
  overviewSuppliers:
    'Purchase orders grouped by PO supplier code (e.g. IZS0001 for ISUZU, SPS0057 for Parts). Click a bar to filter by supplier.',
  overviewIntegration:
    'SAP IntegrationStatus — Completed / Initiated / None — whether intercompany posting finished between companies. Click a chip to filter; percentages are of the current filtered set.',
  pipelineFunnel:
    'For each pipeline stage (Invoice → PO → SD → … → GRPO), how many filtered documents have reached that step. Click a row to open a popup with the document list — the dashboard filters stay unchanged.',
  pipelineJourney:
    'Visual tracker per document: green = stage done, blue highlight = current waiting stage. Search by invoice, doc, card, or supplier; browse 20 cards per page. Click a card to open full details in a popup.',
  detailsTable:
    'Line-level list from BI_ICAUTO_10001 with key document numbers and progress %. Click a row to open full details in a popup.',
  filterIntegrationStatus:
    'IntegrationStatus from SAP — typically Completed when the intercompany posting/integration finished successfully between source and target company.',
  filterPipelineStage:
    'Filter by where the document is in the physical/logistics pipeline, or use presets: in transit, awaiting GRPO, or fully complete.',
  filterEpl1:
    'EPL1 (Export Packing List 1) confirmation status on the KSA side — logistics step after declaration.',
  filterEpl2:
    'EPL2 status when a second export packing list exists in the process.',
} as const;

export const INTEGRATION_STATUS_DESC: Record<string, string> = {
  Completed:
    'Intercompany integration finished in SAP — the document was posted/synced successfully between companies.',
  Pending:
    'Integration not finished yet — document is still being processed or waiting in SAP.',
  Failed:
    'Integration attempt failed — may need correction or re-posting in SAP.',
  Error:
    'Integration returned an error — check SAP logs or document status.',
};

export function integrationStatusDescription(status: string): string {
  return (
    INTEGRATION_STATUS_DESC[status] ??
    `Documents with integration status “${status}” as returned by BI_ICAUTO_10001.`
  );
}

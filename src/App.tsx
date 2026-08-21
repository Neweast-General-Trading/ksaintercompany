import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ApiResponse, Filters, IntercompanyRow, StageId } from './types';
import { PIPELINE_STAGES, emptyFilters } from './types';
import {
  buildCompanyChart,
  buildDailyTrend,
  buildKpis,
  buildStageFunnel,
  buildStatusChart,
  buildStuckAtChart,
  buildSupplierChart,
  companyLabel,
  countStuckAtStage,
  filterRows,
  rowsReachedStage,
  fmtDate,
  fmtNum,
  hasValue,
  rowProgress,
  uniqueSorted,
} from './lib/analytics';
import { buildExportOptions, runExportOption, type ExportOptionId } from './lib/export';
import { PanelHead } from './components/PanelHead';
import { SectionInfo } from './components/SectionInfo';
import { SECTION_HELP } from './lib/section-help';
import './index.css';

const API =
  import.meta.env.VITE_API_BASE ??
  (import.meta.env.PROD
    ? 'https://misapi.neweast.cloud/api/intercompany-ksa'
    : '/api/intercompany-ksa');

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
];

const tooltipStyle = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(15,23,42,0.1)',
  fontSize: 12,
};

type Tab = 'overview' | 'pipeline' | 'details';

export default function App() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(emptyFilters());
  const [draft, setDraft] = useState<Filters>(emptyFilters());
  const [tab, setTab] = useState<Tab>('overview');
  const [selected, setSelected] = useState<IntercompanyRow | null>(null);
  const [stagePopup, setStagePopup] = useState<StageId | null>(null);
  const [page, setPage] = useState(0);
  const [journeyQuery, setJourneyQuery] = useState('');
  const [journeyPage, setJourneyPage] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const PAGE_SIZE = 15;
  const JOURNEY_PAGE_SIZE = 20;

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const url = new URL(API, window.location.origin);
      if (refresh) url.searchParams.set('_', String(Date.now()));
      const res = await fetch(url.toString());
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setData(json as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const kpis = useMemo(() => buildKpis(filtered), [filtered]);
  const companyChart = useMemo(() => buildCompanyChart(filtered), [filtered]);
  const statusChart = useMemo(() => buildStatusChart(filtered), [filtered]);
  const funnel = useMemo(() => buildStageFunnel(filtered), [filtered]);
  const trend = useMemo(() => buildDailyTrend(filtered), [filtered]);
  const stuck = useMemo(() => buildStuckAtChart(filtered), [filtered]);
  const suppliers = useMemo(() => buildSupplierChart(filtered), [filtered]);

  const companies = useMemo(() => uniqueSorted(rows, (r) => r['Target Company']), [rows]);
  const cards = useMemo(() => uniqueSorted(rows, (r) => r.CardCode), [rows]);
  const statuses = useMemo(() => uniqueSorted(rows, (r) => r.IntegrationStatus), [rows]);
  const epl1Statuses = useMemo(() => uniqueSorted(rows, (r) => r.EPL1Status), [rows]);
  const epl2Statuses = useMemo(() => uniqueSorted(rows, (r) => r.EPL2Status), [rows]);
  const supplierOpts = useMemo(() => uniqueSorted(rows, (r) => r.POSupplier), [rows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const applyFilters = () => {
    startTransition(() => {
      setFilters({ ...draft });
      setPage(0);
    });
  };

  const setQuick = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setDraft(next);
    startTransition(() => {
      setFilters(next);
      setPage(0);
    });
  };

  const clearAll = () => {
    const empty = emptyFilters();
    setDraft(empty);
    startTransition(() => {
      setFilters(empty);
      setPage(0);
    });
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const stagePopupMeta = useMemo(
    () => (stagePopup ? PIPELINE_STAGES.find((s) => s.id === stagePopup) ?? null : null),
    [stagePopup],
  );
  const stagePopupRows = useMemo(
    () => (stagePopup ? rowsReachedStage(filtered, stagePopup) : []),
    [filtered, stagePopup],
  );
  const stagePopupStuck = useMemo(
    () => (stagePopup ? countStuckAtStage(filtered, stagePopup) : 0),
    [filtered, stagePopup],
  );

  const journeyFiltered = useMemo(() => {
    const q = journeyQuery.trim().toLowerCase();
    if (!q) return filtered;
    return filtered.filter((r) => {
      const hay = [
        r.InvoiceNumber,
        r.DocNum,
        r.DocEntry,
        r.CardCode,
        r.POSupplier,
        r['Target Company'],
        companyLabel(r['Target Company']),
        r.PONUM,
        r.SDDocNum,
        r['DEC.DOCNUM'],
        r.EPL1,
        r.CONTAINERNUM,
        r.GRPONUMBER,
      ]
        .map((v) => String(v ?? '').toLowerCase())
        .join(' ');
      return hay.includes(q);
    });
  }, [filtered, journeyQuery]);

  const journeyPageCount = Math.max(1, Math.ceil(journeyFiltered.length / JOURNEY_PAGE_SIZE));
  const journeyPageRows = journeyFiltered.slice(
    journeyPage * JOURNEY_PAGE_SIZE,
    journeyPage * JOURNEY_PAGE_SIZE + JOURNEY_PAGE_SIZE,
  );

  useEffect(() => {
    setJourneyPage(0);
  }, [filters, journeyQuery]);

  useEffect(() => {
    if (!stagePopup && !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (selected) setSelected(null);
      else setStagePopup(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stagePopup, selected]);

  const openDetail = (row: IntercompanyRow) => {
    setSelected(row);
  };

  const detailFields = (row: IntercompanyRow): [string, string][] => [
    ['Company', companyLabel(row['Target Company'])],
    ['Card code', row.CardCode],
    ['Target', row.Target ?? '—'],
    ['Integration', row.IntegrationStatus ?? '—'],
    ['Invoice date', fmtDate(row['Invoice Date'])],
    ['Delivery date', fmtDate(row['Del.Date'])],
    ['Supplier', row.POSupplier ?? '—'],
    ['PO', fmtNum(row.PONUM)],
    ['PO date', fmtDate(row.PODocDate)],
    ['Stock delivery', fmtNum(row.SDDocNum)],
    ['SD date', fmtDate(row.SDDocDate)],
    ['Declaration', fmtNum(row['DEC.DOCNUM'])],
    ['EPL1', `${fmtNum(row.EPL1)} (${row.EPL1Status ?? '—'})`],
    ['EPL1 date', fmtDate(row.EPL1Date)],
    ['EPL2', `${fmtNum(row.EPL2)} (${row.EPL2Status ?? '—'})`],
    ['EPL2 date', fmtDate(row.EPL2Date)],
    ['Container', fmtNum(row.CONTAINERNUM)],
    ['Draft GRPO', fmtNum(row.DraftGRPO)],
    ['GRPO BOE', fmtNum(row.GRPOBOEDOCNUM)],
    ['GRPO', fmtNum(row.GRPONUMBER)],
  ];

  useEffect(() => {
    if (!exportOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('.export-menu')) return;
      setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportOpen]);

  const exportOptions = useMemo(
    () => buildExportOptions(rows, filtered),
    [rows, filtered],
  );

  const handleExport = (id: ExportOptionId) => {
    runExportOption(id, rows, filtered);
    setExportOpen(false);
  };

  if (loading && !data) {
    return (
      <div className="app app-loading">
        <div className="loader-ring" />
        <p>Loading intercompany pipeline…</p>
        <span className="muted">BI_ICAUTO_10001 · ISUZU &amp; Parts</span>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="NEWEAST" />
          <div>
            <p className="eyebrow">KSA · Intercompany</p>
            <h1>Intercompany Tracking</h1>
            <span className="badge">ISUZU — Parts · BI_ICAUTO_10001</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="export-menu">
            <button
              type="button"
              className="btn"
              aria-expanded={exportOpen}
              aria-haspopup="menu"
              disabled={!rows.length}
              onClick={() => setExportOpen((o) => !o)}
            >
              Excel Export ▾
            </button>
            {exportOpen && (
              <div className="export-dropdown" role="menu">
                <p className="export-dropdown-title">Download Excel</p>
                {exportOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="menuitem"
                    className="export-option"
                    disabled={opt.disabled}
                    onClick={() => handleExport(opt.id)}
                  >
                    <strong>{opt.label}</strong>
                    <span>{opt.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="btn btn-primary" onClick={() => load(true)} disabled={refreshing}>
            {refreshing ? '…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && (
        <div className="alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {(refreshing || isPending) && (
        <div className="busy-banner" role="status">
          <span className="busy-dot" />
          {refreshing ? 'Syncing from SAP HANA…' : 'Applying filters…'}
        </div>
      )}

      <section className="panel filters-panel">
        <PanelHead
          title={`Filters${activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}`}
          info={SECTION_HELP.filters}
          actions={
            <>
              <button type="button" className="btn btn-sm" onClick={clearAll}>Clear</button>
              <button type="button" className="btn btn-sm btn-primary" onClick={applyFilters}>Apply</button>
            </>
          }
        />
        <div className="filters-grid">
          <label>
            <span className="filter-label">
              Company
            </span>
            <select value={draft.company} onChange={(e) => setDraft((d) => ({ ...d, company: e.target.value }))}>
              <option value="">All companies</option>
              {companies.map((c) => (
                <option key={c} value={c}>{companyLabel(c)} ({c})</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              Card code
            </span>
            <select value={draft.cardCode} onChange={(e) => setDraft((d) => ({ ...d, cardCode: e.target.value }))}>
              <option value="">All cards</option>
              {cards.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              Integration status
              <SectionInfo text={SECTION_HELP.filterIntegrationStatus} title="Integration status filter" />
            </span>
            <select value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              Pipeline stage
              <SectionInfo text={SECTION_HELP.filterPipelineStage} title="Pipeline stage filter" />
            </span>
            <select value={draft.stage} onChange={(e) => setDraft((d) => ({ ...d, stage: e.target.value }))}>
              <option value="">Any stage</option>
              <option value="in_transit">In transit</option>
              <option value="awaiting_grpo">Awaiting GRPO</option>
              <option value="complete">Fully complete</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s.id} value={s.id}>Stuck at {s.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              Supplier
            </span>
            <select value={draft.supplier} onChange={(e) => setDraft((d) => ({ ...d, supplier: e.target.value }))}>
              <option value="">All suppliers</option>
              {supplierOpts.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              EPL1 status
              <SectionInfo text={SECTION_HELP.filterEpl1} title="EPL1 status" />
            </span>
            <select value={draft.epl1Status} onChange={(e) => setDraft((d) => ({ ...d, epl1Status: e.target.value }))}>
              <option value="">All</option>
              {epl1Statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">
              EPL2 status
              <SectionInfo text={SECTION_HELP.filterEpl2} title="EPL2 status" />
            </span>
            <select value={draft.epl2Status} onChange={(e) => setDraft((d) => ({ ...d, epl2Status: e.target.value }))}>
              <option value="">All</option>
              {epl2Statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="filter-label">From invoice date</span>
            <input type="date" value={draft.fromDate} onChange={(e) => setDraft((d) => ({ ...d, fromDate: e.target.value }))} />
          </label>
          <label>
            <span className="filter-label">To invoice date</span>
            <input type="date" value={draft.toDate} onChange={(e) => setDraft((d) => ({ ...d, toDate: e.target.value }))} />
          </label>
          <label className="span-2">
            <span className="filter-label">Search</span>
            <input
              type="search"
              placeholder="Invoice, PO, EPL, container, card…"
              value={draft.search}
              onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            />
          </label>
        </div>
        {data?.cachedAt && (
          <p className="meta">Cached {new Date(data.cachedAt).toLocaleString()} · {filtered.length} of {rows.length} documents</p>
        )}
      </section>

      <div className="kpi-section">
        <div className="kpi-section-head">
          <h2>
            Key metrics
            <SectionInfo text={SECTION_HELP.kpis} title="Key metrics" />
          </h2>
        </div>
      <div className="kpi-grid">
        <button type="button" className={`kpi blue${filters.company === '' && !filters.stage ? ' active' : ''}`} onClick={() => setQuick({ company: '', stage: '' })}>
          <label>Total documents</label>
          <strong>{kpis.total}</strong>
        </button>
        <button type="button" className={`kpi violet${filters.company.includes('ISUZU') ? ' active' : ''}`} onClick={() => setQuick({ company: companies.find((c) => c.includes('ISUZU')) ?? '' })}>
          <label>ISUZU</label>
          <strong>{kpis.isuzu}</strong>
        </button>
        <button type="button" className={`kpi amber${filters.company.includes('PARTS') ? ' active' : ''}`} onClick={() => setQuick({ company: companies.find((c) => c.includes('PARTS')) ?? '' })}>
          <label>Parts</label>
          <strong>{kpis.parts}</strong>
        </button>
        <button type="button" className={`kpi green${filters.stage === 'complete' ? ' active' : ''}`} onClick={() => setQuick({ stage: 'complete' })}>
          <label>Pipeline complete</label>
          <strong>{kpis.completed}</strong>
        </button>
        <button type="button" className={`kpi cyan${filters.stage === 'in_transit' ? ' active' : ''}`} onClick={() => setQuick({ stage: 'in_transit' })}>
          <label>In transit</label>
          <strong>{kpis.inTransit}</strong>
        </button>
        <button type="button" className={`kpi red${filters.stage === 'awaiting_grpo' ? ' active' : ''}`} onClick={() => setQuick({ stage: 'awaiting_grpo' })}>
          <label>Awaiting GRPO</label>
          <strong>{kpis.awaitingGrpo}</strong>
        </button>
        <div className="kpi slate">
          <label>Avg progress</label>
          <strong>{kpis.avgProgress}%</strong>
          <div className="mini-bar"><span style={{ width: `${kpis.avgProgress}%` }} /></div>
        </div>
        <div className="kpi slate">
          <label>With EPL1</label>
          <strong>{kpis.withEpl1}</strong>
        </div>
      </div>
      </div>

      <nav className="tabs">
        {([
          ['overview', 'Overview'],
          ['pipeline', 'Pipeline'],
          ['details', 'Details'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <div className="charts-grid">
          <section className="panel chart-card span-7">
            <PanelHead title="Invoice volume by day" info={SECTION_HELP.overviewTrend} />
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="gIsuzu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="gParts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => String(v).slice(5)} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="isuzu" name="ISUZU" stroke="#3B82F6" fill="url(#gIsuzu)" strokeWidth={2} />
                  <Area type="monotone" dataKey="parts" name="Parts" stroke="#10B981" fill="url(#gParts)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel chart-card span-5">
            <PanelHead title="Company & integration" info={SECTION_HELP.overviewCompanyIntegration} />
            <div className="chart-body pie-wrap">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={companyChart} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={3}
                    onClick={(d) => {
                      const code = companies.find((c) => companyLabel(c) === d.name);
                      if (code) setQuick({ company: code });
                    }}
                  >
                    {companyChart.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="legend">
                {companyChart.map((c, i) => (
                  <li key={c.name}><span style={{ background: COLORS[i % COLORS.length] }} />{c.name}: <b>{c.value}</b></li>
                ))}
              </ul>
            </div>
            <div className="integration-inline">
              <div className="integration-inline-head">
                <span>Integration status</span>
                <SectionInfo text={SECTION_HELP.overviewIntegration} title="Integration status" />
              </div>
              <div className="integration-status-grid compact">
                {statusChart.length === 0 && (
                  <p className="integration-empty muted">No integration status in current filter.</p>
                )}
                {statusChart.map((s, i) => {
                  const pct = filtered.length ? Math.round((s.value / filtered.length) * 100) : 0;
                  return (
                    <button
                      key={s.name}
                      type="button"
                      className={`integration-status-card${filters.status === s.name ? ' active' : ''}`}
                      style={{ ['--accent' as string]: COLORS[i % COLORS.length] }}
                      onClick={() => setQuick({ status: filters.status === s.name ? '' : s.name })}
                    >
                      <div className="integration-status-top">
                        <span className="integration-status-name">{s.name}</span>
                        <span className="integration-status-pct">{pct}%</span>
                      </div>
                      <div className="integration-status-count-row">
                        <strong>{s.value}</strong>
                        <span>docs</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="panel chart-card span-6">
            <PanelHead title="Where documents are stuck" info={SECTION_HELP.overviewStuck} />
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stuck} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="Documents" radius={[0, 6, 6, 0]}
                    onClick={(d) => {
                      if (d.name === 'Complete') setQuick({ stage: 'complete' });
                      else {
                        const stage = PIPELINE_STAGES.find((s) => s.short === d.name);
                        if (stage) setQuick({ stage: stage.id });
                      }
                    }}
                  >
                    {stuck.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel chart-card span-6">
            <PanelHead title="Suppliers" info={SECTION_HELP.overviewSuppliers} />
            <div className="chart-body">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={suppliers}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" name="POs" fill="#3B82F6" radius={[6, 6, 0, 0]}
                    onClick={(d) => setQuick({ supplier: String(d.name) })}
                    cursor="pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>
      )}

      {tab === 'pipeline' && (
        <div className="pipeline-view">
          <section className="panel">
            <PanelHead title="Stage completion funnel" info={SECTION_HELP.pipelineFunnel} />
            <div className="funnel">
              {funnel.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="funnel-step"
                  onClick={() => setStagePopup(s.id)}
                  title={`${s.label}: ${s.count} docs — click to view list`}
                >
                  <div className="funnel-bar-wrap">
                    <div className="funnel-bar" style={{ width: `${Math.max(s.pct, 4)}%` }} />
                  </div>
                  <div className="funnel-meta">
                    <strong>{s.name}</strong>
                    <span>{s.count} · {s.pct}%</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <PanelHead title="Document journey board" info={SECTION_HELP.pipelineJourney} />
            <div className="journey-toolbar">
              <input
                type="search"
                className="journey-search"
                placeholder="Search invoice, doc, card, supplier…"
                value={journeyQuery}
                onChange={(e) => setJourneyQuery(e.target.value)}
                aria-label="Filter journey documents"
              />
              <span className="muted journey-count">
                {journeyFiltered.length} document{journeyFiltered.length === 1 ? '' : 's'}
                {journeyQuery.trim() ? ' matched' : ''}
              </span>
            </div>
            {journeyPageRows.length === 0 ? (
              <p className="muted journey-empty">No documents match this search.</p>
            ) : (
              <div className="journey-list">
                {journeyPageRows.map((r) => {
                  const p = rowProgress(r);
                  return (
                    <button
                      key={r.DocEntry}
                      type="button"
                      className="journey-card"
                      onClick={() => openDetail(r)}
                    >
                      <div className="journey-top">
                        <div>
                          <strong>INV {fmtNum(r.InvoiceNumber)}</strong>
                          <span className="muted"> · Doc {r.DocNum}</span>
                        </div>
                        <span className={`pill ${companyLabel(r['Target Company']).toLowerCase()}`}>
                          {companyLabel(r['Target Company'])}
                        </span>
                      </div>
                      <div className="stage-track">
                        {PIPELINE_STAGES.map((s) => {
                          const done = p.done.includes(s.id);
                          const current = p.current === s.id;
                          return (
                            <span
                              key={s.id}
                              className={`stage-dot${done ? ' done' : ''}${current ? ' current' : ''}`}
                              title={s.label}
                            >
                              {s.short}
                            </span>
                          );
                        })}
                      </div>
                      <div className="journey-foot">
                        <span>{fmtDate(r['Invoice Date'])}</span>
                        <span>
                          {p.pct}% ·{' '}
                          {p.current
                            ? `At ${PIPELINE_STAGES.find((s) => s.id === p.current)?.label}`
                            : 'Complete'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="pager">
              <button
                type="button"
                className="btn btn-sm"
                disabled={journeyPage === 0}
                onClick={() => setJourneyPage((p) => p - 1)}
              >
                Prev
              </button>
              <span>
                Page {Math.min(journeyPage + 1, journeyPageCount)} / {journeyPageCount}
                <span className="muted"> · {JOURNEY_PAGE_SIZE} per page</span>
              </span>
              <button
                type="button"
                className="btn btn-sm"
                disabled={journeyPage >= journeyPageCount - 1}
                onClick={() => setJourneyPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </div>
      )}

      {tab === 'details' && (
        <section className="panel details-panel">
          <PanelHead title="Document details" info={SECTION_HELP.detailsTable} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Company</th>
                  <th>Card</th>
                  <th>Status</th>
                  <th>PO</th>
                  <th>SD</th>
                  <th>EPL1</th>
                  <th>Container</th>
                  <th>GRPO</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => {
                  const p = rowProgress(r);
                  return (
                    <tr key={r.DocEntry} className={selected?.DocEntry === r.DocEntry ? 'selected' : ''} onClick={() => openDetail(r)}>
                      <td className="mono">{fmtNum(r.InvoiceNumber)}</td>
                      <td>{fmtDate(r['Invoice Date'])}</td>
                      <td><span className={`pill ${companyLabel(r['Target Company']).toLowerCase()}`}>{companyLabel(r['Target Company'])}</span></td>
                      <td className="mono">{r.CardCode}</td>
                      <td>{r.IntegrationStatus ?? '—'}</td>
                      <td className="mono">{fmtNum(r.PONUM)}</td>
                      <td className="mono">{fmtNum(r.SDDocNum)}</td>
                      <td className="mono">{fmtNum(r.EPL1)}</td>
                      <td className="mono">{fmtNum(r.CONTAINERNUM)}</td>
                      <td className="mono">{fmtNum(r.GRPONUMBER)}</td>
                      <td>
                        <div className="prog">
                          <div className="prog-bar"><span style={{ width: `${p.pct}%` }} /></div>
                          <em>{p.pct}%</em>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn btn-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page + 1} / {pageCount}</span>
            <button type="button" className="btn btn-sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </section>
      )}

      {stagePopup && stagePopupMeta && (
        <div
          className="stage-modal-backdrop"
          role="presentation"
          onClick={() => setStagePopup(null)}
        >
          <div
            className="stage-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stage-modal-head">
              <div>
                <h3 id="stage-modal-title">
                  {stagePopupMeta.label} ({stagePopupMeta.short})
                </h3>
                <p className="muted">
                  {stagePopupRows.length} document{stagePopupRows.length === 1 ? '' : 's'} reached this stage
                  {stagePopupStuck > 0 ? ` · ${stagePopupStuck} waiting here` : ''}
                  {' · '}
                  current filters applied
                </p>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setStagePopup(null)}>
                Close
              </button>
            </div>
            {stagePopupRows.length === 0 ? (
              <p className="stage-modal-empty muted">No documents reached this stage for the current filters.</p>
            ) : (
              <div className="stage-modal-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Doc</th>
                      <th>Company</th>
                      <th>Supplier</th>
                      <th>Invoice date</th>
                      <th>{stagePopupMeta.short}</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stagePopupRows.map((r) => {
                      const waiting = rowProgress(r).current === stagePopup;
                      return (
                        <tr
                          key={r.DocEntry}
                          className={waiting ? 'row-waiting' : ''}
                          onClick={() => {
                            openDetail(r);
                            setStagePopup(null);
                          }}
                        >
                          <td>{fmtNum(r.InvoiceNumber)}</td>
                          <td>{r.DocNum}</td>
                          <td>{companyLabel(r['Target Company'])}</td>
                          <td>{r.POSupplier ?? '—'}</td>
                          <td>{fmtDate(r['Invoice Date'])}</td>
                          <td>{fmtNum(r[stagePopupMeta.field])}</td>
                          <td>
                            {waiting ? (
                              <span className="pill amber">Waiting</span>
                            ) : (
                              <span className="pill green">Done</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {selected && (
        <div
          className="stage-modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <div
            className="stage-modal detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="stage-modal-head">
              <div>
                <h3 id="detail-modal-title">Invoice {fmtNum(selected.InvoiceNumber)}</h3>
                <p className="muted">
                  Doc {selected.DocNum} · Entry {selected.DocEntry} ·{' '}
                  {companyLabel(selected['Target Company'])} · {rowProgress(selected).pct}% complete
                </p>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <div className="detail-modal-body">
              <div className="drawer-grid">
                {detailFields(selected).map(([k, v]) => (
                  <div key={k} className="drawer-item">
                    <label>{k}</label>
                    <strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="stage-track large">
                {PIPELINE_STAGES.map((s) => {
                  const p = rowProgress(selected);
                  const done = p.done.includes(s.id);
                  const current = p.current === s.id;
                  return (
                    <span
                      key={s.id}
                      className={`stage-dot${done ? ' done' : ''}${current ? ' current' : ''}`}
                    >
                      <b>{s.short}</b>
                      <small>{hasValue(selected[s.field]) ? fmtNum(selected[s.field]) : 'pending'}</small>
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

# KSA Intercompany Tracking

MIS dashboard for KSA intercompany pipeline (ISUZU & Parts) via SAP HANA SP `BI_ICAUTO_10001`.

## Live URL

https://mis.neweast.cloud/ksa/intercompany/

## Stack

- **Frontend:** Vite + React + TypeScript + Recharts
- **API:** MIS Node server — `GET /api/intercompany-ksa` (`server/src/intercompany-ksa.ts` in the MIS monorepo)
- **Source SP:** `BI_NEGT_KSAISUZU.BI_ICAUTO_10001` + `BI_NEGT_KSAPARTS.BI_ICAUTO_10001`

## Local development

```bash
npm install
npm run dev
```

Set `VITE_API_BASE` if the API is not at `/api/intercompany-ksa`.

## Production build

```bash
npm run build
# deploy dist/ to /var/www/mis-dashboard/ksa/intercompany/
```

## Features

- Filters, KPIs, Overview charts, Pipeline funnel + journey board
- Document detail popup, Excel export options
- Stage funnel opens a popup list (does not rewrite global filters)

# Walkthrough: Lead & USA Territory Outreach Manager

We have created and integrated the **Lead & USA Outreach Manager** page into MapMiner AI. This allows you to manage target business niches, select and check every state and city across the USA for outreach, track campaign progress, and launch Google Maps lead extraction directly for any target city.

## Summary of Changes

### Backend API & Database

- **SQLAlchemy Models** ([models.py](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/backend/app/models.py)):
  - Added `Niche` model (`id`, `name`, `description`, `created_at`).
  - Added `NicheTarget` model (`id`, `niche_id`, `state_code`, `state_name`, `city_name`, `status`, `notes`, `updated_at`).
- **Pydantic Schemas** ([schemas.py](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/backend/app/schemas.py)):
  - Added `NicheCreate`, `NicheResponse`, `NicheTargetSchema`, `TargetToggleRequest`, `BulkStateToggleRequest`.
- **REST Endpoints** ([main.py](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/backend/app/main.py)):
  - `GET /api/v1/niches`: Get list of niches with targeted and outreached counts.
  - `POST /api/v1/niches`: Create new business niche.
  - `DELETE /api/v1/niches/{niche_id}`: Delete a niche and its targets.
  - `GET /api/v1/niches/{niche_id}/targets`: Retrieve target status mapping for all states and cities in a niche.
  - `POST /api/v1/niches/{niche_id}/targets/toggle`: Toggle target status (`targeted`, `outreached`, `skipped`, `untargeted`) for a single city.
  - `POST /api/v1/niches/{niche_id}/targets/bulk`: Bulk toggle all cities in a state.

### Frontend Application

- **USA Dataset** ([usaStatesCitiesData.js](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/frontend/src/usaStatesCitiesData.js)):
  - Built-in dataset mapping all 50 US States (AL to WY) with major outreach cities and regional groupings (West, South, Midwest, Northeast).
  - Popular preset niches list (Roofing Contractors, Plumbers & HVAC, Dentists, Med Spas, Electricians, Solar Installers, Auto Repair, etc.).
- **Lead Manager Page Component** ([LeadManagerPage.jsx](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/frontend/src/LeadManagerPage.jsx)):
  - **Header Stats Banner**: Real-time metrics showing active niche, targeted US cities, outreached cities count, and targeted states count.
  - **Niche Selector Bar**: Create custom niches, switch active niche tabs, view quick presets, and delete niches.
  - **Filter & Search Controls**: Search any state name or city name instantly; filter by status (`All`, `Targeted Only`, `Outreached Only`, `Untargeted Only`) or region (`West`, `South`, `Midwest`, `Northeast`).
  - **Interactive State & City Grid**:
    - Master state checkboxes to check/uncheck all cities in a state with one click.
    - Master state actions to mark all cities as sent or clear them.
    - Granular city checkboxes with status tags (`Targeted`, `Outreached / Sent`, `Skipped`).
    - **🚀 Direct Extraction Launcher**: One-click `Zap` button on every city row that pre-fills the keyword (`{Niche}`) and location (`{City}, {State}`) and redirects directly to the Lead Extractor search tab!
- **Navigation Integration** ([App.jsx](file:///c:/Users/waizt/OneDrive/Desktop/Websites/Automation/Leads%20Qualifier/frontend/src/App.jsx)):
  - Added new `🎯 Lead Manager` navigation tab button to the top header navigation.
  - Integrated `onExtractFromTarget` callback handler for seamless cross-tab pre-fill and navigation.

---

## Verification Results

### Build Verification
- Executed Vite production build:
  - `transforming... ✓ 1776 modules transformed.`
  - `built in 6.61s` with **0 errors**.

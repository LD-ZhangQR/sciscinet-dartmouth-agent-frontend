## SciSciNet Dartmouth Agent Frontend

This repository contains the frontend for Project 2, a chat-driven dashboard for exploring Dartmouth-related publication statistics derived from SciSciNet.

The interface supports multi-turn conversations, allowing users to iteratively refine a visualization (filters, styling, and comparison) without re-specifying the entire query. Charts are rendered using Vega-Lite (via vega-embed) and are generated based on responses from the backend agent (/api/chat), which returns both the Vega-Lite specification and the underlying data.

⸻

### What You Can Ask

1) Chart Types
```bash
You can request:
	•	Papers by year (counts grouped by year)
	•	Papers by field (counts grouped by field name)

Examples:
	•	“Show me the number of papers by year from 2020 to 2024.”
	•	“Show me papers by field from 2020 to 2024.”
```
⸻

2) Filters (single-turn or follow-up)
```bash
Supported filters can be provided directly or modified across turns:
	•	Time range: year_from, year_to
Example: “Show papers by year from 2018 to 2024.”
	•	Document type (optional): doctype
Example: “Show only articles from 2020 to 2024.”
	•	Field chart only:
	•	field_level (e.g., “Use field level 2.”)
	•	field_score_min (e.g., “Use score threshold 0.4.”)
	•	top_k (e.g., “Show top 10 fields.”)

Note: top_k returns the top K fields ranked by paper count after filters are applied.
```
⸻

3) Styling (multi-turn)
```bash
Chart appearance can be changed without repeating filters:
	•	Color (e.g., “Make it purple.”)
	•	Chart type: bar / line / area
Examples: “Use a line chart.”, “Show the trend.”

If a previous plan exists, style-only messages reuse earlier parameters.
```
⸻

4) Compare Mode
```bash
Two time ranges can be compared within a single chart.

Examples:
	•	“Compare 2020–2022 vs 2023–2024.”
	•	“Compare 2018–2020 vs 2021–2024 and use a line chart.”
	•	“Compare 2020–2022 vs 2023–2024 for papers by field, top 10, score threshold 0.4.”

In compare mode, data include a group label (A/B) and color is used to distinguish groups.
```
⸻

5) Multi-turn Conversations
```bash
Users can progressively refine charts across turns.

Example (year chart):
	1.	“Show me papers by year from 2020 to 2024.”
	2.	“Make it purple.”
	3.	“Use a line chart.”
	4.	“Compare 2020–2022 vs 2023–2024.”

Example (field chart):
	1.	“Show me papers by field from 2020 to 2024.”
	2.	“Show top 10 fields.”
	3.	“Use score threshold 0.4.”
	4.	“Compare 2020–2022 vs 2023–2024.”

This works because the frontend stores the last plan and sends it as prev_plan in subsequent requests.
```
⸻

#### Downloads / Export
```bash
The UI supports exporting:
	•	Chart data (JSON, CSV)
	•	Vega-Lite spec (JSON)
	•	Chart image (PNG)

All exports are based on backend-returned data and specifications.
```
⸻

#### Tech Stack
```bash
	•	React (hooks)
	•	Vega-Lite (vega-embed)
	•	Fetch API for backend communication
```
⸻

#### Running the Frontend
```bash
Prerequisites
	•	Node.js (v16+)
	•	Backend running locally
```
Install
```bash
npm install
```
Start
```bash
npm run dev
```
Default URL:
```bash
http://localhost:5173
```
⸻

#### Backend Dependency
```bash
Expected backend address:
	•	http://127.0.0.1:8004

Endpoints used:
	•	POST /api/chat
	•	POST /api/chart/papers_by_year (optional)
	•	POST /api/chart/papers_by_field (optional)
```
⸻

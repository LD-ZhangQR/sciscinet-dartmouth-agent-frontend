import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import vegaEmbed from "vega-embed";

const API = "http://127.0.0.1:8004";

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}

function escapeCsvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [];
  lines.push(headers.map(escapeCsvCell).join(","));
  for (const r of rows) {
    lines.push(headers.map((h) => escapeCsvCell(r[h])).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(filename, rows) {
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  downloadBlob(filename, blob);
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const bytes = atob(b64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function VegaView({ spec, onView }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);

  useEffect(() => {
    let canceled = false;

    async function run() {
      if (!spec || !containerRef.current) return;

      if (viewRef.current) {
        try {
          viewRef.current.finalize();
        } catch {
          // ignore
        }
        viewRef.current = null;
      }

      containerRef.current.innerHTML = "";

      const result = await vegaEmbed(containerRef.current, spec, {
        actions: false,
        renderer: "canvas",
      });

      if (canceled) {
        try {
          result?.view?.finalize();
        } catch {
          // ignore
        }
        return;
      }

      viewRef.current = result?.view || null;
      onView?.(viewRef.current);
    }

    run().catch(() => {
      if (!canceled) onView?.(null);
    });

    return () => {
      canceled = true;
      onView?.(null);
      if (viewRef.current) {
        try {
          viewRef.current.finalize();
        } catch {
          // ignore
        }
        viewRef.current = null;
      }
    };
  }, [spec, onView]);

  return <div ref={containerRef} />;
}

export default function App() {
  const [spec, setSpec] = useState(null);
  const [err, setErr] = useState("");

  const [data, setData] = useState(null);
  const [plan, setPlan] = useState(null);

  const [view, setView] = useState(null);

  const [selected, setSelected] = useState(null);

  const [input, setInput] = useState("show me the number of papers by year from 2020 to 2024");
  const [messages, setMessages] = useState([]);

  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  async function post(path, body) {
    setErr("");
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const onView = useCallback((v) => setView(v), []);

  // Attach selection listener to Vega signal "pick"
  useEffect(() => {
    if (!view) return;

    let active = true;

    const handler = (_name, value) => {
      if (!active) return;
      if (!value) {
        setSelected(null);
        return;
      }
      setSelected(value);
    };

    try {
      view.addSignalListener("pick", handler);
    } catch {
      // If spec has no "pick", ignore
    }

    return () => {
      active = false;
      try {
        view.removeSignalListener("pick", handler);
      } catch {
        // ignore
      }
    };
  }, [view]);

  async function loadYearChart() {
    try {
      const body = { year_from: 2020, year_to: 2024 };
      const j = await post("/api/chart/papers_by_year", body);

      setSpec(j.vegaLiteSpec);
      setData(j.data || null);
      setSelected(null);

      setPlan({
        chart_type: "papers_by_year",
        year_from: 2020,
        year_to: 2024,
        doctype: null,
        field_level: 1,
        field_score_min: 0.3,
        top_k: 25,
        color: null,
        mark: "bar",
        compare: false,
        compare_year_from: null,
        compare_year_to: null,
      });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      inputRef.current?.focus();
    }
  }

  async function loadFieldChart() {
    try {
      const body = {
        year_from: 2020,
        year_to: 2024,
        field_level: 1,
        field_score_min: 0.3,
        top_k: 25,
      };
      const j = await post("/api/chart/papers_by_field", body);

      setSpec(j.vegaLiteSpec);
      setData(j.data || null);
      setSelected(null);

      setPlan({
        chart_type: "papers_by_field",
        year_from: 2020,
        year_to: 2024,
        doctype: null,
        field_level: 1,
        field_score_min: 0.3,
        top_k: 25,
        color: null,
        mark: "bar",
        compare: false,
        compare_year_from: null,
        compare_year_to: null,
      });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      inputRef.current?.focus();
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");

    try {
      const j = await post("/api/chat", { message: text, prev_plan: plan });

      setMessages((m) => [...m, { role: "assistant", text: j.answer || "OK" }]);

      if (j.vegaLiteSpec) setSpec(j.vegaLiteSpec);
      if (j.data) setData(j.data);
      if (j.plan) setPlan(j.plan);

      setSelected(null);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function downloadCurrentDataJson() {
    if (!plan || !data) return;
    const filename = `${plan.chart_type || "chart"}_${plan.year_from || ""}-${plan.year_to || ""}_data.json`;
    downloadJson(filename, { plan, data });
  }

  function downloadCurrentDataCsv() {
    if (!plan || !data || !Array.isArray(data) || data.length === 0) return;
    const filename = `${plan.chart_type || "chart"}_${plan.year_from || ""}-${plan.year_to || ""}_data.csv`;
    downloadCsv(filename, data);
  }

  function downloadCurrentSpecJson() {
    if (!plan || !spec) return;
    const filename = `${plan.chart_type || "chart"}_${plan.year_from || ""}-${plan.year_to || ""}_vegaLiteSpec.json`;
    downloadJson(filename, { plan, vegaLiteSpec: spec });
  }

  async function downloadCurrentPng() {
    if (!plan || !view) return;
    try {
      const dataUrl = await view.toImageURL("png");
      const blob = dataUrlToBlob(dataUrl);
      const filename = `${plan.chart_type || "chart"}_${plan.year_from || ""}-${plan.year_to || ""}.png`;
      downloadBlob(filename, blob);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      inputRef.current?.focus();
    }
  }

  const canDownload = Boolean(plan && spec);
  const canDownloadData = Boolean(plan && data && Array.isArray(data) && data.length > 0);
  const canDownloadPng = Boolean(plan && view);

  const selectionSummary = useMemo(() => {
    if (!selected) return null;
    const keys = Object.keys(selected || {});
    if (keys.length === 0) return null;
    return selected;
  }, [selected]);

  function quickAskFromSelection() {
    if (!selectionSummary || !plan) return;

    if (plan.chart_type === "papers_by_year") {
      const year = selectionSummary.year;
      const group = selectionSummary.group;
      const msg = group
        ? `show me the number of papers by year from ${year} to ${year} and compare ${plan.year_from}-${plan.year_to} vs ${plan.compare_year_from}-${plan.compare_year_to}`
        : `show me the number of papers by year from ${year} to ${year}`;
      setInput(msg);
      inputRef.current?.focus();
      return;
    }

    if (plan.chart_type === "papers_by_field") {
      const field = selectionSummary.field;
      if (!field) return;
      const msg = plan.compare
        ? `show me papers by field from ${plan.year_from} to ${plan.year_to} and compare ${plan.year_from}-${plan.year_to} vs ${plan.compare_year_from}-${plan.compare_year_to}, top_k ${plan.top_k}, field_score_min ${plan.field_score_min}, field_level ${plan.field_level}`
        : `show me papers by field from ${plan.year_from} to ${plan.year_to}, top_k ${plan.top_k}, field_score_min ${plan.field_score_min}, field_level ${plan.field_level}`;
      setInput(msg);
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 1200, margin: "0 auto" }}>
      <h2>SciSciNet Dartmouth Chat Dashboard</h2>

      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Chat</div>

          <div
            style={{
              height: 320,
              overflow: "auto",
              border: "1px solid #f0f0f0",
              borderRadius: 8,
              padding: 8,
              marginBottom: 10,
            }}
          >
            {messages.length === 0 ? (
              <div style={{ color: "#666" }}>
                Try:
                <ul>
                  <li>show me the number of papers by year from 2020 to 2024</li>
                  <li>show me papers by field from 2020 to 2022</li>
                  <li>compare 2020-2022 vs 2023-2024</li>
                  <li>compare 2018-2020 vs 2021-2024 and use a line chart</li>
                  <li>compare 2020-2022 vs 2023-2024, top_k 10, field_score_min 0.4, field_level 1</li>
                  <li>make it purple</li>
                </ul>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <b>{m.role}:</b> {m.text}
                </div>
              ))
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" ? send() : null)}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
              placeholder='Ask: "compare 2020-2022 vs 2023-2024"'
              disabled={sending}
            />
            <button onClick={send} style={{ padding: "8px 12px", borderRadius: 8 }} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={loadYearChart}>Quick: Papers by Year</button>
            <button onClick={loadFieldChart}>Quick: Papers by Field</button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button onClick={downloadCurrentDataJson} disabled={!canDownloadData}>
              Download data (JSON)
            </button>
            <button onClick={downloadCurrentDataCsv} disabled={!canDownloadData}>
              Download data (CSV)
            </button>
            <button onClick={downloadCurrentSpecJson} disabled={!canDownload}>
              Download spec (JSON)
            </button>
            <button onClick={downloadCurrentPng} disabled={!canDownloadPng}>
              Download chart (PNG)
            </button>
          </div>

          {err ? <div style={{ color: "crimson", marginTop: 10 }}>{err}</div> : null}

          {selectionSummary ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected item</div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
{JSON.stringify(selectionSummary, null, 2)}
              </pre>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button onClick={() => setSelected(null)}>Clear</button>
                <button onClick={quickAskFromSelection}>Use as follow-up</button>
              </div>
            </div>
          ) : null}

          {plan ? (
            <div style={{ marginTop: 12, fontSize: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Agent plan</div>
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  background: "#fafafa",
                  border: "1px solid #eee",
                  borderRadius: 8,
                  overflow: "auto",
                }}
              >
{JSON.stringify(plan, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>

        <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Dashboard</div>
          {spec ? <VegaView spec={spec} onView={onView} /> : <div style={{ color: "#666" }}>Send a message to generate a chart.</div>}
        </div>
      </div>
    </div>
  );
}
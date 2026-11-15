"use client";
import { useState } from "react";
import {
  Search,
  Phone,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  Activity,
  MousePointer2,
  SlidersHorizontal,
  BarChart3,
  ShieldCheck,
  Download,
} from "lucide-react";
import { useData, time, Notice, Empty, Badge } from "./shared";
export default function Insights() {
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState("");
  const { data, error } = useData<any>("insights?days=" + days, {
    counts: [],
    categories: [],
    species: [],
    workload: [],
    activity: [],
  });
  const count = (kind: string) =>
    data.counts.find((c: any) => c.kind === kind)?.count || 0;
  function download() {
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        periodDays: days,
        disclaimer:
          "Demo events only. Contact clicks do not establish calls or visits.",
        ...data,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "vetpath-insights.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="workspace">
      <div className="workspace-header">
        <div className="workspace-title">
          <div className="eyebrow">A CLEARER PICTURE OF CARE</div>
          <h1>Understand the path to care.</h1>
          <p>
            See what owners need, where they turn, and what your teams confirm.
          </p>
        </div>
        <div className="workspace-actions">
          <select
            aria-label="Insights period"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 145 }}
          >
            {[1, 7, 30, 90].map((x) => (
              <option key={x} value={x}>
                Last {x} {x === 1 ? "day" : "days"}
              </option>
            ))}
          </select>
          <button className="secondary" onClick={download}>
            <Download size={15} /> Export
          </button>
        </div>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="metrics">
        {[
          {
            label: "Discovery searches",
            value: count("search"),
            caption: "Chat searches with organized requirements",
            Icon: Search,
          },
          {
            label: "Call link clicks",
            value: count("call_click"),
            caption: "Contact intent · not completed calls",
            Icon: Phone,
          },
          {
            label: "Intakes submitted",
            value: count("intake_submitted"),
            caption: "Requests sent through VetPath",
            Icon: ClipboardList,
          },
          {
            label: "Confirmed arrivals",
            value: count("confirmed_arrival"),
            caption: "Arrival recorded by clinic staff",
            Icon: CheckCircle2,
          },
        ].map((x) => (
          <div className="metric" key={x.label}>
            <div className="metric-head">
              {x.label}
              <x.Icon size={17} />
            </div>
            <div className="metric-value">
              {x.value.toString().padStart(2, "0")}
            </div>
            <small>{x.caption}</small>
          </div>
        ))}
      </div>
      <div className="callout">
        <ShieldCheck size={18} />
        <span>
          <strong>Measured with care.</strong> These are demo events from this
          application. Call and directions clicks do not prove a completed call
          or visit. Only a staff-recorded arrival counts as a confirmed arrival.
          Seeded patients are excluded from submission counts.
        </span>
      </div>
      <div className="insights-grid" style={{ marginTop: 22 }}>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>What owners are looking for</h2>
              <p>Care categories extracted from discovery searches</p>
            </div>
            <BarChart3 size={20} />
          </div>
          {!data.categories.length ? (
            <Empty
              title="Your first insight starts with a search"
              body="Use the owner guide to generate real demo activity here."
            />
          ) : (
            data.categories.map((c: any) => (
              <Bar
                key={c.label}
                label={c.label}
                value={c.count}
                max={Math.max(...data.categories.map((x: any) => x.count))}
              />
            ))
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Every kind of companion</h2>
              <p>Species mentioned in searches and intake submissions</p>
            </div>
            <Badge tone="teal">Live demo data</Badge>
          </div>
          {!data.species.length ? (
            <p className="muted">No species events in this period.</p>
          ) : (
            data.species.map((c: any) => (
              <Bar
                key={c.label}
                label={c.label}
                value={c.count}
                max={Math.max(...data.species.map((x: any) => x.count))}
                light
              />
            ))
          )}
        </section>
      </div>
      <div className="insights-grid">
        <section className="panel">
          <h2>From intent to a confirmed arrival</h2>
          <p className="tiny">
            Separate event counts, not a conversion rate or a linked funnel.
          </p>
          <div className="funnel">
            <div>
              <strong>{count("call_click") + count("directions_click")}</strong>
              <span>Contact & direction clicks</span>
            </div>
            <ArrowRight size={16} />
            <div>
              <strong>{count("intake_submitted")}</strong>
              <span>Intake submissions</span>
            </div>
            <ArrowRight size={16} />
            <div>
              <strong>{count("confirmed_arrival")}</strong>
              <span>Staff-confirmed arrivals</span>
            </div>
          </div>
          <div className="action-row">
            <Badge>{count("directions_click")} direction clicks</Badge>
            <Badge>{count("comparison")} comparison selections</Badge>
            <Badge>{count("filter_change")} filter changes</Badge>
          </div>
        </section>
        <section className="panel">
          <h2>Demand across the directory</h2>
          <p className="tiny">
            Active intakes by clinic. Includes clearly fictional seeded
            patients.
          </p>
          {data.workload
            .filter((c: any) => c.total > 0)
            .map((c: any) => (
              <Bar
                key={c.id}
                label={c.name}
                value={c.active}
                max={Math.max(1, ...data.workload.map((x: any) => x.active))}
              />
            ))}
          {data.workload.every((c: any) => !c.total) && (
            <p className="muted">No patient workload in this period.</p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Operational activity</h2>
            <p>Availability changes, intake stages, imports, and handoffs</p>
          </div>
          <input
            aria-label="Search operational activity"
            placeholder="Search actions or entities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {data.activity
          .filter((a: any) =>
            (a.action + " " + a.entity + " " + a.actor)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((a: any) => (
            <div className="activity-row" key={a.id}>
              <span>
                <Activity size={13} />
              </span>
              <div>
                <strong>{a.action}</strong>
                <small>
                  {a.entity} · {a.actor}
                </small>
              </div>
              <small>{time(a.created_at)}</small>
            </div>
          ))}
      </section>
    </main>
  );
}
function Bar({
  label,
  value,
  max,
  light = false,
}: {
  label: string;
  value: number;
  max: number;
  light?: boolean;
}) {
  return (
    <div className="bar-row">
      <div className="bar-label">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="bar-track">
        <div
          className={"bar-fill " + (light ? "light" : "")}
          style={{ width: Math.max(0, (value / Math.max(1, max)) * 100) + "%" }}
        />
      </div>
    </div>
  );
}

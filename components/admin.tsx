"use client";
import { useEffect, useRef, useState } from "react";
import {
  Database,
  Upload,
  RefreshCw,
  Check,
  ArrowUpRight,
  ExternalLink,
  Plus,
  ShieldCheck,
  GitMerge,
  FileSpreadsheet,
  Clock3,
  Search,
  AlertTriangle,
  Building2,
  History,
} from "lucide-react";
import type { Provider } from "@/lib/domain";
import {
  api,
  useData,
  Notice,
  Modal,
  Field,
  Badge,
  time,
  Empty,
} from "./shared";
import { Checkboxes } from "./clinic";
export default function Admin({
  providers,
  refreshProviders,
}: {
  providers: Provider[];
  refreshProviders: () => void;
}) {
  const [tab, setTab] = useState("Hospital directory");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Provider | null>(null);
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const syncing = useRef(false);
  const { data: overview, refresh } = useData<any>("admin/overview", {
    imports: [],
    conflicts: [],
    audit: [],
    interviews: [],
  });
  async function sync(csv?: string) {
    if (syncing.current) return;
    syncing.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await api(
        "admin/import",
        "POST",
        csv ? { csv } : { sync: true },
      );
      setFeedback(
        `Import complete: ${r.rows} interview rows processed; ${r.merged} matched existing hospitals. Staff edits are preserved and conflicts are ready for review.`,
      );
      refresh();
      refreshProviders();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!auto) return;
    const timer = setInterval(() => sync(), 60000);
    return () => clearInterval(timer);
  }, [auto]);
  async function partner(p: Provider) {
    try {
      await api("providers/" + p.id, "PATCH", {
        version: p.version,
        partner: !p.partner,
      });
      refreshProviders();
      refresh();
      setFeedback(
        `${p.name}: demo partnership ${p.partner ? "removed" : "enabled"}. Owner intake options update automatically.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const filtered = providers.filter((p) =>
    (p.name + " " + p.city + " " + p.category + " " + p.services.join(" "))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <main className="workspace">
      <div className="workspace-header">
        <div className="workspace-title">
          <div className="eyebrow">A DIRECTORY YOU CAN TRUST</div>
          <h1>Good data. Better care.</h1>
          <p>
            One shared source for owners, clinics, and the people connecting
            them.
          </p>
        </div>
        <div className="workspace-actions">
          <button
            className="secondary"
            onClick={() => {
              setTab("Imports & sources");
            }}
          >
            <FileSpreadsheet size={16} /> Import data
          </button>
          <button className="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add hospital
          </button>
        </div>
      </div>
      <div className="metrics">
        {[
          {
            label: "Hospitals in directory",
            value: providers.length,
            caption: "Deduplicated provider records",
            Icon: Building2,
          },
          {
            label: "Interview records",
            value: overview.interviews.length,
            caption: "Original source evidence retained",
            Icon: FileSpreadsheet,
          },
          {
            label: "Demo partners",
            value: providers.filter((p) => p.partner).length,
            caption: "Free pilot · no billing enabled",
            Icon: ShieldCheck,
          },
          {
            label: "Conflicts to review",
            value: overview.conflicts.length,
            caption: "Staff edits protected on import",
            Icon: GitMerge,
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
      <div className="tabs" role="tablist" aria-label="Data sections">
        {[
          "Hospital directory",
          "Imports & sources",
          "Conflicts",
          "Activity log",
        ].map((x) => (
          <button
            role="tab"
            aria-selected={tab === x}
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "Conflicts" && overview.conflicts.length
              ? ` (${overview.conflicts.length})`
              : ""}
          </button>
        ))}
      </div>
      {feedback && <Notice>{feedback}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {tab === "Hospital directory" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Hospital directory</h2>
              <p>
                Public facts stay distinct from live, simulated operational
                status.
              </p>
            </div>
            <input
              aria-label="Search hospital directory"
              placeholder="Search hospitals, cities, services…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Care type</th>
                  <th>Source</th>
                  <th>Partnership</th>
                  <th>Last updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>
                        {p.city} ·{" "}
                        {p.species.join(", ") || "Species unconfirmed"}
                      </small>
                    </td>
                    <td>
                      <Badge>{p.category}</Badge>
                    </td>
                    <td>
                      <a
                        className="pill-link"
                        href={p.source_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.source_kind === "spreadsheet"
                          ? "Interview tracker"
                          : "Public website"}{" "}
                        <ExternalLink size={11} />
                      </a>
                    </td>
                    <td>
                      <button
                        className={"badge " + (p.partner ? "teal" : "gray")}
                        aria-label={"Toggle partnership for " + p.name}
                        onClick={() => partner(p)}
                      >
                        {p.partner ? "Demo partner ✓" : "Nonpartner +"}{" "}
                      </button>
                    </td>
                    <td>
                      <small>{time(p.updated_at)}</small>
                    </td>
                    <td>
                      <button
                        className="table-button"
                        onClick={() => setSelected(p)}
                      >
                        Edit <ArrowUpRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {tab === "Imports & sources" && (
        <div className="import-layout">
          <section className="panel">
            <h2>Your spreadsheet, connected</h2>
            <p className="muted" style={{ fontSize: 12 }}>
              Import the original interview tracker without losing duplicate
              interviews or replacing staff-owned facts.
            </p>
            <div className="source-box">
              <FileSpreadsheet size={24} />
              <div>
                <strong>Veterinary Emergency-Care Interview Tracker</strong>
                <p>Google Sheets · 5 original interviews → 4 hospitals</p>
                <a
                  href="https://docs.google.com/spreadsheets/d/1Bm70UnTK56-J-U9bgxAUKzTwmA6JIlIn8DYnUudk_TE/edit?gid=440460470#gid=440460470"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open spreadsheet <ExternalLink size={12} />
                </a>
              </div>
            </div>
            <div className="action-row">
              <button
                className="primary"
                disabled={busy}
                onClick={() => sync()}
              >
                <RefreshCw size={15} className={busy ? "spin" : ""} />
                {busy ? "Syncing…" : "Sync Google Sheet"}
              </button>
              <label
                className="tiny"
                style={{ display: "flex", alignItems: "center", gap: 7 }}
              >
                <input
                  type="checkbox"
                  style={{ width: "auto" }}
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />{" "}
                Auto-sync every 60 seconds
              </label>
            </div>
            <p className="tiny" style={{ marginTop: 14 }}>
              Auto-sync runs while this administrator page is open. All views
              refresh database changes every 4 seconds.
            </p>
            <div className="upload-zone">
              <Upload size={25} />
              <h3 style={{ marginTop: 12 }}>Or upload an exported CSV</h3>
              <small>Same tracker columns. Up to 1.5 MB.</small>
              <input
                type="file"
                aria-label="Import hospital CSV"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (f.size > 1500000) {
                      setError("CSV exceeds 1.5 MB.");
                      return;
                    }
                    await sync(await f.text());
                    e.target.value = "";
                  }
                }}
              />
            </div>
            <div className="callout">
              <ShieldCheck size={17} />
              Imports never update live intake capacity or turn a public listing
              into a partner.
            </div>
          </section>
          <section className="panel">
            <h2>Import history</h2>
            {overview.imports.map((r: any) => (
              <div className="activity-row" key={r.id}>
                <span>
                  <Check size={14} />
                </span>
                <div>
                  <strong>{r.source}</strong>
                  <small>
                    {r.rows_count} rows · {r.merged_count} existing matches ·{" "}
                    {time(r.created_at)}
                  </small>
                </div>
              </div>
            ))}
            <div className="divider" />
            <h3>How updates are handled</h3>
            <p className="muted" style={{ fontSize: 12 }}>
              Records match by interview ID, normalized phone, or hospital name
              and city. Original interviews remain attached to their hospital.
              Empty interview cells do not erase known capabilities.
            </p>
            <p className="muted" style={{ fontSize: 12 }}>
              Clinic and administrator edits become protected fields. Incoming
              spreadsheet differences appear under Conflicts, where you can keep
              the staff value or apply the spreadsheet value.
            </p>
          </section>
        </div>
      )}
      {tab === "Conflicts" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Keep a human in the loop</h2>
              <p>
                Incoming spreadsheet edits never silently replace staff updates.
              </p>
            </div>
            <GitMerge size={22} />
          </div>
          {!overview.conflicts.length ? (
            <Empty
              title="Everything is in agreement"
              body="When a spreadsheet value differs from a protected clinic edit, it will appear here."
            />
          ) : (
            overview.conflicts.map((c: any) => (
              <div className="conflict-card" key={c.id}>
                <h3>
                  {c.name} <Badge tone="amber">{c.field}</Badge>
                </h3>
                <div className="conflict-values">
                  <div>
                    <small>Current staff value</small>
                    {JSON.stringify(c.current_value)}
                  </div>
                  <div>
                    <small>Incoming spreadsheet value</small>
                    {JSON.stringify(c.incoming_value)}
                  </div>
                </div>
                <div className="action-row">
                  <button
                    className="secondary"
                    onClick={async () => {
                      try {
                        await api("admin/conflicts", "POST", {
                          id: c.id,
                          apply: false,
                        });
                        refresh();
                        setFeedback("Staff value retained.");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Keep staff value
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      try {
                        await api("admin/conflicts", "POST", {
                          id: c.id,
                          apply: true,
                        });
                        refresh();
                        refreshProviders();
                        setFeedback("Spreadsheet value applied to all views.");
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Apply spreadsheet value
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      )}
      {tab === "Activity log" && (
        <section className="panel">
          <h2>A clear trail of changes</h2>
          {overview.audit.map((a: any) => (
            <div className="activity-row" key={a.id}>
              <span>
                <History size={13} />
              </span>
              <div>
                <strong>{a.action}</strong>
                <small>
                  {a.actor} · {a.entity}: {a.entity_id} · {time(a.created_at)}
                </small>
              </div>
            </div>
          ))}
        </section>
      )}
      {selected && (
        <EditProvider
          provider={selected}
          close={() => setSelected(null)}
          saved={() => {
            refreshProviders();
            refresh();
            setSelected(null);
            setFeedback(
              "Hospital details saved. Connected views will update automatically.",
            );
          }}
        />
      )}
      {adding && (
        <AddProvider
          close={() => setAdding(false)}
          saved={() => {
            refreshProviders();
            refresh();
            setAdding(false);
            setFeedback(
              "Hospital added with unknown availability. Add confirmed capabilities in Edit.",
            );
          }}
        />
      )}
    </main>
  );
}
function EditProvider({
  provider: p,
  close,
  saved,
}: {
  provider: Provider;
  close: () => void;
  saved: () => void;
}) {
  const [species, setSpecies] = useState(p.species);
  const [services, setServices] = useState(p.services);
  const [error, setError] = useState("");
  return (
    <Modal title="Edit hospital details" close={close} wide>
      <div className="callout">
        These changes update the shared directory and are protected from
        spreadsheet overwrites. Confirm facts with the clinic before publishing
        outside the demo.
      </div>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("providers/" + p.id, "PATCH", {
              ...d,
              phone: d.phone ? String(d.phone).replace(/\D/g, "") : null,
              version: p.version,
              species,
              services,
              exam_fee: d.exam_fee ? Number(d.exam_fee) : null,
            });
            saved();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Field label="Hospital name">
          <input required name="name" defaultValue={p.name} />
        </Field>
        <Field label="City">
          <input required name="city" defaultValue={p.city} />
        </Field>
        <Field label="Care category">
          <select name="category" defaultValue={p.category}>
            {["Emergency", "Urgent care", "Specialty", "General practice"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </Field>
        <Field label="Phone (10 digits)">
          <input name="phone" defaultValue={p.phone || ""} />
        </Field>
        <div className="span-2">
          <Field label="Street address">
            <input required name="address" defaultValue={p.address || ""} />
          </Field>
        </div>
        <Field label="Published hours">
          <input name="hours" required defaultValue={p.hours} />
        </Field>
        <Field label="Reported exam fee (optional)">
          <input
            name="exam_fee"
            type="number"
            min="0"
            step="0.01"
            defaultValue={p.exam_fee || ""}
          />
        </Field>
        <div className="span-2">
          <Field label="Capabilities and limitations">
            <textarea name="scope" required defaultValue={p.scope} />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Cost information and qualifiers">
            <textarea name="cost_note" required defaultValue={p.cost_note} />
          </Field>
        </div>
        <div className="span-2">
          <p className="tiny">Species</p>
          <Checkboxes
            choices={["Dog", "Cat", "Rabbit", "Bird", "Reptile"]}
            values={species}
            set={setSpecies}
          />
        </div>
        <div className="span-2">
          <p className="tiny">Services</p>
          <Checkboxes
            choices={[
              "Emergency",
              "Urgent care",
              "Specialty",
              "Neurology",
              "Surgery",
              "Ultrasound",
              "General practice",
              "Internal medicine",
              "Radiography",
              "Oxygen support",
            ]}
            values={services}
            set={setServices}
          />
        </div>
        {error && (
          <div className="span-2">
            <Notice error>{error}</Notice>
          </div>
        )}
        <button className="primary span-2">
          Save hospital changes <Check size={16} />
        </button>
      </form>
    </Modal>
  );
}
function AddProvider({
  close,
  saved,
}: {
  close: () => void;
  saved: () => void;
}) {
  const [error, setError] = useState("");
  return (
    <Modal title="Add a hospital" close={close}>
      <p className="muted">
        Start with sourced facts. Intake status stays unknown until updated by
        staff.
      </p>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("admin/providers", "POST", {
              ...d,
              phone: d.phone ? String(d.phone).replace(/\D/g, "") : null,
              lat: Number(d.lat),
              lng: Number(d.lng),
            });
            saved();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="span-2">
          <Field label="Hospital name">
            <input required name="name" />
          </Field>
        </div>
        <Field label="City">
          <input required name="city" defaultValue="San Francisco, CA" />
        </Field>
        <Field label="Care category">
          <select name="category">
            {["Emergency", "Urgent care", "Specialty", "General practice"].map(
              (x) => (
                <option key={x}>{x}</option>
              ),
            )}
          </select>
        </Field>
        <div className="span-2">
          <Field label="Street address">
            <input required name="address" />
          </Field>
        </div>
        <Field label="Phone (optional)">
          <input name="phone" />
        </Field>
        <Field label="Official source URL">
          <input name="source_url" type="url" required />
        </Field>
        <Field label="Latitude">
          <input
            name="lat"
            type="number"
            step="any"
            min="-90"
            max="90"
            required
          />
        </Field>
        <Field label="Longitude">
          <input
            name="lng"
            type="number"
            step="any"
            min="-180"
            max="180"
            required
          />
        </Field>
        {error && (
          <div className="span-2">
            <Notice error>{error}</Notice>
          </div>
        )}
        <button className="primary span-2">
          Add sourced hospital <Plus size={15} />
        </button>
      </form>
    </Modal>
  );
}

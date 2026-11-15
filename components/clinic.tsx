"use client";
import ActivityPanel from "./activity-panel";
import {
  speciesGroups,
  exoticTypes,
  farmTypes,
  speciesLabel,
} from "@/lib/species";
import { useState } from "react";
import {
  ArrowRight,
  Users,
  ClipboardList,
  Clock3,
  Activity,
  Plus,
  Check,
  Stethoscope,
  PawPrint,
  Send,
  ArrowUpRight,
  RefreshCw,
  ShieldCheck,
  MessageSquare,
  CalendarClock,
} from "lucide-react";
import type { Provider } from "@/lib/domain";
import {
  allowedStage,
  liveAvailability,
  stages,
  canInquire,
} from "@/lib/domain";
import {
  api,
  useData,
  Notice,
  Modal,
  Field,
  Badge,
  time,
  Empty,
  Loading,
} from "./shared";
import { Conversation } from "./owner";
export default function Clinic({
  providers,
  clinicId,
  changeClinic,
  refreshProviders,
}: {
  providers: Provider[];
  clinicId: string;
  changeClinic: (id: string) => void;
  refreshProviders: () => void;
}) {
  const [tab, setTab] = useState("Patients");
  const [selected, setSelected] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("All stages");
  const [queue, setQueue] = useState("Incoming inquiries");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const {
    data: intakes,
    loading,
    error: loadError,
    refresh,
  } = useData<any[]>("intakes", []);
  const { data: handoffs, refresh: refreshHandoffs } = useData<any[]>(
    "handoffs",
    [],
  );
  const clinic = providers.find((p) => p.id === clinicId);
  const visibleIntakes = intakes.filter(
    (i) =>
      (queue === "Incoming inquiries"
        ? ["New", "Reviewing", "Expected"].includes(i.stage)
        : queue === "At clinic"
          ? ["Arrived", "In care"].includes(i.stage)
          : ["Discharged", "Transferred"].includes(i.stage)) &&
      (stage === "All stages" || i.stage === stage) &&
      (i.pet_name + " " + i.owner_name + " " + i.concern)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const active = intakes.filter((i) =>
    ["Arrived", "In care"].includes(i.stage),
  );
  async function handoffAction(id: string, status: string) {
    try {
      await api("handoffs/" + id, "PATCH", { status });
      refreshHandoffs();
      refresh();
      setFeedback(
        `Handoff ${status.toLowerCase()}. The patient board is updated.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <main className="workspace">
      <div className="workspace-header">
        <div className="workspace-title">
          <div className="eyebrow">VETPATH FOR CARE TEAMS</div>
          <h1>Today’s care board</h1>
          <p>
            Acknowledge inquiries, record arrivals, and keep owners informed.
          </p>
        </div>
        <div className="workspace-actions">
          <span className="live-label">
            <span className="status-dot" /> Updates every 4 seconds
          </span>
          <select
            aria-label="Select clinic workspace"
            value={clinicId}
            onChange={(e) => changeClinic(e.target.value)}
          >
            {[...providers]
              .sort((a, b) => Number(b.fictional) - Number(a.fictional))
              .map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="intro-panel">
        <div>
          <h3>{clinic?.name || "Clinic workspace"}</h3>
          <p>
            {clinic?.partner
              ? "Free pilot partner · Simulated partnership"
              : "Public listing · Simulated clinic workspace · no actual hospital is notified"}{" "}
            · {clinic?.city}
          </p>
        </div>
        <Badge
          tone={
            liveAvailability(clinic || ({} as Provider)) === "Accepting"
              ? "teal"
              : "gray"
          }
        >
          {clinic ? liveAvailability(clinic) : "Unknown"} · Demo
        </Badge>
      </div>
      {clinic?.fictional && (
        <ActivityPanel
          clinicId={clinicId}
          configure={() => setTab("Availability & services")}
        />
      )}
      <div className="metrics">
        {[
          {
            label: "Incoming requests",
            value: intakes.filter((i) => i.stage === "New").length,
            caption: "Ready for your first review",
            Icon: ClipboardList,
          },
          {
            label: "Expected arrivals",
            value: intakes.filter((i) => i.stage === "Expected").length,
            caption: "Intake reviewed by your team",
            Icon: Clock3,
          },
          {
            label: "Patients in care",
            value: intakes.filter((i) => i.stage === "In care").length,
            caption: "Care currently underway",
            Icon: Stethoscope,
          },
          {
            label: "Arrived workload",
            value: active.length,
            caption: "Arrived or in care · excludes inquiries",
            Icon: Users,
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
      <div className="tabs" role="tablist" aria-label="Clinic sections">
        {[
          "Patients",
          "Availability & services",
          "Team coverage",
          "Handoffs",
        ].map((x) => (
          <button
            role="tab"
            aria-selected={tab === x}
            key={x}
            className={tab === x ? "active" : ""}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "Handoffs" &&
            handoffs.filter(
              (h) => h.status === "Requested" && h.to_provider === clinicId,
            ).length > 0
              ? " •"
              : ""}
          </button>
        ))}
      </div>
      {feedback && <Notice>{feedback}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {loadError && (
        <Notice error>
          {loadError} <button onClick={refresh}>Try again</button>
        </Notice>
      )}
      {tab === "Patients" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Patient board</h2>
              <p>
                Fictional patients. Assessments and stages are set by clinic
                staff.
              </p>
            </div>
            <div className="workspace-actions">
              <input
                aria-label="Search patients"
                placeholder="Search pets or owners…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter patient stage"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                style={{ width: 150 }}
              >
                {["All stages", ...stages].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="queue-tabs" aria-label="Patient queues">
            {["Incoming inquiries", "At clinic", "Completed"].map((q) => (
              <button
                key={q}
                aria-pressed={queue === q}
                className={queue === q ? "active" : ""}
                onClick={() => {
                  setQueue(q);
                  setStage("All stages");
                }}
              >
                {q} (
                {
                  intakes.filter((i) =>
                    q === "Incoming inquiries"
                      ? ["New", "Reviewing", "Expected"].includes(i.stage)
                      : q === "At clinic"
                        ? ["Arrived", "In care"].includes(i.stage)
                        : ["Discharged", "Transferred"].includes(i.stage),
                  ).length
                }
                )
              </button>
            ))}
          </div>
          {loading ? (
            <Loading />
          ) : visibleIntakes.length === 0 ? (
            <Empty
              title={
                queue === "Incoming inquiries"
                  ? "No incoming inquiries"
                  : "No patients in this view"
              }
              body="New owner inquiries appear here automatically. Check another queue or clear your search to see other patients."
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Patient / owner</th>
                    <th>Presenting concern</th>
                    <th>Assessment</th>
                    <th>Stage</th>
                    <th>Received</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visibleIntakes.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <strong>
                          {i.pet_name}{" "}
                          <span className="tiny">
                            · {speciesLabel(i.species, i.species_subtype)}
                          </span>
                        </strong>
                        <small>{i.owner_name}</small>
                      </td>
                      <td style={{ maxWidth: 240 }}>
                        <span>
                          {i.concern.length > 75
                            ? i.concern.slice(0, 75) + "…"
                            : i.concern}
                        </span>
                      </td>
                      <td>
                        <Badge
                          tone={
                            i.urgency === "Critical"
                              ? "red"
                              : i.urgency === "Urgent"
                                ? "amber"
                                : "gray"
                          }
                        >
                          {i.urgency}
                        </Badge>
                      </td>
                      <td>
                        <Badge tone={i.stage === "New" ? "blue" : "teal"}>
                          {i.stage}
                        </Badge>
                      </td>
                      <td>
                        <small>{time(i.created_at)}</small>
                      </td>
                      <td>
                        <button
                          className="table-button"
                          onClick={() => setSelected(i)}
                        >
                          Review <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {tab === "Availability & services" && clinic && (
        <ClinicSettings
          key={clinic.id + ":" + clinic.version}
          clinic={clinic}
          refresh={refreshProviders}
          feedback={setFeedback}
        />
      )}
      {tab === "Team coverage" && <Coverage clinicId={clinicId} />}
      {tab === "Handoffs" && (
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h2>A more useful handoff</h2>
              <p>
                The receiving clinic must accept before the patient moves to its
                board.
              </p>
            </div>
            <ArrowUpRight size={21} />
          </div>
          {!handoffs.length ? (
            <Empty
              title="No handoffs yet"
              body="Open a patient and coordinate a handoff with another clinic workspace."
            />
          ) : (
            handoffs.map((h) => (
              <div className="request-row" key={h.id}>
                <div>
                  <strong>
                    {h.pet_name} · {h.from_name} →{" "}
                    {providers.find((p) => p.id === h.to_provider)?.name}
                  </strong>
                  <span>{h.summary}</span>
                  <small>{time(h.created_at)}</small>
                </div>
                <Badge tone={h.status === "Accepted" ? "teal" : "amber"}>
                  {h.status}
                </Badge>
                {h.to_provider === clinicId && h.status === "Requested" && (
                  <>
                    <button
                      className="secondary"
                      onClick={() => handoffAction(h.id, "Declined")}
                    >
                      Decline
                    </button>
                    <button
                      className="primary"
                      onClick={() => handoffAction(h.id, "Accepted")}
                    >
                      Accept handoff
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {selected && (
        <PatientDetail
          initial={selected}
          providers={providers}
          close={() => setSelected(null)}
          refreshBoard={() => {
            refresh();
            refreshProviders();
          }}
        />
      )}
    </main>
  );
}
function ClinicSettings({
  clinic,
  refresh,
  feedback,
}: {
  clinic: Provider;
  refresh: () => void;
  feedback: (s: string) => void;
}) {
  const [availability, setAvailability] = useState(clinic.availability);
  const [services, setServices] = useState(clinic.services);
  const [species, setSpecies] = useState(clinic.species);
  const [subtypes, setSubtypes] = useState(clinic.species_subtypes || []);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="section-grid">
      {clinic.fictional ? (
        <ActivityPanel clinicId={clinic.id} editable />
      ) : (
        <section className="panel">
          <h2>Let owners know where you stand</h2>
          <p className="muted">
            Update your intake capacity in a few seconds. Statuses become
            unknown after 60 minutes.
          </p>
          <div className="status-selector">
            {["Accepting", "Limited", "At capacity", "Unknown"].map((x) => (
              <button
                key={x}
                className={availability === x ? "active" : ""}
                onClick={() => setAvailability(x)}
              >
                {x}
              </button>
            ))}
          </div>
          <p className="tiny">
            Last availability update: {time(clinic.availability_at)}. All demo
            availability is simulated.
          </p>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("providers/" + clinic.id, "PATCH", {
                  version: clinic.version,
                  availability,
                });
                refresh();
                feedback(
                  "Availability saved. Owner discovery will update automatically.",
                );
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Check size={15} /> Publish demo availability
          </button>
          {error && <Notice error>{error}</Notice>}
          <div className="divider" />
          <h3>A useful call starts with the facts</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            Owners see live status alongside its timestamp. An “Accepting”
            status never guarantees acceptance, an appointment, or a wait time.
          </p>
        </section>
      )}
      <section className="panel">
        <h2>Exam fee</h2>
        <p className="muted">
          Owners see this amount on the clinic card and in price filters.
        </p>
        <form
          key={`${clinic.id}:${clinic.version}`}
          className="form-grid"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const value = new FormData(e.currentTarget).get("exam_fee");
              await api("providers/" + clinic.id, "PATCH", {
                version: clinic.version,
                exam_fee: value === "" ? null : Number(value),
              });
              refresh();
              feedback(
                "Exam fee saved. Owner cards and price filters update automatically.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Exam fee ($)">
            <input
              name="exam_fee"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              defaultValue={clinic.exam_fee ?? ""}
            />
          </Field>
          <button className="primary" disabled={busy}>
            Save exam fee
          </button>
        </form>
        {error && <Notice error>{error}</Notice>}
        <div className="divider" />
        <h2>Species & capabilities</h2>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("providers/" + clinic.id, "PATCH", {
                version: clinic.version,
                services,
                species,
                species_subtypes: subtypes,
              });
              refresh();
              feedback(
                "Species and services saved across the directory and owner view.",
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="tiny">Species accepted</p>
          <Checkboxes
            choices={[...speciesGroups]}
            values={species}
            set={setSpecies}
          />
          {species.includes("Exotics") && (
            <>
              <p className="tiny">
                Confirmed exotic types (empty means unconfirmed)
              </p>
              <Checkboxes
                choices={exoticTypes}
                values={subtypes}
                set={setSubtypes}
              />
            </>
          )}
          {species.includes("Farm animals") && (
            <>
              <p className="tiny">Confirmed farm animal types</p>
              <Checkboxes
                choices={farmTypes}
                values={subtypes}
                set={setSubtypes}
              />
            </>
          )}
          <p className="tiny" style={{ marginTop: 25 }}>
            Listed capabilities
          </p>
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
          <button className="primary full" disabled={busy}>
            Save species & services <Check size={15} />
          </button>
        </form>
      </section>
    </div>
  );
}
export function Checkboxes({
  choices,
  values,
  set,
}: {
  choices: string[];
  values: string[];
  set: (values: string[]) => void;
}) {
  return (
    <div className="check-group">
      {choices.map((x) => (
        <label key={x}>
          <input
            type="checkbox"
            checked={values.includes(x)}
            onChange={(e) =>
              set(
                e.target.checked
                  ? [...values, x]
                  : values.filter((y) => y !== x),
              )
            }
          />
          {x}
        </label>
      ))}
    </div>
  );
}
function Coverage({ clinicId }: { clinicId: string }) {
  const { data, refresh } = useData<any[]>("coverage?clinic=" + clinicId, []);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>The people behind the care</h2>
          <p>
            Simulated staff coverage. Confirm actual clinical capability
            directly with the team.
          </p>
        </div>
        <button className="secondary" onClick={() => setAdding(!adding)}>
          <Plus size={15} /> Add team member
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      {data.map((staff) => (
        <div className="staff-row" key={staff.id}>
          <span className="avatar">
            {staff.name
              .split(" ")
              .map((s: string) => s[0])
              .slice(0, 2)
              .join("")}
          </span>
          <div>
            <strong>{staff.name}</strong>
            <small>
              {staff.role} · {staff.shift}
            </small>
          </div>
          <Badge tone={staff.on_duty ? "teal" : "gray"}>
            {staff.on_duty ? "On duty" : "Off duty"}
          </Badge>
          <button
            className="secondary"
            onClick={async () => {
              try {
                await api(`coverage/${staff.id}?clinic=${clinicId}`, "PATCH", {
                  on_duty: !staff.on_duty,
                });
                refresh();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            {staff.on_duty ? "End shift" : "Start shift"}
          </button>
        </div>
      ))}
      {adding && (
        <form
          className="form-grid"
          style={{ marginTop: 20 }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            try {
              await api(
                "coverage?clinic=" + clinicId,
                "POST",
                Object.fromEntries(new FormData(form)),
              );
              refresh();
              form.reset();
              setAdding(false);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Field label="Staff name">
            <input name="name" required />
          </Field>
          <Field label="Role">
            <input name="role" required placeholder="Veterinary technician" />
          </Field>
          <Field label="Capacity role">
            <select name="role_type">
              <option value="nonclinical">Nonclinical (does not count)</option>
              <option value="doctor">Doctor</option>
              <option value="clinical_support">Clinical support</option>
            </select>
          </Field>
          <Field label="Shift hours">
            <input name="shift" required placeholder="9:00 AM – 5:00 PM" />
          </Field>
          <button className="primary" style={{ alignSelf: "end" }}>
            Add demo staff member
          </button>
        </form>
      )}
    </section>
  );
}
function PatientDetail({
  initial,
  providers,
  close,
  refreshBoard,
}: {
  initial: any;
  providers: Provider[];
  close: () => void;
  refreshBoard: () => void;
}) {
  const { data, refresh } = useData<any>("intakes/" + initial.id, initial);
  const [stage, setStage] = useState(initial.stage);
  const [urgency, setUrgency] = useState(initial.urgency);
  const [note, setNote] = useState("");
  const [workload, setWorkload] = useState(initial.workload || "Standard");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [handoff, setHandoff] = useState(false);
  const [version, setVersion] = useState(initial.version);
  async function save(nextStage = stage) {
    setSaving(true);
    try {
      const result = await api("intakes/" + initial.id, "PATCH", {
        version,
        stage: nextStage,
        urgency,
        workload,
      });
      setVersion(result.version);
      setStage(result.stage);
      refresh();
      refreshBoard();
      setFeedback("Clinical assessment and stage saved.");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const next: Record<string, [string, string]> = {
    New: ["Reviewing", "Acknowledge inquiry"],
    Reviewing: ["Arrived", "Record arrival"],
    Expected: ["Arrived", "Record arrival"],
    Arrived: ["In care", "Record clinical review & start care"],
    "In care": ["Discharged", "Complete visit"],
  };
  return (
    <Modal title="Patient inquiry & care" close={close} wide>
      <div className="patient-head">
        <div className="pet-avatar">
          <PawPrint size={25} />
        </div>
        <div>
          <h3>{data.pet_name}</h3>
          <p>
            {speciesLabel(data.species, data.species_subtype)} ·{" "}
            {data.owner_name} · {data.contact}
          </p>
        </div>
        <Badge tone="teal">{data.stage}</Badge>
      </div>
      {error && (
        <Notice error>
          {error}{" "}
          <button
            className="text-button"
            onClick={() => {
              setVersion(data.version);
              setStage(data.stage);
              setUrgency(data.urgency);
              setWorkload(data.workload);
              setError("");
            }}
          >
            Reload latest values
          </button>
        </Notice>
      )}
      {feedback && <Notice>{feedback}</Notice>}
      <div className="next-step">
        <div>
          <strong>
            {data.stage === "Discharged"
              ? "Visit complete"
              : next[data.stage]?.[1]}
          </strong>
          <p>
            {["New", "Reviewing", "Expected"].includes(data.stage)
              ? "This is an incoming inquiry. No activity points are added until staff record arrival."
              : "Workload points count until this visit is completed."}
          </p>
        </div>
        {next[data.stage] && (
          <button
            className="primary"
            disabled={saving}
            onClick={() => save(next[data.stage][0])}
          >
            {saving ? "Saving…" : next[data.stage][1]}
          </button>
        )}
      </div>
      <div className="patient-detail-layout">
        <div>
          <section className="panel">
            <h3>Receiving clinic summary</h3>
            <p>
              {data.receiving_summary || "Review the owner’s report below."}
            </p>
            <p className="tiny">
              Structured from owner-provided facts · not a diagnosis.{" "}
              {data.summary_mode === "ai"
                ? "AI-organized requirements."
                : "Prepared from the original owner report; no clinical decision is automated."}
            </p>
            <h3>Original owner report</h3>
            <p>{data.concern}</p>
            <p className="tiny">
              Duration: {data.duration || "Not provided"}
              <br />
              Submitted {time(data.created_at)}
            </p>
            <div className="divider" />
            <div className="form-grid">
              <Field label="Clinical assessment">
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                >
                  {["Unassessed", "Routine", "Urgent", "Critical"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Workload assignment">
                <select
                  value={workload}
                  onChange={(e) => setWorkload(e.target.value)}
                >
                  <option value="Light">Light · 1 point</option>
                  <option value="Standard">Standard · 2 points</option>
                  <option value="Intensive">Intensive · 4 points</option>
                </select>
              </Field>
              <Field label="Patient stage">
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  {stages
                    .filter((x) => allowedStage(data.stage, x))
                    .map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                </select>
              </Field>
            </div>
            <button
              className="secondary full"
              disabled={saving}
              onClick={() => save()}
            >
              Save assessment & stage <Check size={15} />
            </button>
            <small>
              Only authorized demo staff set clinical assessments. Arrived means
              a staff-confirmed arrival.
            </small>
          </section>
          <section className="panel" style={{ marginTop: 18 }}>
            <h3>Clinical notes</h3>
            {data.notes?.map((n: any) => (
              <div className="note" key={n.id}>
                <p>{n.body}</p>
                <small>
                  {n.author} · {time(n.created_at)}
                </small>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(`intakes/${initial.id}/notes`, "POST", {
                    body: note,
                  });
                  setNote("");
                  refresh();
                  setFeedback(
                    "Clinical note saved. Notes are visible only to staff.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <textarea
                aria-label="Clinical note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={3000}
                placeholder="Assessment, medications, and next steps…"
              />
              <button className="secondary full">
                Add clinical note <Plus size={14} />
              </button>
            </form>
          </section>
        </div>
        <div>
          <Conversation intakeId={initial.id} />
          <div className="divider" />
          <h3>Coordinate the next step</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            Share a concise summary with the receiving team. A request alone
            does not confirm acceptance.
          </p>
          <button className="secondary" onClick={() => setHandoff(!handoff)}>
            Create handoff <ArrowUpRight size={15} />
          </button>
          {handoff && (
            <form
              className="stack"
              style={{ marginTop: 18 }}
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api(
                    `intakes/${initial.id}/handoff`,
                    "POST",
                    Object.fromEntries(new FormData(e.currentTarget)),
                  );
                  setFeedback(
                    "Handoff requested. The receiving clinic must accept.",
                  );
                  setHandoff(false);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Field label="Receiving clinic">
                <select name="toProvider" required>
                  <option value="">Select a receiving clinic</option>
                  {providers
                    .filter((p) => canInquire(p) && p.id !== data.provider_id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Clinical handoff summary">
                <textarea
                  name="summary"
                  required
                  maxLength={3000}
                  placeholder="Reason for transfer, stability, medication history, records needed"
                />
              </Field>
              <button className="primary">
                Request handoff <Send size={15} />
              </button>
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}

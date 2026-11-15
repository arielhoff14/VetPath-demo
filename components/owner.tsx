"use client";
import { useState, useMemo } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  LocateFixed,
  SlidersHorizontal,
  Phone,
  Navigation,
  Check,
  ShieldCheck,
  Clock3,
  Plus,
  X,
  Heart,
  Stethoscope,
  ChevronDown,
  LayoutList,
  Map as MapIcon,
  TriangleAlert,
  Sparkles,
  Send,
  Building2,
  GitCompareArrows,
  PawPrint,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import {
  Provider,
  Filters,
  matchProviders,
  liveAvailability,
  locate,
} from "@/lib/domain";
import {
  api,
  Modal,
  Notice,
  Field,
  Badge,
  time,
  sourceDate,
  useData,
  Empty,
} from "./shared";
export default function Owner({ providers }: { providers: Provider[] }) {
  const [filters, setFilters] = useState<Filters>({
    species: "Any pet",
    service: "Any care",
    location: "San Francisco",
    radius: 25,
    available: false,
  });
  const [prompt, setPrompt] = useState("");
  const [conversation, setConversation] = useState<
    { role: string; text: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [assistantMode, setAssistantMode] = useState("rule-based");
  const [emergency, setEmergency] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [selected, setSelected] = useState<Provider | null>(null);
  const [intake, setIntake] = useState<Provider | null>(null);
  const [requests, setRequests] = useState(false);
  const [map, setMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const matches = useMemo(
    () => matchProviders(providers, filters, emergency),
    [providers, filters, emergency],
  );
  function change<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((f) => ({
      ...f,
      [key]: value,
      ...(key === "location" ? { lat: undefined, lng: undefined } : {}),
    }));
    api("events", "POST", {
      kind: "filter_change",
      metadata: { filter: key, value: String(value) },
    }).catch(() => {});
  }
  async function ask(value = prompt) {
    if (!value.trim()) return;
    setBusy(true);
    setError("");
    setPrompt("");
    setConversation((c) => [...c, { role: "owner", text: value }]);
    try {
      const d = await api("assistant", "POST", { message: value });
      setAssistantMode(d.mode);
      setEmergency(d.emergency);
      setFilters((f) => ({
        ...f,
        ...(d.species ? { species: d.species } : {}),
        ...(d.service ? { service: d.service } : {}),
        ...(d.location
          ? { location: d.location, lat: undefined, lng: undefined }
          : {}),
        available: d.emergency ? false : f.available,
      }));
      setConversation((c) => [...c, { role: "assistant", text: d.reply }]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function geolocate() {
    setLocating(true);
    if (!navigator.geolocation) {
      setError(
        "Location is unavailable in this browser. Enter a city or ZIP code.",
      );
      setLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setFilters((f) => ({
          ...f,
          location: "My location",
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        }));
        setLocating(false);
      },
      () => {
        setError(
          "We couldn’t access your location. Please enter a supported city or ZIP code.",
        );
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }
  function toggleCompare(p: Provider) {
    if (compare.includes(p.id)) setCompare((c) => c.filter((x) => x !== p.id));
    else if (compare.length < 3) {
      setCompare((c) => [...c, p.id]);
      api("events", "POST", { kind: "comparison", providerId: p.id }).catch(
        () => {},
      );
    } else setError("Compare up to three clinics at a time.");
  }
  return (
    <main className="owner-main">
      <section className="owner-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-dot" /> HERE FOR YOU. HERE FOR THEM.
          </div>
          <h1>
            The right care.
            <br />
            <span>A little closer.</span>
          </h1>
          <p>
            When your pet needs help, finding it should feel simpler.
            <br className="desktop-break" /> Let’s find the right place,
            together.
          </p>
        </div>
        <div className="hero-note">
          <span className="heart-circle">
            <Heart size={24} />
          </span>
          <div>
            One less thing
            <br />
            to worry about.<span>Free for you. Always.</span>
          </div>
          <svg viewBox="0 0 140 55" aria-hidden="true">
            <path
              d="M3 32 Q45 4 81 28 T135 17"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="4 5"
            />
            <path
              d="m125 10 12 6-9 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            />
          </svg>
        </div>
      </section>
      <div className="emergency-strip">
        <span>
          <TriangleAlert size={16} />
          <strong>A possible emergency?</strong> Trouble breathing, collapse, or
          severe bleeding need immediate care.
        </span>
        <button
          onClick={() => {
            setEmergency(true);
            setFilters((f) => ({
              ...f,
              service: "Emergency",
              available: false,
            }));
          }}
        >
          Find emergency care <ArrowUpRight size={16} />
        </button>
      </div>
      <div className="discovery-layout">
        <aside className="discovery-sidebar">
          <section className="chat-card">
            <div className="chat-top">
              <div className="assistant-symbol">
                <Sparkles size={20} />
              </div>
              <div>
                <h2>Let’s find their care</h2>
                <span>Your VetPath guide</span>
              </div>
              <span className="online-dot" />
            </div>
            <div className="chat-body">
              <div className="assistant-message">
                <p>
                  Hi, I’m here to help. <span aria-hidden="true">👋</span>
                </p>
                <p>
                  Tell me a little about your pet and what’s going on. We’ll
                  take it from there.
                </p>
              </div>
              {conversation.length === 0 ? (
                <>
                  <div className="chat-hint">A good place to start</div>
                  <button
                    className="suggestion"
                    onClick={() =>
                      ask(
                        "My dog is vomiting and needs urgent care in San Francisco",
                      )
                    }
                  >
                    My dog isn’t feeling well <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="suggestion"
                    onClick={() =>
                      ask(
                        "My cat needs a neurology specialist in San Francisco",
                      )
                    }
                  >
                    I’m looking for a specialist <ArrowUpRight size={14} />
                  </button>
                  <button
                    className="suggestion"
                    onClick={() => ask("My rabbit needs care in San Francisco")}
                  >
                    Care for a rabbit or exotic pet <ArrowUpRight size={14} />
                  </button>
                </>
              ) : (
                conversation.map((m, i) => (
                  <div key={i} className={"chat-message " + m.role}>
                    {m.text}
                  </div>
                ))
              )}
              {busy && (
                <div className="chat-hint" role="status">
                  Organizing your needs…
                </div>
              )}
            </div>
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault();
                ask();
              }}
            >
              <textarea
                aria-label="Tell us about your pet"
                placeholder="Tell us about your pet…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                maxLength={3000}
              />
              <button
                aria-label="Send message"
                disabled={busy || !prompt.trim()}
              >
                <ArrowUp size={19} />
              </button>
            </form>
            <div className="chat-disclaimer">
              <ShieldCheck size={13} />
              <span>
                Guidance, not a diagnosis.{" "}
                {assistantMode === "ai"
                  ? "AI-assisted search"
                  : "Rule-based demo assistant"}
                .
              </span>
            </div>
          </section>
          <div className="reassurance">
            <div className="mini-icon">
              <Heart size={18} />
            </div>
            <h3>Your pet comes first.</h3>
            <p>
              We prioritize appropriate care over price or partnership. Every
              match shows what we know—and what still needs a call.
            </p>
            <button onClick={() => setRequests(true)}>
              View your care requests <ArrowRight size={14} />
            </button>
          </div>
        </aside>
        <section className="results-section">
          <div className="search-toolbar">
            <div className="location-control">
              <MapPin size={18} />
              <input
                aria-label="Search location"
                value={filters.location}
                onChange={(e) => change("location", e.target.value)}
                list="locations"
              />
              <datalist id="locations">
                {[
                  "San Francisco",
                  "Mission District",
                  "94103",
                  "94110",
                  "94112",
                  "Oakland",
                  "Lafayette",
                  "San Jose",
                  "Sacramento",
                ].map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
              <button
                onClick={geolocate}
                disabled={locating}
                aria-label="Use my location"
                title="Use my location"
              >
                <LocateFixed size={18} />
              </button>
            </div>
            <button
              className={"filter-button " + (showFilters ? "selected" : "")}
              onClick={() => setShowFilters(!showFilters)}
            >
              <SlidersHorizontal size={16} /> Filters{" "}
              <span>
                {Number(filters.species !== "Any pet") +
                  Number(filters.service !== "Any care") +
                  Number(filters.available)}
              </span>
            </button>
          </div>
          {!filters.lat && !locate(filters.location) && (
            <Notice error>
              Choose a supported Bay Area city or ZIP from the suggestions, or
              use your location. Distances are unavailable for this entry.
            </Notice>
          )}
          <div className="quick-filters">
            <label>
              <PawPrint size={14} />
              <select
                aria-label="Pet species"
                value={filters.species}
                onChange={(e) => change("species", e.target.value)}
              >
                {["Any pet", "Dog", "Cat", "Rabbit", "Bird", "Reptile"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              <Stethoscope size={14} />
              <select
                aria-label="Care type"
                value={filters.service}
                onChange={(e) => {
                  setEmergency(false);
                  change("service", e.target.value);
                }}
              >
                {[
                  "Any care",
                  "Emergency",
                  "Urgent care",
                  "Specialty",
                  "Neurology",
                  "Surgery",
                  "Ultrasound",
                  "General practice",
                ].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button
              className={filters.available ? "selected" : ""}
              onClick={() => change("available", !filters.available)}
            >
              <span className="status-dot" />
              {filters.available ? "Accepting only" : "Accepting patients"}
            </button>
          </div>
          {showFilters && (
            <div className="expanded-filters">
              <Field label="Search radius">
                <select
                  value={filters.radius}
                  onChange={(e) => change("radius", Number(e.target.value))}
                  aria-label="Search radius"
                >
                  {[5, 10, 25, 50, 100, 200].map((x) => (
                    <option value={x} key={x}>
                      {x} miles
                    </option>
                  ))}
                </select>
              </Field>
              <span>
                Distances are approximate straight-line estimates. Intake status
                expires after 60 minutes.
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setEmergency(false);
                  setFilters({
                    species: "Any pet",
                    service: "Any care",
                    location: "San Francisco",
                    radius: 25,
                    available: false,
                  });
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          {error && <Notice error>{error}</Notice>}
          {emergency && (
            <div className="emergency-callout">
              <TriangleAlert />
              <div>
                <strong>Seek veterinary attention now.</strong>
                <p>
                  Emergency hospitals are sorted by distance. Availability and
                  radius filters are bypassed. Do not delay care to compare
                  prices or wait for a response.
                </p>
                <button
                  onClick={() => {
                    setEmergency(false);
                    change("service", "Any care");
                  }}
                >
                  Return to all care
                </button>
              </div>
            </div>
          )}
          <div className="results-heading">
            <div>
              <h2>
                Care near{" "}
                {filters.location === "My location" ? "you" : filters.location}
              </h2>
              <p>
                {matches.length}{" "}
                {matches.length === 1 ? "provider" : "providers"} ·{" "}
                {emergency
                  ? "Nearest emergency care first"
                  : "Appropriate care, thoughtfully matched"}
              </p>
            </div>
            <div className="view-toggle">
              <button
                className={!map ? "active" : ""}
                aria-label="List view"
                onClick={() => setMap(false)}
              >
                <LayoutList size={17} />
              </button>
              <button
                className={map ? "active" : ""}
                aria-label="Area overview"
                onClick={() => setMap(true)}
              >
                <MapIcon size={17} />
              </button>
            </div>
          </div>
          {map && (
            <div className="area-overview">
              <MapPin size={26} />
              <div>
                <strong>Your care, around the Bay</strong>
                <p>
                  {matches
                    .filter((p) => p.distance !== undefined)
                    .map((p) => `${p.name}: ${p.distance!.toFixed(1)} mi`)
                    .join(" · ")}
                </p>
                <small>
                  Approximate distances. Use a clinic’s Directions link for a
                  live Google Maps route.
                </small>
              </div>
            </div>
          )}
          <div className="provider-list">
            {matches.map((p, i) => (
              <ProviderCard
                key={p.id}
                p={p}
                first={i === 0}
                selected={compare.includes(p.id)}
                compare={() => toggleCompare(p)}
                details={() => setSelected(p)}
                intake={() => setIntake(p)}
              />
            ))}
          </div>
          {!matches.length && (
            <Empty
              title="Let’s widen the search"
              body="No providers match every selected filter. Try a larger radius or another care type. Species acceptance may need a phone call."
            />
          )}
          <div className="results-footnote">
            <ShieldCheck size={15} />
            <span>
              Public listings and clinic updates, with sources you can check.
              <br />
              An intake request is not an appointment or a guarantee of
              acceptance.
            </span>
          </div>
        </section>
      </div>
      {compare.length > 0 && (
        <div className="compare-tray">
          <GitCompareArrows size={20} />
          <span>
            <strong>
              {compare.length} clinic{compare.length > 1 ? "s" : ""} selected
            </strong>
            <small>See your options side by side</small>
          </span>
          <button className="primary" onClick={() => setShowCompare(true)}>
            Compare care <ArrowRight size={15} />
          </button>
          <button
            className="icon-button"
            onClick={() => setCompare([])}
            aria-label="Clear comparison"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {showCompare && (
        <Modal
          title="A clearer picture of your options"
          close={() => setShowCompare(false)}
          wide
        >
          <div className="comparison-grid">
            {providers
              .filter((p) => compare.includes(p.id))
              .map((p) => (
                <div key={p.id}>
                  <Badge tone="teal">{p.category}</Badge>
                  <h3>{p.name}</h3>
                  <dl>
                    <dt>Intake availability</dt>
                    <dd>
                      {liveAvailability(p)} {p.simulated ? "(simulated)" : ""}
                    </dd>
                    <dt>Species</dt>
                    <dd>{p.species.join(", ") || "Not confirmed — call"}</dd>
                    <dt>Capabilities</dt>
                    <dd>{p.services.join(", ")}</dd>
                    <dt>Hours</dt>
                    <dd>{p.hours}</dd>
                    <dt>Cost information</dt>
                    <dd>{p.cost_note}</dd>
                    <dt>Source checked</dt>
                    <dd>{sourceDate(p.source_checked)}</dd>
                  </dl>
                  <ContactLinks p={p} />
                </div>
              ))}
          </div>
          <div className="callout">
            Clinical urgency comes first. Prices are historical or unknown and
            do not determine these recommendations.
          </div>
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} close={() => setSelected(null)} wide>
          <div className="detail-top">
            <Badge tone="teal">{selected.category}</Badge>
            <Badge>
              {selected.partner
                ? "Demo partner"
                : "Public listing · Nonpartner"}
            </Badge>
          </div>
          <p>{selected.scope}</p>
          <div className="detail-grid">
            <div>
              <h3>Before you go</h3>
              <p>
                <MapPin size={15} />{" "}
                {selected.address || "Street address unverified"}
              </p>
              <p>
                <Clock3 size={15} /> {selected.hours}
              </p>
              <p>
                Species:{" "}
                {selected.species.join(", ") || "Not confirmed. Call to check."}
              </p>
              <p>
                Intake: <strong>{liveAvailability(selected)}</strong>
                {selected.simulated ? " · Simulated demo status" : ""}
              </p>
              <small>
                Updated {time(selected.availability_at)}. Capacity can change
                quickly.
              </small>
            </div>
            <div>
              <h3>Cost & expectations</h3>
              <p>{selected.cost_note}</p>
              <small>
                An exam fee is not a total treatment estimate. Ask the clinic
                for an individualized estimate.
              </small>
            </div>
          </div>
          <div className="source-box">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {selected.source_kind === "spreadsheet"
                  ? "Interview tracker & public contact source"
                  : "Public website information"}
              </strong>
              <p>{selected.source_notes}</p>
              {!!selected.field_overrides?.length && (
                <p>
                  Staff-edited fields: {selected.field_overrides.join(", ")}.
                  Original source retained for comparison.
                </p>
              )}
              <a href={selected.source_url} target="_blank" rel="noreferrer">
                View source <ExternalLink size={13} />
              </a>
              <small>
                Source checked {sourceDate(selected.source_checked)} · Directory
                updated {time(selected.updated_at)}
              </small>
            </div>
          </div>
          <ContactLinks p={selected} />
          {selected.partner && (
            <button
              className="primary full"
              onClick={() => {
                setIntake(selected);
                setSelected(null);
              }}
            >
              Send a demo intake <ArrowRight size={16} />
            </button>
          )}
        </Modal>
      )}
      {intake && (
        <IntakeForm
          provider={intake}
          close={() => setIntake(null)}
          done={() => {
            setIntake(null);
            setRequests(true);
          }}
        />
      )}
      {requests && <OwnerRequests close={() => setRequests(false)} />}
    </main>
  );
}
function ProviderCard({
  p,
  first,
  selected,
  compare,
  details,
  intake,
}: {
  p: Provider;
  first: boolean;
  selected: boolean;
  compare: () => void;
  details: () => void;
  intake: () => void;
}) {
  const availability = liveAvailability(p);
  return (
    <article className={"provider-card " + (p.partner ? "partner-card" : "")}>
      <div className="provider-card-main">
        <div
          className={
            "provider-avatar " + (p.category === "Specialty" ? "specialty" : "")
          }
        >
          <Building2 size={25} strokeWidth={1.5} />
        </div>
        <div className="provider-content">
          <div className="provider-labels">
            <span>
              {p.category === "Emergency"
                ? "EMERGENCY & VETERINARY CARE"
                : p.category.toUpperCase()}
            </span>
            {p.partner && (
              <Badge tone="teal">
                <Check size={11} /> Demo partner
              </Badge>
            )}
          </div>
          <button className="provider-title" onClick={details}>
            {p.name}
          </button>
          <p className="provider-location">
            <MapPin size={13} />
            {p.address?.split(",")[0] || p.city}
            <span>·</span>
            {p.distance !== undefined
              ? `${p.distance.toFixed(1)} mi`
              : "Distance unknown"}
          </p>
          <div className="provider-services">
            {p.services.slice(0, 3).map((s) => (
              <span key={s}>{s}</span>
            ))}
            <span>
              {p.species.length
                ? p.species.join(" & ")
                : "Species: call to confirm"}
            </span>
          </div>
        </div>
        <button
          className={"compare-check " + (selected ? "checked" : "")}
          onClick={compare}
          aria-label={"Compare " + p.name}
          aria-pressed={selected}
        >
          {selected ? <Check size={15} /> : <Plus size={15} />}
        </button>
      </div>
      <div className="provider-status">
        <div>
          <span
            className={
              "status-dot " +
              (availability === "Accepting"
                ? ""
                : availability === "Limited"
                  ? "amber"
                  : "gray")
            }
          />
          <strong>
            {availability === "Unknown"
              ? "Call to confirm availability"
              : availability === "Accepting"
                ? "Accepting patients"
                : availability}
          </strong>
          {p.simulated && <span className="simulated-label">Simulated</span>}
        </div>
        <span>
          <Clock3 size={12} />
          {p.hours.includes("24/7")
            ? "Open 24/7 · published hours"
            : p.category === "Specialty"
              ? "Specialty hours vary"
              : "Confirm hours"}
        </span>
      </div>
      <div className="provider-card-bottom">
        <button className="why-match" onClick={details}>
          <ShieldCheck size={14} />
          {p.partner
            ? "Clinic updates + public sources"
            : "Sourced public listing"}
          <ArrowUpRight size={12} />
        </button>
        <div className="card-actions">
          <ContactLinks p={p} compact />
          {p.partner && (
            <button className="primary small" onClick={intake}>
              Send intake <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
export function ContactLinks({
  p,
  compact = false,
}: {
  p: Provider;
  compact?: boolean;
}) {
  function track(kind: string) {
    api("events", "POST", { kind, providerId: p.id }).catch(() => {});
  }
  return (
    <div className={"contact-links " + (compact ? "compact" : "")}>
      {p.phone ? (
        <a
          className="secondary"
          href={"tel:+1" + p.phone.replace(/\D/g, "")}
          onClick={() => track("call_click")}
        >
          <Phone size={14} />
          {compact
            ? "Call clinic"
            : p.phone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
        </a>
      ) : (
        <span className="tiny">Phone unverified</span>
      )}
      {p.address && (
        <a
          className={compact ? "directions-icon" : "secondary"}
          href={
            "https://www.google.com/maps/dir/?api=1&destination=" +
            encodeURIComponent(p.address)
          }
          target="_blank"
          rel="noreferrer"
          aria-label={"Directions to " + p.name}
          onClick={() => track("directions_click")}
        >
          <Navigation size={14} />
          {!compact && "Directions"}
        </a>
      )}
    </div>
  );
}
function IntakeForm({
  provider,
  close,
  done,
}: {
  provider: Provider;
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Help the care team prepare" close={close}>
      <p className="muted">
        Send a demo intake to <strong>{provider.name}</strong>. This does not
        confirm an appointment or acceptance.
      </p>
      <div className="callout">
        Use fictional details. This demo does not contact the actual hospital.
        In an emergency, call or go to an emergency hospital now.
      </div>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const d = Object.fromEntries(new FormData(e.currentTarget));
          try {
            await api("intakes", "POST", { ...d, providerId: provider.id });
            done();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Your name">
          <input
            required
            name="ownerName"
            maxLength={120}
            autoComplete="off"
            placeholder="Alex Morgan"
          />
        </Field>
        <Field label="Pet’s name">
          <input required name="petName" maxLength={80} placeholder="Milo" />
        </Field>
        <Field label="Species">
          <select name="species">
            {["Dog", "Cat", "Rabbit", "Bird", "Reptile"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field label="How long has this been happening?">
          <input
            name="duration"
            maxLength={120}
            placeholder="Since this morning"
          />
        </Field>
        <div className="span-2">
          <Field label="What’s going on?">
            <textarea
              required
              name="concern"
              maxLength={3000}
              placeholder="Symptoms, behavior, medications, and anything the team should know"
            />
          </Field>
        </div>
        <div className="span-2">
          <Field label="Demo email or phone">
            <input
              required
              name="contact"
              minLength={5}
              maxLength={150}
              placeholder="alex@example.test"
            />
          </Field>
        </div>
        {error && (
          <div className="span-2">
            <Notice error>{error}</Notice>
          </div>
        )}
        <button className="primary span-2" disabled={busy}>
          {busy ? "Sending…" : "Send demo intake"}
          <Send size={15} />
        </button>
      </form>
    </Modal>
  );
}
function OwnerRequests({ close }: { close: () => void }) {
  const { data, refresh } = useData<any[]>("intakes", []);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState("");
  return (
    <Modal title="Your care requests" close={close} wide>
      <div className="callout">
        Requests and messages stay inside this demo. A clinic must confirm
        acceptance by phone before you travel.
      </div>
      {data.length === 0 ? (
        <Empty
          title="No care requests yet"
          body="Find a demo partner clinic and send an intake to start."
        />
      ) : (
        data.map((x) => (
          <div className="request-row" key={x.id}>
            <div>
              <strong>{x.pet_name}</strong>
              <span>{x.provider_name}</span>
              <small>Sent {time(x.created_at)}</small>
            </div>
            <Badge tone="teal">{x.stage}</Badge>
            {["New", "Reviewing"].includes(x.stage) && (
              <button className="secondary" onClick={() => setEditing(x)}>
                Edit request
              </button>
            )}
            <button className="secondary" onClick={() => setSelected(x.id)}>
              <MessageCircle size={15} /> Messages
            </button>
          </div>
        ))
      )}
      {error && <Notice error>{error}</Notice>}
      {editing && (
        <form
          className="form-grid"
          style={{ marginTop: 24 }}
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await api("intakes/" + editing.id, "PATCH", {
                ...Object.fromEntries(new FormData(e.currentTarget)),
                version: editing.version,
              });
              setEditing(null);
              refresh();
              setError("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          <Field label="Your name">
            <input
              name="owner_name"
              required
              defaultValue={editing.owner_name}
            />
          </Field>
          <Field label="Pet’s name">
            <input name="pet_name" required defaultValue={editing.pet_name} />
          </Field>
          <Field label="Duration">
            <input name="duration" defaultValue={editing.duration} />
          </Field>
          <Field label="Contact">
            <input name="contact" required defaultValue={editing.contact} />
          </Field>
          <div className="span-2">
            <Field label="Updated concern">
              <textarea
                name="concern"
                required
                defaultValue={editing.concern}
              />
            </Field>
          </div>
          <button className="primary span-2">Save request changes</button>
        </form>
      )}
      {selected && <Conversation intakeId={selected} owner />}
    </Modal>
  );
}
export function Conversation({
  intakeId,
  owner = false,
}: {
  intakeId: string;
  owner?: boolean;
}) {
  const { data, refresh } = useData<any>("intakes/" + intakeId, null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="conversation">
      <h3>{owner ? "Your care team conversation" : "Owner communication"}</h3>
      <p className="tiny">In-app demo messages. No SMS or email is sent.</p>
      {data?.messages.map((m: any) => (
        <div className={"message-bubble " + m.sender} key={m.id}>
          <strong>{m.sender === "clinic" ? "Care team" : "Pet owner"}</strong>
          <p>{m.body}</p>
          <small>{time(m.created_at)}</small>
        </div>
      ))}
      {!data?.messages.length && (
        <p className="muted">Start a conversation with a clear next step.</p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await api(`intakes/${intakeId}/messages`, "POST", {
              body: message,
            });
            setMessage("");
            refresh();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <input
          aria-label="Message text"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={3000}
          placeholder="Write a message…"
        />
        <button className="primary" aria-label="Send in-app message">
          <Send size={16} />
        </button>
      </form>
      {error && <Notice error>{error}</Notice>}
    </div>
  );
}

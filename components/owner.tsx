"use client";
import { SpeciesFields } from "./species-fields";
import { speciesMatch, speciesLabel } from "@/lib/species";
import { useState, useMemo } from "react";
import { locationSuggestions } from "@/lib/locations";
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
    location: "",
    radius: 25,
    available: false,
  });
  const [prompt, setPrompt] = useState("");
  const [conversation, setConversation] = useState<
    { role: string; text: string }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [organized, setOrganized] = useState<any>(null);
  const [assistantMode, setAssistantMode] = useState("rule-based");
  const [emergency, setEmergency] = useState(false);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedSnapshot, setSelected] = useState<Provider | null>(null);
  const selected =
    providers.find((p) => p.id === selectedSnapshot?.id) || selectedSnapshot;
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
      setOrganized(d);
      setEmergency(d.emergency);
      setFilters((f) => ({
        ...f,
        ...(d.species ? { species: d.species, subtype: d.subtype || "" } : {}),
        ...(d.service ? { service: d.service } : {}),
        ...(d.location
          ? { location: d.location, lat: undefined, lng: undefined }
          : {}),
        available: d.emergency ? false : f.available,
      }));
      setConversation((c) => [
        ...c,
        {
          role: "assistant",
          text: d.reply + (d.missing?.length ? "\n" + d.missing.join(" ") : ""),
        },
      ]);
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
            Find Your Way
            <br />
            <span>When Your Pet Needs You Most.</span>
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
      <ol className="owner-steps" aria-label="How to find care">
        <li>
          <b>1</b> Tell us what’s happening
        </li>
        <li>
          <b>2</b> Check the clinic’s fit
        </li>
        <li>
          <b>3</b> Call or send an inquiry
        </li>
      </ol>
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
                  : "AI not configured · structured demo helper"}
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
                placeholder="All locations · enter city or ZIP"
                value={filters.location}
                onChange={(e) => change("location", e.target.value)}
                list="locations"
              />
              <datalist id="locations">
                {locationSuggestions.map((x) => (
                  <option key={x} value={x} />
                ))}
              </datalist>
              {filters.location && (
                <button
                  aria-label="Clear location filter"
                  title="Show all locations"
                  onClick={() => change("location", "")}
                >
                  <X size={16} />
                </button>
              )}
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
          {filters.location.trim() &&
            filters.lat === undefined &&
            !locate(filters.location) && (
              <Notice error>
                We couldn’t find that city or ZIP code. Enter a Bay Area city or
                ZIP, use your location, or clear the location to see all
                providers.
              </Notice>
            )}
          <div className="quick-filters">
            <SpeciesFields
              filter
              species={filters.species}
              subtype={filters.subtype || ""}
              setSpecies={(value) =>
                setFilters((f) => ({ ...f, species: value, subtype: "" }))
              }
              setSubtype={(value) => change("subtype", value)}
            />
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
              {filters.available ? "Open inquiries only" : "Open for inquiries"}
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
                Distances are approximate straight-line estimates, using ZIP
                centers when needed. Intake status expires after 60 minutes.
              </span>
              <button
                className="text-button"
                onClick={() => {
                  setEmergency(false);
                  setFilters({
                    species: "Any pet",
                    service: "Any care",
                    location: "",
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
                {filters.location.trim()
                  ? `Care near ${filters.location === "My location" ? "you" : filters.location}`
                  : "Explore all care locations"}
              </h2>
              <p>
                {matches.length}{" "}
                {matches.length === 1 ? "provider" : "providers"} ·{" "}
                {emergency
                  ? "Nearest emergency care first"
                  : filters.location.trim()
                    ? `Within ${filters.radius} miles · nearby cities included`
                    : "All listed locations · filter to narrow your search"}
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
          {!matches.length &&
            (!filters.location.trim() ||
              locate(filters.location) ||
              filters.lat !== undefined) && (
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
              acceptance. City and ZIP locations:{" "}
              <a
                href="https://www.geonames.org/"
                target="_blank"
                rel="noreferrer"
              >
                GeoNames
              </a>{" "}
              (CC BY 4.0).
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
                    <dd>
                      {[...p.species, ...(p.species_subtypes || [])].join(
                        ", ",
                      ) || "Not confirmed — call"}
                    </dd>
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
              <p className="tiny">
                Address source checked:{" "}
                {sourceDate(
                  selected.address_checked || selected.source_checked,
                )}
                . {selected.coordinate_source || "Approximate coordinates"}.
              </p>
              <p>
                <Clock3 size={15} /> {selected.hours}
              </p>
              <p>
                Species:{" "}
                {[
                  ...selected.species,
                  ...(selected.species_subtypes || []),
                ].join(", ") || "Not confirmed. Call to check."}
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
          {selected.species_evidence && (
            <section
              className="callout"
              style={{ whiteSpace: "pre-line", display: "block" }}
            >
              <h3>Species evidence & limits</h3>
              <p>{selected.species_evidence}</p>
            </section>
          )}
          <div className="source-box">
            <ShieldCheck size={20} />
            <div>
              <strong>
                {selected.fictional
                  ? "Fictional demo data"
                  : selected.source_kind === "spreadsheet"
                    ? "Interview tracker & public contact source"
                    : selected.source_kind === "directory"
                      ? "Spreadsheet directory & public branch sources"
                      : "Public website information"}
              </strong>
              <p>{selected.source_notes}</p>
              {!!selected.field_overrides?.length && (
                <p>
                  Staff-edited fields: {selected.field_overrides.join(", ")}.
                  Original source retained for comparison.
                </p>
              )}
              {selected.source_url && (
                <a href={selected.source_url} target="_blank" rel="noreferrer">
                  View source <ExternalLink size={13} />
                </a>
              )}
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
              disabled={selected.activity?.accepting === false}
              onClick={() => {
                setIntake(selected);
                setSelected(null);
              }}
            >
              Send inquiry <ArrowRight size={16} />
            </button>
          )}
        </Modal>
      )}
      {intake && (
        <IntakeForm
          initial={{
            ...filters,
            concern: organized?.concern || "",
            duration: organized?.duration || "",
          }}
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
            {p.fictional && <Badge tone="blue">Fictional demo clinic</Badge>}
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
            {p.fictional
              ? `${p.city} · Fictional practice location`
              : p.address || `${p.city} · Street address unverified`}
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
                ? [...p.species, ...(p.species_subtypes || [])].join(" · ")
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
      {p.reasons && <p className="match-facts">{p.reasons.join(" · ")}</p>}
      {p.activity ? (
        <div className={`owner-activity ${p.activity.tone}`}>
          <strong>{p.activity.label}</strong>
          <span>{p.activity.acceptance}</span>
          <small>
            Demo assumptions · Updated {time(p.activity.updated_at)}
            {p.activity.overridden ? " · Staff override" : ""}
          </small>
        </div>
      ) : (
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
      )}
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
            <button
              className="primary small"
              disabled={p.activity?.accepting === false}
              onClick={intake}
            >
              {p.activity?.accepting === false
                ? "Not accepting today"
                : "Send inquiry"}{" "}
              <ArrowRight size={14} />
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
  if (p.fictional)
    return (
      <span className="tiny">Practice clinic · no real calls or travel</span>
    );
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
  initial,
  close,
  done,
}: {
  provider: Provider;
  initial: Filters & { concern: string; duration: string };
  close: () => void;
  done: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [species, setSpecies] = useState(
    initial.species === "Any pet" ? "" : initial.species,
  );
  const [subtype, setSubtype] = useState(initial.subtype || "");
  const [submissionKey] = useState(() => {
    const slot = `vetpath-inquiry-${provider.id}`;
    const old = sessionStorage.getItem(slot);
    if (old) return old;
    const key = crypto.randomUUID();
    sessionStorage.setItem(slot, key);
    return key;
  });
  const match = species ? speciesMatch(provider, species, subtype) : "unknown";
  return (
    <Modal title="Send a care inquiry" close={close}>
      <p className="muted">
        Send an inquiry to <strong>{provider.name}</strong>. This does not
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
            await api("intakes", "POST", {
              ...d,
              species,
              speciesSubtype: subtype,
              submissionKey,
              requestedService: initial.service,
              allowUnknownSpecies: d.allowUnknownSpecies === "on",
              providerId: provider.id,
            });
            sessionStorage.removeItem(`vetpath-inquiry-${provider.id}`);
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
        <SpeciesFields
          species={species}
          subtype={subtype}
          setSpecies={setSpecies}
          setSubtype={setSubtype}
        />
        {species && match === "mismatch" && (
          <div className="span-2">
            <Notice error>
              This clinic does not list care for{" "}
              {speciesLabel(species, subtype)}. Close this inquiry and choose an
              appropriate clinic.
            </Notice>
          </div>
        )}
        {species && match === "unknown" && (
          <label className="span-2 confirmation-check">
            <input type="checkbox" name="allowUnknownSpecies" required />
            Species eligibility is unconfirmed. I understand I must call this
            clinic before travelling.
          </label>
        )}
        <Field label="How long has this been happening?">
          <input
            name="duration"
            defaultValue={initial.duration}
            maxLength={120}
            placeholder="Since this morning"
          />
        </Field>
        <div className="span-2">
          <Field label="What’s going on?">
            <textarea
              required
              name="concern"
              defaultValue={initial.concern}
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
        <button
          className="primary span-2"
          disabled={busy || match === "mismatch"}
        >
          {busy ? "Sending…" : "Send inquiry to clinic"}
          <Send size={15} />
        </button>
      </form>
    </Modal>
  );
}
function OwnerRequests({ close }: { close: () => void }) {
  const {
    data,
    loading,
    error: loadError,
    refresh,
  } = useData<any[]>("intakes", []);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [error, setError] = useState("");
  return (
    <Modal title="Your care requests" close={close} wide>
      <div className="callout">
        Your inquiry is saved. Updates appear here automatically. Requests and
        messages stay inside this demo. A clinic must confirm acceptance by
        phone before you travel.
      </div>
      {loadError && (
        <Notice error>
          {loadError}
          <button onClick={refresh}>Try again</button>
        </Notice>
      )}
      {loading ? (
        <p role="status">Loading your inquiries…</p>
      ) : data.length === 0 ? (
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
            <Badge tone="teal">
              {{
                New: "Inquiry sent",
                Reviewing: "Acknowledged",
                Expected: "Expected",
                Arrived: "Checked in",
                "In care": "In care",
                Discharged: "Visit complete",
                Transferred: "Transferred",
              }[x.stage as string] || x.stage}
            </Badge>
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

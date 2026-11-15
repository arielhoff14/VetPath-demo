"use client";
import { useState } from "react";
import { api, useData, Notice, Field, time, Loading } from "./shared";
export default function ActivityPanel({
  clinicId,
  editable = false,
  configure,
}: {
  clinicId: string;
  editable?: boolean;
  configure?: () => void;
}) {
  const { data, loading, error, refresh } = useData<any>(
    `activity/${clinicId}`,
    null,
  );
  const [feedback, setFeedback] = useState("");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(body: any) {
    setBusy(true);
    setFailure("");
    setFeedback("");
    try {
      await api(`activity/${clinicId}`, "PATCH", {
        ...body,
        version: data.version,
      });
      await refresh();
      setFeedback("Saved. Activity and owner information have updated.");
    } catch (e) {
      setFailure((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <Notice error>{error}</Notice>;
  if (!data)
    return (
      <div className="callout">
        Automatic activity is available in the three fictional practice clinics.
        This public listing has no confirmed resource feed.
      </div>
    );
  return (
    <section className="activity-panel panel" aria-label="Clinic activity">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">DEMO ACTIVITY · NOT CLINICAL URGENCY</div>
          <h2>{data.label}</h2>
          <p>{data.acceptance}</p>
        </div>
        <strong
          className={`activity-number ${data.tone}`}
          data-testid="activity-percent"
        >
          {data.fresh && data.percent !== null
            ? `${data.percent}%`
            : "Unconfirmed"}
        </strong>
      </div>
      <div className={`activity-track ${data.tone}`}>
        <div style={{ width: `${Math.min(data.percent || 0, 100)}%` }} />
      </div>
      <p data-testid="activity-calculation">
        <strong>
          {data.workload} workload points ÷ {data.capacity} effective capacity
        </strong>{" "}
        · Limiting resource: {data.limiting.join(" and ")}
      </p>
      <p className="tiny">
        Only arrived patients and patients in care count. Incoming inquiries do
        not. Updated {time(data.updated_at)}. Resource confirmation:{" "}
        {time(data.verified_at)}.
      </p>
      {data.overrideActive && (
        <Notice>
          Staff override: {data.overrideReason}. Ends {time(data.overrideUntil)}
          . Calculated activity remains {data.computedTone}.
        </Notice>
      )}
      {!data.fresh && (
        <Notice error>
          Resources have not been confirmed within the last 60 minutes. Owners
          see “Activity unconfirmed.” Confirm the current resources to restore
          the meter.
        </Notice>
      )}
      <details>
        <summary>How this demo calculation works</summary>
        <div className="formula-grid">
          {data.resources.map((r: any) => (
            <div key={r.label}>
              <strong>{r.label}</strong>
              <span>{r.capacity} capacity points</span>
            </div>
          ))}
        </div>
        <p>
          Effective capacity = min(rooms × 2, doctors × 4, clinical support
          staff × 2). Light = 1, standard = 2, intensive = 4 workload points.
          Green &lt;60%; yellow 60–84%; red ≥85%.
        </p>
        <p className="tiny">
          These are presentation assumptions, not a validated staffing model or
          wait-time prediction. A veterinary professional decides clinical
          urgency.
        </p>
      </details>
      {!editable && configure && (
        <button className="secondary" onClick={configure}>
          Review resources & acceptance
        </button>
      )}
      {editable && (
        <>
          <form
            key={`${clinicId}:${data.version}`}
            className="form-grid resource-form"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              save({
                rooms: Number(d.get("rooms")),
                doctors: Number(d.get("doctors")),
                support: Number(d.get("support")),
                confirm: true,
              });
            }}
          >
            <Field label="Usable rooms">
              <input
                name="rooms"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={data.rooms}
              />
            </Field>
            <Field label="On-duty doctors">
              <input
                name="doctors"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={data.doctors}
              />
            </Field>
            <Field label="On-duty clinical support">
              <input
                name="support"
                type="number"
                min={0}
                max={100}
                required
                defaultValue={data.support}
              />
            </Field>
            <button className="primary" disabled={busy}>
              Confirm resources
            </button>
          </form>
          <div className="acceptance-control">
            <div>
              <h3>New patient acceptance</h3>
              <p>
                Separate from activity. Closing applies until midnight Pacific
                time.
              </p>
            </div>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => save({ closed: data.accepting })}
            >
              {data.accepting ? "Stop accepting today" : "Reopen inquiries"}
            </button>
          </div>
          <details>
            <summary>Temporary staff override</summary>
            <p className="tiny">
              Use a reason and expiry when the calculation does not describe the
              floor. Stale resources still show as unconfirmed.
            </p>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault();
                const d = new FormData(e.currentTarget);
                save({
                  override: {
                    tone: d.get("tone"),
                    reason: d.get("reason"),
                    minutes: Number(d.get("minutes")),
                  },
                });
              }}
            >
              <Field label="Override activity">
                <select name="tone">
                  <option value="green">Lower activity</option>
                  <option value="yellow">Busy</option>
                  <option value="red">High activity</option>
                </select>
              </Field>
              <Field label="Override duration">
                <select name="minutes">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </Field>
              <Field label="Override reason">
                <input name="reason" required minLength={5} maxLength={300} />
              </Field>
              <button className="secondary" disabled={busy}>
                Apply timed override
              </button>
            </form>
            {data.overrideActive && (
              <button
                className="text-button"
                onClick={() => save({ override: null })}
              >
                Clear override
              </button>
            )}
          </details>
        </>
      )}
      {failure && <Notice error>{failure}</Notice>}
      {feedback && <Notice>{feedback}</Notice>}
    </section>
  );
}

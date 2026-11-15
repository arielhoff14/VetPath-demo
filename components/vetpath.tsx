"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ArrowUpRight,
  FlaskConical,
  HeartHandshake,
  LayoutDashboard,
  Database,
  BarChart3,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { api, Logo, Modal, useData, Notice, Field } from "./shared";
import type { Provider } from "@/lib/domain";
import Owner from "./owner";
import Clinic from "./clinic";
import Admin from "./admin";
import Insights from "./insights";
export default function VetPath() {
  const [view, setView] = useState("owner");
  const [demoOpen, setDemoOpen] = useState(false);
  const [error, setError] = useState("");
  const [clinicId, setClinicId] = useState("sage-sf");
  const [sessionReady, setSessionReady] = useState(false);
  const { data: providers, refresh } = useData<Provider[]>("providers", []);
  useEffect(() => {
    api("session")
      .then(async (d) => {
        if (!d.session) await api("session", "POST", { role: "owner" });
        else {
          setView(d.session.role === "admin" ? "admin" : d.session.role);
          if (d.session.clinicId) setClinicId(d.session.clinicId);
        }
        setSessionReady(true);
      })
      .catch((e) => setError(e.message));
  }, []);
  async function navigate(next: string) {
    try {
      await api("session", "POST", {
        role:
          next === "owner" ? "owner" : next === "clinic" ? "clinic" : "admin",
        clinicId: next === "clinic" ? clinicId : undefined,
      });
      setView(next);
      setDemoOpen(false);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function changeClinic(id: string) {
    try {
      await api("session", "POST", { role: "clinic", clinicId: id });
      setClinicId(id);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <div className="demo-banner">
        <span>
          <FlaskConical size={13} /> A little preview of better-connected care
        </span>
        <button onClick={() => setDemoOpen(true)}>
          Interactive demo <ArrowUpRight size={13} />
        </button>
      </div>
      <header className="site-header">
        <button
          className="brand-button"
          onClick={() => navigate("owner")}
          aria-label="VetPath home"
        >
          <Logo />
        </button>
        <nav aria-label="Main navigation">
          {[
            ["owner", "Find care"],
            ["clinic", "Clinic workspace"],
            ["insights", "Insights"],
            ["admin", "Directory"],
          ].map(([key, label]) => (
            <button
              key={key}
              disabled={!sessionReady}
              className={view === key ? "active" : ""}
              onClick={() => navigate(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <button className="demo-toggle" onClick={() => setDemoOpen(true)}>
          <span className="avatar">{view === "owner" ? "P" : "D"}</span>
          <span>{view === "owner" ? "Pet owner" : "Demo team"}</span>
          <ChevronDown size={15} />
        </button>
      </header>
      {error && (
        <div className="page-error">
          <Notice error>{error}</Notice>
        </div>
      )}
      {!sessionReady ? (
        <div className="loading">Preparing your demo…</div>
      ) : view === "owner" ? (
        <Owner providers={providers} />
      ) : view === "clinic" ? (
        <Clinic
          key={clinicId}
          providers={providers}
          clinicId={clinicId}
          changeClinic={changeClinic}
          refreshProviders={refresh}
        />
      ) : view === "admin" ? (
        <Admin providers={providers} refreshProviders={refresh} />
      ) : (
        <Insights />
      )}
      <footer className="site-footer">
        <Logo />
        <span>Less searching. More caring.</span>
        <span>
          San Francisco pilot <span className="footer-dot">•</span> Always free
          for pet owners
        </span>
      </footer>
      {demoOpen && (
        <Modal title="Make yourself at home" close={() => setDemoOpen(false)}>
          <p className="muted">
            Explore connected workflows with fictional patients. Clinic
            partnerships, staff, and live statuses are simulated.
          </p>
          <div className="demo-options">
            {[
              {
                id: "owner",
                title: "Pet owner",
                text: "Find care, compare clinics, and send an intake.",
                Icon: HeartHandshake,
              },
              {
                id: "clinic",
                title: "Clinic workspace",
                text: "Review patients and update your clinic.",
                Icon: LayoutDashboard,
              },
              {
                id: "admin",
                title: "Directory & data",
                text: "Manage partnerships, imports, and conflicts.",
                Icon: Database,
              },
              {
                id: "insights",
                title: "Platform insights",
                text: "Follow searches, contacts, and confirmed arrivals.",
                Icon: BarChart3,
              },
            ].map((x) => (
              <button key={x.id} onClick={() => navigate(x.id)}>
                <x.Icon />
                <span>
                  <strong>{x.title}</strong>
                  <small>{x.text}</small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
          </div>
          <div className="callout">
            <FlaskConical size={18} />
            <span>
              Demo access grants a scoped staff session. No real clinic is
              notified. Use fictional patient information.
            </span>
          </div>
          <p className="tiny">
            Pilot model: free clinic partnerships in San Francisco.
            Subscriptions are planned after demonstrated value; billing is not
            enabled.
          </p>
        </Modal>
      )}
    </>
  );
}

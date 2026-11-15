import type { PoolClient } from "pg";
export const demoClinics = [
  {
    id: "demo-harbor",
    name: "Harbor Pet Urgent Care",
    city: "San Francisco, CA",
    lat: 37.773,
    lng: -122.414,
    species: ["Dog", "Cat"],
    subtypes: [],
    rooms: 4,
    doctors: 2,
    support: 4,
    workload: "Standard",
  },
  {
    id: "demo-willow",
    name: "Willow Exotics & Urgent Care",
    city: "San Jose, CA",
    lat: 37.338,
    lng: -121.886,
    species: ["Dog", "Cat", "Exotics"],
    subtypes: ["Rabbit", "Bird", "Reptile", "Small mammal"],
    rooms: 3,
    doctors: 3,
    support: 3,
    workload: "Standard",
  },
  {
    id: "demo-valley",
    name: "Valley Mixed Animal Care",
    city: "Lafayette, CA",
    lat: 37.886,
    lng: -122.118,
    species: ["Dog", "Cat", "Farm animals"],
    subtypes: ["Horse", "Cattle", "Goat", "Sheep", "Pig", "Poultry"],
    rooms: 6,
    doctors: 2,
    support: 4,
    workload: "Intensive",
  },
];
export async function seedFictionalClinics(c: PoolClient, reset = false) {
  for (const p of demoClinics) {
    await c.query(
      `INSERT INTO providers(id,name,city,category,lat,lng,species,species_subtypes,services,hours,scope,source_kind,source_notes,source_checked,partner,fictional,simulated) VALUES($1,$2,$3,'Urgent care',$4,$5,$6,$7,ARRAY['Urgent care','General practice'],'Fictional demo clinic · no real opening hours','Fictional clinic for practicing connected inquiries and patient workflows. Not a real care destination.','demo','All resources, patients and operational values are demo assumptions.',now(),true,true,true) ON CONFLICT(id) DO NOTHING`,
      [p.id, p.name, p.city, p.lat, p.lng, p.species, p.subtypes],
    );
    await c.query("SELECT id FROM providers WHERE id=$1 FOR UPDATE", [p.id]);
    await c.query(
      `INSERT INTO clinic_operations(provider_id,rooms,verified_at) VALUES($1,$2,now()) ON CONFLICT(provider_id) DO ${reset ? "UPDATE SET rooms=EXCLUDED.rooms,verified_at=now(),updated_at=now(),closed_on=NULL,override_tone=NULL,override_reason=NULL,override_until=NULL,version=clinic_operations.version+1" : "NOTHING"}`,
      [p.id, p.rooms],
    );
    if (reset) {
      await c.query(
        "UPDATE providers SET name=$2,species=$3,species_subtypes=$4,services=ARRAY['Urgent care','General practice'],partner=true,version=version+1,updated_at=now() WHERE id=$1 AND fictional=true",
        [p.id, p.name, p.species, p.subtypes],
      );
      await c.query(
        `UPDATE intakes SET archived_at=now(),updated_at=now(),version=version+1 WHERE provider_id=$1 AND archived_at IS NULL`,
        [p.id],
      );
      await c.query("DELETE FROM coverage WHERE provider_id=$1", [p.id]);
    }
    if (
      !(
        await c.query("SELECT id FROM coverage WHERE provider_id=$1 LIMIT 1", [
          p.id,
        ])
      ).rowCount
    ) {
      for (const [type, count] of [
        ["doctor", p.doctors],
        ["clinical_support", p.support],
        ["nonclinical", 1],
      ] as const) {
        for (let n = 1; n <= count; n++)
          await c.query(
            "INSERT INTO coverage(provider_id,name,role,role_type,shift) VALUES($1,$2,$3,$4,'Demo shift')",
            [
              p.id,
              `Demo ${type === "doctor" ? "doctor" : type === "clinical_support" ? "technician" : "receptionist"} ${n}`,
              type === "doctor"
                ? "Veterinarian"
                : type === "clinical_support"
                  ? "Clinical technician"
                  : "Reception",
              type,
            ],
          );
      }
      for (let n = 1; n <= 2; n++)
        await c.query(
          `INSERT INTO intakes(provider_id,owner_session,owner_name,pet_name,species,species_subtype,concern,contact,stage,urgency,workload,clinical_reviewed_at,arrived_at,demo_seed,receiving_summary) VALUES($1,'demo-seed','Fictional owner',$2,$3,CASE WHEN $3='Exotics' THEN 'Rabbit' ELSE '' END,'Baseline fictional workload for this demonstration.','demo@example.test','In care','Routine',$4,now(),now(),true,'Baseline demo patient. Workload points are assumptions, not a clinical assessment.')`,
          [
            p.id,
            `${p.id === "demo-willow" ? "Bunny" : "Baseline pet"} ${n}`,
            p.id === "demo-willow" ? "Exotics" : "Dog",
            p.workload,
          ],
        );
    }
  }
}

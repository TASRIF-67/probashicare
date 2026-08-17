import { useEffect, useState } from "react";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { CaregiverChecklist } from "../../components/CaregiverChecklist.jsx";
import { ClipboardListIcon } from "../../components/Icons.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";

const ASSIGNED_BOOKING_STATUSES = ["accepted", "confirmed"];

export function CaregiverTasksPage() {
  const [state, setState] = useState({
    loading: true,
    bookings: [],
    error: "",
  });
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAssignedProfiles() {
      try {
        const result = await bookingService.listCaregiverBookings();

        if (active) {
          setState({
            loading: false,
            bookings: result.bookings || [],
            error: "",
          });
        }
      } catch (requestError) {
        if (active) {
          setState({
            loading: false,
            bookings: [],
            error: normalizeApiError(requestError).message,
          });
        }
      }
    }

    loadAssignedProfiles();

    return () => {
      active = false;
    };
  }, []);

  const assignedProfiles = [];

  for (const booking of state.bookings) {
    if (!ASSIGNED_BOOKING_STATUSES.includes(booking.status)) {
      continue;
    }

    const profileId = booking.elderlyProfileId?.toString?.() || booking.elderlyProfile?._id;
    const profileName = booking.elderlyProfile?.name || "Care recipient";

    if (!profileId || assignedProfiles.some((profile) => profile.id === profileId)) {
      continue;
    }

    assignedProfiles.push({ id: profileId, name: profileName });
  }

  useEffect(() => {
    if (!selectedProfileId && assignedProfiles[0]) {
      setSelectedProfileId(assignedProfiles[0].id);
    }
  }, [assignedProfiles, selectedProfileId]);

  const selectedProfile = assignedProfiles.find((profile) => profile.id === selectedProfileId) || assignedProfiles[0] || null;

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page" style={{ display: "grid", gap: "1rem" }}>
        <section className="page-heading page-heading--action">
          <div>
            <span className="eyebrow">Care tasks</span>
            <h1>Assigned patient tasks</h1>
            <p>Keep each elderly profile’s care checklist separate and stay focused on the right patient.</p>
          </div>
        </section>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading assigned profiles
          </div>
        )}

        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && !state.error && assignedProfiles.length === 0 && (
          <Card>
            <div className="caregiver-card-empty" style={{ padding: "2rem" }}>
              <ClipboardListIcon />
              <strong>No assigned patients yet</strong>
              <span>Accepted or confirmed bookings will appear here as separate care task lists.</span>
            </div>
          </Card>
        )}

        {!state.loading && !state.error && assignedProfiles.length > 0 && (
          <Card>
            <div className="caregiver-card-heading" style={{ marginBottom: "1rem" }}>
              <div>
                <span className="eyebrow">Current patient</span>
                <h2>Task list</h2>
              </div>
              <ClipboardListIcon />
            </div>

            {assignedProfiles.length > 1 && (
              <div style={{ marginBottom: "1rem" }}>
                <label htmlFor="caregiver-task-profile" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}>
                  Elderly profile
                </label>
                <select
                  id="caregiver-task-profile"
                  value={selectedProfile?.id || ""}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                  style={{ width: "100%", padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1" }}
                >
                  {assignedProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedProfile && (
              <CaregiverChecklist
                elderlyProfileId={selectedProfile.id}
                elderlyName={selectedProfile.name}
              />
            )}
          </Card>
        )}
      </div>
    </main>
  );
}

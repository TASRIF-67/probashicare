import { useEffect, useMemo, useState } from "react";
import { useToast } from "../context/ToastContext.jsx";
import { bookingService } from "../services/bookingService.js";
import { careVisitService } from "../services/careVisitService.js";
import { normalizeApiError } from "../services/api.js";

const EMPTY_FORM = {
  title: "",
  instructions: "",
  priority: "medium",
  visitDate: "",
  caregiverUserId: "",
};

export function FamilyTaskPlanner({ elderlyProfileId, elderlyName }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.priority] - order[b.priority];
    });
  }, [tasks]);

  async function loadTasks() {
    if (!elderlyProfileId) return;
    try {
      setLoading(true);
      const [taskResult, bookingResult] = await Promise.all([
        careVisitService.listTasks(elderlyProfileId),
        bookingService.listMyBookings(),
      ]);

      const assignedCaregivers = (bookingResult.bookings || [])
        .filter((booking) =>
          String(booking.elderlyProfileId) === String(elderlyProfileId)
          && ["accepted", "confirmed"].includes(booking.status)
          && booking.caregiverId,
        )
        .map((booking) => ({
          id: booking.caregiverId,
          name: booking.caregiver?.name || "Assigned caregiver",
        }));

      setCaregivers(assignedCaregivers);
      setTasks(taskResult.tasks || []);
      if (assignedCaregivers.length && !form.caregiverUserId) {
        setForm((current) => ({ ...current, caregiverUserId: assignedCaregivers[0].id }));
      }
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [elderlyProfileId]);

  function onFieldChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!elderlyProfileId || !form.title.trim()) {
      showToast("Add a task title before saving.", "error");
      return;
    }

    try {
      setSaving(true);
      if (!form.caregiverUserId) {
        showToast("Select the caregiver this task belongs to.", "error");
        return;
      }

      const payload = {
        ...form,
        title: form.title.trim(),
        instructions: form.instructions.trim(),
        elderlyProfileId,
        caregiverUserId: form.caregiverUserId,
      };

      if (editingId) {
        const result = await careVisitService.updateTask(editingId, payload);
        setTasks((current) => current.map((task) => task.id === editingId ? result.task : task));
        showToast("Task updated.", "success");
      } else {
        const result = await careVisitService.createTask(payload);
        setTasks((current) => [result.task, ...current]);
        showToast("Task created.", "success");
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(taskId) {
    try {
      await careVisitService.deleteTask(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
      showToast("Task removed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  function startEdit(task) {
    setEditingId(task.id);
    setForm({
      title: task.title,
      instructions: task.instructions || "",
      priority: task.priority,
      visitDate: task.visitDate ? new Date(task.visitDate).toISOString().slice(0, 10) : "",
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem" }}>
        <div>
          <h3 style={{ margin: 0 }}>Care visit task planner</h3>
          <small>{elderlyName ? `For ${elderlyName}` : "Select an elderly profile"}</small>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.75rem", padding: "1rem", border: "1px solid #dfe7ef", borderRadius: 12 }}>
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>Task title</label>
          <input name="title" value={form.title} onChange={onFieldChange} placeholder="Medication reminder" style={{ padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1" }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label>Priority</label>
            <select name="priority" value={form.priority} onChange={onFieldChange} style={{ padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1" }}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label>Visit date</label>
            <input type="date" name="visitDate" value={form.visitDate} onChange={onFieldChange} style={{ padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1" }} />
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>Assigned caregiver</label>
          <select name="caregiverUserId" value={form.caregiverUserId} onChange={onFieldChange} style={{ padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1" }}>
            {caregivers.length === 0 ? (
              <option value="">No assigned caregiver yet</option>
            ) : (
              caregivers.map((caregiver) => (
                <option key={caregiver.id} value={caregiver.id}>{caregiver.name}</option>
              ))
            )}
          </select>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>Instructions</label>
          <textarea name="instructions" value={form.instructions} onChange={onFieldChange} rows={4} placeholder="Optional guidance for the caregiver" style={{ padding: "0.7rem", borderRadius: 10, border: "1px solid #cbd5e1", resize: "vertical" }} />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }} style={{ padding: "0.7rem 1rem", borderRadius: 10, border: "1px solid #cbd5e1", background: "white" }}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={saving} style={{ padding: "0.7rem 1rem", borderRadius: 10, border: "none", background: "#1d4ed8", color: "white", cursor: "pointer" }}>
            {saving ? "Saving..." : editingId ? "Update task" : "Add task"}
          </button>
        </div>
      </form>

      <div style={{ display: "grid", gap: "0.75rem" }}>
        {loading ? (
          <p>Loading tasks...</p>
        ) : sortedTasks.length === 0 ? (
          <p>No tasks planned for this visit yet.</p>
        ) : (
          sortedTasks.map((task) => (
            <div key={task.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
                <div>
                  <strong>{task.title}</strong>
                  <div style={{ color: "#475569", fontSize: 14 }}>
                    {task.priority.toUpperCase()} • {task.status}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button type="button" onClick={() => startEdit(task)} style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid #cbd5e1", background: "white" }}>Edit</button>
                  <button type="button" onClick={() => handleDelete(task.id)} style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid #ef4444", background: "#fee2e2", color: "#991b1b" }}>Delete</button>
                </div>
              </div>

              {task.instructions && <p style={{ margin: "0.75rem 0 0", color: "#334155" }}>{task.instructions}</p>}

              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginTop: "0.75rem", color: "#475569", fontSize: 14 }}>
                <span>Visit: {task.visitDate ? new Date(task.visitDate).toLocaleDateString() : "Not scheduled"}</span>
                {task.skipReason && <span>Skipped reason: {task.skipReason}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

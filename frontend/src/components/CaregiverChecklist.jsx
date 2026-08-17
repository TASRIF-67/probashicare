import { useEffect, useMemo, useState } from "react";
import { careVisitService } from "../services/careVisitService.js";
import { normalizeApiError } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";

const defaultStatus = { pending: "pending", completed: "completed", skipped: "skipped" };

export function CaregiverChecklist({ elderlyProfileId, elderlyName }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const pendingTasks = useMemo(() => tasks.filter((task) => task.status === "pending"), [tasks]);
  const completedTasks = useMemo(() => tasks.filter((task) => task.status === "completed"), [tasks]);

  async function loadTasks() {
    if (!elderlyProfileId) return;
    try {
      setLoading(true);
      const result = await careVisitService.listTasks(elderlyProfileId);
      setTasks(result.tasks || []);
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, [elderlyProfileId]);

  async function handleStatusChange(taskId, status) {
    const skipReason = status === "skipped" ? window.prompt("Why was this task skipped?") || "" : "";
    if (status === "skipped" && !skipReason.trim()) {
      showToast("Add a reason when skipping a task.", "error");
      return;
    }

    try {
      const result = await careVisitService.updateTaskStatus(taskId, status, skipReason, "");
      setTasks((current) => current.map((task) => task.id === taskId ? result.task : task));
      showToast("Task updated.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <h3 style={{ margin: 0 }}>Caregiver checklist</h3>
        <small>{elderlyName ? `Visiting ${elderlyName}` : "Load a profile to begin"}</small>
      </div>

      {loading ? (
        <p>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <p>No tasks assigned for this visit yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {tasks.map((task) => (
            <div key={task.id} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem", background: "#f8fafc" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <strong>{task.title}</strong>
                  <div style={{ color: "#475569", fontSize: 14 }}>{task.priority.toUpperCase()} • {task.status}</div>
                </div>

                {task.status === "pending" ? (
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" onClick={() => handleStatusChange(task.id, "completed")} style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid #16a34a", background: "#dcfce7", color: "#166534" }}>
                      Complete
                    </button>
                    <button type="button" onClick={() => handleStatusChange(task.id, "skipped")} style={{ padding: "0.45rem 0.75rem", borderRadius: 8, border: "1px solid #f59e0b", background: "#fef3c7", color: "#92400e" }}>
                      Skip
                    </button>
                  </div>
                ) : (
                  <span style={{ padding: "0.35rem 0.7rem", borderRadius: 999, background: task.status === "completed" ? "#dcfce7" : "#fef3c7", color: task.status === "completed" ? "#166534" : "#92400e", fontWeight: 600 }}>
                    {task.status === "completed" ? "Completed" : "Skipped"}
                  </span>
                )}
              </div>

              {task.instructions && <p style={{ margin: "0.75rem 0 0", color: "#334155" }}>{task.instructions}</p>}
              {task.skipReason && <p style={{ margin: "0.5rem 0 0", color: "#b45309" }}>Skip reason: {task.skipReason}</p>}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
        <div style={{ padding: "0.75rem", borderRadius: 12, border: "1px solid #dbeafe", background: "#eff6ff" }}>
          <strong>Pending</strong>
          <div>{pendingTasks.length}</div>
        </div>
        <div style={{ padding: "0.75rem", borderRadius: 12, border: "1px solid #dcfce7", background: "#f0fdf4" }}>
          <strong>Completed</strong>
          <div>{completedTasks.length}</div>
        </div>
      </div>

    </div>
  );
}

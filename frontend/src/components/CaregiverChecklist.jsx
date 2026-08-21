import { useEffect, useState } from "react";
import { Button } from "./Button.jsx";
import {
  CalendarIcon,
  CareTasksIcon,
  CheckIcon,
} from "./Icons.jsx";
import { careVisitService } from "../services/careVisitService.js";
import { normalizeApiError } from "../services/api.js";
import { useToast } from "../context/ToastContext.jsx";

/**
 * Formats a caregiver task date for the visit checklist.
 * @param {string|Date|null} value - Stored visit date.
 * @returns {string} Localized date or an unscheduled label.
 * @sideEffects None.
 */
function formatTaskDate(value) {
  if (!value) {
    return "No visit date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No visit date";
  }

  return date.toLocaleDateString("en-GB", {
    dateStyle: "medium",
  });
}

/**
 * Converts a stored task value into a readable label.
 * @param {string} value - Stored status or priority.
 * @returns {string} Capitalized display text.
 * @sideEffects None.
 */
function humanize(value) {
  const text = String(value || "").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Displays assigned care tasks and lets a caregiver complete or skip each item.
 * @param {{elderlyProfileId: string, elderlyName?: string}} props - Assigned profile and name.
 * @returns {import("react").ReactElement} Caregiver visit checklist.
 * @sideEffects Loads task data and updates task status through the API.
 */
export function CaregiverChecklist({ elderlyProfileId, elderlyName }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyTaskId, setBusyTaskId] = useState("");
  const [skippingTaskId, setSkippingTaskId] = useState("");
  const [skipReason, setSkipReason] = useState("");

  useEffect(() => {
    let active = true;

    /**
     * Loads tasks assigned to this caregiver for the selected profile.
     * @returns {Promise<void>} Resolves after checklist state is updated.
     * @sideEffects Calls the task API and updates React state.
     */
    async function loadTasks() {
      if (!elderlyProfileId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await careVisitService.listTasks(elderlyProfileId);

        if (active) {
          setTasks(result.tasks || []);
        }
      } catch (error) {
        if (active) {
          showToast(normalizeApiError(error).message, "error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return function stopTaskLoad() {
      active = false;
    };
  }, [elderlyProfileId, showToast]);

  /**
   * Replaces one task after a successful status update.
   * @param {object} updatedTask - Updated API task response.
   * @returns {void}
   * @sideEffects Updates local task state.
   */
  function replaceTask(updatedTask) {
    setTasks((currentTasks) => {
      const nextTasks = [];

      for (const task of currentTasks) {
        if (task.id === updatedTask.id) {
          nextTasks.push(updatedTask);
        } else {
          nextTasks.push(task);
        }
      }

      return nextTasks;
    });
  }

  /**
   * Marks one pending task as completed.
   * @param {string} taskId - CareTask identifier.
   * @returns {Promise<void>} Resolves after the status update.
   * @sideEffects Writes task status, updates state, and shows feedback.
   */
  async function completeTask(taskId) {
    try {
      setBusyTaskId(taskId);
      const result = await careVisitService.updateTaskStatus(
        taskId,
        "completed",
        "",
        "",
      );
      replaceTask(result.task);
      showToast("Task marked as completed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyTaskId("");
    }
  }

  /**
   * Opens the inline reason field for one skipped task.
   * @param {string} taskId - CareTask identifier.
   * @returns {void}
   * @sideEffects Updates local skip-editor state.
   */
  function openSkipReason(taskId) {
    setSkippingTaskId(taskId);
    setSkipReason("");
  }

  /**
   * Closes the inline skip editor.
   * @returns {void}
   * @sideEffects Clears local skip-editor state.
   */
  function closeSkipReason() {
    if (!busyTaskId) {
      setSkippingTaskId("");
      setSkipReason("");
    }
  }

  /**
   * Saves the reason and marks the selected task as skipped.
   * @returns {Promise<void>} Resolves after the status update.
   * @sideEffects Writes task status, updates state, and shows feedback.
   */
  async function confirmSkippedTask() {
    if (!skippingTaskId || skipReason.trim().length < 3) {
      showToast("Add a short reason before skipping this task.", "error");
      return;
    }

    try {
      setBusyTaskId(skippingTaskId);
      const result = await careVisitService.updateTaskStatus(
        skippingTaskId,
        "skipped",
        skipReason.trim(),
        "",
      );
      replaceTask(result.task);
      setSkippingTaskId("");
      setSkipReason("");
      showToast("Task marked as skipped.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyTaskId("");
    }
  }

  let pendingCount = 0;
  let completedCount = 0;

  for (const task of tasks) {
    if (task.status === "pending") {
      pendingCount += 1;
    } else if (task.status === "completed") {
      completedCount += 1;
    }
  }

  if (loading) {
    return (
      <div className="page-loader-inline">
        <span className="spinner" />
        Loading assigned tasks
      </div>
    );
  }

  return (
    <div className="caregiver-checklist">
      <header className="caregiver-checklist__heading">
        <div>
          <span className="eyebrow">Visit checklist</span>
          <h2>{elderlyName ? "Care for " + elderlyName : "Assigned care tasks"}</h2>
          <p>Complete each instruction during the connected care visit.</p>
        </div>
        <div className="caregiver-checklist__counts">
          <span><strong>{pendingCount}</strong> Pending</span>
          <span><strong>{completedCount}</strong> Done</span>
        </div>
      </header>

      {tasks.length === 0 ? (
        <div className="caregiver-checklist__empty">
          <CareTasksIcon />
          <h3>No tasks assigned</h3>
          <p>The family has not added visit instructions for this profile yet.</p>
        </div>
      ) : (
        <div className="caregiver-checklist__list">
          {tasks.map((task) => (
            <article
              className={"caregiver-checklist-task caregiver-checklist-task--" + task.status}
              key={task.id}
            >
              <span className="caregiver-checklist-task__icon">
                {task.status === "completed" ? <CheckIcon /> : <CareTasksIcon />}
              </span>
              <div className="caregiver-checklist-task__body">
                <div className="caregiver-checklist-task__topline">
                  <div>
                    <h3>{task.title}</h3>
                    <span className={"task-priority task-priority--" + task.priority}>
                      {humanize(task.priority)} priority
                    </span>
                  </div>
                  <span className={"status-badge status-badge--" + task.status}>
                    {humanize(task.status)}
                  </span>
                </div>
                {task.instructions && <p>{task.instructions}</p>}
                <span className="caregiver-checklist-task__date">
                  <CalendarIcon size={15} />
                  {formatTaskDate(task.visitDate)}
                </span>
                {task.skipReason && (
                  <div className="record-note">Skip reason: {task.skipReason}</div>
                )}

                {skippingTaskId === task.id && (
                  <div className="caregiver-checklist-task__skip-editor">
                    <label className="field" htmlFor={"skip-reason-" + task.id}>
                      <span>Why can this task not be completed?</span>
                      <textarea
                        className="input textarea"
                        id={"skip-reason-" + task.id}
                        value={skipReason}
                        onChange={(event) => setSkipReason(event.target.value)}
                        rows={2}
                        maxLength={500}
                        autoFocus
                      />
                    </label>
                    <div>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={Boolean(busyTaskId)}
                        onClick={closeSkipReason}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        isLoading={busyTaskId === task.id}
                        disabled={skipReason.trim().length < 3}
                        onClick={confirmSkippedTask}
                      >
                        Confirm skip
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {task.status === "pending" && skippingTaskId !== task.id && (
                <div className="caregiver-checklist-task__actions">
                  <Button
                    type="button"
                    isLoading={busyTaskId === task.id}
                    disabled={Boolean(busyTaskId)}
                    onClick={() => completeTask(task.id)}
                  >
                    <CheckIcon size={16} />
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={Boolean(busyTaskId)}
                    onClick={() => openSkipReason(task.id)}
                  >
                    Skip task
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

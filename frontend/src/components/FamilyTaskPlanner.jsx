import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button.jsx";
import {
  CalendarIcon,
  CareTasksIcon,
  CheckIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
} from "./Icons.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { bookingService } from "../services/bookingService.js";
import { careVisitService } from "../services/careVisitService.js";
import { normalizeApiError } from "../services/api.js";

const QUICK_TASKS = [
  "Medication reminder",
  "Meal support",
  "Hydration check",
  "Mobility assistance",
];

const PRIORITIES = ["low", "medium", "high"];

/**
 * Creates a clean task form with an optional default caregiver.
 * @param {string} caregiverUserId - Assigned caregiver identifier to preselect.
 * @returns {{title: string, instructions: string, priority: string, visitDate: string, caregiverUserId: string}} Empty controlled form values.
 * @sideEffects None.
 */
function createEmptyForm(caregiverUserId = "") {
  return {
    title: "",
    instructions: "",
    priority: "medium",
    visitDate: "",
    caregiverUserId,
  };
}

/**
 * Formats an optional task visit date for family display.
 * @param {string|Date|null} value - Stored task date.
 * @returns {string} Localized date or an unscheduled label.
 * @sideEffects None.
 */
function formatTaskDate(value) {
  if (!value) {
    return "Date not selected";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date not selected";
  }

  return date.toLocaleDateString("en-GB", {
    dateStyle: "medium",
  });
}

/**
 * Converts a task enum value into a readable label.
 * @param {string} value - Stored status or priority.
 * @returns {string} Capitalized display text.
 * @sideEffects None.
 */
function humanize(value) {
  const text = String(value || "").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Provides a focused family interface for creating and managing care-visit tasks.
 * @param {{elderlyProfileId: string, elderlyName?: string}} props - Authorized profile and display name.
 * @returns {import("react").ReactElement} Task list and compact planning form.
 * @sideEffects Loads bookings/tasks and creates, updates, or deletes tasks through the API.
 */
export function FamilyTaskPlanner({ elderlyProfileId, elderlyName }) {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState([]);
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(createEmptyForm());
  const [editingId, setEditingId] = useState("");

  useEffect(() => {
    let active = true;

    /**
     * Loads tasks and caregivers with active bookings for this profile.
     * @returns {Promise<void>} Resolves after task planner state is prepared.
     * @sideEffects Calls two APIs and updates task, caregiver, and form state.
     */
    async function loadTaskPlanner() {
      if (!elderlyProfileId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // These requests do not depend on each other, so they can load together.
        const results = await Promise.all([
          careVisitService.listTasks(elderlyProfileId),
          bookingService.listMyBookings(),
        ]);
        const taskResult = results[0];
        const bookingResult = results[1];
        const assignedCaregivers = [];

        for (const booking of bookingResult.bookings || []) {
          const belongsToProfile =
            String(booking.elderlyProfileId) === String(elderlyProfileId);
          const hasActiveStatus =
            booking.status === "accepted" || booking.status === "confirmed";

          if (!belongsToProfile || !hasActiveStatus || !booking.caregiverId) {
            continue;
          }

          let alreadyIncluded = false;

          for (const caregiver of assignedCaregivers) {
            if (String(caregiver.id) === String(booking.caregiverId)) {
              alreadyIncluded = true;
              break;
            }
          }

          if (!alreadyIncluded) {
            assignedCaregivers.push({
              id: booking.caregiverId,
              name: booking.caregiver?.name || "Assigned caregiver",
            });
          }
        }

        if (!active) {
          return;
        }

        setCaregivers(assignedCaregivers);
        setTasks(taskResult.tasks || []);

        const defaultCaregiverId = assignedCaregivers[0]?.id || "";
        setForm(createEmptyForm(defaultCaregiverId));
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

    loadTaskPlanner();

    return function stopTaskPlannerLoad() {
      active = false;
    };
  }, [elderlyProfileId, showToast]);

  /**
   * Updates one text, date, or caregiver form field.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event - Controlled form event.
   * @returns {void}
   * @sideEffects Updates local form state.
   */
  function handleFieldChange(event) {
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    setForm((current) => ({
      ...current,
      [fieldName]: fieldValue,
    }));
  }

  /**
   * Selects one common care task without requiring manual typing.
   * @param {string} taskTitle - Suggested task title.
   * @returns {void}
   * @sideEffects Updates the task title field.
   */
  function selectQuickTask(taskTitle) {
    setForm((current) => ({
      ...current,
      title: taskTitle,
    }));
  }

  /**
   * Selects the task priority through visible buttons.
   * @param {string} priority - Low, medium, or high priority.
   * @returns {void}
   * @sideEffects Updates the priority field.
   */
  function selectPriority(priority) {
    setForm((current) => ({
      ...current,
      priority,
    }));
  }

  /**
   * Restores the form while keeping the first assigned caregiver selected.
   * @returns {void}
   * @sideEffects Clears editing state and resets controlled form fields.
   */
  function resetForm() {
    const defaultCaregiverId = caregivers[0]?.id || "";
    setEditingId("");
    setForm(createEmptyForm(defaultCaregiverId));
  }

  /**
   * Creates a new task or saves changes to the selected task.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Planner form submission.
   * @returns {Promise<void>} Resolves after the API operation and local update.
   * @sideEffects Prevents navigation, writes task data, updates state, and shows feedback.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.title.trim()) {
      showToast("Choose or enter a task before saving.", "error");
      return;
    }

    if (!form.caregiverUserId) {
      showToast("An active caregiver booking is required for care tasks.", "error");
      return;
    }

    const payload = {
      title: form.title.trim(),
      instructions: form.instructions.trim(),
      priority: form.priority,
      visitDate: form.visitDate,
      elderlyProfileId,
      caregiverUserId: form.caregiverUserId,
    };

    try {
      setSaving(true);

      if (editingId) {
        const result = await careVisitService.updateTask(editingId, payload);

        setTasks((currentTasks) => {
          const updatedTasks = [];

          for (const task of currentTasks) {
            if (task.id === editingId) {
              updatedTasks.push(result.task);
            } else {
              updatedTasks.push(task);
            }
          }

          return updatedTasks;
        });
        showToast("Care task updated.", "success");
      } else {
        const result = await careVisitService.createTask(payload);
        setTasks((currentTasks) => [result.task, ...currentTasks]);
        showToast("Care task added.", "success");
      }

      resetForm();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Removes a family-owned task from the current list.
   * @param {string} taskId - CareTask identifier.
   * @returns {Promise<void>} Resolves after deletion and state update.
   * @sideEffects Deletes task data, updates state, and displays feedback.
   */
  async function handleDelete(taskId) {
    try {
      await careVisitService.deleteTask(taskId);
      setTasks((currentTasks) => {
        const remainingTasks = [];

        for (const task of currentTasks) {
          if (task.id !== taskId) {
            remainingTasks.push(task);
          }
        }

        return remainingTasks;
      });

      if (editingId === taskId) {
        resetForm();
      }

      showToast("Care task removed.", "success");
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    }
  }

  /**
   * Copies an existing task into the editing form without losing its caregiver.
   * @param {object} task - Selected CareTask response object.
   * @returns {void}
   * @sideEffects Updates editing and form state.
   */
  function startEdit(task) {
    let visitDate = "";

    if (task.visitDate) {
      visitDate = new Date(task.visitDate).toISOString().slice(0, 10);
    }

    setEditingId(task.id);
    setForm({
      title: task.title,
      instructions: task.instructions || "",
      priority: task.priority,
      visitDate,
      caregiverUserId: task.caregiverUserId || caregivers[0]?.id || "",
    });
  }

  /**
   * Finds the display name for a task's assigned caregiver.
   * @param {string} caregiverUserId - Assigned caregiver identifier.
   * @returns {string} Caregiver name or a safe fallback.
   * @sideEffects None.
   */
  function getCaregiverName(caregiverUserId) {
    for (const caregiver of caregivers) {
      if (String(caregiver.id) === String(caregiverUserId)) {
        return caregiver.name;
      }
    }

    return "Assigned caregiver";
  }

  // Sorting a copied array keeps React state unchanged while grouping urgent work first.
  const visibleTasks = [...tasks].sort((leftTask, rightTask) => {
    const priorityOrder = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return priorityOrder[leftTask.priority] - priorityOrder[rightTask.priority];
  });
  let pendingCount = 0;
  let completedCount = 0;

  for (const task of tasks) {
    if (task.status === "completed") {
      completedCount += 1;
    } else if (task.status === "pending") {
      pendingCount += 1;
    }
  }

  if (loading) {
    return (
      <div className="page-loader-inline">
        <span className="spinner" />
        Loading care tasks
      </div>
    );
  }

  return (
    <div className="family-task-workspace">
      <section className="family-task-list-panel">
        <header className="family-task-panel-heading">
          <div>
            <span className="eyebrow">Visit checklist</span>
            <h2>Tasks for {elderlyName || "this care recipient"}</h2>
            <p>Caregivers update these items during their assigned visits.</p>
          </div>
          <div className="family-task-counts" aria-label="Task summary">
            <span><strong>{pendingCount}</strong> Pending</span>
            <span><strong>{completedCount}</strong> Completed</span>
          </div>
        </header>

        {visibleTasks.length === 0 ? (
          <div className="family-task-empty">
            <span><CareTasksIcon /></span>
            <h3>No care tasks planned</h3>
            <p>Add a simple visit instruction from the planning panel.</p>
          </div>
        ) : (
          <div className="family-task-list">
            {visibleTasks.map((task) => (
              <article className="family-task-card" key={task.id}>
                <span className={"family-task-card__check family-task-card__check--" + task.status}>
                  {task.status === "completed" ? <CheckIcon /> : <CareTasksIcon />}
                </span>
                <div className="family-task-card__body">
                  <div className="family-task-card__topline">
                    <h3>{task.title}</h3>
                    <span className={"task-priority task-priority--" + task.priority}>
                      {humanize(task.priority)} priority
                    </span>
                  </div>
                  {task.instructions && <p>{task.instructions}</p>}
                  <div className="family-task-card__meta">
                    <span><CalendarIcon size={15} /> {formatTaskDate(task.visitDate)}</span>
                    <span><UserIcon size={15} /> {getCaregiverName(task.caregiverUserId)}</span>
                    <span className={"status-badge status-badge--" + task.status}>
                      {humanize(task.status)}
                    </span>
                  </div>
                  {task.skipReason && (
                    <div className="record-note">Skipped: {task.skipReason}</div>
                  )}
                </div>
                <div className="family-task-card__actions">
                  <button type="button" onClick={() => startEdit(task)}>
                    <PencilIcon size={15} />
                    Edit
                  </button>
                  <button
                    className="family-task-card__delete"
                    type="button"
                    onClick={() => handleDelete(task.id)}
                  >
                    <TrashIcon size={15} />
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className="family-task-editor">
        <header>
          <span className="feature-icon"><CareTasksIcon /></span>
          <div>
            <span className="eyebrow">{editingId ? "Edit task" : "Plan a task"}</span>
            <h2>{editingId ? "Update visit instruction" : "Add visit instruction"}</h2>
          </div>
        </header>

        {caregivers.length === 0 ? (
          <div className="family-task-no-caregiver">
            <UserIcon />
            <h3>No active caregiver assignment</h3>
            <p>Accept a caregiver booking before assigning visit tasks.</p>
            <Link className="button button--primary" to="/bookings">
              Review bookings
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <fieldset className="family-task-quick-options">
              <legend>Choose a common task</legend>
              <div>
                {QUICK_TASKS.map((taskTitle) => (
                  <button
                    className={form.title === taskTitle ? "is-selected" : ""}
                    type="button"
                    onClick={() => selectQuickTask(taskTitle)}
                    key={taskTitle}
                  >
                    {taskTitle}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="field" htmlFor="care-task-title">
              <span>Task</span>
              <input
                className="input"
                id="care-task-title"
                name="title"
                value={form.title}
                onChange={handleFieldChange}
                placeholder="Enter another care task"
                maxLength={120}
              />
            </label>

            <fieldset className="family-task-priority-options">
              <legend>Priority</legend>
              <div>
                {PRIORITIES.map((priority) => (
                  <button
                    className={form.priority === priority ? "is-selected" : ""}
                    type="button"
                    onClick={() => selectPriority(priority)}
                    key={priority}
                  >
                    {humanize(priority)}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="field" htmlFor="care-task-date">
              <span>Visit date</span>
              <input
                className="input"
                id="care-task-date"
                type="date"
                name="visitDate"
                value={form.visitDate}
                onChange={handleFieldChange}
              />
            </label>

            {caregivers.length === 1 ? (
              <div className="family-task-assignee">
                <span><UserIcon /></span>
                <div>
                  <small>Assigned caregiver</small>
                  <strong>{caregivers[0].name}</strong>
                </div>
              </div>
            ) : (
              <label className="field" htmlFor="care-task-caregiver">
                <span>Assigned caregiver</span>
                <select
                  className="input"
                  id="care-task-caregiver"
                  name="caregiverUserId"
                  value={form.caregiverUserId}
                  onChange={handleFieldChange}
                >
                  {caregivers.map((caregiver) => (
                    <option value={caregiver.id} key={caregiver.id}>
                      {caregiver.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field" htmlFor="care-task-instructions">
              <span>Care instructions</span>
              <textarea
                className="input textarea"
                id="care-task-instructions"
                name="instructions"
                value={form.instructions}
                onChange={handleFieldChange}
                placeholder="Add only the details the caregiver needs"
                rows={3}
                maxLength={1000}
              />
            </label>

            <div className="family-task-form-actions">
              {editingId && (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  Cancel
                </Button>
              )}
              <Button type="submit" isLoading={saving}>
                {editingId ? "Save changes" : "Add task"}
              </Button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}

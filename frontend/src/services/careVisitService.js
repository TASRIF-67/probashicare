import { api, buildCareTaskPayload } from "./api.js";

async function listTasks(elderlyProfileId) {
  const response = await api.get("/care-visit/tasks", {
    params: { elderlyProfileId },
  });
  return response.data.data;
}

async function createTask(task) {
  const response = await api.post("/care-visit/tasks", buildCareTaskPayload(task));
  return response.data.data;
}

async function updateTask(taskId, task) {
  const response = await api.put(`/care-visit/tasks/${taskId}`, buildCareTaskPayload(task));
  return response.data.data;
}

async function deleteTask(taskId) {
  const response = await api.delete(`/care-visit/tasks/${taskId}`);
  return response.data.data;
}

async function updateTaskStatus(taskId, status, skipReason = "", notes = "") {
  const response = await api.patch(`/care-visit/tasks/${taskId}/status`, {
    status,
    skipReason,
    notes,
  });
  return response.data.data;
}

async function listHandovers(profileId) {
  const response = await api.get(`/care-visit/handover/${profileId}`);
  return response.data.data;
}

async function createHandover(payload) {
  const response = await api.post("/care-visit/handover", payload);
  return response.data.data;
}

export const careVisitService = {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  listHandovers,
  createHandover,
};

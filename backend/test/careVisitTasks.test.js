import test from "node:test";
import assert from "node:assert/strict";

import { CARE_TASK_PRIORITIES, CARE_TASK_STATUSES, CareTask } from "../models/CareTask.js";
import { VISIT_HANDOVER_TYPES, VisitHandover } from "../models/VisitHandover.js";

test("care visit task schema exposes the expected status and priority enums", () => {
  assert.deepEqual(CARE_TASK_PRIORITIES, ["low", "medium", "high"]);
  assert.deepEqual(CARE_TASK_STATUSES, ["pending", "completed", "skipped"]);
  assert.equal(CareTask.modelName, "CareTask");
  assert.deepEqual(VISIT_HANDOVER_TYPES, ["final"]);
  assert.equal(VisitHandover.modelName, "VisitHandover");
});

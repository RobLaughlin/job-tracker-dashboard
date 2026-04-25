import type { components } from "../../generated/api-types";

export type JobStatus = components["schemas"]["jobStatus"];
export type TaskStatus = components["schemas"]["taskStatus"];

export type HealthResponse = components["schemas"]["health-response.schema"];
export type JobsListResponse =
  components["schemas"]["jobs-list-response.schema"];
export type JobDetailResponse =
  components["schemas"]["job-detail-response.schema"];
export type JobTasksResponse =
  components["schemas"]["job-tasks-response.schema"];
export type ErrorResponse = components["schemas"]["error.schema"];

export type SnapshotEvent = {
  event_id: string;
  event_type: "snapshot";
  schema_version: "1.0.0";
  occurred_at: string;
  job_id: string;
  payload: {
    job: components["schemas"]["job.schema"];
    tasks: components["schemas"]["task.schema"][];
  };
};

export type JobUpdatedEvent = {
  event_id: string;
  event_type: "job.updated";
  schema_version: "1.0.0";
  occurred_at: string;
  job_id: string;
  payload: {
    status: JobStatus;
  };
};

export type TaskUpdatedEvent = {
  event_id: string;
  event_type: "task.updated";
  schema_version: "1.0.0";
  occurred_at: string;
  job_id: string;
  payload: {
    task_id: string;
    required: boolean;
    status: TaskStatus;
  };
};

export type HeartbeatEvent = {
  event_id: string;
  event_type: "heartbeat";
  schema_version: "1.0.0";
  occurred_at: string;
  job_id: string;
  payload: {
    interval_seconds: number;
  };
};

export type StreamErrorEvent = {
  event_id: string;
  event_type: "error";
  schema_version: "1.0.0";
  occurred_at: string;
  job_id: string;
  payload: {
    code: string;
    message: string;
    recoverable: boolean;
  };
};

export type StreamEvent =
  | SnapshotEvent
  | JobUpdatedEvent
  | TaskUpdatedEvent
  | HeartbeatEvent
  | StreamErrorEvent;

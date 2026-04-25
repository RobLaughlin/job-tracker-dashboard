import type { SchemaPath } from "../../generated/schema-registry";

export const REST_SCHEMA_PATHS = {
  healthResponse: "rest/health-response.schema.json",
  jobsListResponse: "rest/jobs-list-response.schema.json",
  jobDetailResponse: "rest/job-detail-response.schema.json",
  jobTasksResponse: "rest/job-tasks-response.schema.json",
  errorResponse: "common/error.schema.json",
} as const satisfies Record<string, SchemaPath>;

export const SSE_SCHEMA_PATHS = {
  streamEvent: "sse/stream-event.schema.json",
} as const satisfies Record<string, SchemaPath>;

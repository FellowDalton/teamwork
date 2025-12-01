/**
 * Zod schemas and TypeScript types for Teamwork API v3 responses.
 */

import { z } from 'zod';

// ============================================================================
// Pagination & Response Wrappers
// ============================================================================

/**
 * Meta information for paginated responses.
 */
export const PaginationMetaSchema = z.object({
  page: z
    .object({
      pageOffset: z.number().optional(),
      pageSize: z.number().optional(),
      count: z.number().optional(),
      hasMore: z.boolean().optional(),
    })
    .optional(),
  totalCount: z.number().optional(),
});

export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;

// ============================================================================
// User & Team References
// ============================================================================

/**
 * User reference in API responses.
 */
export const UserReferenceSchema = z.object({
  id: z.number(),
  type: z.literal('users').optional(),
});

export type UserReference = z.infer<typeof UserReferenceSchema>;

/**
 * Full user object.
 */
export const UserSchema = z.object({
  id: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  avatarUrl: z.string().optional(),
  companyId: z.number().optional(),
  title: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

/**
 * Team reference.
 */
export const TeamReferenceSchema = z.object({
  id: z.number(),
  type: z.literal('teams').optional(),
});

export type TeamReference = z.infer<typeof TeamReferenceSchema>;

/**
 * Company reference.
 */
export const CompanyReferenceSchema = z.object({
  id: z.number(),
  type: z.literal('companies').optional(),
});

export type CompanyReference = z.infer<typeof CompanyReferenceSchema>;

// ============================================================================
// Tags
// ============================================================================

/**
 * Tag object - name may be omitted when tags are returned as references.
 * Full tag data is often in the "included" section of the response.
 */
export const TagSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  color: z.string().optional(),
  projectId: z.number().optional(),
});

export type Tag = z.infer<typeof TagSchema>;

// ============================================================================
// Tasks
// ============================================================================

/**
 * Task status in API responses.
 */
export const TaskStatusSchema = z.enum([
  'new',
  'pending',
  'active',
  'in progress',
  'completed',
  'deleted',
  'reopened',
]);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * Task priority.
 */
export const TaskPrioritySchema = z.enum(['none', 'low', 'medium', 'high']);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/**
 * Full task object from API.
 */
export const ApiTaskSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional().default(''),
  status: z.string().optional(),
  priority: z.string().optional(),
  progress: z.number().optional(),
  estimatedMinutes: z.number().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  completedAt: z.string().nullable().optional(),
  projectId: z.number().optional(),
  tasklistId: z.number().optional(),
  parentTaskId: z.number().nullable().optional(),
  // API can return assignees in different formats:
  // - Object: { userIds: [], teamIds: [], companyIds: [] }
  // - Array of references: [{ id: 123, type: 'users' }]
  assignees: z
    .union([
      z.object({
        userIds: z.array(z.number()).optional(),
        teamIds: z.array(z.number()).optional(),
        companyIds: z.array(z.number()).optional(),
      }),
      z.array(
        z.object({
          id: z.number(),
          type: z.string().optional(),
        })
      ),
    ])
    .optional(),
  tags: z.array(TagSchema).optional(),
  // Workflow stage info
  workflowColumn: z
    .object({
      id: z.number(),
      name: z.string().optional(),
    })
    .nullable()
    .optional(),
  // Custom fields can be present
  customFields: z.array(z.unknown()).optional(),
});

export type ApiTask = z.infer<typeof ApiTaskSchema>;

/**
 * Task list response.
 */
export const TaskListResponseSchema = z.object({
  tasks: z.array(ApiTaskSchema),
  meta: PaginationMetaSchema.optional(),
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
      teams: z.record(z.string(), z.unknown()).optional(),
      tags: z.record(z.string(), TagSchema).optional(),
    })
    .optional(),
});

export type TaskListResponse = z.infer<typeof TaskListResponseSchema>;

/**
 * Single task response.
 */
export const TaskResponseSchema = z.object({
  task: ApiTaskSchema,
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
      teams: z.record(z.string(), z.unknown()).optional(),
      tags: z.record(z.string(), TagSchema).optional(),
    })
    .optional(),
});

export type TaskResponse = z.infer<typeof TaskResponseSchema>;

/**
 * Task creation request.
 */
export const CreateTaskRequestSchema = z.object({
  task: z.object({
    name: z.string(),
    description: z.string().optional(),
    priority: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    estimatedMinutes: z.number().optional(),
    assignees: z
      .object({
        userIds: z.array(z.number()).optional(),
        teamIds: z.array(z.number()).optional(),
        companyIds: z.array(z.number()).optional(),
      })
      .optional(),
    tagIds: z.array(z.number()).optional(),
  }),
});

export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

/**
 * Task update request.
 */
export const UpdateTaskRequestSchema = z.object({
  task: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    progress: z.number().optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    estimatedMinutes: z.number().optional(),
    assignees: z
      .object({
        userIds: z.array(z.number()).optional(),
        teamIds: z.array(z.number()).optional(),
        companyIds: z.array(z.number()).optional(),
      })
      .optional(),
    tagIds: z.array(z.number()).optional(),
  }),
});

export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

// ============================================================================
// Tasklists
// ============================================================================

/**
 * Tasklist object.
 */
export const TasklistSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  projectId: z.number().optional(),
  milestoneId: z.number().nullable().optional(),
  position: z.number().optional(),
  status: z.string().optional(),
});

export type Tasklist = z.infer<typeof TasklistSchema>;

/**
 * Tasklist list response.
 */
export const TasklistListResponseSchema = z.object({
  tasklists: z.array(TasklistSchema),
  meta: PaginationMetaSchema.optional(),
});

export type TasklistListResponse = z.infer<typeof TasklistListResponseSchema>;

// ============================================================================
// Projects
// ============================================================================

/**
 * Project object.
 */
export const ProjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  companyId: z.number().optional(),
  categoryId: z.number().nullable().optional(),
  ownerId: z.number().optional(),
  defaultPrivacy: z.string().optional(),
  // Workflow info
  activeWorkflow: z
    .object({
      id: z.number(),
      name: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

/**
 * Project list response.
 */
export const ProjectListResponseSchema = z.object({
  projects: z.array(ProjectSchema),
  meta: PaginationMetaSchema.optional(),
  included: z
    .object({
      companies: z.record(z.string(), z.unknown()).optional(),
      users: z.record(z.string(), UserSchema).optional(),
    })
    .optional(),
});

export type ProjectListResponse = z.infer<typeof ProjectListResponseSchema>;

/**
 * Single project response.
 */
export const ProjectResponseSchema = z.object({
  project: ProjectSchema,
  included: z
    .object({
      companies: z.record(z.string(), z.unknown()).optional(),
      users: z.record(z.string(), UserSchema).optional(),
    })
    .optional(),
});

export type ProjectResponse = z.infer<typeof ProjectResponseSchema>;

// ============================================================================
// Workflows & Stages
// ============================================================================

/**
 * Workflow stage/column.
 */
export const StageSchema = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string().optional(),
  position: z.number().optional(),
  isCollapsed: z.boolean().optional(),
  highlightNewTasks: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Stage = z.infer<typeof StageSchema>;

/**
 * Workflow object.
 */
export const WorkflowSchema = z.object({
  id: z.number(),
  name: z.string(),
  statusId: z.number().optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  stages: z.array(StageSchema).optional(),
});

export type Workflow = z.infer<typeof WorkflowSchema>;

/**
 * Workflow list response.
 */
export const WorkflowListResponseSchema = z.object({
  workflows: z.array(WorkflowSchema),
  meta: PaginationMetaSchema.optional(),
  included: z
    .object({
      stages: z.record(z.string(), StageSchema).optional(),
      projects: z.record(z.string(), ProjectSchema).optional(),
    })
    .optional(),
});

export type WorkflowListResponse = z.infer<typeof WorkflowListResponseSchema>;

/**
 * Single workflow response.
 */
export const WorkflowResponseSchema = z.object({
  workflow: WorkflowSchema,
  included: z
    .object({
      stages: z.record(z.string(), StageSchema).optional(),
      projects: z.record(z.string(), ProjectSchema).optional(),
    })
    .optional(),
});

export type WorkflowResponse = z.infer<typeof WorkflowResponseSchema>;

/**
 * Stage list response.
 */
export const StageListResponseSchema = z.object({
  stages: z.array(StageSchema),
  meta: PaginationMetaSchema.optional(),
});

export type StageListResponse = z.infer<typeof StageListResponseSchema>;

/**
 * Single stage response.
 */
export const StageResponseSchema = z.object({
  stage: StageSchema,
});

export type StageResponse = z.infer<typeof StageResponseSchema>;

/**
 * Task position update in workflow.
 */
export const UpdateTaskPositionRequestSchema = z.object({
  card: z.object({
    columnId: z.number(),
    positionAfterCard: z.number().nullable().optional(),
  }),
});

export type UpdateTaskPositionRequest = z.infer<typeof UpdateTaskPositionRequestSchema>;

/**
 * Add task to stage request.
 */
export const AddTaskToStageRequestSchema = z.object({
  cards: z.array(
    z.object({
      taskId: z.number(),
      positionAfterCard: z.number().nullable().optional(),
    })
  ),
});

export type AddTaskToStageRequest = z.infer<typeof AddTaskToStageRequestSchema>;

// ============================================================================
// Comments
// ============================================================================

/**
 * Comment object.
 */
export const CommentSchema = z.object({
  id: z.number(),
  body: z.string(),
  contentType: z.string().optional(),
  authorId: z.number().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  objectType: z.string().optional(),
  objectId: z.number().optional(),
  isPrivate: z.boolean().optional(),
});

export type Comment = z.infer<typeof CommentSchema>;

/**
 * Comment list response.
 */
export const CommentListResponseSchema = z.object({
  comments: z.array(CommentSchema),
  meta: PaginationMetaSchema.optional(),
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
    })
    .optional(),
});

export type CommentListResponse = z.infer<typeof CommentListResponseSchema>;

/**
 * Single comment response.
 */
export const CommentResponseSchema = z.object({
  comment: CommentSchema,
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
    })
    .optional(),
});

export type CommentResponse = z.infer<typeof CommentResponseSchema>;

/**
 * Create comment request.
 */
export const CreateCommentRequestSchema = z.object({
  comment: z.object({
    body: z.string(),
    contentType: z.enum(['TEXT', 'HTML', 'MARKDOWN']).optional(),
    isPrivate: z.boolean().optional(),
  }),
});

export type CreateCommentRequest = z.infer<typeof CreateCommentRequestSchema>;

// ============================================================================
// Processed Task (compatible with existing data-models.ts)
// ============================================================================

/**
 * Processed task matching the TeamworkTask interface from data-models.ts.
 */
export const ProcessedTaskSchema = z.object({
  task_id: z.string(),
  project_id: z.string(),
  title: z.string(),
  status: z.string(),
  description: z.string().default(''),
  tags: z.record(z.string(), z.string()).default({}),
  worktree: z.string().optional(),
  model: z.string().optional(),
  workflow_type: z.string().optional(),
  prototype: z.string().optional(),
  execution_trigger: z.string().optional(),
  task_prompt: z.string().optional(),
  assigned_to: z.string().nullable().optional(),
  created_time: z.string().optional(),
  last_edited_time: z.string().optional(),
  due_date: z.string().nullable().optional(),
  priority: z.string().optional(),
  estimated_minutes: z.number().int().optional(),
  // Workflow stage info
  stage_id: z.number().optional(),
  stage_name: z.string().optional(),
});

export type ProcessedTask = z.infer<typeof ProcessedTaskSchema>;

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
  priority: z.string().nullable().optional(),
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
  tags: z.array(TagSchema).nullable().optional(),
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

// ============================================================================
// Time Entries (Timelogs)
// ============================================================================

/**
 * Time entry object from API.
 */
export const TimeEntrySchema = z.object({
  id: z.number(),
  minutes: z.number(),
  hours: z.number().optional(),
  description: z.string().optional().default(''),
  date: z.string().optional(),
  timeLogged: z.string().optional(),
  dateCreated: z.string().optional(),
  dateEdited: z.string().nullable().optional(),
  billable: z.boolean().optional(),
  isBillable: z.boolean().optional().default(true),
  hasStartTime: z.boolean().optional(),
  userId: z.number().optional(),
  taskId: z.number().nullable().optional(),
  projectId: z.number().optional(),
  tasklistId: z.number().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().nullable().optional(),
  invoiceId: z.number().nullable().optional(),
  tagIds: z.array(z.number()).nullable().optional(),
  deleted: z.boolean().optional(),
});

export type TimeEntry = z.infer<typeof TimeEntrySchema>;

/**
 * Time entry list response.
 */
export const TimeEntryListResponseSchema = z.object({
  timelogs: z.array(TimeEntrySchema),
  meta: PaginationMetaSchema.optional(),
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
      tasks: z.record(z.string(), ApiTaskSchema).optional(),
      projects: z.record(z.string(), ProjectSchema).optional(),
    })
    .optional(),
});

export type TimeEntryListResponse = z.infer<typeof TimeEntryListResponseSchema>;

/**
 * Single time entry response.
 */
export const TimeEntryResponseSchema = z.object({
  timelog: TimeEntrySchema,
  included: z
    .object({
      users: z.record(z.string(), UserSchema).optional(),
      tasks: z.record(z.string(), ApiTaskSchema).optional(),
      projects: z.record(z.string(), ProjectSchema).optional(),
    })
    .optional(),
});

export type TimeEntryResponse = z.infer<typeof TimeEntryResponseSchema>;

/**
 * Create time entry request.
 */
export const CreateTimeEntryRequestSchema = z.object({
  timelog: z.object({
    taskId: z.number().optional(),
    minutes: z.number(),
    date: z.string(),
    description: z.string().optional(),
    isBillable: z.boolean().optional(),
    time: z.string().optional(),
    tagIds: z.array(z.number()).optional(),
  }),
});

export type CreateTimeEntryRequest = z.infer<typeof CreateTimeEntryRequestSchema>;

/**
 * Update time entry request.
 */
export const UpdateTimeEntryRequestSchema = z.object({
  timelog: z.object({
    minutes: z.number().optional(),
    date: z.string().optional(),
    description: z.string().optional(),
    isBillable: z.boolean().optional(),
    time: z.string().optional(),
    tagIds: z.array(z.number()).optional(),
  }),
});

export type UpdateTimeEntryRequest = z.infer<typeof UpdateTimeEntryRequestSchema>;

// ============================================================================
// People / Current User (Me)
// ============================================================================

/**
 * Full person object from /me endpoint.
 */
export const PersonSchema = z.object({
  id: z.number(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  emailAddress: z.string().optional(),
  title: z.string().optional(),
  avatarUrl: z.string().optional(),
  companyId: z.number().optional(),
  company: z.object({
    id: z.number(),
    type: z.string().optional(),
  }).optional(),
  administrator: z.boolean().optional(),
  isAdmin: z.boolean().optional(),
  isClientUser: z.boolean().optional(),
  isServiceAccount: z.boolean().optional(),
  siteOwner: z.boolean().optional(),
  inOwnerCompany: z.boolean().optional(),
  canAddProjects: z.boolean().optional(),
  timezone: z.string().optional(),
  lengthOfDay: z.number().optional(),
  lastLogin: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  teams: z.array(z.object({
    id: z.number(),
    type: z.string().optional(),
  })).optional(),
  deleted: z.boolean().optional(),
});

export type Person = z.infer<typeof PersonSchema>;

/**
 * Response from /me endpoint.
 */
export const MeResponseSchema = z.object({
  person: PersonSchema,
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

// ============================================================================
// Activity
// ============================================================================

/**
 * Activity item from latestactivity endpoint.
 */
export const ActivitySchema = z.object({
  id: z.number(),
  activityType: z.string(),
  dateTime: z.string(),
  description: z.string().optional(),
  extraDescription: z.string().optional(),
  itemId: z.number().optional(),
  itemType: z.string().optional(),
  itemLink: z.string().optional(),
  itemDescription: z.string().optional(),
  projectId: z.number().optional(),
  companyId: z.number().optional(),
  forUserId: z.number().optional(),
  forUserName: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  isPrivate: z.union([z.boolean(), z.number()]).optional(),
  project: z.object({
    id: z.number(),
    type: z.string().optional(),
  }).optional(),
  user: z.object({
    id: z.number(),
    type: z.string().optional(),
  }).optional(),
});

export type Activity = z.infer<typeof ActivitySchema>;

/**
 * Activity list response.
 */
export const ActivityListResponseSchema = z.object({
  activities: z.array(ActivitySchema),
  meta: PaginationMetaSchema.optional(),
  included: z.object({
    users: z.record(z.string(), UserSchema).optional(),
    projects: z.record(z.string(), ProjectSchema).optional(),
    companies: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
});

export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;

// ============================================================================
// Budgets
// ============================================================================

/**
 * Project budget object from API.
 */
export const ProjectBudgetSchema = z.object({
  id: z.number(),
  projectId: z.number().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  capacityUsed: z.number().optional(),
  capacity: z.number().optional(),
  originatorBudgetId: z.number().nullable().optional(),
  isRepeating: z.boolean().optional(),
  repeatPeriod: z.number().nullable().optional(),
  repeatUnit: z.string().nullable().optional(),
  repeatsRemaining: z.number().nullable().optional(),
  sequenceNumber: z.number().nullable().optional(),
  startDateTime: z.string().nullable().optional(),
  endDateTime: z.string().nullable().optional(),
  currencyCode: z.string().nullable().optional(),
  timelogType: z.string().optional(),
  expenseType: z.string().optional(),
  defaultRate: z.number().nullable().optional(),
  notificationIds: z.array(z.number()).optional(),
  createdByUserId: z.number().optional(),
  dateCreated: z.string().optional(),
  updatedUserId: z.number().nullable().optional(),
  dateUpdated: z.string().nullable().optional(),
  completedByUserId: z.number().nullable().optional(),
  dateCompleted: z.string().nullable().optional(),
  deletedByUserId: z.number().nullable().optional(),
  dateDeleted: z.string().nullable().optional(),
});

export type ProjectBudget = z.infer<typeof ProjectBudgetSchema>;

/**
 * Tasklist budget object from API.
 */
export const TasklistBudgetSchema = z.object({
  id: z.number(),
  tasklistId: z.number().optional(),
  projectBudgetId: z.number().optional(),
  capacityUsed: z.number().optional(),
  capacity: z.number().optional(),
  dateCreated: z.string().optional(),
  dateUpdated: z.string().nullable().optional(),
});

export type TasklistBudget = z.infer<typeof TasklistBudgetSchema>;

/**
 * Budget list response for project budgets.
 */
export const ProjectBudgetListResponseSchema = z.object({
  budgets: z.array(ProjectBudgetSchema),
  meta: PaginationMetaSchema.optional(),
  included: z.object({
    projects: z.record(z.string(), ProjectSchema).optional(),
    users: z.record(z.string(), UserSchema).optional(),
  }).optional(),
});

export type ProjectBudgetListResponse = z.infer<typeof ProjectBudgetListResponseSchema>;

/**
 * Single project budget response.
 */
export const ProjectBudgetResponseSchema = z.object({
  budget: ProjectBudgetSchema,
  included: z.object({
    projects: z.record(z.string(), ProjectSchema).optional(),
    users: z.record(z.string(), UserSchema).optional(),
  }).optional(),
});

export type ProjectBudgetResponse = z.infer<typeof ProjectBudgetResponseSchema>;

/**
 * Tasklist budget list response.
 */
export const TasklistBudgetListResponseSchema = z.object({
  budgets: z.array(TasklistBudgetSchema),
  meta: PaginationMetaSchema.optional(),
  included: z.object({
    tasklists: z.record(z.string(), TasklistSchema).optional(),
    projectBudgets: z.record(z.string(), ProjectBudgetSchema).optional(),
  }).optional(),
});

export type TasklistBudgetListResponse = z.infer<typeof TasklistBudgetListResponseSchema>;

#!/usr/bin/env bun
/**
 * Restructure the PM project (806515) to align with AI Development project.
 */

import { createClientFromEnv } from './client.ts';
import { ProjectsResource } from './resources/projects.ts';
import { TasksResource } from './resources/tasks.ts';

const PROJECT_ID = 806515;
const NIKOLAS_USER_ID = 366085;

// Tasklists to keep unchanged
const KEEP_TASKLISTS = [
  2039115, // General tasks
  2039121, // Testing & Validation
  2039122, // Launch & Training
];

// Tasklists to archive tasks from and then delete
const ARCHIVE_AND_DELETE = [
  2039117, // Storyblok CMS Development
  2039118, // Next.js Frontend Development
  2039120, // Integration & MediaLibrary
];

// Tasklist to keep but move Nikolas's tasks to archive
const PROJECT_KICKOFF_TASKLIST = 2039116;

// Tasklist to rename
const PIM_TASKLIST = 2039119;
const PIM_NEW_NAME = "Sprint 5: NextPage PIM Integration";

// New sprint tasklists to create with their summary tasks
const NEW_SPRINTS = [
  {
    name: "Sprint 1: Foundation & Setup",
    description: "Epic 1: Visual Editing Foundation - Next.js 16 + Storyblok SDK setup",
    tasks: [
      { name: "Next.js 16 + Storyblok SDK Setup", description: "Initialize project with TypeScript, ESLint, App Router, PPR enabled, and @storyblok/react SDK configured." },
      { name: "Dynamic Page Routing", description: "Implement catch-all route for Storyblok pages with content fetching." },
      { name: "Visual Editor Preview Integration", description: "Enable real-time preview in Storyblok visual editor with draft content and bridge connection." },
      { name: "Webhook Revalidation", description: "Implement /api/revalidate endpoint for Storyblok webhooks with revalidateTag()." },
    ]
  },
  {
    name: "Sprint 2: Component Library",
    description: "Epic 2: Complete Component Library - All 29 components with 1:1 visual parity",
    tasks: [
      { name: "CSS Architecture & Design Tokens", description: "Set up CSS foundation with design tokens, BEM patterns, fluid clamp responsive system." },
      { name: "Layout Components", description: "Build Header, Footer, and Navigation components with Radix NavigationMenu." },
      { name: "Content & Interactive Components", description: "Implement all 29 Storyblok components: Wysiwyg, Accordion, Slider, Video, CTA, Push, etc." },
      { name: "Responsive Verification", description: "Verify all components scale correctly across mobile, tablet, and desktop viewports." },
    ]
  },
  {
    name: "Sprint 3: Multi-Country Delivery",
    description: "Epic 3: Multi-Country Site Delivery - 5 country domains with localized content",
    tasks: [
      { name: "Domain-to-Country Routing Middleware", description: "Implement middleware to detect domain and set country context (dk, se, no, de, en)." },
      { name: "Country-Based Content Fetching", description: "Fetch content from country-specific Storyblok folders." },
      { name: "Railway Multi-Domain Configuration", description: "Configure Railway deployment with all custom domains and SSL certificates." },
    ]
  },
  {
    name: "Sprint 4: Content Migration",
    description: "Epic 4: Content Migration - Migrate all Ibexa content to Storyblok",
    tasks: [
      { name: "Migration Tooling Setup", description: "Build automated tooling to transform Ibexa YAML exports to Storyblok format." },
      { name: "Media Asset Migration", description: "Migrate all images and documents to Storyblok asset library." },
      { name: "Denmark Pilot + Remaining Countries", description: "Migrate Danish content as pilot, then roll out to SE, NO, DE, EN." },
      { name: "Migration Validation", description: "Validate migrated content accuracy, link integrity, and visual comparison." },
    ]
  },
  {
    name: "Sprint 6: Search & Forms",
    description: "Epic 6+7: Search & Discovery + Forms & Compliance",
    tasks: [
      { name: "Algolia Integration & Indexing", description: "Configure Algolia, index pages/products/news, sync on publish." },
      { name: "Site Search UI", description: "Build instant search in header with results navigation." },
      { name: "Contact Forms & Backend", description: "Implement form validation, submission, email notifications, country routing." },
      { name: "Didomi Cookie Consent", description: "Integrate Didomi consent banner, enforce cookie preferences." },
    ]
  },
  {
    name: "Sprint 7: Performance & Cache",
    description: "Epic 8: Performance & Cache Optimization",
    tasks: [
      { name: "PPR + Redis Cache Handler", description: "Configure PPR with @neshca/cache-handler for Redis, stable cache keys." },
      { name: "Tag-Based Revalidation", description: "Implement revalidateTag() for granular content updates within 5 seconds." },
      { name: "Cache Strategy Implementation", description: "Implement tag patterns: story:{country}:{slug}, country:{code}, product:{id}, navigation." },
      { name: "Performance Monitoring", description: "Set up Core Web Vitals tracking, verify LCP < 2.5s, TTFB < 600ms." },
    ]
  },
];

async function main() {
  const client = createClientFromEnv(true);
  const projects = new ProjectsResource(client);
  const tasks = new TasksResource(client);

  console.log(`Restructuring PM project (ID: ${PROJECT_ID})\n`);

  // Step 1: Create Archive tasklist
  console.log("Step 1: Creating Archive tasklist...");
  const archiveResult = await projects.createTasklist(PROJECT_ID, {
    name: "Archive",
    description: "Historical tasks moved during project restructure",
  });
  const archiveTasklistId = parseInt(archiveResult.id);
  console.log(`  Created Archive tasklist (ID: ${archiveTasklistId})\n`);

  // Step 2: Create new sprint tasklists
  console.log("Step 2: Creating new sprint tasklists...");
  const sprintTasklistIds: Map<string, number> = new Map();
  for (const sprint of NEW_SPRINTS) {
    const result = await projects.createTasklist(PROJECT_ID, {
      name: sprint.name,
      description: sprint.description,
    });
    const tasklistId = parseInt(result.id);
    sprintTasklistIds.set(sprint.name, tasklistId);
    console.log(`  Created "${sprint.name}" (ID: ${tasklistId})`);
  }
  console.log('');

  // Step 3: Rename PIM tasklist
  console.log("Step 3: Renaming PIM tasklist...");
  await client.patch(`/projects/api/v3/tasklists/${PIM_TASKLIST}.json`, {
    tasklist: { name: PIM_NEW_NAME }
  });
  console.log(`  Renamed tasklist ${PIM_TASKLIST} to "${PIM_NEW_NAME}"\n`);

  // Step 4: Move tasks from tasklists to archive
  console.log("Step 4: Moving tasks to Archive...");
  for (const tasklistId of ARCHIVE_AND_DELETE) {
    const tasksResponse = await tasks.listByTasklist(tasklistId, { pageSize: 100 });
    console.log(`  Moving ${tasksResponse.tasks.length} tasks from tasklist ${tasklistId}...`);
    for (const task of tasksResponse.tasks) {
      await client.patch(`/projects/api/v3/tasks/${task.id}.json`, {
        task: { tasklistId: archiveTasklistId }
      });
    }
  }
  console.log('');

  // Step 5: Move Nikolas's tasks from Project Kickoff to Archive
  console.log("Step 5: Moving Nikolas's tasks from Project Kickoff to Archive...");
  const kickoffTasks = await tasks.listByTasklist(PROJECT_KICKOFF_TASKLIST, {
    pageSize: 100,
    include: ['assignees']
  });
  let movedCount = 0;
  for (const task of kickoffTasks.tasks) {
    // Check if task is assigned to Nikolas
    const isNikolasTask = task.assignees?.some(a => a.id === NIKOLAS_USER_ID);
    if (isNikolasTask) {
      await client.patch(`/projects/api/v3/tasks/${task.id}.json`, {
        task: { tasklistId: archiveTasklistId }
      });
      movedCount++;
    }
  }
  console.log(`  Moved ${movedCount} tasks assigned to Nikolas\n`);

  // Step 6: Delete emptied tasklists
  console.log("Step 6: Deleting emptied tasklists...");
  for (const tasklistId of ARCHIVE_AND_DELETE) {
    await client.delete(`/projects/api/v3/tasklists/${tasklistId}.json`);
    console.log(`  Deleted tasklist ${tasklistId}`);
  }
  console.log('');

  // Step 7: Create summary tasks in new sprint tasklists
  console.log("Step 7: Creating summary tasks in sprint tasklists...");
  for (const sprint of NEW_SPRINTS) {
    const tasklistId = sprintTasklistIds.get(sprint.name)!;
    console.log(`  Creating tasks in "${sprint.name}"...`);
    for (const taskDef of sprint.tasks) {
      await tasks.create(tasklistId, {
        name: taskDef.name,
        description: taskDef.description,
      });
    }
  }
  console.log('');

  console.log("Done! Project restructured successfully.");
  console.log("\nFinal structure:");
  const finalTasklists = await projects.getTasklists(PROJECT_ID);
  for (const tl of finalTasklists.tasklists) {
    console.log(`  [${tl.id}] ${tl.name}`);
  }
}

main().catch(console.error);

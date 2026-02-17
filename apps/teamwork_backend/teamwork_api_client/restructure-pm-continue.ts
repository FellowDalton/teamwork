#!/usr/bin/env bun
/**
 * Continue restructuring PM project from step 4.
 */

import { createClientFromEnv } from './client.ts';
import { ProjectsResource } from './resources/projects.ts';
import { TasksResource } from './resources/tasks.ts';

const PROJECT_ID = 806515;
const NIKOLAS_USER_ID = 366085;

// Archive tasklist (already created)
const ARCHIVE_TASKLIST_ID = 2040217;

// Tasklists to archive tasks from and then delete
const ARCHIVE_AND_DELETE = [
  2039117, // Storyblok CMS Development
  2039118, // Next.js Frontend Development
  2039120, // Integration & MediaLibrary
];

// Tasklist to keep but move Nikolas's tasks to archive
const PROJECT_KICKOFF_TASKLIST = 2039116;

// Sprint tasklists (already created)
const SPRINT_TASKLISTS = {
  "Sprint 1: Foundation & Setup": 2040218,
  "Sprint 2: Component Library": 2040219,
  "Sprint 3: Multi-Country Delivery": 2040220,
  "Sprint 4: Content Migration": 2040221,
  "Sprint 6: Search & Forms": 2040222,
  "Sprint 7: Performance & Cache": 2040223,
};

// New sprint tasks
const SPRINT_TASKS = [
  {
    tasklistId: 2040218, // Sprint 1
    tasks: [
      { name: "Next.js 16 + Storyblok SDK Setup", description: "Initialize project with TypeScript, ESLint, App Router, PPR enabled, and @storyblok/react SDK configured." },
      { name: "Dynamic Page Routing", description: "Implement catch-all route for Storyblok pages with content fetching." },
      { name: "Visual Editor Preview Integration", description: "Enable real-time preview in Storyblok visual editor with draft content and bridge connection." },
      { name: "Webhook Revalidation", description: "Implement /api/revalidate endpoint for Storyblok webhooks with revalidateTag()." },
    ]
  },
  {
    tasklistId: 2040219, // Sprint 2
    tasks: [
      { name: "CSS Architecture & Design Tokens", description: "Set up CSS foundation with design tokens, BEM patterns, fluid clamp responsive system." },
      { name: "Layout Components", description: "Build Header, Footer, and Navigation components with Radix NavigationMenu." },
      { name: "Content & Interactive Components", description: "Implement all 29 Storyblok components: Wysiwyg, Accordion, Slider, Video, CTA, Push, etc." },
      { name: "Responsive Verification", description: "Verify all components scale correctly across mobile, tablet, and desktop viewports." },
    ]
  },
  {
    tasklistId: 2040220, // Sprint 3
    tasks: [
      { name: "Domain-to-Country Routing Middleware", description: "Implement middleware to detect domain and set country context (dk, se, no, de, en)." },
      { name: "Country-Based Content Fetching", description: "Fetch content from country-specific Storyblok folders." },
      { name: "Railway Multi-Domain Configuration", description: "Configure Railway deployment with all custom domains and SSL certificates." },
    ]
  },
  {
    tasklistId: 2040221, // Sprint 4
    tasks: [
      { name: "Migration Tooling Setup", description: "Build automated tooling to transform Ibexa YAML exports to Storyblok format." },
      { name: "Media Asset Migration", description: "Migrate all images and documents to Storyblok asset library." },
      { name: "Denmark Pilot + Remaining Countries", description: "Migrate Danish content as pilot, then roll out to SE, NO, DE, EN." },
      { name: "Migration Validation", description: "Validate migrated content accuracy, link integrity, and visual comparison." },
    ]
  },
  {
    tasklistId: 2040222, // Sprint 6
    tasks: [
      { name: "Algolia Integration & Indexing", description: "Configure Algolia, index pages/products/news, sync on publish." },
      { name: "Site Search UI", description: "Build instant search in header with results navigation." },
      { name: "Contact Forms & Backend", description: "Implement form validation, submission, email notifications, country routing." },
      { name: "Didomi Cookie Consent", description: "Integrate Didomi consent banner, enforce cookie preferences." },
    ]
  },
  {
    tasklistId: 2040223, // Sprint 7
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

  console.log(`Continuing PM project restructure (ID: ${PROJECT_ID})\n`);

  // Step 4: Move tasks from tasklists to archive
  console.log("Step 4: Moving tasks to Archive...");
  for (const tasklistId of ARCHIVE_AND_DELETE) {
    const tasksResponse = await tasks.listByTasklist(tasklistId, { pageSize: 100 });
    console.log(`  Moving ${tasksResponse.tasks.length} tasks from tasklist ${tasklistId}...`);
    let moved = 0, failed = 0;
    for (const task of tasksResponse.tasks) {
      try {
        await client.patch(`/projects/api/v3/tasks/${task.id}.json`, {
          task: { tasklistId: ARCHIVE_TASKLIST_ID }
        });
        moved++;
      } catch (e) {
        failed++;
        console.log(`    Warning: Could not move task ${task.id} (${task.name}) - may be a subtask`);
      }
    }
    console.log(`    Moved ${moved}, skipped ${failed}`);
  }
  console.log('');

  // Step 5: Move Nikolas's tasks from Project Kickoff to Archive
  console.log("Step 5: Moving Nikolas's tasks from Project Kickoff to Archive...");
  const kickoffTasks = await tasks.listByTasklist(PROJECT_KICKOFF_TASKLIST, {
    pageSize: 100,
    include: ['assignees']
  });
  let movedCount = 0;
  let failedCount = 0;
  for (const task of kickoffTasks.tasks) {
    // Check if task is assigned to Nikolas
    const isNikolasTask = task.assignees?.some(a => a.id === NIKOLAS_USER_ID);
    if (isNikolasTask) {
      try {
        await client.patch(`/projects/api/v3/tasks/${task.id}.json`, {
          task: { tasklistId: ARCHIVE_TASKLIST_ID }
        });
        movedCount++;
        console.log(`    Moved: ${task.name}`);
      } catch (e) {
        failedCount++;
        console.log(`    Warning: Could not move task ${task.id} (${task.name})`);
      }
    }
  }
  console.log(`  Moved ${movedCount} tasks, skipped ${failedCount}\n`);

  // Step 6: Delete emptied tasklists
  console.log("Step 6: Deleting emptied tasklists...");
  for (const tasklistId of ARCHIVE_AND_DELETE) {
    await client.delete(`/projects/api/v3/tasklists/${tasklistId}.json`);
    console.log(`  Deleted tasklist ${tasklistId}`);
  }
  console.log('');

  // Step 7: Create summary tasks in new sprint tasklists
  console.log("Step 7: Creating summary tasks in sprint tasklists...");
  for (const sprint of SPRINT_TASKS) {
    console.log(`  Creating tasks in tasklist ${sprint.tasklistId}...`);
    for (const taskDef of sprint.tasks) {
      await tasks.create(sprint.tasklistId, {
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

#!/usr/bin/env bun
/**
 * Finish restructuring - delete old tasklists and create summary tasks.
 */

import { createClientFromEnv } from './client.ts';
import { ProjectsResource } from './resources/projects.ts';
import { TasksResource } from './resources/tasks.ts';

const PROJECT_ID = 806515;

// Tasklists to delete (should be empty now)
const TASKLISTS_TO_DELETE = [
  2039117, // Storyblok CMS Development
  2039118, // Next.js Frontend Development
  2039120, // Integration & MediaLibrary
];

// Sprint tasks to create
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

  console.log(`Finishing PM project restructure (ID: ${PROJECT_ID})\n`);

  // Step 1: Delete emptied tasklists
  console.log("Step 1: Deleting emptied tasklists...");
  for (const tasklistId of TASKLISTS_TO_DELETE) {
    try {
      await client.delete(`/projects/api/v3/tasklists/${tasklistId}.json`);
      console.log(`  Deleted tasklist ${tasklistId}`);
    } catch (e: any) {
      console.log(`  Warning: Could not delete tasklist ${tasklistId}: ${e.message}`);
    }
  }
  console.log('');

  // Step 2: Create summary tasks in new sprint tasklists
  console.log("Step 2: Creating summary tasks in sprint tasklists...");
  for (const sprint of SPRINT_TASKS) {
    // Check if tasks already exist
    const existingTasks = await tasks.listByTasklist(sprint.tasklistId, { pageSize: 50 });
    if (existingTasks.tasks.length > 0) {
      console.log(`  Tasklist ${sprint.tasklistId} already has ${existingTasks.tasks.length} tasks, skipping...`);
      continue;
    }

    console.log(`  Creating tasks in tasklist ${sprint.tasklistId}...`);
    for (const taskDef of sprint.tasks) {
      await tasks.create(sprint.tasklistId, {
        name: taskDef.name,
        description: taskDef.description,
      });
    }
  }
  console.log('');

  console.log("Done! Final structure:");
  const finalTasklists = await projects.getTasklists(PROJECT_ID);
  for (const tl of finalTasklists.tasklists) {
    console.log(`  [${tl.id}] ${tl.name}`);
  }
}

main().catch(console.error);

#!/usr/bin/env bun
/**
 * Script to set up EXHAUSTO - AI Development project with all epics and stories.
 * Deadline: March 20, 2026 (all work must be done by then for testing)
 */

import { createClientFromEnv } from './client.ts';
import { ProjectsResource } from './resources/projects.ts';
import { TasksResource } from './resources/tasks.ts';

const PROJECT_ID = 806824;
const DEADLINE = new Date('2026-03-20');

// Calculate dates working backwards from deadline
// Total ~50 stories across 9 epics, ~7 weeks of work (Jan 29 - Mar 20)
const START_DATE = new Date('2026-01-29');

interface Story {
  name: string;
  description: string;
}

interface Epic {
  name: string;
  description: string;
  stories: Story[];
}

const EPICS: Epic[] = [
  {
    name: "Epic 1: Visual Editing Foundation",
    description: "Content editors can log in, create pages, preview, and publish using the visual editor.",
    stories: [
      { name: "Story 1.1: Initialize Next.js Project with Storyblok SDK", description: "Set up Next.js 16 with TypeScript, ESLint, App Router, PPR enabled, and @storyblok/react SDK configured." },
      { name: "Story 1.2: Dynamic Page Routing with Storyblok Content", description: "Implement catch-all route for Storyblok pages with content fetching and basic component rendering." },
      { name: "Story 1.3: Visual Editor Preview Integration", description: "Enable real-time preview in Storyblok visual editor with draft content support and bridge connection." },
      { name: "Story 1.4: Publish Workflow with Webhook Revalidation", description: "Implement /api/revalidate endpoint for Storyblok webhooks with revalidateTag() for content updates." },
    ]
  },
  {
    name: "Epic 2: Complete Component Library",
    description: "Content editors can build any page using all 29 components with 1:1 visual parity to existing site.",
    stories: [
      { name: "Story 2.1: CSS Architecture & Design Tokens", description: "Set up CSS foundation with design tokens, BEM patterns, fluid clamp responsive system (736px-1920px)." },
      { name: "Story 2.2: Layout Components (Header, Footer, Navigation)", description: "Build Header, Footer, and Navigation components with Radix NavigationMenu for dropdowns." },
      { name: "Story 2.3: Simple Content Components", description: "Implement Wysiwyg, CenteredImage, CustomHtml, and Seo components with proper styling." },
      { name: "Story 2.4: Interactive Components (Accordion, Slider, Carousel)", description: "Build Faq (Radix Accordion), Slider, and SocialCarousel with keyboard accessibility." },
      { name: "Story 2.5: Video Components", description: "Implement VideoSimple and MultiVideo components with responsive loading." },
      { name: "Story 2.6: CTA & Push Components", description: "Build CtaLong, PushNews, PushAdvantages, PushDocuments, SmallMultipush, LogoMultipush, MultipushSolutionsVertical, QuickActions." },
      { name: "Story 2.7: Content Section Components", description: "Implement Testimonial, IllustratedBenefits, ProjectReference, KeyFacts, Infographic, MultiContent, BlockToColumns, SolutionComponents, ServiceBlock, AnchorsBlock." },
      { name: "Story 2.8: Form Components (UI Only)", description: "Build Forms and ContactForm component layouts with validation UI (submission in Epic 7)." },
      { name: "Story 2.9: Responsive Layout Verification", description: "Verify all components scale smoothly with fluid clamp system across all viewport sizes." },
    ]
  },
  {
    name: "Epic 3: Multi-Country Site Delivery",
    description: "Visitors on any country domain see correct localized content; editors manage content per country.",
    stories: [
      { name: "Story 3.1: Domain-to-Country Routing Middleware", description: "Implement middleware to detect domain and set country context (dk, se, no, de, en)." },
      { name: "Story 3.2: Country-Based Storyblok Content Fetching", description: "Fetch content from country-specific Storyblok folders (/dk, /se, /no, /de, /en)." },
      { name: "Story 3.3: Country-Specific Layout and Navigation", description: "Display country-specific header, footer, and navigation content." },
      { name: "Story 3.4: Railway Multi-Domain Configuration", description: "Configure Railway deployment with all custom domains and SSL certificates." },
      { name: "Story 3.5: Environment & Domain Configuration", description: "Set up test, staging, and production environments with appropriate routing." },
    ]
  },
  {
    name: "Epic 4: Content Migration",
    description: "All existing static content is available in Storyblok for editors to manage.",
    stories: [
      { name: "Story 4.1: Content Migration Tooling Setup", description: "Build automated tooling to transform Ibexa YAML exports to Storyblok format." },
      { name: "Story 4.2: Media Asset Migration", description: "Migrate all images and documents to Storyblok asset library with URL mapping." },
      { name: "Story 4.3: Denmark Pilot Content Migration", description: "Migrate all Danish static pages to Storyblok /dk folder as pilot validation." },
      { name: "Story 4.3b: Remaining Countries Content Migration", description: "Migrate content for se, no, de, en countries after Denmark pilot validation." },
      { name: "Story 4.4: Denmark Global Content Migration (Header, Footer)", description: "Migrate Danish header and footer content to Storyblok." },
      { name: "Story 4.4b: Remaining Countries Global Content Migration", description: "Migrate header and footer for remaining countries." },
      { name: "Story 4.5: Denmark Migration Validation & Link Integrity", description: "Validate Danish migrated content accuracy, link integrity, and visual comparison." },
      { name: "Story 4.5b: Remaining Countries Migration Validation", description: "Validate all remaining country content after migration." },
    ]
  },
  {
    name: "Epic 5: Product Information & PIM Integration",
    description: "Visitors can browse products, view specifications, and download all documentation.",
    stories: [
      { name: "Story 5.0: Document Nextpage PIM Integration", description: "Document existing PHP sync: API endpoints, field mappings, sync rules, error handling." },
      { name: "Story 5.1: Nextpage PIM API Client", description: "Build JavaScript client for Nextpage PIM API with OAuth2 authentication." },
      { name: "Story 5.2: PIM to Storyblok Data Mapping", description: "Define and implement data mapping from PIM structures to Storyblok component schemas." },
      { name: "Story 5.3: Initial Product Data Load", description: "Load all product categories, products, and ranges into Storyblok." },
      { name: "Story 5.4: Product Document & Software Sync", description: "Sync product PDFs, manuals, software, and technical datasheets." },
      { name: "Story 5.5: Product Category Pages", description: "Build product category page templates with product listings." },
      { name: "Story 5.6: Product Detail Pages", description: "Build product detail pages with specifications, documents, and downloads." },
      { name: "Story 5.7: Related Products & Product Ranges", description: "Display related products and product range associations." },
      { name: "Story 5.8: Ongoing PIM Sync Service", description: "Implement Railway cron job for automatic PIM sync via /api/sync/pim." },
      { name: "Story 5.9: PIM Sync Error Handling & Reporting", description: "Implement continue-on-error handling with summary reporting." },
    ]
  },
  {
    name: "Epic 6: Search & Discovery",
    description: "Visitors can search for content/products and browse news articles.",
    stories: [
      { name: "Story 6.1: Algolia Integration Setup", description: "Configure Algolia client with search and admin keys, define index structure." },
      { name: "Story 6.2: Content & Product Indexing", description: "Index pages, products, and news articles in Algolia with sync on publish." },
      { name: "Story 6.3: Site Search UI", description: "Build instant search UI in header with results navigation." },
      { name: "Story 6.4: News Search Page (New Figma Design)", description: "Build news search page per Figma design with filtering and pagination." },
      { name: "Story 6.5: SEO Optimization for Product Pages", description: "Add meta tags, structured data, canonical URLs, and sitemap for products." },
    ]
  },
  {
    name: "Epic 7: Forms & Compliance",
    description: "Visitors can contact Exhausto and the site meets GDPR requirements.",
    stories: [
      { name: "Story 7.1: Contact Form Submission", description: "Implement form validation and submission with success/error feedback." },
      { name: "Story 7.2: Contact Form Backend Handler", description: "Build API route for form processing with email notification and country routing." },
      { name: "Story 7.3: Country Contact Information Display", description: "Display country-specific contact details in footer and contact pages." },
      { name: "Story 7.4: Didomi Cookie Consent Integration", description: "Integrate Didomi consent banner with accept/reject/customize options." },
      { name: "Story 7.5: Cookie Preference Enforcement", description: "Enforce cookie preferences for analytics and marketing scripts." },
    ]
  },
  {
    name: "Epic 8: Performance & Cache Optimization",
    description: "Site loads fast and content updates appear quickly after publishing.",
    stories: [
      { name: "Story 8.1: PPR Setup with Redis Cache Handler", description: "Configure PPR with @neshca/cache-handler for Redis, stable cache keys, cacheTag()." },
      { name: "Story 8.2: Storyblok Webhook Tag-Based Revalidation", description: "Implement revalidateTag() for granular content updates within 5 seconds." },
      { name: "Story 8.3: Cache Tag Strategy Implementation", description: "Implement tag patterns: story:{country}:{slug}, country:{code}, product:{id}, navigation." },
      { name: "Story 8.4: Performance Baseline & Monitoring", description: "Set up Core Web Vitals tracking and verify LCP < 2.5s, TTFB < 600ms." },
      { name: "Story 8.5: Storyblok API Cost Optimization", description: "Ensure API calls scale with content updates not traffic, high cache hit ratio." },
    ]
  },
  {
    name: "Epic 9: Launch & Rollback Strategy",
    description: "Safe cutover to the new site with ability to revert if critical issues arise.",
    stories: [
      { name: "Story 9.1: Rollback Strategy & DNS Cutover Plan", description: "Document DNS cutover procedure and rollback within 15 minutes." },
      { name: "Story 9.2: Pre-Launch Checklist & Go/No-Go Criteria", description: "Complete pre-launch checklist with stakeholder sign-off." },
      { name: "Story 9.3: Post-Launch Monitoring & Old Site Decommission", description: "Monitor transition period, verify PIM sync, decommission old site after approval." },
    ]
  },
];

// Calculate story dates - distribute evenly across available time
function calculateDates(epicIndex: number, storyIndex: number, totalStoriesInEpic: number): { start: string, due: string } {
  const totalDays = Math.floor((DEADLINE.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  const totalStories = EPICS.reduce((sum, e) => sum + e.stories.length, 0);

  // Count stories before this one
  let storiesBefore = 0;
  for (let i = 0; i < epicIndex; i++) {
    storiesBefore += EPICS[i].stories.length;
  }
  storiesBefore += storyIndex;

  const daysPerStory = totalDays / totalStories;
  const storyStartDay = Math.floor(storiesBefore * daysPerStory);
  // Ensure due date is at least 1 day after start
  const storyEndDay = Math.max(storyStartDay + 1, Math.floor((storiesBefore + 1) * daysPerStory));

  const startDate = new Date(START_DATE);
  startDate.setDate(startDate.getDate() + storyStartDay);

  const dueDate = new Date(START_DATE);
  dueDate.setDate(dueDate.getDate() + storyEndDay);

  // Ensure due date doesn't exceed deadline
  if (dueDate > DEADLINE) {
    dueDate.setTime(DEADLINE.getTime());
  }

  return {
    start: startDate.toISOString().split('T')[0],
    due: dueDate.toISOString().split('T')[0],
  };
}

async function main() {
  const client = createClientFromEnv(true);
  const projects = new ProjectsResource(client);
  const tasks = new TasksResource(client);

  console.log(`Setting up EXHAUSTO - AI Development project (ID: ${PROJECT_ID})`);
  console.log(`Timeline: ${START_DATE.toISOString().split('T')[0]} to ${DEADLINE.toISOString().split('T')[0]}`);
  console.log(`Total epics: ${EPICS.length}`);
  console.log(`Total stories: ${EPICS.reduce((sum, e) => sum + e.stories.length, 0)}`);
  console.log('');

  // Get existing tasklists to avoid duplicates
  console.log('Checking existing tasklists...');
  const existingTasklists = await projects.getTasklists(PROJECT_ID);
  const tasklistLookup = new Map<string, number>();
  for (const tl of existingTasklists.tasklists) {
    tasklistLookup.set(tl.name, tl.id);
  }
  console.log(`Found ${existingTasklists.tasklists.length} existing tasklists\n`);

  for (let epicIndex = 0; epicIndex < EPICS.length; epicIndex++) {
    const epic = EPICS[epicIndex];

    // Check if tasklist already exists
    let tasklistId = tasklistLookup.get(epic.name);
    if (tasklistId) {
      console.log(`Tasklist exists: ${epic.name} (ID: ${tasklistId})`);
    } else {
      // Create tasklist for epic
      console.log(`Creating tasklist: ${epic.name}...`);
      const tasklistResult = await projects.createTasklist(PROJECT_ID, {
        name: epic.name,
        description: epic.description,
      });
      tasklistId = parseInt(tasklistResult.id);
      console.log(`  Created tasklist ID: ${tasklistId}`);
    }

    // Get existing tasks in this tasklist
    const existingTasks = await tasks.listByTasklist(tasklistId, { pageSize: 100 });
    const existingTaskNames = new Set(existingTasks.tasks.map(t => t.name));

    // Create tasks for each story
    for (let storyIndex = 0; storyIndex < epic.stories.length; storyIndex++) {
      const story = epic.stories[storyIndex];
      const dates = calculateDates(epicIndex, storyIndex, epic.stories.length);

      if (existingTaskNames.has(story.name)) {
        console.log(`  Task exists: ${story.name}`);
        continue;
      }

      console.log(`  Creating task: ${story.name} (${dates.start} - ${dates.due})...`);
      const task = await tasks.create(tasklistId, {
        name: story.name,
        description: story.description,
        startDate: dates.start,
        dueDate: dates.due,
      });
      console.log(`    Created task ID: ${task.id}`);
    }

    console.log('');
  }

  console.log('Done! All epics and stories created.');
}

main().catch(console.error);

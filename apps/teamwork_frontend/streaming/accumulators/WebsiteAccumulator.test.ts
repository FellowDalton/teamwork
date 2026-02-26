/**
 * Unit tests for WebsiteAccumulator
 *
 * Verifies that NDJSON website lines are correctly accumulated
 * into a WebsiteDraftState structure.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { WebsiteAccumulator, WEBSITE_LINE_TYPES } from './WebsiteAccumulator';
import type { WebsiteDraftState, WebsiteLine } from './WebsiteAccumulator';

describe('WebsiteAccumulator', () => {
  let accumulator: WebsiteAccumulator;

  beforeEach(() => {
    accumulator = new WebsiteAccumulator();
  });

  it('should have correct identity', () => {
    expect(accumulator.id).toBe('website');
    expect(accumulator.displayName).toBe('Website Builder');
  });

  it('should accept website line types', () => {
    expect(accumulator.accepts({ type: 'website_meta', title: 'Test' })).toBe(true);
    expect(accumulator.accepts({ type: 'website_page', id: 'p1', title: 'Home', route: '/' })).toBe(true);
    expect(accumulator.accepts({ type: 'website_section', id: 's1', pageId: 'p1', component: 'hero', props: {} })).toBe(true);
    expect(accumulator.accepts({ type: 'website_complete' })).toBe(true);
  });

  it('should reject non-website line types', () => {
    expect(accumulator.accepts({ type: 'project', name: 'Test' })).toBe(false);
    expect(accumulator.accepts({ type: 'tasklist', id: 'tl-1', name: 'Phase' })).toBe(false);
    expect(accumulator.accepts({ type: 'unknown' })).toBe(false);
  });

  describe('website_meta', () => {
    it('should set meta information', () => {
      const state = accumulator.processLine({
        type: 'website_meta',
        title: 'My Portfolio',
        description: 'A personal portfolio site',
        theme: 'dark',
      });

      expect(state.meta.title).toBe('My Portfolio');
      expect(state.meta.description).toBe('A personal portfolio site');
      expect(state.meta.theme).toBe('dark');
      expect(state.isBuilding).toBe(true);
    });
  });

  describe('website_page', () => {
    it('should add pages', () => {
      accumulator.processLine({ type: 'website_meta', title: 'Test' });
      const state = accumulator.processLine({
        type: 'website_page',
        id: 'home',
        title: 'Home',
        route: '/',
      });

      expect(state.pages).toHaveLength(1);
      expect(state.pages[0].id).toBe('home');
      expect(state.pages[0].title).toBe('Home');
      expect(state.pages[0].route).toBe('/');
      expect(state.pages[0].sections).toEqual([]);
    });

    it('should not duplicate pages with same id', () => {
      accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home', route: '/' });
      const state = accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home Updated', route: '/' });

      expect(state.pages).toHaveLength(1);
    });
  });

  describe('website_section', () => {
    it('should add sections to existing pages', () => {
      accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home', route: '/' });
      const state = accumulator.processLine({
        type: 'website_section',
        id: 's-1',
        pageId: 'home',
        component: 'hero',
        props: { heading: 'Welcome', subheading: 'To my site' },
      });

      expect(state.pages[0].sections).toHaveLength(1);
      expect(state.pages[0].sections[0].component).toBe('hero');
      expect(state.pages[0].sections[0].props.heading).toBe('Welcome');
    });

    it('should auto-create page if section arrives before page declaration', () => {
      const state = accumulator.processLine({
        type: 'website_section',
        id: 's-1',
        pageId: 'about',
        component: 'text',
        props: { content: 'About us' },
      });

      expect(state.pages).toHaveLength(1);
      expect(state.pages[0].id).toBe('about');
      expect(state.pages[0].sections).toHaveLength(1);
    });

    it('should add multiple sections to the same page', () => {
      accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home', route: '/' });
      accumulator.processLine({ type: 'website_section', id: 's-1', pageId: 'home', component: 'hero', props: {} });
      const state = accumulator.processLine({ type: 'website_section', id: 's-2', pageId: 'home', component: 'features', props: { items: [1, 2, 3] } });

      expect(state.pages[0].sections).toHaveLength(2);
      expect(state.pages[0].sections[1].component).toBe('features');
    });
  });

  describe('website_complete', () => {
    it('should mark building as complete', () => {
      accumulator.processLine({ type: 'website_meta', title: 'Test' });
      expect(accumulator.isComplete()).toBe(false);

      const state = accumulator.processLine({ type: 'website_complete', message: 'Website ready!' });

      expect(accumulator.isComplete()).toBe(true);
      expect(state.isBuilding).toBe(false);
      expect(state.message).toBe('Website ready!');
    });
  });

  describe('full workflow', () => {
    it('should build complete website structure', () => {
      accumulator.processLine({ type: 'website_meta', title: 'My Site', description: 'A test site', theme: 'dark' });
      accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home', route: '/' });
      accumulator.processLine({ type: 'website_section', id: 's-1', pageId: 'home', component: 'hero', props: { heading: 'Welcome' } });
      accumulator.processLine({ type: 'website_section', id: 's-2', pageId: 'home', component: 'features', props: { items: ['a', 'b'] } });
      accumulator.processLine({ type: 'website_page', id: 'about', title: 'About', route: '/about' });
      accumulator.processLine({ type: 'website_section', id: 's-3', pageId: 'about', component: 'text', props: { content: 'About us' } });
      const state = accumulator.processLine({ type: 'website_complete', message: 'Your website is ready to preview' });

      expect(state.meta.title).toBe('My Site');
      expect(state.meta.theme).toBe('dark');
      expect(state.pages).toHaveLength(2);
      expect(state.pages[0].sections).toHaveLength(2);
      expect(state.pages[1].sections).toHaveLength(1);
      expect(state.isBuilding).toBe(false);
      expect(state.message).toBe('Your website is ready to preview');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      accumulator.processLine({ type: 'website_meta', title: 'Test' });
      accumulator.processLine({ type: 'website_page', id: 'home', title: 'Home', route: '/' });
      accumulator.processLine({ type: 'website_complete' });

      accumulator.reset();

      const state = accumulator.getState();
      expect(state.meta.title).toBe('');
      expect(state.pages).toHaveLength(0);
      expect(state.isBuilding).toBe(true);
      expect(accumulator.isComplete()).toBe(false);
    });
  });
});

/**
 * React hooks for fetching Teamwork data
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  teamworkService, 
  TeamworkProject, 
  TeamworkTask, 
  TeamworkStage,
  TeamworkTimeEntry,
  ProjectWithDetails 
} from '../services/teamworkService';

interface UseDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch all active projects
 */
export function useProjects(): UseDataResult<TeamworkProject[]> {
  const [data, setData] = useState<TeamworkProject[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projects = await teamworkService.getProjects();
      setData(projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook to fetch a single project with details
 */
export function useProject(projectId: number | null): UseDataResult<ProjectWithDetails> {
  const [data, setData] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const project = await teamworkService.getProject(projectId);
      setData(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook to fetch tasks for a project
 */
export function useProjectTasks(projectId: number | null): UseDataResult<TeamworkTask[]> {
  const [data, setData] = useState<TeamworkTask[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!projectId) {
      setData(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const tasks = await teamworkService.getProjectTasks(projectId);
      setData(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook to fetch time entries
 */
export function useTimeEntries(projectId?: number): UseDataResult<TeamworkTimeEntry[]> {
  const [data, setData] = useState<TeamworkTimeEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const entries = await teamworkService.getTimeEntries(projectId);
      setData(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch time entries');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for logging time with optimistic updates
 */
export function useLogTime() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logTime = useCallback(async (
    taskId: number,
    hours: number,
    description: string,
    isBillable: boolean = true
  ): Promise<TeamworkTimeEntry | null> => {
    setLoading(true);
    setError(null);
    try {
      const entry = await teamworkService.logTime(taskId, hours, description, isBillable);
      return entry;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log time');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { logTime, loading, error };
}

/**
 * Hook for API health check
 */
export function useApiHealth() {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [details, setDetails] = useState<{
    hasTeamworkConfig: boolean;
    hasAnthropicConfig: boolean;
  } | null>(null);

  useEffect(() => {
    teamworkService.checkHealth()
      .then((result) => {
        setHealthy(result.status === 'ok');
        setDetails({
          hasTeamworkConfig: result.hasTeamworkConfig,
          hasAnthropicConfig: result.hasAnthropicConfig,
        });
      })
      .catch(() => {
        setHealthy(false);
      });
  }, []);

  return { healthy, details };
}

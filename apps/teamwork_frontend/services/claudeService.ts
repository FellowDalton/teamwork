import { Project, Task } from "../types";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Helper to call Claude API
async function callClaude(
  systemPrompt: string,
  userMessage: string,
  tools?: any[]
): Promise<any> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      ...(tools && { tools }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  return response.json();
}

// Generate project structure
export const generateProjectStructure = async (
  prompt: string
): Promise<Partial<Project>> => {
  try {
    const systemPrompt = `You are an expert project manager. Generate realistic, detailed project structures.
Always respond with valid JSON matching this exact structure:
{
  "name": "string",
  "description": "string",
  "stages": [
    {
      "name": "string",
      "tasks": [
        {
          "title": "string",
          "description": "string",
          "priority": "low" | "medium" | "high",
          "tags": ["string"]
        }
      ]
    }
  ]
}`;

    const userMessage = `Create a comprehensive project management board structure for a project described as: "${prompt}".
Include 4-6 typical workflow stages (e.g., Backlog, Design, Dev, QA, Done) appropriate for this type of project.
Populate each stage with 2-3 realistic sample tasks.
Respond ONLY with the JSON, no other text.`;

    const response = await callClaude(systemPrompt, userMessage);

    const textContent = response.content.find(
      (c: any) => c.type === "text"
    )?.text;
    if (!textContent) throw new Error("No response from AI");

    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const data = JSON.parse(jsonStr.trim());

    // Transform to internal model with IDs
    return {
      name: data.name,
      description: data.description,
      stages: data.stages.map((stage: any, index: number) => ({
        id: `stage-${Date.now()}-${index}`,
        name: stage.name,
        tasks: stage.tasks.map((task: any, tIndex: number) => ({
          id: `task-${Date.now()}-${index}-${tIndex}`,
          title: task.title,
          description: task.description || "",
          priority: task.priority as "low" | "medium" | "high",
          tags: task.tags || [],
          assignedTo: `https://picsum.photos/seed/${Math.random()}/32/32`,
          timeLogs: [],
          comments: [],
        })),
      })),
    };
  } catch (error) {
    console.error("Failed to generate project:", error);
    throw error;
  }
};

export const suggestNextTask = async (
  currentTasks: string[],
  projectContext: string
): Promise<Task> => {
  try {
    const systemPrompt = `You are a project management assistant. Suggest logical next tasks for projects.
Always respond with valid JSON matching this exact structure:
{
  "title": "string",
  "description": "string",
  "priority": "low" | "medium" | "high",
  "tags": ["string"]
}`;

    const userMessage = `Given the project context: "${projectContext}" and existing tasks: ${JSON.stringify(currentTasks)}, suggest a new, logical next task.
Respond ONLY with the JSON, no other text.`;

    const response = await callClaude(systemPrompt, userMessage);

    const textContent = response.content.find(
      (c: any) => c.type === "text"
    )?.text;
    if (!textContent) throw new Error("No response from AI");

    // Extract JSON from response
    let jsonStr = textContent;
    const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const taskData = JSON.parse(jsonStr.trim());

    return {
      id: `task-gen-${Date.now()}`,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      tags: taskData.tags,
      assignedTo: `https://picsum.photos/seed/${Date.now()}/32/32`,
      timeLogs: [],
      comments: [],
    };
  } catch (e) {
    console.error(e);
    throw new Error("Failed to suggest task");
  }
};

// --- Chat & Time Logging Capability ---

const tools = [
  {
    name: "logWork",
    description:
      "Log working hours to a specific task and add a comment. Detects if hours are billable (default true unless specified otherwise).",
    input_schema: {
      type: "object",
      properties: {
        taskName: {
          type: "string",
          description:
            "The name of the task to log time for. Try to fuzzy match based on user input.",
        },
        hours: { type: "number", description: "Number of hours to log." },
        comment: {
          type: "string",
          description: "A comment describing the work done.",
        },
        isBillable: {
          type: "boolean",
          description: "Whether the hours are billable.",
        },
      },
      required: ["hours", "comment"],
    },
  },
  {
    name: "createProject",
    description:
      "Create a new project with a structured workflow (stages and tasks) based on the user's description.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "The name of the project" },
        description: {
          type: "string",
          description: "A description of the project",
        },
        stages: {
          type: "array",
          description: "The workflow stages of the project",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description:
                  "Name of the workflow stage (e.g. 'To Do', 'In Progress')",
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high"] },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["title", "priority", "tags"],
                },
              },
            },
            required: ["name", "tasks"],
          },
        },
      },
      required: ["name", "description", "stages"],
    },
  },
];

export interface ToolCallResponse {
  type: "tool_call";
  functionName: string;
  args: any;
  text?: string;
}

export interface TextResponse {
  type: "text";
  text: string;
}

export const processChatCommand = async (
  message: string,
  systemContext: string
): Promise<ToolCallResponse | TextResponse> => {
  try {
    const systemPrompt = `You are an advanced Project AI assistant integrated into a Kanban-style workflow app.

CURRENT APP CONTEXT:
${systemContext}

CAPABILITIES:
1. Log Work: If the user mentions working, hours, or logging time, use 'logWork'. Match task names fuzzily.
2. Create Project: If the user wants to start a new project, plan, or workflow, use 'createProject'. You must generate the full structure (stages/tasks) in the tool call arguments based on their request.
3. General Advice: Answer questions about project management, suggest improvements to the current board, or explain features.

BEHAVIOR:
- Be concise and professional, like a hardware synth interface.
- If the user asks to create a project, don't ask for every detail. Infer a good structure from their high-level description and call the tool.
- If the user is vague about a task for logging time, ask for clarification or make a best guess if obvious.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: message }],
        tools,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${error}`);
    }

    const data = await response.json();

    // Check for tool use
    const toolUse = data.content.find((c: any) => c.type === "tool_use");

    if (toolUse) {
      return {
        type: "tool_call",
        functionName: toolUse.name,
        args: toolUse.input,
        text: "Command received. Processing logic...",
      };
    }

    // Return text response
    const textContent = data.content.find((c: any) => c.type === "text")?.text;
    return {
      type: "text",
      text: textContent || "I'm not sure how to help with that.",
    };
  } catch (error) {
    console.error("Chat Error:", error);
    return { type: "text", text: "System Error: Connection interrupted." };
  }
};

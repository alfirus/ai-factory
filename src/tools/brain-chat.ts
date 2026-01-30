import { isBrainAvailable, loadPersona, loadCoreRules, searchKnowledge } from "../brain/loader.js";

export interface BrainChatOptions {
  persona?: string;
  modules?: ("persona" | "rules" | "knowledge")[];
  knowledgeQuery?: string;
}

export async function buildBrainSystemPrompt(options: BrainChatOptions = {}): Promise<string> {
  if (!isBrainAvailable()) {
    return "";
  }

  const modules = options.modules || ["persona", "rules"];
  const parts: string[] = [];

  // Load persona
  if (modules.includes("persona")) {
    const persona = loadPersona(options.persona || "default");
    if (persona) {
      parts.push("## Persona\n" + persona);
    }
  }

  // Load core rules
  if (modules.includes("rules")) {
    const rules = loadCoreRules();
    if (rules) {
      parts.push("## Rules\n" + rules);
    }
  }

  // Search knowledge if requested
  if (modules.includes("knowledge") && options.knowledgeQuery) {
    const knowledge = searchKnowledge(options.knowledgeQuery);
    if (knowledge.length > 0) {
      const knowledgeText = knowledge.map((k) => `### ${k.file}\n${k.preview}`).join("\n\n");
      parts.push("## Relevant Knowledge\n" + knowledgeText);
    }
  }

  return parts.join("\n\n---\n\n");
}

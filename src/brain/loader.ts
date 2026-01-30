import fs from "fs";
import path from "path";
import { config } from "../utils/config.js";
import { logger } from "../utils/logger.js";

export function isBrainAvailable(): boolean {
  if (!config.AI_BRAIN_PATH) return false;
  try {
    const stats = fs.statSync(config.AI_BRAIN_PATH);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export function loadPersona(name: string = "default"): string {
  if (!isBrainAvailable()) {
    logger.warn("Brain not available, returning empty persona");
    return "";
  }

  try {
    const personaPath = path.join(config.AI_BRAIN_PATH, "personas", `${name}.md`);
    if (!fs.existsSync(personaPath)) {
      logger.warn(`Persona file not found: ${personaPath}`);
      return "";
    }
    const content = fs.readFileSync(personaPath, "utf-8");
    logger.debug(`Loaded persona: ${name}`);
    return content;
  } catch (error) {
    logger.error("Error loading persona", error);
    return "";
  }
}

export function loadCoreRules(): string {
  if (!isBrainAvailable()) {
    logger.warn("Brain not available, returning empty rules");
    return "";
  }

  try {
    const rulesPath = path.join(config.AI_BRAIN_PATH, "rules", "core.md");
    if (!fs.existsSync(rulesPath)) {
      logger.warn(`Core rules file not found: ${rulesPath}`);
      return "";
    }
    const content = fs.readFileSync(rulesPath, "utf-8");
    logger.debug("Loaded core rules");
    return content;
  } catch (error) {
    logger.error("Error loading core rules", error);
    return "";
  }
}

export function searchKnowledge(query: string): Array<{ file: string; preview: string }> {
  if (!isBrainAvailable()) {
    logger.warn("Brain not available, search returned empty results");
    return [];
  }

  const results: Array<{ file: string; preview: string }> = [];
  const knowledgePath = path.join(config.AI_BRAIN_PATH, "knowledge");

  if (!fs.existsSync(knowledgePath)) {
    logger.warn(`Knowledge directory not found: ${knowledgePath}`);
    return results;
  }

  try {
    const searchRecursive = (dir: string) => {
      const entries = fs.readdirSync(dir);

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        const stats = fs.statSync(fullPath);

        if (stats.isDirectory()) {
          searchRecursive(fullPath);
        } else if (entry.endsWith(".md")) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const lowerContent = content.toLowerCase();
            const lowerQuery = query.toLowerCase();

            if (lowerContent.includes(lowerQuery)) {
              const relPath = path.relative(knowledgePath, fullPath);
              // Extract a preview around the first match
              const matchIndex = lowerContent.indexOf(lowerQuery);
              const previewStart = Math.max(0, matchIndex - 100);
              const previewEnd = Math.min(content.length, matchIndex + 200);
              const preview = content.substring(previewStart, previewEnd).trim();

              results.push({
                file: relPath,
                preview: `...${preview}...`,
              });
            }
          } catch (err) {
            logger.warn(`Error reading file ${fullPath}`, err);
          }
        }
      }
    };

    searchRecursive(knowledgePath);
    logger.debug(`Knowledge search for "${query}" found ${results.length} results`);
  } catch (error) {
    logger.error("Error searching knowledge", error);
  }

  return results;
}

export type ReviewFocus = "bugs" | "security" | "perf" | "style" | "all";

export function buildReviewPrompt(code: string, language?: string, focus?: ReviewFocus): string {
  const langHint = language ? ` (${language})` : "";
  const focusMap: Record<ReviewFocus, string> = {
    bugs: "focus on identifying potential bugs, logical errors, and edge cases",
    security: "focus on security vulnerabilities, injection attacks, and unsafe patterns",
    perf: "focus on performance issues, inefficient algorithms, and resource usage",
    style: "focus on code style, naming conventions, and readability",
    all: "provide a comprehensive review covering bugs, security, performance, and style",
  };

  const focusText = focus ? focusMap[focus] : focusMap.all;

  return `Please review the following code${langHint}. ${focusText}.

\`\`\`
${code}
\`\`\`

Provide constructive feedback with specific examples and suggestions for improvement.`;
}

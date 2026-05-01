import type { Sport } from "@/types";
import type { RuleKnowledge } from "@/lib/ruleRetrieval";

export interface BuildFoulAnalysisPromptInput {
  sport: Sport;
  callOnField?: string;
  suspectedFoul?: string;
  description?: string;
  relevantRules: RuleKnowledge[];
}

function formatRules(rules: RuleKnowledge[]) {
  return rules
    .map(
      (rule) => `Rule ID: ${rule.id}
Rule name: ${rule.rule_name}
Foul type: ${rule.foul_type}
Summary: ${rule.plain_english_summary}
Criteria:
${rule.criteria_checklist.map((criterion) => `- ${criterion}`).join("\n")}
Official reference: ${rule.official_rule_reference}`
    )
    .join("\n\n");
}

export function buildFoulAnalysisPrompt({
  sport,
  callOnField,
  suspectedFoul,
  description,
  relevantRules,
}: BuildFoulAnalysisPromptInput): string {
  const rulesText =
    relevantRules.length > 0
      ? formatRules(relevantRules)
      : "No specific rule snippets were retrieved. Use INCONCLUSIVE unless the visible evidence is clear.";

  return `You are RefCheck AI, a careful ${sport} officiating analyst.

Analyze the video evidence using only the retrieved rules below.

Context:
- Sport: ${sport}
- Call on field: ${callOnField || "Unknown / not provided"}
- Suspected foul or call: ${suspectedFoul || "Unknown / not provided"}
- User description: ${description || "No description provided"}

Retrieved rules:
${rulesText}

Required reasoning order:
1. Observe visible evidence first. Describe only what can be seen in the clip.
2. Identify uncertainty from angle, blur, occlusion, missing contact, missing timing, or incomplete camera coverage.
3. Apply each relevant rule criterion to the visible evidence.
4. Decide whether the evidence supports LEGAL, ILLEGAL, or INCONCLUSIVE.

Return strict JSON only. No markdown, no preamble, no trailing commentary.

JSON schema:
{
  "decision": "LEGAL" | "ILLEGAL" | "INCONCLUSIVE",
  "confidence": <number from 0 to 100>,
  "visible_evidence": ["<observable fact>", "..."],
  "uncertainties": ["<reason judgment may be limited>", "..."],
  "applied_rules": [
    {
      "rule_id": "<retrieved rule id>",
      "rule_name": "<retrieved rule name>",
      "criteria_met": ["<criterion supported by evidence>", "..."],
      "criteria_not_met": ["<criterion not supported or contradicted>", "..."],
      "official_rule_reference": "<official reference>"
    }
  ],
  "reasoning": "<short plain-English explanation>"
}

Decision rules:
- Use LEGAL only when visible evidence clearly shows no violation/foul under the retrieved criteria.
- Use ILLEGAL only when visible evidence clearly satisfies the required foul or violation criteria.
- Use INCONCLUSIVE when the evidence is unclear, the key contact/timing is hidden, the clip is blurry, or the camera angle cannot establish the rule criteria.
- Lower confidence when video angle, blur, occlusion, missing contact, or missing timing makes judgment uncertain.
- Do not invent rule references. Use only the retrieved rules.`;
}

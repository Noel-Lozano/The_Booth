import basketballRules from "@/rules/basketball.json";
import soccerRules from "@/rules/soccer.json";
import type { Sport } from "@/types";

export interface RuleKnowledge {
  id: string;
  sport: Sport;
  rule_name: string;
  foul_type: string;
  plain_english_summary: string;
  criteria_checklist: string[];
  official_rule_reference: string;
}

export interface FindRelevantRulesInput {
  sport: Sport;
  suspectedFoul?: string;
  description?: string;
}

const RULES_BY_SPORT: Partial<Record<Sport, RuleKnowledge[]>> = {
  basketball: basketballRules as RuleKnowledge[],
  soccer: soccerRules as RuleKnowledge[],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ");
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[\s-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

function getSearchText(rule: RuleKnowledge) {
  return [
    rule.rule_name,
    rule.foul_type,
    rule.plain_english_summary,
    rule.criteria_checklist.join(" "),
    rule.official_rule_reference,
  ].join(" ");
}

function scoreRule(rule: RuleKnowledge, queryTokens: string[]) {
  const searchText = normalize(getSearchText(rule));
  return queryTokens.reduce((score, token) => {
    if (normalize(rule.rule_name).includes(token)) return score + 4;
    if (normalize(rule.foul_type).includes(token)) return score + 3;
    if (searchText.includes(token)) return score + 1;
    return score;
  }, 0);
}

export function getRulesForSport(sport: Sport): RuleKnowledge[] {
  return RULES_BY_SPORT[sport] ?? [];
}

export function findRelevantRules({
  sport,
  suspectedFoul = "",
  description = "",
}: FindRelevantRulesInput): RuleKnowledge[] {
  const rules = getRulesForSport(sport);
  const queryTokens = tokenize(`${suspectedFoul} ${description}`);

  if (queryTokens.length === 0) {
    return rules.slice(0, 4);
  }

  const scoredRules = rules
    .map((rule) => ({ rule, score: scoreRule(rule, queryTokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scoredRules.length > 0
    ? scoredRules.slice(0, 4).map(({ rule }) => rule)
    : rules.slice(0, 3);
}

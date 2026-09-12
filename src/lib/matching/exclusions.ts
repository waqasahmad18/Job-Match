import { EXCLUSION_PATTERNS } from "@/lib/constants";

const TITLE_EXCLUSIONS = [
  "wordpress",
  "shopify",
  "woocommerce",
  "elementor",
  "wp developer",
  "shopify developer",
];

function countMentions(text: string, terms: string[]) {
  return terms.reduce((total, term) => {
    const matches = text.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"));
    return total + (matches?.length || 0);
  }, 0);
}

export function evaluateHardReject(input: {
  title: string;
  description: string;
  tags?: string[];
  excludedTechnologies?: string[];
  targetTechnologies?: string[];
}) {
  const title = input.title.toLowerCase();
  const description = `${input.description} ${(input.tags || []).join(" ")}`.toLowerCase();
  const excluded = (input.excludedTechnologies || EXCLUSION_PATTERNS).map((item) =>
    item.toLowerCase(),
  );
  const targets = (input.targetTechnologies || []).map((item) => item.toLowerCase());

  if (TITLE_EXCLUSIONS.some((term) => title.includes(term))) {
    return {
      rejected: true,
      reason: "Primary title focus is WordPress/Shopify-related work.",
    };
  }

  const exclusionHits = countMentions(description, excluded);
  const targetHits = countMentions(description, targets.length ? targets : ["react", "next.js", "node", "laravel", "django"]);

  if (exclusionHits >= 4 && exclusionHits > targetHits * 1.5) {
    return {
      rejected: true,
      reason: "Job description is primarily WordPress/Shopify administration or theme work.",
    };
  }

  return { rejected: false, reason: "" };
}

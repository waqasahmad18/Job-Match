const PKR_PER_USD = 280;

const SALARY_CONTEXT =
  /(?:salary|compensation|ctc|stipend|package|remuneration|rs\.?|pkr|rupees?|\$|usd|dollars?|lacs?|lakhs?|\/\s*(?:mo|month|yr|year)|per\s+(?:month|year|annum))/i;

const NON_SALARY_CONTEXT =
  /(?:employees?|organizations?|compan(?:y|ies)|users|customers|people|engineers|developers|founded|since|over|more than|countries|offices)/i;

function toPkr(amount: number, unit: string) {
  if (unit === "usd") return amount * PKR_PER_USD;
  if (unit === "lac" || unit === "lakh") return amount * 100_000;
  if (unit === "k") return amount * 1000;
  return amount;
}

export function evaluateMinimumSalary(text: string, minimumPkr = 80_000) {
  const haystack = text.toLowerCase().replace(/,/g, "");
  const matches = [
    ...haystack.matchAll(/(\$)?\s*(\d+(?:\.\d+)?)\s*(lacs?|lakhs?|k|usd|dollars?|pkr|rs\.?)?/gi),
  ];

  const amounts = matches
    .map((match) => {
      const raw = match[0];
      const start = Math.max(0, (match.index || 0) - 28);
      const end = Math.min(haystack.length, (match.index || 0) + raw.length + 28);
      const window = haystack.slice(start, end);
      if (!SALARY_CONTEXT.test(window) && !raw.includes("$")) return null;
      if (NON_SALARY_CONTEXT.test(window) && !/(salary|compensation|\$|pkr|rs\.?|usd)/i.test(window)) {
        return null;
      }

      const value = Number(match[2]);
      if (!Number.isFinite(value) || value <= 0) return null;
      const unit = (match[3] || "").toLowerCase();
      const normalizedUnit =
        unit.startsWith("lac") || unit.startsWith("lakh")
          ? "lac"
          : unit === "k"
            ? "k"
            : unit.includes("usd") || unit.includes("dollar") || Boolean(match[1]) || raw.includes("$")
              ? "usd"
              : value >= 1000
                ? "pkr"
                : value <= 300
                  ? "k"
                  : "pkr";
      return toPkr(value, normalizedUnit);
    })
    .filter((value): value is number => Boolean(value))
    .filter((value) => value >= 15_000 && value <= 5_000_000);

  if (!amounts.length) {
    return { allowed: true, offeredPkr: null, reason: "Salary not stated; treated as eligible." };
  }

  const starting = Math.min(...amounts);
  if (starting < minimumPkr) {
    return {
      allowed: false,
      offeredPkr: starting,
      reason: `Starting salary ${Math.round(starting).toLocaleString()} PKR is below the ${minimumPkr.toLocaleString()} PKR minimum.`,
    };
  }

  return {
    allowed: true,
    offeredPkr: starting,
    reason: `Starting salary ${Math.round(starting).toLocaleString()} PKR meets the minimum.`,
  };
}

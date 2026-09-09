/** All money is integer minor units (cents). Never float. */

export function roundCents(n: number): number {
  return Math.round(n);
}

export function formatMoney(cents: number, symbol: string): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const withCommas = whole.toLocaleString("en-US");
  return `${sign}${symbol}${withCommas}.${frac}`;
}

const ONES = [
  "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
  "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
  "seventeen", "eighteen", "nineteen",
];
const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety",
];
const SCALES = ["", "thousand", "million", "billion"];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${ONES[hundreds]} hundred`);
  if (rest > 0) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const tens = Math.floor(rest / 10);
      const ones = rest % 10;
      parts.push(ones > 0 ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens]);
    }
  }
  return parts.join(" ");
}

function capitalizeFirst(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** e.g. amountInWords(7127) -> "Seventy-one and 27/100" */
export function amountInWords(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = String(Math.abs(cents) % 100).padStart(2, "0");

  let wholeWords: string;
  if (whole === 0) {
    wholeWords = "Zero";
  } else {
    const groups: number[] = [];
    let n = whole;
    while (n > 0) {
      groups.unshift(n % 1000);
      n = Math.floor(n / 1000);
    }
    const scaleOffset = groups.length - 1;
    const parts: string[] = [];
    groups.forEach((g, i) => {
      if (g === 0) return;
      const scale = SCALES[scaleOffset - i];
      parts.push(scale ? `${threeDigitsToWords(g)} ${scale}` : threeDigitsToWords(g));
    });
    wholeWords = parts.join(" ");
  }
  const sign = cents < 0 ? "Negative " : "";
  return `${sign}${capitalizeFirst(wholeWords)} and ${frac}/100`;
}

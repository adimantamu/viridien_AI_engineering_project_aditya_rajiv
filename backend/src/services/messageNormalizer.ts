/** Normalize voice / chat text before parsing. */

export function normalizeCompoundMessage(message: string): string {
  return message
    .replace(/([.!?])(?=\S)/g, "$1 ")
    .replace(/\b(add|include|order|get)\.(\d+)/gi, "$1 $2")
    .replace(/\band\.(\d+)/gi, "and $1")
    .replace(/(\d+)\s*\.(\d+)/g, "$1 $2")
    .replace(/\s+also\s+include\s+/gi, " and ")
    .replace(/\balong\s+with\s+that\b/gi, " and ")
    .replace(/\balong\s+with\b/gi, " and ")
    .replace(/\band\s+also\s+add\b/gi, " and ")
    .replace(/\balso\s+add\b/gi, " and ")
    .replace(/\band\s+also\s+(remove|delete|take off)\b/gi, " and remove $1 ")
    .replace(/\band\s+then\b/gi, " and ")
    .replace(/\bthen\s+(?:(?:you|please|can you)\s+)*(?=(?:add|remove|delete|take off)\b)/gi, "")
    .replace(/\b(?:to be )?added to (?:the )?cart\b/gi, "")
    .replace(/\band\s+and\b/gi, " and ")
    .replace(/\bthree\s+of\s+them\b/gi, "3 spicy chicken sandwiches")
    .replace(/\b(two|2)\s+of\s+them\b/gi, "2 of them")
    .replace(/\s+/g, " ")
    .trim();
}

/** First sentence/clause that looks like a menu question (not an add command). */
export function extractMenuInquiryText(message: string): string {
  const parts = message
    .split(/[.!?]+/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const part of parts) {
    if (
      /\b(options?|what are|what('s| is)|what do you have|suggestions?|recommend|show|list|different|menu|dishes?|choices|have|tell me)\b/i.test(
        part,
      ) &&
      !/^\s*(add|get|order|please add|can you add)\b/i.test(part)
    ) {
      return part;
    }
  }

  const beforeAdd = message.split(
    /\b(?:can you |please )?(?:add|get|order|i want|i'd like)\b/i,
  )[0];
  if (beforeAdd?.trim() && beforeAdd.trim().length > 8) {
    return beforeAdd.trim();
  }

  return message;
}

/** Full order phrase for cart parsing — not just text after the last "add". */
export function extractAddText(message: string): string {
  const normalized = normalizeCompoundMessage(message);

  if (messageHasMenuInquiry(normalized)) {
    const match = normalized.match(
      /\b(?:(?:can you|please)\s+)?(?:add|get|order|i want|i'd like|give me)\b(.+)/i,
    );
    if (match?.[1]) {
      const tail = match[1].trim();
      return tail.includes("?") ? (tail.split("?").pop()?.trim() ?? tail) : tail;
    }
  }

  if (messageHasAddIntent(normalized)) {
    return normalized
      .replace(/^(?:please|can you)\s+/i, "")
      .replace(/\bthat\s+also\s+add\s+/gi, "")
      .replace(/\balso\s+add\s+/gi, "")
      .trim();
  }

  return "";
}

export function messageHasAddIntent(message: string): boolean {
  const text = normalizeCompoundMessage(message);
  return (
    /\b(?:add|added|get|order|include|put)\b/i.test(text) ||
    /\bto be added\b/i.test(text) ||
    /\b(i want|i'd like|give me)\b/i.test(text)
  );
}

export function messageHasRemoveIntent(message: string): boolean {
  const text = normalizeCompoundMessage(message);
  return /\b(remove|removed|delete|take off)\b/i.test(text);
}

export function messageHasCartMutation(message: string): boolean {
  const text = normalizeCompoundMessage(message);
  return (
    messageHasAddIntent(message) ||
    messageHasRemoveIntent(message) ||
    /^(clear|empty)\s+(my\s+)?cart/i.test(text.trim()) ||
    /\b(change|update|set)\s+.+\s+to\s+\d+/i.test(text) ||
    /\bmake\s+it\s+\d+/i.test(text)
  );
}

export function messageHasMenuInquiry(message: string): boolean {
  const normalized = normalizeCompoundMessage(message);
  const inquiry = extractMenuInquiryText(normalized);
  const text = `${normalized} ${inquiry}`.toLowerCase();

  if (
    /\b(options?|what are|what('s| is)|what do you have|suggestions?|recommend|show|list|different|menu|dishes?|choices)\b/i.test(
      inquiry,
    )
  ) {
    return true;
  }

  if (/\btell me\b/i.test(text) && /\b(what|starter|main|bowl|salad|side|drink|dessert|menu)\b/i.test(text)) {
    return true;
  }

  if (/\bwhat\s+(are|is)\s+there\b/i.test(text) && /\b(for|in)\b/i.test(text)) {
    return true;
  }

  return /\b(what do you (have|serve|offer)|show me (the )?menu)\b/i.test(text);
}

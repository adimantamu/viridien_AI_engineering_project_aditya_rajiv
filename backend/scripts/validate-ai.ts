/**
 * Rules-first AI validation — run: npm run validate:ai
 */
import type { CartAction, ChatRequest, ChatResponse } from "../src/types/index.js";
import {
  getGreetingReply,
  handleStructuredChat,
  isGreetingMessage,
} from "../src/services/chatOrchestrator.js";
import { buildMenuInquiryResponse } from "../src/services/menuInquiry.js";
import {
  dedupeCartActions,
  parseAddActionsFromMessage,
} from "../src/services/orderSegmentParser.js";
import { messageHasCartMutation, messageHasMenuInquiry } from "../src/services/messageNormalizer.js";

type TestResult = { name: string; ok: boolean; detail?: string };

const sampleCart: ChatRequest["cart"] = {
  lines: [
    {
      lineId: "l1",
      itemId: "spicy-chicken-sandwich",
      name: "Spicy Chicken Sandwich",
      quantity: 2,
      unitPrice: 14.5,
    },
    {
      lineId: "l2",
      itemId: "sparkling-water",
      name: "Sparkling Water",
      quantity: 1,
      unitPrice: 3.5,
    },
  ],
  subtotal: 32.5,
};

const sampleOrder: NonNullable<ChatRequest["orders"]>[0] = {
  id: "ord-1",
  orderNumber: 1042,
  status: "placed",
  total: 35.1,
  itemCount: 3,
  createdAt: Date.now(),
  lines: [
    {
      name: "Spicy Chicken Sandwich",
      quantity: 2,
      unitPrice: 14.5,
      lineTotal: 29,
    },
    {
      name: "Sparkling Water",
      quantity: 1,
      unitPrice: 3.5,
      lineTotal: 3.5,
    },
  ],
};

function req(message: string, extra: Partial<ChatRequest> = {}): ChatRequest {
  return { message, ...extra };
}

function assertActions(
  actions: CartAction[],
  expected: Array<{ type: CartAction["type"]; itemId: string; quantity?: number }>,
): string | null {
  if (actions.length !== expected.length) {
    return `expected ${expected.length} actions, got ${actions.length}: ${JSON.stringify(actions)}`;
  }
  for (let i = 0; i < expected.length; i++) {
    const a = actions[i];
    const e = expected[i];
    if (a.type !== e.type || a.itemId !== e.itemId) {
      return `action[${i}]: expected ${e.type} ${e.itemId}, got ${a.type} ${a.itemId}`;
    }
    if (e.quantity !== undefined && (a.quantity ?? 1) !== e.quantity) {
      return `action[${i}]: expected qty ${e.quantity}, got ${a.quantity}`;
    }
  }
  return null;
}

function runParserTests(): TestResult[] {
  const cases: Array<{
    name: string;
    message: string;
    expected: Array<{ type: CartAction["type"]; itemId: string; quantity?: number }>;
  }> = [
    {
      name: "add single item",
      message: "add a sparkling water",
      expected: [{ type: "ADD", itemId: "sparkling-water", quantity: 1 }],
    },
    {
      name: "add with word quantity",
      message: "add two spicy chicken sandwiches",
      expected: [{ type: "ADD", itemId: "spicy-chicken-sandwich", quantity: 2 }],
    },
    {
      name: "compound remove + add",
      message: "remove one spicy chicken sandwich and add a sparkling water",
      expected: [
        { type: "REMOVE", itemId: "spicy-chicken-sandwich", quantity: 1 },
        { type: "ADD", itemId: "sparkling-water", quantity: 1 },
      ],
    },
    {
      name: "multi add",
      message: "add truffle fries and a chocolate lava cake",
      expected: [
        { type: "ADD", itemId: "truffle-fries", quantity: 1 },
        { type: "ADD", itemId: "chocolate-lava-cake", quantity: 1 },
      ],
    },
    {
      name: "clear cart",
      message: "clear my cart",
      expected: [],
    },
  ];

  return cases.map(({ name, message, expected }) => {
    const actions = dedupeCartActions(parseAddActionsFromMessage(message));
    if (name === "clear cart") {
      const ok = actions.length === 1 && actions[0].type === "CLEAR";
      return { name: `parser: ${name}`, ok, detail: ok ? undefined : JSON.stringify(actions) };
    }
    const err = assertActions(actions, expected);
    return { name: `parser: ${name}`, ok: !err, detail: err ?? undefined };
  });
}

async function runStructuredTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const starters = await handleStructuredChat(
    req("please tell me what are there for starters"),
  );
  results.push({
    name: "menu: starters inquiry",
    ok: Boolean(
      starters?.reply &&
        /starter/i.test(starters.reply) &&
        !/trouble|error|cannot/i.test(starters.reply),
    ),
    detail: starters?.reply?.slice(0, 120),
  });

  const bowls = await handleStructuredChat(req("what bowls do you have?"));
  results.push({
    name: "menu: bowls category",
    ok: Boolean(bowls?.reply && /bowl/i.test(bowls.reply)),
  });

  const startersAndBowls = await handleStructuredChat(
    req("what are the options in starters and bowls?"),
  );
  const blocks = startersAndBowls?.recommendationBlocks ?? [];
  const blockTitles = blocks.map((b) => b.title).join(" ");
  results.push({
    name: "menu: starters and bowls (multi)",
    ok: Boolean(
      startersAndBowls?.reply &&
        /starter/i.test(startersAndBowls.reply) &&
        /bowl/i.test(startersAndBowls.reply) &&
        /starter/i.test(blockTitles) &&
        /bowl/i.test(blockTitles),
    ),
    detail: `blocks: ${blocks.length}, parsedBy: ${startersAndBowls?.parsedBy}`,
  });

  const compound = await handleStructuredChat(
    req("what are your desserts? add chocolate lava cake"),
  );
  results.push({
    name: "compound: menu + add",
    ok: Boolean(
      compound?.actions?.some((a) => a.itemId === "chocolate-lava-cake") &&
        /dessert|cake|chocolate/i.test(compound?.reply ?? ""),
    ),
  });

  const chainedCart = await handleStructuredChat(
    req(
      "remove three sparkling water and also remove two spicy chicken sandwiches and then you can add three truffle mushroom burgers",
      { cart: sampleCart },
    ),
  );
  results.push({
    name: "cart: chained remove×2 + add×3",
    ok: Boolean(
      chainedCart?.actions?.some(
        (a) => a.type === "ADD" && a.itemId === "truffle-mushroom-burger" && a.quantity === 3,
      ) &&
        chainedCart?.actions?.some(
          (a) => a.type === "REMOVE" && a.itemId === "sparkling-water" && a.quantity === 3,
        ),
    ),
    detail: chainedCart?.actions?.map((a) => `${a.type}:${a.itemId}×${a.quantity}`).join(", "),
  });

  const removeAdd = await handleStructuredChat(
    req("remove one spicy chicken sandwich and add sparkling water", { cart: sampleCart }),
  );
  results.push({
    name: "cart: remove + add",
    ok: Boolean(
      removeAdd?.actions?.some((a) => a.type === "REMOVE" && a.itemId === "spicy-chicken-sandwich") &&
        removeAdd?.actions?.some((a) => a.type === "ADD" && a.itemId === "sparkling-water"),
    ),
    detail: removeAdd?.actions?.map((a) => `${a.type}:${a.itemId}`).join(", "),
  });

  const cartView = await handleStructuredChat(req("What's in my cart?", { cart: sampleCart }));
  results.push({
    name: "cart: view contents",
    ok: Boolean(cartView?.reply?.includes("Spicy Chicken") && !cartView?.actions?.length),
  });

  const place = await handleStructuredChat(req("place order", { cart: sampleCart }));
  results.push({
    name: "order: place asks confirm",
    ok: Boolean(
      place?.sessionContext?.awaitingConfirmation === "place_order" &&
        /yes/i.test(place?.reply ?? ""),
    ),
  });

  const placeSession = { awaitingConfirmation: "place_order" as const, pendingActions: [] };
  const confirmYes = await handleStructuredChat(
    req("yes", { cart: sampleCart, session: placeSession }),
  );
  results.push({
    name: "order: confirm yes places",
    ok: Boolean(confirmYes?.placeOrderFromCart),
    detail: confirmYes?.reply?.slice(0, 80),
  });

  const confirmNo = await handleStructuredChat(
    req("no", { cart: sampleCart, session: placeSession }),
  );
  results.push({
    name: "order: confirm no keeps cart",
    ok: Boolean(confirmNo?.reply && !confirmNo?.placeOrderFromCart),
  });

  const cancel = await handleStructuredChat(req("cancel my last order", { orders: [sampleOrder] }));
  results.push({
    name: "order: cancel last",
    ok: Boolean(cancel?.orderActions?.some((a) => a.type === "CANCEL_ORDER")),
  });

  const orderDetail = await handleStructuredChat(
    req("what items are in my current order?", { orders: [sampleOrder] }),
  );
  results.push({
    name: "order: detail (not cancel list)",
    ok: Boolean(
      orderDetail?.reply?.includes("Spicy Chicken") &&
        !orderDetail?.orderActions?.length,
    ),
  });

  const bulk = await handleStructuredChat(req("add 15 sparkling waters"));
  results.push({
    name: "cart: bulk qty needs confirm",
    ok: Boolean(
      bulk?.sessionContext?.awaitingConfirmation === "bulk_add" &&
        bulk?.sessionContext?.pendingActions?.length,
    ),
  });

  const updateQty = await handleStructuredChat(
    req("change spicy chicken sandwich to 1", { cart: sampleCart }),
  );
  results.push({
    name: "cart: update quantity",
    ok: Boolean(
      updateQty?.actions?.some(
        (a) => a.type === "UPDATE_QUANTITY" && a.itemId === "spicy-chicken-sandwich",
      ),
    ),
  });

  const greeting = isGreetingMessage("hello");
  const greetReply = getGreetingReply();
  results.push({
    name: "greeting",
    ok: greeting && greetReply.reply.length > 50,
  });

  const menuBuild = buildMenuInquiryResponse(req("what are your starters?"));
  results.push({
    name: "menu: buildMenuInquiryResponse",
    ok: Boolean(menuBuild?.recommendationBlocks?.length || menuBuild?.reply?.includes("Starter")),
  });

  const inquiryFlag = messageHasMenuInquiry("please tell me what are there for starters");
  const mutationFlag = messageHasCartMutation(
    "remove one spicy chicken sandwich and add sparkling water",
  );
  results.push({ name: "flags: menu inquiry", ok: inquiryFlag });
  results.push({ name: "flags: cart mutation", ok: mutationFlag });

  return results;
}

async function main() {
  const all = [...runParserTests(), ...(await runStructuredTests())];
  const failed = all.filter((r) => !r.ok);

  console.log("\n=== Intelligent Bistro AI Validation ===\n");
  for (const r of all) {
    console.log(r.ok ? "✓" : "✗", r.name, r.detail ? `— ${r.detail}` : "");
  }
  console.log(`\n${all.length - failed.length}/${all.length} passed`);
  if (failed.length) {
    console.error("\nFailed:", failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Exhaustive cart-command parser tests — run: npm run validate:parser
 */
import type { CartAction } from "../src/types/index.js";
import {
  dedupeCartActions,
  parseAllCartActionsFromMessage,
  reconcileAiCartActions,
} from "../src/services/orderSegmentParser.js";

type Case = {
  name: string;
  message: string;
  expected: Array<{
    type: CartAction["type"];
    itemId: string;
    quantity?: number;
    modifiers?: Record<string, string>;
  }>;
};

const CASES: Case[] = [
  {
    name: "user report: remove×2 + add×3 chain",
    message:
      "remove three sparkling water and also remove two spicy chicken sandwiches and then you can add three truffle mushroom burgers",
    expected: [
      { type: "REMOVE", itemId: "sparkling-water", quantity: 3 },
      { type: "REMOVE", itemId: "spicy-chicken-sandwich", quantity: 2 },
      { type: "ADD", itemId: "truffle-mushroom-burger", quantity: 3 },
    ],
  },
  {
    name: "then add with word qty",
    message: "remove one soup and then add two truffle fries",
    expected: [
      { type: "REMOVE", itemId: "soup-du-jour", quantity: 1 },
      { type: "ADD", itemId: "truffle-fries", quantity: 2 },
    ],
  },
  {
    name: "also remove mid-chain",
    message: "remove 1 water and also remove 2 burgers and add 4 waters",
    expected: [
      { type: "REMOVE", itemId: "water", quantity: 1 },
      { type: "REMOVE", itemId: "truffle-mushroom-burger", quantity: 2 },
      { type: "ADD", itemId: "water", quantity: 4 },
    ],
  },
  {
    name: "comma separated",
    message: "add 2 burgers, remove 1 fries, add 3 sparkling waters",
    expected: [
      { type: "ADD", itemId: "truffle-mushroom-burger", quantity: 2 },
      { type: "REMOVE", itemId: "truffle-fries", quantity: 1 },
      { type: "ADD", itemId: "sparkling-water", quantity: 3 },
    ],
  },
  {
    name: "please can you add",
    message: "please can you add three chocolate lava cakes",
    expected: [{ type: "ADD", itemId: "chocolate-lava-cake", quantity: 3 }],
  },
  {
    name: "digit qty add",
    message: "add 5 sparkling waters",
    expected: [{ type: "ADD", itemId: "sparkling-water", quantity: 5 }],
  },
  {
    name: "remove one and add one",
    message: "remove one spicy chicken sandwich and add a sparkling water",
    expected: [
      { type: "REMOVE", itemId: "spicy-chicken-sandwich", quantity: 1 },
      { type: "ADD", itemId: "sparkling-water", quantity: 1 },
    ],
  },
  {
    name: "duplicate add sums",
    message: "add two burgers and add one burger",
    expected: [{ type: "ADD", itemId: "truffle-mushroom-burger", quantity: 3 }],
  },
  {
    name: "duplicate remove sums",
    message: "remove two waters and remove one water",
    expected: [{ type: "REMOVE", itemId: "water", quantity: 3 }],
  },
    {
      name: "after that add",
      message: "remove 1 cake and after that add 2 soups",
      expected: [
        { type: "REMOVE", itemId: "chocolate-lava-cake", quantity: 1 },
        { type: "ADD", itemId: "soup-du-jour", quantity: 2 },
      ],
    },
    {
      name: "add large water",
      message: "add two large sparkling waters",
      expected: [
        {
          type: "ADD",
          itemId: "sparkling-water",
          quantity: 2,
          modifiers: { size: "large" },
        },
      ],
    },
    {
      name: "remove small fries",
      message: "remove one small truffle fries",
      expected: [
        {
          type: "REMOVE",
          itemId: "truffle-fries",
          quantity: 1,
          modifiers: { size: "small" },
        },
      ],
    },
    {
      name: "change size to large",
      message: "change my burger to large",
      expected: [
        {
          type: "SET_MODIFIER",
          itemId: "truffle-mushroom-burger",
          modifiers: { size: "large" },
        },
      ],
    },
    {
      name: "go large on item",
      message: "go large on the sparkling water",
      expected: [
        {
          type: "SET_MODIFIER",
          itemId: "sparkling-water",
          modifiers: { size: "large" },
        },
      ],
    },
    {
      name: "upgrade size",
      message: "upgrade my fries to large",
      expected: [
        {
          type: "SET_MODIFIER",
          itemId: "truffle-fries",
          modifiers: { size: "large" },
        },
      ],
    },
    {
      name: "change size and add",
      message: "change my burger to large and add two soups",
      expected: [
        {
          type: "SET_MODIFIER",
          itemId: "truffle-mushroom-burger",
          modifiers: { size: "large" },
        },
        { type: "ADD", itemId: "soup-du-jour", quantity: 2 },
      ],
    },
    {
      name: "with clause three items",
      message:
        "add four spicy chicken sandwiches and seven truffle mushroom burgers with three craft lavender lemonade",
      expected: [
        { type: "ADD", itemId: "spicy-chicken-sandwich", quantity: 4 },
        { type: "ADD", itemId: "truffle-mushroom-burger", quantity: 7 },
        { type: "ADD", itemId: "craft-lemonade", quantity: 3 },
      ],
    },
  ];

function run(): void {
  let passed = 0;
  const failures: string[] = [];

  for (const { name, message, expected } of CASES) {
    const actions = dedupeCartActions(parseAllCartActionsFromMessage(message));
    let ok = actions.length === expected.length;

    if (ok) {
      for (let i = 0; i < expected.length; i++) {
        const a = actions[i];
        const e = expected[i];
        if (a.type !== e.type || a.itemId !== e.itemId) {
          ok = false;
          break;
        }
        if (e.quantity !== undefined && (a.quantity ?? 1) !== e.quantity) {
          ok = false;
          break;
        }
        if (e.modifiers && JSON.stringify(a.modifiers ?? {}) !== JSON.stringify(e.modifiers)) {
          ok = false;
          break;
        }
      }
    }

    if (ok) {
      passed++;
      console.log("✓", name);
    } else {
      failures.push(name);
      console.log("✗", name);
      console.log("  message:", message);
      console.log("  expected:", JSON.stringify(expected));
      console.log(
        "  got:",
        JSON.stringify(
          actions.map((a) => ({ type: a.type, itemId: a.itemId, quantity: a.quantity })),
        ),
      );
    }
  }

  const reconcileCases: Array<{
    name: string;
    message: string;
    aiHallucination: CartAction[];
    expectedItemIds: string[];
  }> = [
    {
      name: "reconcile: single add strips cart re-adds",
      message: "Add Craft Lavender Lemonade",
      aiHallucination: [
        { type: "ADD", itemId: "harvest-bowl", quantity: 1 },
        { type: "ADD", itemId: "new-york-cheesecake", quantity: 1 },
        { type: "ADD", itemId: "craft-lemonade", quantity: 1 },
      ],
      expectedItemIds: ["craft-lemonade"],
    },
    {
      name: "reconcile: keeps compound order",
      message:
        "add four spicy chicken sandwiches and seven truffle mushroom burgers with three craft lavender lemonade",
      aiHallucination: [
        { type: "ADD", itemId: "spicy-chicken-sandwich", quantity: 4 },
        { type: "ADD", itemId: "truffle-mushroom-burger", quantity: 7 },
        { type: "ADD", itemId: "craft-lemonade", quantity: 3 },
        { type: "ADD", itemId: "sparkling-water", quantity: 1 },
      ],
      expectedItemIds: ["spicy-chicken-sandwich", "truffle-mushroom-burger", "craft-lemonade"],
    },
  ];

  for (const { name, message, aiHallucination, expectedItemIds } of reconcileCases) {
    const actions = reconcileAiCartActions(message, aiHallucination);
    const ids = actions.filter((a) => a.type === "ADD").map((a) => a.itemId);
    const ok =
      ids.length === expectedItemIds.length &&
      expectedItemIds.every((id, i) => ids[i] === id);
    if (ok) {
      passed++;
      console.log("✓", name);
    } else {
      failures.push(name);
      console.log("✗", name);
      console.log("  got ids:", ids.join(", "));
    }
  }

  const total = CASES.length + reconcileCases.length;
  console.log(`\n${passed}/${total} passed`);
  if (failures.length) {
    process.exit(1);
  }
}

run();

/**
 * Exhaustive cart-command parser tests — run: npm run validate:parser
 */
import type { CartAction } from "../src/types/index.js";
import {
  dedupeCartActions,
  parseAddActionsFromMessage,
} from "../src/services/orderSegmentParser.js";

type Case = {
  name: string;
  message: string;
  expected: Array<{ type: CartAction["type"]; itemId: string; quantity: number }>;
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
];

function run(): void {
  let passed = 0;
  const failures: string[] = [];

  for (const { name, message, expected } of CASES) {
    const actions = dedupeCartActions(parseAddActionsFromMessage(message));
    let ok = actions.length === expected.length;

    if (ok) {
      for (let i = 0; i < expected.length; i++) {
        const a = actions[i];
        const e = expected[i];
        if (a.type !== e.type || a.itemId !== e.itemId || (a.quantity ?? 1) !== e.quantity) {
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

  console.log(`\n${passed}/${CASES.length} passed`);
  if (failures.length) {
    process.exit(1);
  }
}

run();

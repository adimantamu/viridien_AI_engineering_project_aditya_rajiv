import { Router } from "express";
import { MENU_ITEMS } from "../data/menu.js";

export const menuRouter = Router();

menuRouter.get("/", (_req, res) => {
  res.json({ items: MENU_ITEMS });
});

menuRouter.get("/categories", (_req, res) => {
  const categories = [...new Set(MENU_ITEMS.map((item) => item.category))];
  res.json({ categories });
});

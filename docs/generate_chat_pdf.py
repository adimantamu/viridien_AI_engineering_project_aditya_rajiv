#!/usr/bin/env python3
"""Generate CHAT_CONVERSATION_EXPORT.pdf from transcript + summary markdown."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
TRANSCRIPT = Path(
    os.environ.get(
        "CHAT_TRANSCRIPT",
        r"C:\Users\Aditya Rajiv\.cursor\projects\c-Users-Aditya-Rajiv-Documents-viridien-project-intelligent-bistro"
        r"\agent-transcripts\af23326b-2e6c-4b52-9a87-854b8ab6fa0b\af23326b-2e6c-4b52-9a87-854b8ab6fa0b.jsonl",
    )
)
MD_FILE = DOCS / "CHAT_CONVERSATION_EXPORT.md"
OUT_PDF = DOCS / "CHAT_CONVERSATION_EXPORT.pdf"


def break_long_tokens(text: str, max_len: int = 90) -> str:
    """Insert soft breaks so fpdf can wrap very long tokens (URLs, paths)."""
    parts: list[str] = []
    for token in re.split(r"(\s+)", text):
        if len(token) <= max_len or token.isspace():
            parts.append(token)
            continue
        for i in range(0, len(token), max_len):
            chunk = token[i : i + max_len]
            parts.append(chunk)
            if i + max_len < len(token):
                parts.append("\n")
    return "".join(parts)


def sanitize_for_pdf(text: str) -> str:
    """Keep PDF rendering stable with core fonts."""
    replacements = {
        "\u2014": " -- ",
        "\u2013": "-",
        "\u2192": "->",
        "\u2190": "<-",
        "\u2713": "[ok]",
        "\u2705": "[ok]",
        "\u2022": "*",
        "\u00d7": "x",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u00a0": " ",
        "\u00e9": "e",
        "\u00e8": "e",
        "\u00ea": "e",
        "\u00f4": "o",
        "\u00e0": "a",
        "\u00fc": "u",
        "\u00f6": "o",
        "\u00e4": "a",
        "\u00ab": '"',
        "\u00bb": '"',
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    # Drop remaining non-latin-1 chars
    return text.encode("latin-1", errors="replace").decode("latin-1")


def extract_user_query(text: str) -> str:
    m = re.search(r"<user_query>\s*(.*?)\s*</user_query>", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    if text.startswith("<external_links>"):
        m2 = re.search(r"<user_query>\s*(.*?)\s*</user_query>", text, re.DOTALL | re.IGNORECASE)
        if m2:
            return m2.group(1).strip()
    return text.strip()


def clean_assistant_text(text: str) -> str:
    if not text or text.strip() == "[REDACTED]":
        return ""
    text = re.sub(r"\n?\[REDACTED\]\s*$", "", text)
    text = re.sub(r"\n?\[REDACTED\]", "", text)
    return text.strip()


def parse_transcript(path: Path) -> list[tuple[str, str]]:
    """Return list of (role, text) for user-visible messages."""
    turns: list[tuple[str, str]] = []
    if not path.exists():
        return turns

    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue

            role = row.get("role", "")
            content = row.get("message", {}).get("content", [])
            texts: list[str] = []
            for block in content:
                if block.get("type") != "text":
                    continue
                raw = block.get("text", "")
                if role == "user":
                    t = extract_user_query(raw)
                    if t and "Briefly inform the user about the task result" not in t:
                        texts.append(t)
                elif role == "assistant":
                    t = clean_assistant_text(raw)
                    if t:
                        texts.append(t)

            if not texts:
                continue

            combined = "\n\n".join(texts)
            if not combined.strip():
                continue

            # Merge consecutive assistant chunks into one turn when possible
            if turns and turns[-1][0] == role:
                turns[-1] = (role, turns[-1][1] + "\n\n" + combined)
            else:
                turns.append((role, combined))

    return turns


class ChatPDF(FPDF):
    def __init__(self) -> None:
        super().__init__()
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 18, 18)

    def section_title(self, title: str) -> None:
        self.ln(4)
        self.set_font("Helvetica", "B", 13)
        width = self.w - self.l_margin - self.r_margin
        self.multi_cell(width, 8, break_long_tokens(sanitize_for_pdf(title)))
        self.ln(2)

    def sub_title(self, title: str) -> None:
        self.ln(2)
        self.set_font("Helvetica", "B", 11)
        width = self.w - self.l_margin - self.r_margin
        self.multi_cell(width, 7, break_long_tokens(sanitize_for_pdf(title)))
        self.ln(1)

    def body_text(self, text: str, size: int = 9) -> None:
        self.set_font("Helvetica", "", size)
        width = self.w - self.l_margin - self.r_margin
        for para in text.split("\n"):
            para = para.rstrip()
            if not para:
                self.ln(3)
                continue
            safe = break_long_tokens(sanitize_for_pdf(para))
            self.multi_cell(width, 4.5, safe)
        self.ln(2)

    def role_block(self, role: str, text: str) -> None:
        label = "USER" if role == "user" else "ASSISTANT"
        self.sub_title(label)
        self.body_text(text)


def add_markdown_summary(pdf: ChatPDF, md_path: Path) -> None:
    if not md_path.exists():
        return
    content = md_path.read_text(encoding="utf-8")
    pdf.add_page()
    pdf.section_title("Compiled Summary & Reference Material")
    pdf.body_text(
        "The following sections consolidate presentation notes, architecture docs, "
        "and development summaries from this project session.",
        size=9,
    )

    for line in content.splitlines():
        if line.startswith("# "):
            pdf.section_title(line[2:].strip())
        elif line.startswith("## "):
            pdf.sub_title(line[3:].strip())
        elif line.startswith("### "):
            pdf.set_font("Helvetica", "B", 10)
            width = pdf.w - pdf.l_margin - pdf.r_margin
            pdf.multi_cell(width, 6, break_long_tokens(sanitize_for_pdf(line[4:].strip())))
            pdf.ln(1)
        elif line.strip() == "---":
            pdf.ln(2)
        else:
            pdf.body_text(line, size=8)


def add_transcript(pdf: ChatPDF, turns: list[tuple[str, str]]) -> None:
    pdf.add_page()
    pdf.section_title("Full Conversation Transcript")
    pdf.body_text(
        f"Exported from Cursor agent transcript ({len(turns)} turns). "
        "Tool-only assistant steps are omitted; substantive replies are included.",
        size=9,
    )

    turn_num = 0
    for role, text in turns:
        turn_num += 1
        pdf.sub_title(f"Turn {turn_num}")
        pdf.role_block(role, text)


def main() -> int:
    turns = parse_transcript(TRANSCRIPT)
    pdf = ChatPDF()
    pdf.set_title("The Intelligent Bistro - Chat Export")
    pdf.set_author("Viridien Project Session")

    pdf.add_page()
    pdf.section_title("The Intelligent Bistro")
    pdf.sub_title("Conversation Export")
    pdf.body_text(
        "Project: Viridien AI Full-Stack Engineering Internship\n"
        "Repository: viridien_project_intelligent_bistro\n"
        "Export: full chat transcript + compiled session notes",
        size=10,
    )

    add_transcript(pdf, turns)
    add_markdown_summary(pdf, MD_FILE)

    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(OUT_PDF))
    print(f"Wrote {OUT_PDF} ({OUT_PDF.stat().st_size:,} bytes, {len(turns)} turns)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

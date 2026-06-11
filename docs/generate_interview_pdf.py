#!/usr/bin/env python3
"""Generate INTERVIEW_PREP.pdf from INTERVIEW_PREP.md"""

import re
from pathlib import Path

from fpdf import FPDF

DOCS = Path(__file__).resolve().parent
MD_FILE = DOCS / "INTERVIEW_PREP.md"
PDF_FILE = DOCS / "INTERVIEW_PREP.pdf"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\arialbd.ttf")
FONT_ITALIC = Path(r"C:\Windows\Fonts\ariali.ttf")
FONT_MONO = Path(r"C:\Windows\Fonts\consola.ttf")


class InterviewPDF(FPDF):
    def footer(self):
        self.set_y(-12)
        self.set_font("Arial", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def setup_fonts(pdf: FPDF) -> None:
    pdf.add_font("Arial", "", str(FONT))
    pdf.add_font("Arial", "B", str(FONT_BOLD))
    pdf.add_font("Arial", "I", str(FONT_ITALIC))
    pdf.add_font("Consolas", "", str(FONT_MONO))


def write_wrapped(pdf: FPDF, text: str, size: int = 10, style: str = "", indent: int = 0) -> None:
    pdf.set_font("Arial", style, size)
    pdf.set_text_color(30, 30, 30)
    effective_width = pdf.w - pdf.l_margin - pdf.r_margin - indent
    x = pdf.l_margin + indent
    pdf.set_x(x)
    pdf.multi_cell(effective_width, 5.5, text)


def write_code_block(pdf: FPDF, lines: list[str]) -> None:
    pdf.ln(2)
    pdf.set_fill_color(245, 245, 245)
    pdf.set_font("Consolas", "", 8)
    pdf.set_text_color(40, 40, 40)
    for line in lines:
        if pdf.get_y() > pdf.h - 20:
            pdf.add_page()
        pdf.set_x(pdf.l_margin + 4)
        pdf.multi_cell(pdf.w - pdf.l_margin - pdf.r_margin - 8, 4.5, line or " ", fill=True)
    pdf.ln(3)


def is_table_row(line: str) -> bool:
    return line.strip().startswith("|") and "|" in line.strip()[1:]


def is_table_separator(line: str) -> bool:
    return bool(re.match(r"^\|[\s\-:|]+\|\s*$", line.strip()))


def render_table(pdf: FPDF, rows: list[str]) -> None:
    data_rows = [r for r in rows if not is_table_separator(r)]
    if not data_rows:
        return

    parsed = []
    for row in data_rows:
        cells = [c.strip() for c in row.strip().strip("|").split("|")]
        parsed.append(cells)

    if not parsed:
        return

    col_count = max(len(r) for r in parsed)
    width = pdf.w - pdf.l_margin - pdf.r_margin
    col_w = width / col_count

    pdf.ln(2)
    pdf.set_font("Arial", "", 8)
    for i, row in enumerate(parsed):
        if pdf.get_y() > pdf.h - 20:
            pdf.add_page()
        if i == 0:
            pdf.set_font("Arial", "B", 8)
            pdf.set_fill_color(230, 230, 230)
        else:
            pdf.set_font("Arial", "", 8)
            pdf.set_fill_color(250, 250, 250)
        for j in range(col_count):
            cell = row[j] if j < len(row) else ""
            pdf.cell(col_w, 6, cell[:80], border=1, fill=True)
        pdf.ln()
    pdf.ln(3)


def convert_md_to_pdf() -> None:
    text = MD_FILE.read_text(encoding="utf-8")
    lines = text.splitlines()

    pdf = InterviewPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=18)
    setup_fonts(pdf)
    pdf.add_page()

    in_code = False
    code_lines: list[str] = []
    table_lines: list[str] = []

    i = 0
    while i < len(lines):
        line = lines[i]

        if in_code:
            if line.strip().startswith("```"):
                write_code_block(pdf, code_lines)
                code_lines = []
                in_code = False
            else:
                code_lines.append(line)
            i += 1
            continue

        if line.strip().startswith("```"):
            in_code = True
            i += 1
            continue

        if is_table_row(line):
            table_lines.append(line)
            i += 1
            if i >= len(lines) or not is_table_row(lines[i]):
                render_table(pdf, table_lines)
                table_lines = []
            continue

        if line.strip() == "---":
            pdf.ln(2)
            pdf.set_draw_color(200, 200, 200)
            y = pdf.get_y()
            pdf.line(pdf.l_margin, y, pdf.w - pdf.r_margin, y)
            pdf.ln(4)
            i += 1
            continue

        if line.startswith("# "):
            if pdf.get_y() > 30:
                pdf.ln(4)
            write_wrapped(pdf, line[2:].strip(), size=18, style="B")
            pdf.ln(2)
            i += 1
            continue

        if line.startswith("## "):
            if pdf.get_y() > 40:
                pdf.add_page()
            write_wrapped(pdf, line[3:].strip(), size=14, style="B")
            pdf.ln(2)
            i += 1
            continue

        if line.startswith("### "):
            pdf.ln(2)
            write_wrapped(pdf, line[4:].strip(), size=11, style="B")
            pdf.ln(1)
            i += 1
            continue

        if line.startswith("> "):
            write_wrapped(pdf, line[2:].strip(), size=10, style="I", indent=6)
            pdf.ln(1)
            i += 1
            continue

        if line.strip().startswith("- ") or line.strip().startswith("* "):
            bullet = re.sub(r"^[\-\*]\s+", "", line.strip())
            bullet = re.sub(r"\*\*(.+?)\*\*", r"\1", bullet)
            write_wrapped(pdf, f"  • {bullet}", size=10, indent=4)
            i += 1
            continue

        if re.match(r"^\d+\.\s", line.strip()):
            item = re.sub(r"^\d+\.\s+", "", line.strip())
            item = re.sub(r"\*\*(.+?)\*\*", r"\1", item)
            write_wrapped(pdf, f"  {line.strip()}", size=10, indent=4)
            i += 1
            continue

        stripped = line.strip()
        if not stripped:
            pdf.ln(2)
            i += 1
            continue

        clean = re.sub(r"\*\*(.+?)\*\*", r"\1", stripped)
        clean = re.sub(r"`([^`]+)`", r"\1", clean)
        write_wrapped(pdf, clean, size=10)
        pdf.ln(1)
        i += 1

    pdf.output(str(PDF_FILE))
    print(f"Created: {PDF_FILE}")


if __name__ == "__main__":
    convert_md_to_pdf()

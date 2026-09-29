"""Approved learning-pack PDF export behind a replaceable renderer interface."""
from __future__ import annotations

from io import BytesIO
from typing import Protocol

from app.services.storage import get_store


class PDFRenderer(Protocol):
    def render(self, pack_data: dict) -> bytes: ...


class ReportLabRenderer:
    """Portable server-side PDF renderer; no browser or external service needed."""

    slot_labels = {
        "explanation": "Explanation",
        "assessment_easy": "Assessment — Easy",
        "assessment_medium": "Assessment — Medium",
        "assessment_advanced": "Assessment — Advanced",
        "exam_focus": "Important & Exam Focus",
        "video_script": "AI Teacher Script",
    }

    def render(self, pack_data: dict) -> bytes:
        from reportlab.lib.colors import HexColor
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak

        assets = pack_data.get("assets", [])
        if not assets:
            raise ValueError("No approved assets to export")
        if any(a.get("state") != "APPROVED" for a in assets):
            raise ValueError("Only approved asset versions may be exported")
        if any(a.get("source_revision") not in (None, pack_data.get("source_revision")) for a in assets):
            raise ValueError("Export contains stale asset versions")

        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="LFTitle", parent=styles["Title"], textColor=HexColor("#1855A8"), spaceAfter=12))
        styles.add(ParagraphStyle(name="LFHeading", parent=styles["Heading2"], textColor=HexColor("#1855A8"), spaceBefore=12, spaceAfter=6))
        styles.add(ParagraphStyle(name="LFBody", parent=styles["BodyText"], leading=15, spaceAfter=7))
        out = BytesIO()
        doc = SimpleDocTemplate(out, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=18*mm, bottomMargin=18*mm, title=pack_data.get("title", "Learning Pack"))
        story = [
            Paragraph(self._esc(pack_data.get("title", "Learning Pack")), styles["LFTitle"]),
            Paragraph(self._esc(" · ".join(filter(None, [pack_data.get("subject"), pack_data.get("level"), pack_data.get("exam")]))) or "Learning Pack", styles["LFBody"]),
            Paragraph(self._esc(f"Approved revision {pack_data.get('revision', 1)}"), styles["LFBody"]),
            Spacer(1, 6),
        ]
        by_slot = {a.get("slot"): a for a in assets}
        ordered_slots = ["explanation", "assessment_easy", "assessment_medium", "assessment_advanced", *[f"quiz{i}" for i in range(1, 6)]]
        for slot in ordered_slots:
            asset = by_slot.get(slot)
            if asset:
                self._asset(story, asset, self.slot_labels.get(slot, f"Quiz {slot.removeprefix('quiz') or ''}"), styles)
        quizzes = [by_slot.get(f"quiz{i}") for i in range(1, 6) if by_slot.get(f"quiz{i}")]
        if quizzes:
            story.append(Paragraph("Answer Key", styles["LFHeading"]))
            for index, asset in enumerate(quizzes, 1):
                p = asset.get("payload", asset)
                answer = p.get("answer")
                options = p.get("options") or []
                answer_text = options[answer] if isinstance(answer, int) and 0 <= answer < len(options) else "Not available"
                story.append(Paragraph(self._esc(f"Quiz {index}: {answer_text}"), styles["LFBody"]))
                if p.get("solution"):
                    story.append(Paragraph(self._esc(p["solution"]), styles["LFBody"]))
        for slot in ("exam_focus", "video_script"):
            asset = by_slot.get(slot)
            if asset:
                self._asset(story, asset, self.slot_labels[slot], styles)
        resources = pack_data.get("resources", [])
        if resources:
            story.append(Paragraph("Supplementary Resources", styles["LFHeading"]))
            for resource in resources:
                story.append(Paragraph(self._esc(f"{resource.get('title', 'Resource')}: {resource.get('url', '')}"), styles["LFBody"]))
        doc.build(story)
        return out.getvalue()

    @staticmethod
    def _esc(value) -> str:
        from xml.sax.saxutils import escape
        return escape(str(value or "")).replace("\n", "<br/>")

    def _asset(self, story, asset, fallback_title, styles):
        from reportlab.platypus import Paragraph
        p = asset.get("payload", asset)
        story.append(Paragraph(self._esc(p.get("title") or fallback_title), styles["LFHeading"]))
        story.append(Paragraph(self._esc(p.get("body", "")), styles["LFBody"]))
        for index, option in enumerate(p.get("options") or []):
            story.append(Paragraph(self._esc(f"{chr(65 + index)}. {option}"), styles["LFBody"]))
        flowchart = p.get("flowchart")
        if flowchart:
            nodes = {node.get("id"): node.get("label", node.get("id", "")) for node in flowchart.get("nodes", [])}
            edges = flowchart.get("edges", [])
            if edges:
                story.append(Paragraph("Concept flow", styles["LFBody"]))
                for edge in edges:
                    line = f"{nodes.get(edge.get('source'), edge.get('source', ''))} → {edge.get('relationship', 'leads to')} → {nodes.get(edge.get('target'), edge.get('target', ''))}"
                    story.append(Paragraph(self._esc(line), styles["LFBody"]))


def render_pack_pdf(pack_data: dict, export_id: str, renderer: PDFRenderer | None = None) -> dict:
    """Render only approved current assets and upload a private PDF object."""
    pdf = (renderer or ReportLabRenderer()).render(pack_data)
    if not pdf.startswith(b"%PDF-"):
        raise ValueError("PDF renderer did not return a valid PDF document")
    storage_key = f"exports/{pack_data['id']}/{export_id}.pdf"
    get_store().put(storage_key, pdf, content_type="application/pdf")
    return {"storage_key": storage_key, "file_size": len(pdf), "mime_type": "application/pdf"}

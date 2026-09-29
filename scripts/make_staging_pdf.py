"""Build a small, real text PDF fixture without adding another runtime dependency."""

from pathlib import Path
import textwrap

TEXT = """Newton's Laws of Motion - teacher-authored staging test source.
Newton's first law: an object remains at rest or at constant velocity unless a nonzero resultant external force acts on it. Mass measures inertia.
Newton's second law: for constant mass in an inertial frame, the resultant external force is F = ma. Force is measured in newtons. A 2 kg object accelerating at 3 m/s^2 has resultant force 6 N.
Newton's third law: interacting bodies exert equal and opposite forces on each other. These forces act on different bodies and do not cancel on one object's free-body diagram.
A free-body diagram shows external forces on a chosen object. Choose the object, identify its forces, find the resultant, and use F = ma to solve force and acceleration problems.
These teacher-authored notes are not historical examination questions."""


def build_pdf():
    lines = [line for p in TEXT.splitlines() for line in textwrap.wrap(p, 85)]
    stream = "BT /F1 11 Tf 45 780 Td 15 TL\n"
    for line in lines:
        line = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream += f"({line}) Tj T*\n"
    stream += "ET"
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream".encode("ascii"),
    ]
    data = b"%PDF-1.4\n"
    offsets = [0]
    for i, obj in enumerate(objects, 1):
        offsets.append(len(data))
        data += f"{i} 0 obj\n".encode() + obj + b"\nendobj\n"
    xref = len(data)
    data += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets[1:]:
        data += f"{off:010d} 00000 n \n".encode()
    return (
        data
        + f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )


if __name__ == "__main__":
    path = Path("backend/integration/fixtures/newton-staging.pdf")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(build_pdf())

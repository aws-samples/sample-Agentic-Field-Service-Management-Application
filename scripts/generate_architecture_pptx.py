#!/usr/bin/env python3
"""
Generate a PowerPoint (docs/architecture.pptx) of the FSM high-level
architecture, recreating docs/architecture.drawio as native, editable
PowerPoint shapes.

Design goals:
  * Same four-plane layout as the draw.io diagram.
  * Strong contrast: light-tinted plane backgrounds, saturated AWS
    service-category fills on components, white bold component text.
  * Corrected flows vs. the original draw.io:
      - Browser calls API Gateway (REST + WSS) directly, NOT through
        CloudFront (per .env.production).
      - FSM-AgentsApiHandler Lambda is invoked directly by API Gateway.

Run:  python3 scripts/generate_architecture_pptx.py
Out:  docs/architecture.pptx
"""

import os
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.oxml.ns import qn

# ----------------------------------------------------------------------------
# Palette
# ----------------------------------------------------------------------------
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
NAVY = RGBColor(0x23, 0x2F, 0x3E)          # AWS Squid Ink (user / edge traffic)
PURPLE = RGBColor(0x8C, 0x4F, 0xFF)        # Networking & Content Delivery
GREEN = RGBColor(0x3F, 0x86, 0x24)         # Storage / API+Lambda flow
ORANGE = RGBColor(0xED, 0x71, 0x00)        # Compute (Lambda)
DDB_BLUE = RGBColor(0x40, 0x53, 0xD6)      # Database (DynamoDB)
RED = RGBColor(0xDD, 0x34, 0x4C)           # Security, Identity & Compliance
TEAL = RGBColor(0x01, 0xA8, 0x8D)          # Machine Learning (Bedrock)
TEAL_DK = RGBColor(0x00, 0x7A, 0x66)       # Orchestrator (darker teal)
PINK = RGBColor(0xC7, 0x40, 0x7F)          # AgentCore invocation
MGMT = RGBColor(0xE7, 0x15, 0x7B)          # Mgmt & Governance (CW / CFN)
GREY = RGBColor(0x5A, 0x6B, 0x7B)          # async / observability

# Plane background tints (light) + border + title colors
PLANE = {
    "edge":     (RGBColor(0xEA, 0xF3, 0xFC), RGBColor(0x09, 0x72, 0xD3), RGBColor(0x09, 0x5C, 0xB0)),
    "identity": (RGBColor(0xF3, 0xEC, 0xFB), RGBColor(0x8C, 0x4F, 0xFF), RGBColor(0x6B, 0x2F, 0xB3)),
    "app":      (RGBColor(0xEE, 0xF6, 0xE6), RGBColor(0x7A, 0xA1, 0x16), RGBColor(0x5F, 0x80, 0x19)),
    "ai":       (RGBColor(0xFB, 0xEA, 0xF2), RGBColor(0xC7, 0x40, 0x7F), RGBColor(0x9A, 0x29, 0x60)),
    "ops":      (RGBColor(0xF1, 0xF3, 0xF5), RGBColor(0x5A, 0x6B, 0x7B), RGBColor(0x3E, 0x5C, 0x76)),
}

# ----------------------------------------------------------------------------
# Presentation scaffold (16:9)
# ----------------------------------------------------------------------------
prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)
slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank

# white background
bg = slide.background
bg.fill.solid()
bg.fill.fore_color.rgb = WHITE

shapes = slide.shapes


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------
def _fill_text(tf, text, tcolor, fs, bold, align=PP_ALIGN.CENTER):
    tf.word_wrap = True
    tf.margin_left = Inches(0.04)
    tf.margin_right = Inches(0.04)
    tf.margin_top = Inches(0.02)
    tf.margin_bottom = Inches(0.02)
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    lines = text.split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.space_after = Pt(0)
        p.space_before = Pt(0)
        r = p.add_run()
        r.text = line
        r.font.size = Pt(fs if i == 0 else max(fs - 2, 7))
        r.font.bold = bold if i == 0 else False
        r.font.color.rgb = tcolor
        r.font.name = "Arial"


def plane(x, y, w, h, title, key):
    fill, line, tcolor = PLANE[key]
    s = shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = line
    s.line.width = Pt(1.75)
    s.shadow.inherit = False
    s.text_frame.text = ""
    tb = shapes.add_textbox(Inches(x + 0.1), Inches(y + 0.05), Inches(w - 0.2), Inches(0.32))
    _fill_text(tb.text_frame, title, tcolor, 12, True, PP_ALIGN.LEFT)
    return s


def comp(x, y, w, h, text, fill, tcolor=WHITE, fs=10):
    s = shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(x), Inches(y), Inches(w), Inches(h))
    s.fill.solid()
    s.fill.fore_color.rgb = fill
    s.line.color.rgb = WHITE
    s.line.width = Pt(1.25)
    s.shadow.inherit = False
    _fill_text(s.text_frame, text, tcolor, fs, True)
    return s


def arrow(x1, y1, x2, y2, color, width=1.75, dashed=False):
    c = shapes.add_connector(MSO_CONNECTOR.STRAIGHT, Inches(x1), Inches(y1), Inches(x2), Inches(y2))
    ln = c.line
    ln.color.rgb = color
    ln.width = Pt(width)
    c.shadow.inherit = False
    lnEl = ln._get_or_add_ln()
    if dashed:
        dash = lnEl.makeelement(qn("a:prstDash"), {"val": "dash"})
        lnEl.append(dash)
    tail = lnEl.makeelement(qn("a:tailEnd"), {"type": "triangle", "w": "med", "len": "med"})
    lnEl.append(tail)
    return c


def label(x, y, w, text, color, fs=8):
    tb = shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(0.24))
    tf = tb.text_frame
    # white backing so labels stay legible over connectors / tinted planes
    tb.fill.solid()
    tb.fill.fore_color.rgb = WHITE
    tb.line.color.rgb = WHITE
    _fill_text(tf, text, color, fs, True)
    return tb


# ----------------------------------------------------------------------------
# Title + subtitle
# ----------------------------------------------------------------------------
t = shapes.add_textbox(Inches(0.3), Inches(0.12), Inches(12.7), Inches(0.55))
_fill_text(t.text_frame, "FSM — Field Service Management on AWS  ·  High-Level Architecture", NAVY, 22, True, PP_ALIGN.LEFT)

st = shapes.add_textbox(Inches(0.32), Inches(0.66), Inches(12.7), Inches(0.3))
_fill_text(st.text_frame,
           "Region us-east-1  ·  fully serverless  ·  four planes: Edge & Web · Identity · Application & Data · AI (Bedrock AgentCore)",
           GREY, 11, False, PP_ALIGN.LEFT)

# ----------------------------------------------------------------------------
# Legend strip
# ----------------------------------------------------------------------------
legend = [
    ("User / HTTPS", NAVY),
    ("API + Lambda", GREEN),
    ("DynamoDB", DDB_BLUE),
    ("AgentCore", PINK),
    ("Async / observability (dashed)", GREY),
]
lx = 0.35
for name, color in legend:
    sw = shapes.add_shape(MSO_SHAPE.RECTANGLE, Inches(lx), Inches(1.06), Inches(0.28), Inches(0.14))
    sw.fill.solid()
    sw.fill.fore_color.rgb = color
    sw.line.fill.background()
    sw.shadow.inherit = False
    w = 1.35 if "observability" not in name else 2.5
    tb = shapes.add_textbox(Inches(lx + 0.32), Inches(0.98), Inches(w), Inches(0.28))
    _fill_text(tb.text_frame, name, NAVY, 9, False, PP_ALIGN.LEFT)
    lx += 0.32 + w + 0.15

# ----------------------------------------------------------------------------
# Planes
# ----------------------------------------------------------------------------
plane(2.05, 1.5, 2.9, 2.3, "Edge & Web", "edge")
plane(0.30, 3.0, 1.55, 1.6, "Identity", "identity")
plane(5.15, 1.4, 4.0, 5.7, "Application & Data", "app")
plane(9.35, 1.4, 3.65, 5.7, "AI — Amazon Bedrock AgentCore", "ai")
plane(0.30, 4.9, 4.55, 2.0, "Operations & IaC", "ops")

# ----------------------------------------------------------------------------
# Components
# ----------------------------------------------------------------------------
# User
comp(0.40, 1.70, 1.15, 0.90, "End User\n(Browser / Mobile)", NAVY, fs=9)

# Edge & Web
comp(2.25, 2.15, 1.20, 0.95, "Amazon\nCloudFront\n(OAI, HTTPS)", PURPLE, fs=9)
comp(3.55, 2.15, 1.25, 0.95, "Amazon S3\n(React /\nCloudscape SPA)", GREEN, fs=9)

# Identity
comp(0.45, 3.60, 1.25, 0.85, "Amazon\nCognito\nUser Pool", RED, fs=9)

# Application & Data
comp(5.35, 2.00, 1.60, 1.00, "Amazon API Gateway\nREST + WebSocket\n(Cognito auth + CORS)", PURPLE, fs=9)
comp(7.30, 2.00, 1.65, 1.00, "Data Lambdas\ncustomers · jobs · techs\ninvoices · parts · metrics", ORANGE, fs=9)
comp(5.35, 3.35, 1.60, 1.00, "Stream Handler\nLambda\n(WebSocket fan-out)", ORANGE, fs=9)
comp(7.30, 3.35, 1.65, 1.00, "FSM-AgentsApiHandler\nLambda\n/agents /chat /workflow /trace", ORANGE, fs=8)
comp(5.55, 4.75, 3.15, 1.90,
     "Amazon DynamoDB  (on-demand)\n\nCustomers · Jobs · Technicians\nInvoices · Metrics · Parts\nDocumentation · SimulatorConfig\nWebSocketConnections\n\n(DynamoDB Streams on hot tables)",
     DDB_BLUE, fs=9)

# AI plane
comp(9.55, 2.00, 3.25, 1.00,
     "Orchestrator Agent\nStrands SDK + Claude Sonnet 4\ndirect DynamoDB tools (read/write)", TEAL_DK, fs=9)
grid = [
    ("HVAC\nMonitoring", 9.55, 3.20), ("Parts\nInventory", 11.30, 3.20),
    ("Technician\nScheduling", 9.55, 4.05), ("Customer\nComms", 11.30, 4.05),
    ("Customer\nAuth", 9.55, 4.90), ("Billing &\nInvoicing", 11.30, 4.90),
    ("Technical\nDocs", 9.55, 5.75),
]
for txt, gx, gy in grid:
    comp(gx, gy, 1.50, 0.72, txt, TEAL, fs=9)
comp(11.30, 5.75, 1.50, 0.72, "Amazon ECR\nper-agent images", NAVY, fs=8)

note = shapes.add_textbox(Inches(9.55), Inches(6.55), Inches(3.25), Inches(0.5))
_fill_text(note.text_frame,
           "Each agent = own arm64 container + ECR image + least-privilege IAM role; observability (OTel) enabled",
           PLANE["ai"][2], 8, False, PP_ALIGN.LEFT)

# Operations & IaC
comp(0.50, 5.55, 1.35, 0.95, "Amazon\nCloudWatch\nLogs + OTel\ntraces", MGMT, fs=8)
comp(1.95, 5.55, 1.35, 0.95, "AWS Cloud-\nFormation\n(nested\ntemplates)", MGMT, fs=8)
comp(3.40, 5.55, 1.35, 0.95, "AWS IAM\n(per-Lambda &\nper-agent\nroles)", RED, fs=8)

# ----------------------------------------------------------------------------
# Connectors  (edges)
# ----------------------------------------------------------------------------
# User -> CloudFront (static)
arrow(1.55, 2.05, 2.25, 2.35, NAVY, 2)
label(1.52, 1.78, 0.85, "HTTPS", NAVY)
# CloudFront -> S3 (OAI)
arrow(3.45, 2.62, 3.55, 2.62, PURPLE, 2)
label(3.15, 3.12, 0.9, "OAI", PURPLE)
# User -> Cognito (OIDC)
arrow(0.98, 2.60, 1.07, 3.60, PURPLE, 1.75, dashed=True)
label(1.30, 3.02, 0.9, "OIDC", PURPLE)
# User -> API Gateway DIRECT (corrected: not via CloudFront)
arrow(1.55, 2.45, 5.35, 2.55, NAVY, 2, dashed=True)
label(2.55, 3.45, 2.35, "REST + WSS direct (Cognito ID token)", NAVY)
# API Gateway -> Data Lambdas
arrow(6.95, 2.45, 7.30, 2.45, GREEN, 2)
# API Gateway -> Agents Lambda (corrected: direct from API GW)
arrow(6.85, 2.90, 7.55, 3.35, GREEN, 2)
# Data Lambdas -> DynamoDB
arrow(8.05, 3.00, 7.20, 4.75, DDB_BLUE, 2)
# Agents Lambda -> Orchestrator
arrow(8.95, 3.80, 9.55, 2.60, PINK, 2)
label(8.30, 4.45, 2.2, "InvokeAgentRuntime (SigV4)", PINK)
# Orchestrator -> specialists (delegation)
arrow(10.15, 3.00, 10.30, 3.20, PINK, 1.5, dashed=True)
arrow(11.90, 3.00, 12.05, 4.90, PINK, 1.5, dashed=True)
label(9.80, 3.02, 1.9, "delegates to specialists", PINK)
# Specialists / Orchestrator -> DynamoDB (tools)
arrow(9.55, 4.60, 8.70, 5.05, DDB_BLUE, 1.75, dashed=True)
label(8.55, 4.30, 1.9, "DDB tools (per-agent IAM)", DDB_BLUE)
# DynamoDB Streams -> Stream Lambda
arrow(6.05, 4.75, 6.15, 4.35, DDB_BLUE, 2)
label(6.20, 4.42, 0.9, "Streams", DDB_BLUE)
# Stream Lambda -> API Gateway (WS push)
arrow(6.15, 3.35, 6.15, 3.00, GREEN, 1.75, dashed=True)
label(6.20, 3.02, 1.0, "WS push", GREEN)
# App plane -> CloudWatch (logs + OTel)
arrow(7.00, 4.35, 1.85, 5.70, GREY, 1.5, dashed=True)
label(3.30, 4.55, 1.6, "logs + OTel", GREY)

# ----------------------------------------------------------------------------
# Save
# ----------------------------------------------------------------------------
out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")
os.makedirs(out_dir, exist_ok=True)
out_path = os.path.join(out_dir, "architecture.pptx")
prs.save(out_path)
print(f"Wrote {out_path}")

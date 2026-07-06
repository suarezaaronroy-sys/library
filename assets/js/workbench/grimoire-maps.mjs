// grimoire-maps.mjs — complex Whiteboard templates that visualize the
// frameworks discussed in the Grimoires. Each purple "grimoire" node deep-links
// to the exact section it represents, so a board doubles as a reading path.
//
// To add a map: append an object below. `link` is a site-relative grimoire URL
// with a section anchor (see _data/grimoire_sections.json for valid anchors);
// canvas.js resolves the site baseurl at open time. Node ids must be unique
// within a map. Positions are canvas pixels.

export const GRIMOIRE_MAPS = [
  {"id": "gmap-crm-closedloop", "label": "G001 · Closed-loop revenue system", "note": "The 11-step self-healing loop from the ASMC CRM engine — capture, score, route, convert, and recycle, with stagnation tripwires and an over-$15K approval gate.", "grimoireId": "grimoire-001", "href": "/grimoires/001-asmc-crm-engine.html", "nodes": [{"id": "input", "type": "trigger", "title": "INPUT — all entry points", "x": 540, "y": 60, "desc": "Ads, forms, inbound calls, SMS. Contact created, lifecycle=TOFU, intent=0, opportunity opened."}, {"id": "normalize", "type": "action", "title": "NORMALIZE — anti-chaos", "x": 540, "y": 180, "desc": "Fill missing owner/stage/source; dedupe and merge on phone/email, keep highest intent."}, {"id": "respond", "type": "action", "title": "RESPOND — speed", "x": 540, "y": 300, "desc": "SMS instant, email at 2 min, check reply at 5 min. first_response_time measured."}, {"id": "track", "type": "process", "title": "TRACK INTENT — core brain", "x": 540, "y": 420, "desc": "Behavioral scoring: reply +3, click +2, visit +1, booking +5, estimate viewed +4."}, {"id": "decide", "type": "condition", "title": "DECIDE + ROUTE", "x": 540, "y": 540, "desc": "intent + source + stage + delay -> assign / escalate / AI call / move / recycle."}, {"id": "sla", "type": "note", "title": "SLA ladder (5/15/30/60 min)", "x": 870, "y": 540, "desc": "Escalation runs in parallel with routing."}, {"id": "convert", "type": "condition", "title": "CONVERT — booking outcome", "x": 540, "y": 660, "desc": "Booked -> confirmation + reminders, then Won / Lost / No-show."}, {"id": "hitl", "type": "approval", "title": "HiTL gate — estimate > $15K", "x": 270, "y": 660, "desc": "Zap 9: no estimate over $15,000 sends without manager approval."}, {"id": "won", "type": "approval", "title": "Won — revenue + Phase 3", "x": 340, "y": 800}, {"id": "noshow", "type": "failure", "title": "No-show — rebooking loop", "x": 560, "y": 800}, {"id": "stagnation", "type": "condition", "title": "STAGNATION detection", "x": 900, "y": 400, "desc": "TOFU>24h, MOFU>3d, BOFU>2d -> task / escalate / reassign."}, {"id": "recycle", "type": "action", "title": "RECYCLE — 12-month nurture", "x": 900, "y": 260, "desc": "Cooled leads enter passive nurture; any activity re-enters at MOFU with an intent boost."}, {"id": "reporting", "type": "database", "title": "REPORTING — embedded", "x": 560, "y": 920, "desc": "Every step feeds metrics live: volume, speed, intent, movement, revenue, recovery."}], "edges": [["input", "normalize", ""], ["normalize", "respond", ""], ["respond", "track", ""], ["track", "decide", ""], ["decide", "sla", "parallel"], ["decide", "convert", "route"], ["convert", "hitl", "> $15K"], ["hitl", "won", "approved"], ["convert", "won", "Won"], ["convert", "noshow", "No-show"], ["noshow", "respond", "rebook"], ["track", "stagnation", "monitor"], ["stagnation", "recycle", "cooled"], ["recycle", "track", "re-entry"], ["won", "reporting", ""], ["convert", "reporting", ""]]},
  {"id": "gmap-dualwing", "label": "G002 · Dual-wing rental flywheel", "note": "The two-sided engine from Dual Wing — a landlord supply pipeline and a renter demand pipeline feeding one shared CRM, where placements drive referrals back into supply.", "grimoireId": "grimoire-002", "href": "/grimoires/002-dual-wing-rental.html", "nodes": [{"id": "ll-acq", "type": "trigger", "title": "Landlord acquisition", "x": 180, "y": 70, "anchor": "m1", "desc": "Cold outreach (34.2% open), SEO, social, listings."}, {"id": "ll1", "type": "action", "title": "New Lead -> fire sequence", "x": 180, "y": 200, "anchor": "m2"}, {"id": "ll2", "type": "action", "title": "Contacted -> consultation task", "x": 180, "y": 320, "anchor": "m6"}, {"id": "ll3", "type": "condition", "title": "Consultation -> Evaluated", "x": 180, "y": 440, "anchor": "m6"}, {"id": "ll4", "type": "approval", "title": "Agreement -> Under Management", "x": 180, "y": 560, "anchor": "m7", "desc": "Closed-Won fires onboarding. Lost -> 90-day re-engage."}, {"id": "rn-acq", "type": "trigger", "title": "Renter acquisition", "x": 960, "y": 70, "anchor": "m1", "desc": "Listings layer + demand-gen content."}, {"id": "rn1", "type": "action", "title": "New Inquiry -> fire sequence", "x": 960, "y": 200, "anchor": "m2"}, {"id": "rn2", "type": "action", "title": "Listings Sent -> viewing", "x": 960, "y": 320, "anchor": "m6"}, {"id": "rn3", "type": "condition", "title": "Viewing -> Viewed", "x": 960, "y": 440, "anchor": "m6"}, {"id": "rn4", "type": "approval", "title": "Offer -> Placed", "x": 960, "y": 560, "anchor": "m7", "desc": "Payment received fires fulfillment. Lost -> 30-day re-engage."}, {"id": "engine", "type": "process", "title": "Shared CRM — scoring + triggers", "x": 570, "y": 300, "anchor": "m4", "desc": "GHL core with lead scoring, nightly decay, and behavioral triggers that interrupt either sequence."}, {"id": "flywheel", "type": "process", "title": "Flywheel: supply <-> demand", "x": 570, "y": 470, "anchor": "m14", "desc": "Properties under management become listings; fast placements make landlords refer."}, {"id": "referral", "type": "note", "title": "Placements -> referrals", "x": 570, "y": 620, "anchor": "m9"}], "edges": [["ll-acq", "ll1", ""], ["ll1", "ll2", ""], ["ll2", "ll3", ""], ["ll3", "ll4", ""], ["rn-acq", "rn1", ""], ["rn1", "rn2", ""], ["rn2", "rn3", ""], ["rn3", "rn4", ""], ["ll1", "engine", "capture"], ["rn1", "engine", "capture"], ["engine", "flywheel", ""], ["ll4", "flywheel", "supply"], ["rn4", "flywheel", "placement"], ["flywheel", "referral", ""], ["referral", "ll-acq", "referrals feed supply"]]},
  {
    id: "gmap-automations",
    label: "G006 · Automation pattern model",
    note: "The conceptual spine of Automations 101, plus a real capture-to-booking pattern with a failure gate.",
    grimoireId: "grimoire-006",
    href: "/grimoires/006-automations-101.html",
    nodes: [
      { id: "core", type: "process", title: "Pattern Reference Model", x: 560, y: 90, anchor: "ch0", desc: "The mental model every automation maps onto." },
      { id: "cog", type: "grimoire", title: "Why AI is just a cog", x: 220, y: 90, anchor: "ch1" },
      { id: "grade", type: "grimoire", title: "Straightforward vs production-grade", x: 900, y: 90, anchor: "ch2" },
      { id: "failfam", type: "grimoire", title: "Failure families & observability", x: 900, y: 250, anchor: "ch3" },
      { id: "handoff", type: "grimoire", title: "Human handoff taxonomy", x: 220, y: 250, anchor: "ch4" },
      { id: "p01", type: "trigger", title: "Capture inbound lead", x: 180, y: 440, anchor: "p01" },
      { id: "p04", type: "condition", title: "AI classify intent / BANT", x: 430, y: 440, anchor: "p04" },
      { id: "p05", type: "action", title: "Self-service booking", x: 690, y: 440, anchor: "p05" },
      { id: "p06", type: "action", title: "Multi-channel reminders", x: 940, y: 440, anchor: "p06" },
      { id: "p07", type: "failure", title: "No-show → auto-reschedule", x: 690, y: 610, anchor: "p07", desc: "Failure gate — see the failure-families chapter." }
    ],
    edges: [
      ["cog", "core", ""], ["core", "grade", ""], ["core", "failfam", ""], ["handoff", "core", ""],
      ["core", "p01", "example"],
      ["p01", "p04", ""], ["p04", "p05", "qualified"], ["p05", "p06", ""],
      ["p06", "p07", "no show"], ["p07", "p05", "rebook"], ["failfam", "p07", "observe"]
    ]
  },
  {
    id: "gmap-orchestration",
    label: "G010 · The orchestration layer",
    note: "The progression from a single agent to a multi-agent organization — the arc of the Orchestration Layer.",
    grimoireId: "grimoire-010",
    href: "/grimoires/010-orchestration-layer.html",
    nodes: [
      { id: "thesis", type: "process", title: "Core thesis", x: 520, y: 80, anchor: "thesis", desc: "Orchestration, not models, is the moat." },
      { id: "lenses", type: "grimoire", title: "The three lenses", x: 200, y: 80, anchor: "lenses" },
      { id: "p1", type: "grimoire", title: "Understanding the problem", x: 520, y: 220, anchor: "part-1" },
      { id: "p2", type: "grimoire", title: "The building blocks", x: 520, y: 340, anchor: "part-2" },
      { id: "p3", type: "grimoire", title: "Your first agent", x: 300, y: 460, anchor: "part-3" },
      { id: "p4", type: "approval", title: "The five-agent company", x: 620, y: 460, anchor: "part-4", desc: "The pivotal chapter — a company as coordinated agents." },
      { id: "p5", type: "grimoire", title: "Multi-agent organizations", x: 620, y: 600, anchor: "part-5" },
      { id: "p6", type: "grimoire", title: "Operating AI organizations", x: 300, y: 600, anchor: "part-6" },
      { id: "p7", type: "note", title: "The org that doesn't exist yet", x: 900, y: 530, anchor: "part-7" }
    ],
    edges: [
      ["lenses", "thesis", ""], ["thesis", "p1", ""], ["p1", "p2", ""],
      ["p2", "p3", ""], ["p3", "p4", "scale"], ["p4", "p5", ""],
      ["p5", "p6", "operate"], ["p5", "p7", "horizon"]
    ]
  },
  {
    id: "gmap-orgphysics",
    label: "G011 · Organizational physics",
    note: "The three problem families converging on the AI-native company and its playbooks.",
    grimoireId: "grimoire-011",
    href: "/grimoires/011-organizational-physics.html",
    nodes: [
      { id: "thesis", type: "process", title: "The central thesis", x: 540, y: 80, anchor: "the-central-thesis", desc: "The organization is the problem." },
      { id: "prob", type: "condition", title: "The organization is the problem", x: 540, y: 210, anchor: "part-01" },
      { id: "mgr", type: "grimoire", title: "Manager problems", x: 230, y: 350, anchor: "part-02" },
      { id: "work", type: "grimoire", title: "Work problems", x: 540, y: 350, anchor: "part-03" },
      { id: "pol", type: "grimoire", title: "Politics problems", x: 850, y: 350, anchor: "part-04" },
      { id: "ai", type: "approval", title: "The AI-native company", x: 540, y: 500, anchor: "part-05", desc: "Where the three problem families dissolve." },
      { id: "play", type: "grimoire", title: "The playbooks", x: 300, y: 630, anchor: "part-06" },
      { id: "laws", type: "note", title: "The laws index", x: 780, y: 630, anchor: "laws-index" }
    ],
    edges: [
      ["thesis", "prob", ""], ["prob", "mgr", ""], ["prob", "work", ""], ["prob", "pol", ""],
      ["mgr", "ai", ""], ["work", "ai", ""], ["pol", "ai", ""],
      ["ai", "play", "apply"], ["ai", "laws", "reference"]
    ]
  },
  {
    id: "gmap-remotework",
    label: "G014 · Remote work path",
    note: "The decision path from overwhelmed beginner to employable remote worker.",
    grimoireId: "grimoire-014",
    href: "/grimoires/014-remote-work-101.html",
    nodes: [
      { id: "start", type: "trigger", title: "Start here if overwhelmed", x: 500, y: 70, anchor: "c0" },
      { id: "what", type: "grimoire", title: "What remote work actually is", x: 500, y: 200, anchor: "c2" },
      { id: "eco", type: "grimoire", title: "The remote work ecosystem", x: 500, y: 320, anchor: "c3" },
      { id: "paths", type: "condition", title: "The major career paths", x: 500, y: 440, anchor: "c4", desc: "Where the reader picks a direction." },
      { id: "class", type: "grimoire", title: "Choosing your class", x: 500, y: 560, anchor: "c5" },
      { id: "skills", type: "grimoire", title: "Skills that matter everywhere", x: 200, y: 440, anchor: "c6" },
      { id: "english", type: "grimoire", title: "English for remote work", x: 200, y: 320, anchor: "c7" },
      { id: "docs", type: "grimoire", title: "Documentation is survival", x: 200, y: 560, anchor: "c9" },
      { id: "employ", type: "approval", title: "Becoming employable", x: 820, y: 500, anchor: "c11" },
      { id: "resume", type: "note", title: "Resumes & profiles", x: 820, y: 620, anchor: "c12" }
    ],
    edges: [
      ["start", "what", ""], ["what", "eco", ""], ["eco", "paths", ""],
      ["paths", "class", "pick"], ["english", "skills", ""], ["skills", "paths", "prepare"],
      ["docs", "class", "practice"], ["class", "employ", "ready"], ["employ", "resume", ""]
    ]
  }
];

// grimoire-maps.mjs — complex Whiteboard templates that visualize the
// frameworks discussed in the Grimoires. Each purple "grimoire" node deep-links
// to the exact section it represents, so a board doubles as a reading path.
//
// To add a map: append an object below. `link` is a site-relative grimoire URL
// with a section anchor (see _data/grimoire_sections.json for valid anchors);
// canvas.js resolves the site baseurl at open time. Node ids must be unique
// within a map. Positions are canvas pixels.

export const GRIMOIRE_MAPS = [
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

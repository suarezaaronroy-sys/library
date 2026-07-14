---
image: /assets/og/notes/handoffs-die-here.png
title: "Handoffs Are Where Work Goes to Die."
date: 2026-03-01
category: Operations
lede: "The artifact passes. The reasoning doesn't. The next person starts over, makes wrong assumptions, or stalls waiting for context that should have been included."
description: "The artifact passes. The reasoning doesn't. The next person starts over, makes wrong assumptions, or stalls."
related_grimoire: /grimoires/010-orchestration-layer.html
---
Watch where projects actually stall and it's almost never inside someone's lane. It's at the seams — the moment work crosses from one person to the next.

The mechanism is specific: **the artifact passes, the reasoning doesn't.** A file arrives, a ticket gets reassigned, a thread gets forwarded — but the *why* stays behind. Why this approach and not the obvious one. What was already tried and failed. Which constraint isn't written anywhere but shaped every decision. The receiver inherits the output of someone's thinking with none of the thinking, so they face three options, all bad: start over (waste), guess (risk), or go ask (delay — and now you're paying the escalation tax on top).

The standard that fixes it fits in one sentence: **a handoff is complete when the receiver can act without asking a question.** Not when the file is sent. Not when the ticket changes owner. When action is possible without a follow-up. Everything required to meet that bar — current state, history, the constraint, the next expected step — travels *with* the work or the handoff didn't happen; what happened was a delivery.

In practice this means a handoff template per seam, five lines, filled at the moment of passing: what this is, where it stands, what was tried, what's decided, what's next. Thirty seconds for the sender, who has the context loaded; an hour saved for the receiver, who doesn't. The asymmetry is the whole argument.

One more reason to care now: AI agents inherit your seams exactly as they are, minus the human improvisation that papers over them. An agent receiving a context-free handoff doesn't walk over to ask — it acts on what it got. The orchestration version of this problem is half of [The Orchestration Layer]({{ '/grimoires/010-orchestration-layer.html' | relative_url }}).

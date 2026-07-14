---
image: /assets/og/notes/automation-trap.png
title: "The Automation Trap: When You Automate a Broken Process."
date: 2026-02-28
category: Operations
lede: "Automation amplifies what's already there. If the process is broken, automation just breaks it faster and at scale."
description: "Automation amplifies what's already there. If the process is broken, automation breaks it faster and at scale."
related_grimoire: /grimoires/006-automations-101.html
---
The most expensive automation projects I've seen all started the same way: a messy manual process, automated exactly as-is. Nobody saw the mess, because humans were quietly absorbing it — catching the duplicate before it mattered, knowing that "urgent" from one client means Tuesday, fixing the malformed entry without mentioning it. Human workflow glue is invisible right up until you remove the humans.

Then the automation ships, and the mess executes at machine speed. Wrong data propagates instantly instead of waiting for someone to notice. Edge cases get handled identically and identically wrong, every time, with total confidence. Errors that a person produced at three per week now arrive at three per minute — and they all look official, because they came from "the system."

Automation is an amplifier. It has no opinion about what it amplifies. Feed it a clean process and you get reliability at scale; feed it a broken one and you get the same breakage with better throughput and a worse blast radius.

The rule is three words: **fix, then automate.** In practice that means mapping the process as it actually runs — including the workarounds, which are the system's confessions about where it's broken — then killing the ambiguity: every exception named, every input validated at the door, every "it depends" converted into a rule or routed to a human. Only then wire it up. The mapping step routinely reveals that half the process shouldn't exist at all, which is the cheapest automation there is.

And one structural safeguard regardless of how clean you think it is: every automated flow needs an exception path to a person. The cases you didn't anticipate are the ones automation handles worst — "handles" doing a lot of work in that sentence.

The 25 production patterns — with the idempotency, retries, and dead-letter queues that make amplification safe — are [Grimoire 006]({{ '/grimoires/006-automations-101.html' | relative_url }}).

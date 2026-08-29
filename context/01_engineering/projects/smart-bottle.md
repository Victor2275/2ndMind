---
updated: 2026-08-29
domain: engineering
stability: volatile
summary: Instrumented water bottle that tracks intake continuously, rather than weighing on demand.
read_when: Portfolio; hardware and embedded work; what Victor is building now.
title: Smart Bottle
slug: smart-bottle
order: 6
status: active
year: 2026
category: hardware
tags: [embedded, sensors, hardware, firmware]
stack: []
links: {}
draft: true
resume_variants: []
public: true
bullets: []
---

# Smart Bottle

Started 2026. The successor to the Water Bottle Scale, which was built in 10th grade and
retired from this vault on 2026-08-29 — a load cell under a bottle answers "how much is in
there right now" and nothing else. This one is meant to answer the question that actually
matters, which is how much was drunk over a day, without being told when to look.

## The problem

> **To write:** what makes continuous intake measurement harder than weighing at rest? The
> bottle gets picked up, tipped, refilled, carried and knocked over, and none of those look
> different to a naive scale. Say which of those is the real difficulty.

## Architecture

> **To write:** sensing approach, microcontroller, power budget and how it charges, how the
> electronics are sealed against a container whose entire purpose is holding water.

## What did not work

> **To write:** the Water Bottle Scale is the honest first draft of this — say what it could
> not do and why that pushed the design here.

## Measured results

> **To write:** one number. Accuracy in millilitres against a measured pour, or battery
> runtime in days. This is what unlocks `draft: false` and a place on the resume.

## Notes

Deliberately `draft: true`: the build is real and belongs on `/now`, but the case study is
scaffolding and the site marks it "write-up pending" rather than pretending otherwise.
Replaces `water-bottle-scale.md`, deleted 2026-08-29 (see `web/DECISIONS.md` D-108).

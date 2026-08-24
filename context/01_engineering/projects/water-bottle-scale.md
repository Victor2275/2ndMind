---
updated: 2026-08-24
domain: engineering
stability: volatile
summary: Battery-powered load-cell scale that measures how much water is left in a bottle.
read_when: Portfolio; hardware and embedded work.
title: Water Bottle Scale
slug: water-bottle-scale
tier: 2
status: active
year: 2026
category: hardware
tags: [arduino, sensors, embedded, hardware]
stack: [Arduino Uno, Load cell]
links: {}
draft: true
resume_variants: []
public: true
bullets:
  - Built a rechargeable, water-sealed scale that reads the remaining water in a bottle from a load sensor, powered by an Arduino Uno and an internal battery.
---

# Water Bottle Scale

A scale that measures how much water is left in a water bottle. It uses a load sensor to read
the remaining weight, runs from an internal rechargeable battery, and the enclosure is sealed
against water so it survives being around a bottle that gets refilled and spilled.

Built on an Arduino Uno.

## Still to write up

Everything above is what Victor has stated about the build. The points below are genuinely not
recorded yet, and this file deliberately does **not** guess at them — `draft: true` keeps the
entry off the resume until there is a measured result to put on it.

- Which load cell and amplifier, and how the cell is mounted.
- How the seal is achieved, and what it is rated for.
- Battery chemistry, capacity, charge circuit, and measured runtime.
- How readings are calibrated and how drift is handled.
- One measured number — accuracy in millilitres or grams, or battery life.
- Whether the reading is displayed on the device, or leaves it at all.

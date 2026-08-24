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

## The problem

> **To write:** what actually made this hard? Weighing something at rest is easy; a bottle
> that gets picked up, refilled and knocked over is not. Say what the real difficulty was.

## Architecture

> **To write:** which load cell and amplifier, how the cell is mounted, how the seal is
> achieved and what it is rated for, and the battery - chemistry, capacity, charge circuit.

## What did not work

> **To write:** what did you try first and abandon? A sealing approach, a mounting, a sensor
> that drifted? This section is the one interviewers remember.

## Measured results

> **To write:** one number. Accuracy in grams or millilitres, or measured battery runtime.
> This is what unlocks `draft: false` and a place on the resume.

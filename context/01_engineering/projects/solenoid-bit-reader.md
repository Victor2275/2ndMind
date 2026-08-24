---
updated: 2026-08-21
domain: engineering
stability: stable
summary: Macro-scale hard-disk-reader analog decoding falling magnetic bits at 100% accuracy.
read_when: Portfolio, robotics resume bullets, or embedded/instrumentation questions.
title: Solenoid Bit Reader
slug: solenoid-bit-reader
tier: 1
status: archived
year: 2026
category: hardware
tags: [esp32, electromagnetism, signal-processing, instrumentation, embedded]
stack: [ESP32, LM358N op-amp, 387-turn copper coil]
links: {}
image: /labs/solenoid_lab_image1.png
figure_count: 10
event: Physics 4BL
group_size: 2
resume_variants: [robotics]
public: true
bullets:
  - Built a macro-scale hard-disk-reader analog — a 387-turn copper coil on a high-permeability iron core, read by an ESP32 — decoding falling binary magnetic bits via Faraday's Law of Induction
  - Amplified sensor output 20x with an LM358N op-amp to fit the ESP32 ADC's 0-3.3V window, and calibrated bit-time windows against gravitational acceleration to establish the system's 40 mm resolution limit
  - Achieved 100% decoding accuracy across all binary test sequences using a start-bit clock synchronization scheme
---

# Solenoid Bit Reader

A hard drive reads data by sensing the magnetic field of bits passing a coil. This is that
mechanism rebuilt at a scale you can watch: magnets fall past a hand-wound solenoid under
gravity, and the induced voltage spike is decoded back into the binary sequence they encode.

## The problem

Faraday induction gives you a voltage proportional to the *rate of change* of flux, so a
falling magnet produces a brief spike rather than a level. Two constraints shaped the design:

- **The ESP32's ADC only reads 0-3.3V**, and the raw coil output was far below that. An
  LM358N operational amplifier stage provides 20x gain to bring spikes into readable range.
- **Gravity means the bits do not arrive at a constant rate.** Each successive magnet is
  moving faster than the last, so the time window for a bit shrinks continuously down the
  drop.

## Design decisions

**Presence-based encoding over polarity-based.** With a unipolar ADC, encoding a 1 as
north-up and a 0 as south-up would put half the signal below the readable floor. Encoding
instead as magnet-present versus empty-slot keeps every symbol inside the window, at the cost
of needing a clock to know when an empty slot went by.

**A start bit for clock synchronization.** Since empty slots produce no signal, the decoder
cannot count them directly. A known start bit establishes t=0, and a calibration matrix built
across three intervals maps the shrinking windows that follow.

## Results

Four binary sequences decoded at 100% accuracy. The calibration work established a 40 mm
resolution limit — closer than that and adjacent spikes merge at the velocities reached
toward the end of the drop.

## What did not work

> **To write:** what you tried first and abandoned, and why. Almost no student
> portfolio has this section, which is exactly why it is convincing to an engineer.

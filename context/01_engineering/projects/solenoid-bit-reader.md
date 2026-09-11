---
updated: 2026-08-29
domain: engineering
stability: stable
summary: Macro-scale hard-disk-reader analog decoding falling magnetic bits at 100% accuracy.
read_when: Portfolio, robotics resume bullets, or embedded/instrumentation questions.
title: Solenoid Bit Reader
slug: solenoid-bit-reader
order: 4
status: done
featured: true
year: 2026
category: hardware
tags: [esp32, electromagnetism, signal-processing, instrumentation, embedded]
stack: [ESP32, LM358N op-amp, 387-turn copper coil]
links: {}
image: /labs/solenoid_lab_image1.png
# 424x299 (1.42:1) against a 16:9 box. Pre-dates image_fit; `cover` was cropping the top and
# bottom off the apparatus diagram and upscaling a 424px-wide source. Same call as the other
# two diagrams: a figure is worth seeing whole.
image_fit: contain
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

## What did not work

Initially, reading voltage changes from the solenoid were too low, meaning the ESP-32 used in the project was unable to read and understand when a bit passed the sensor. The ESP-32 also was unable to read voltage changes fast enough, meaning measures had to be taken to ensure bits were not dropped, such as increasing the distance between bits.

## Results

Four binary sequences decoded at 100% accuracy. The calibration work established a 40 mm
resolution limit — closer than that and adjacent spikes merge at the velocities reached
toward the end of the drop.

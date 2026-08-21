---
updated: 2026-08-20
domain: engineering
stability: stable
summary: Macro-scale hard-disk-reader analog decoding falling magnetic bits at 100% accuracy.
read_when: Academic background, hands-on instrumentation, or portfolio questions.
title: Magnetic Inductance Verification Using a Solenoid Bit Reader
slug: solenoid
course: Physics 4BL
term: Spring 2026
date: 2026-06-05
collaborators: [Ethan Chang]
category: hardware
tags: [esp32, electromagnetism, signal-processing, instrumentation, embedded]
stack: [ESP32, LM358N op-amp, 387-turn copper coil]
report: ../../99_archive/solenoid_lab.md
hero_image: solenoid_lab_image1.png
image_count: 10
resume_variants: [robotics]
public: true
bullets:
  - >-
    Built a macro-scale hard-disk-reader analog: a 387-turn copper coil on a high-permeability iron core, read by an ESP32, decoding falling binary magnetic bits via Faraday's Law of Induction
  - >-
    Amplified sensor output 20x with an LM358N op-amp to fit the ESP32 ADC's 0-3.3V range, and calibrated bit-time windows against gravitational acceleration to establish the system's 40 mm resolution limit
  - >-
    Achieved 100% decoding accuracy across all binary test sequences using a start-bit clock synchronization scheme
---

# Magnetic Inductance Verification Using a Solenoid Bit Reader

Physics 4BL, Spring 2026 · 2026-06-05

## Abstract

Developed a macro-scale analog of a hard disk drive reader. A sensor built from a 387-turn copper coil wrapped around a high-permeability iron bolt core decoded encoded binary bits as magnets fell under uniform gravitational acceleration. ESP32 ADC constraints (0-3.3V) forced a presence-based encoding (magnet = 1, empty = 0); signals were amplified 20x with an LM358N operational amplifier. A calibration matrix across three intervals mapped the shrinking time windows caused by gravitational acceleration, establishing a 40 mm resolution limit. Four binary sequences were decoded with 100% accuracy using a start-bit clock synchronization scheme.

## Notes

Full report with figures and data: [`99_archive/solenoid_lab.md`](../../99_archive/solenoid_lab.md).
Figures live in `context/assets/labs/`. Group lab — co-authored with Ethan Chang.

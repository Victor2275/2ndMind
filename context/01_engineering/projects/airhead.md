---
updated: 2026-09-22
domain: engineering
stability: stable
summary: FRC 2023 robot whose arm and claw ran on pneumatics, gated by the shoulder encoder.
read_when: Portfolio, robotics resume bullets, or FRC and controls questions.
title: Airhead
slug: airhead
order: 7
status: done
year: 2023
category: robotics
tags: [frc, robotics, java, pneumatics, controls, state-machine]
stack: [Java, WPILib 2023, CTRE Phoenix, REVLib, navX, Limelight]
links:
  github: https://github.com/FRC1458/2023Robot
image: /assets/airhead_image1.jpg
# 1600x901 against a 16:9 box, so `cover` trims a few pixels off the sides rather than
# cropping anything out. The frame is deliberately a full-width band of the original
# portrait photo: it keeps the whole pneumatic cylinder stack and the 1458 bumper.
image_fit: cover
event: FRC Team 1458
group_size: 8
resume_variants: []
# `draft: true` because `bullets` is empty and two case-study sections are still
# `> **To write:**` prompts. Its only effect is to keep the entry out of printed resume
# output (Q339 leaves drafts unmarked on the public site), which is belt-and-braces next to
# the empty `resume_variants` — and it keeps the two fixture guards in `resume.test.ts` and
# `og.test.ts` armed, which need at least one draft in the vault to be testing anything.
draft: true
public: true
bullets: []
---

# Airhead

Team 1458's robot for the 2023 FRC season, CHARGED UP. Where the following two years moved
things with motors, this one moved them with air: the arm extension and the claw were both
double-acting pneumatic cylinders driven off a REV Pneumatic Hub, and the software's job was
to decide when it was safe to fire them.

## The problem

A pneumatic cylinder has two states and no middle. It cannot be commanded to a position, it
cannot be slowed down, and it cannot be asked where it is — which is fine for a claw and
dangerous for an arm that extends. Extend at the wrong shoulder angle and the arm drives
itself into the floor or into the robot's own frame at full line pressure, and the only
feedback the software gets is that something broke.

So the interesting part of this robot was not the pneumatics. It was the interlock around
them: the motor-driven shoulder joint, which *does* have position feedback, had to be the
thing that decided whether the air was allowed to fire at all.

## Architecture

**Pneumatics gated on an encoder the cylinders do not have.** `Solenoid` wraps a WPILib
`DoubleSolenoid` on a REV Pneumatic Hub, and two of them are instantiated — one for arm
extension, one for the claw. `Arm.extendArm()` refuses to fire unless the shoulder encoder
reads above 42°, and manual descent below 42° is blocked while the arm is extended. The
cylinder is binary; the condition that releases it is not.

**Arm angle from the motor's own integrated sensor, in degrees.** The shoulder runs on a
TalonFX whose integrated sensor position is scaled to degrees by a single constant, and
presets at 105°, 90° and 45° are reached by a two-speed approach: full speed more than 10° out,
backed off inside that, and a ±1.5° deadband that returns the arm to idle. A state enum
(`TOP`/`MIDDLE`/`BOTTOM`/`IDLE`) means a driver input cancels a preset rather than fighting it.

**Charge-station balance as an eight-state machine.** `Balancer` reads pitch off the navX and
walks a fixed sequence — orient, drive on, detect the ramp when |pitch| exceeds 8°, climb,
then alternate between forward and backward corrections at 0.05 output until pitch settles
inside the small-angle band, then lock the wheels. Each transition is either a pitch
threshold or a timer, so a stall in any one state times out into the next rather than
hanging on the platform.

**AprilTag alignment, partly.** `Aligner` reads a Limelight for horizontal offset, vertical
offset and target rotation and drives the swerve to square up to a scoring tag. The rotate
stage worked; the translate stage did not ship and is commented out in the file.

**LiDAR as a duty cycle.** `Lidar` reads a LaserShark over a DIO channel as a duty-cycle
input scaled to a 4 m full scale — used in the autonomous approach to stop at the scoring
node.

## What did not work

> **To write:** the autonomous scoring routine never got past "not tested" — what actually
> went wrong on the field, and what was chosen instead. Same for the Limelight translate
> stage, which is commented out in `Aligner` rather than deleted.

## Measured results

> **To write:** one number from competition. How often the balance routine actually got the
> charge station level, or where the team placed. The code establishes the mechanism; this
> section is what it did.

## Notes

30 Java files, roughly 1,900 lines, 122 commits from 8 contributors over the 2023 season.
Victor's 18 commits are concentrated in `Robot`, `Balancer`, `Limelight`, `Lidar` and the
first autonomous routine.

**Off the printed resume**, along with the other two robots — measured, not assumed: the
robotics variant already prints at 0.83 of a page, and adding any project entry to it
paginates to two (D-339). `experience/first-robotics.md` carries the 2021–2025 arc there
instead. Reverse by adding `robotics` to `resume_variants` here, writing the `bullets` list,
and re-running `npm run shots` to see what it costs.

**Autonomous carries a real bug**, left as found: `Autonomous.scoreStart()` opens with
`if (finishedScoring = false)`, an assignment rather than a comparison, and the `arm`,
`swerve` and `lidar` fields it then calls are never assigned. Worth mentioning only because
the commit that added it says "not tested", which is accurate.

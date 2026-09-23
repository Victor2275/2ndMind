---
updated: 2026-09-23
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
public: true
bullets:
  - >-
    Programmed a FIRST Robotics competition robot whose arm and claw ran on pneumatics,
    gating every cylinder actuation on the shoulder joint's encoder so the arm could not
    extend into the floor or the frame at full line pressure
  - >-
    Built an eight-state charge-station balancing routine driven by navX pitch, using
    threshold and timeout transitions so a stall in any state advanced rather than hung
  - >-
    Integrated a Limelight vision pipeline and a duty-cycle LiDAR rangefinder for AprilTag
    alignment and scoring-node approach
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

The robot ran out of air. Not once, as an accident — as a pattern, in the back half of
matches, because too much of it was on pneumatics and a stored-air system does not refill on
demand. What an on-board compressor may do during a match is limited by the rules, so the
tank is a budget: every arm extension and every claw actuation spends from it, and by late in
a match the pressure left was not enough to drive the arm reliably.

That reframes the interlock this page opens with. Gating extension on the shoulder encoder
solved the mechanical failure — the arm never fired at an angle that would break something —
and did nothing about the resource failure, because the constraint that actually bit was not
*when* the cylinder fired but *how many times*. Nothing in the software counted actuations or
knew what pressure remained; there is no pressure sensor read anywhere in this codebase.

The autonomous is the other unfinished piece. `Autonomous.scoreStart()` never got past its
"not tested" commit and would not have run if it had: the `arm`, `swerve` and `lidar` fields
it calls are never assigned, and its guard is written `if (finishedScoring = false)` — an
assignment rather than a comparison, which makes the condition always false. The Limelight
translate stage is in the same state, commented out in `Aligner` rather than deleted, leaving
alignment as rotate-only.

This is the direct reason the 2024 robot has no pneumatics at all.

## Measured results

23rd of 46 at the Sacramento Regional.

The robot competed at the maximum allowed weight, as the 2025 robot did — a constraint the
compressor, the tank and the air lines were all spending from. The 2024 robot, which dropped
pneumatics entirely, came in under the cap.

## Notes

30 Java files, roughly 1,900 lines, 122 commits from 8 contributors over the 2023 season.
Victor's 18 commits are concentrated in `Robot`, `Balancer`, `Limelight`, `Lidar` and the
first autonomous routine.

**Off the printed resume**, along with the other two robots — measured, not assumed: the
robotics variant already prints at 0.83 of a page, and adding any project entry to it
paginates to two (D-339). `experience/first-robotics.md` carries the 2021–2025 arc there
instead. The `bullets` above are written and true, so enabling it is one field: add
`robotics` to `resume_variants` and re-run `npm run shots` to see what it costs.

**The autonomous bug is now stated on the public page**, in "What did not work", rather than
hidden here — it is a fair thing to own next to a commit that says "not tested", and the page
is stronger for saying what shipped broken than for implying everything shipped.

**Competition placing and the weight comparison come from Victor** (2026-09-23), not from the
repository, which holds software only. No pressure sensor is read anywhere in the code, so
the air-budget account is his too.

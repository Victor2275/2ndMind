---
updated: 2026-09-22
domain: engineering
stability: stable
summary: FRC 2025 robot with a Motion Magic elevator and runtime-generated AprilTag approaches.
read_when: Portfolio, robotics resume bullets, or FRC and autonomy architecture questions.
title: Lemonlight
slug: lemonlight
order: 9
status: done
year: 2025
category: robotics
tags: [frc, robotics, java, autonomous, controls, pid, vision, apriltag]
stack: [Java, WPILib 2025, CTRE Phoenix 6, PathPlanner, AdvantageKit, LaserCAN, Limelight]
links:
  github: https://github.com/FRC1458/Robot2025
image: /assets/lemonlight_image1.jpg
# 1600x898 against a 16:9 box; `cover` trims a few pixels off the sides. The close-up that
# actually shows the elevator is Fig. 2, which the gallery renders `contain` at its own
# aspect ratio, so it does not need to be the hero to be readable.
image_fit: cover
figure_count: 3
event: FRC Team 1458
group_size: 14
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

# Lemonlight

Team 1458's robot for the 2025 FRC season, REEFSCAPE. The codebase is a different animal from
the two before it — roughly 12,700 lines across 100 files against the previous year's 3,400,
rebuilt around a subsystem-and-looper architecture with its own odometry, motion planning and
vision stack. Victor's share of it was the elevator, the coral scoring actions and the teleop
bindings that drive them.

## The problem

Scoring on the reef is a two-axis problem that has to close in about a second and a half. The
robot has to be at the right place relative to an AprilTag, and the elevator has to be at the
right one of four heights, and neither can wait for the other. Get the order wrong and the
carriage swings into the reef; run the elevator while a coral is still crossing the intake
and it jams against the frame.

The elevator is also the part of the robot with the most stored energy and the shortest
distance to a broken mechanism. Driving it open-loop means every height is the driver's thumb
and the top of its travel is whatever stops it.

## Architecture

**The elevator is a Motion Magic position loop, not a speed.** Two Krakens run as a
leader-follower pair under Phoenix 6 `MotionMagicVoltage`, profiled at 40 rps cruise, 72.5
rps² acceleration and a jerk limit, with position gains on slot 0 and a static feedforward
term for the friction it has to break out of. Eight named setpoints — ground, L2, L3, L4, the
algae presets and a default height chosen to clear the reef without blocking the front camera
— are addressed by name rather than by number, so the same height means the same thing in
teleop and in autonomous. "At target" is a half-rotation tolerance read off a value cached in
`readPeriodicInputs`, not a live motor query, because the callers are on other threads.

**Three interlocks, each guarding a different failure.** The move is refused outright while
the intake LaserCAN reads under 100 mm — a coral in the throat means the elevator does not
go anywhere. A `mSafeStop` flag is raised on every enable, so a robot powered on mid-cycle
holds position rather than driving to a target left over from the last match. A bank of
magnetic switches on DIO 0–4 backs the encoder at ground, L2, L3, L4 and the algae position.
Stator and supply current are both limited to 40 A, which is what turns a jam into a stall
instead of a fire.

**Autonomous routines are a string.** `AutoStringAuto` parses a small language into nested
actions: bare tokens name field points and generate the trajectory between them, brackets
run actions in parallel, parentheses in series, braces repeat, and `CIntake`, `CShoot`,
`Elevator 4` and `Snap LEFTBAR` are the verbs. A new routine is a new string, which means it
can be changed between matches by someone who is not editing Java.

**Approaches are generated at runtime, not drawn in advance.** `SnapToTag` takes an offset
name — left bar, right bar, centre, coral station, hang — looks up the nearest matching
AprilTag from the field layout, and builds a PathPlanner path from the robot's *current* pose
to that offset, with its own constraints zone for the final approach. The same action is
bound to the driver's bumpers in teleop and dropped into autonomous strings unchanged.

**Faster swerve, deliberately.** The drivetrain is SDS MK4i on Kraken X60s at the L3 drive
ratio — the fast option of the three — with the module constants pulled from a shared table
rather than transcribed. Pose comes from a wheel tracker fused with a multi-camera vision
manager that runs candidate poses past an acceptor before they are allowed to move the
estimate.

## What did not work

> **To write:** the elevator went "switched to PID based system (untested)" → "elevator pid" →
> "Elevator Working" over four days in February. What was the open-loop version doing that
> forced the change, and what did tuning it cost? The constants file still carries "occasionally
> stalls at bottom" and "stalls at top" next to the ground and L4 heights.

## Measured results

> **To write:** one number from competition. Cycle time on the reef, autonomous scoring
> reliability, or where the team finished.

## Notes

100 Java files, roughly 12,700 lines, 384 commits from 14 contributors between January and
the March 2025 competition. Victor's 51 commits are the third largest share and sit almost
entirely in `Elevator`, `Constants`, `RobotContainer25`, the teleop `Controller`, the coral
shooter and the elevator autonomous actions.

**Verify before publishing:** the magnetic-switch bank exists as `DigitalSensor` with five
channels wired and read, but the SmartDashboard readout of it in `RobotContainer25` is
commented out in the final state of the repository, and no other file calls `getSensor`. The
sentence above describes the hardware as wired; whether the switches were live as an interlock
at competition is Victor's to confirm.

**Off the printed resume**, along with the other two robots — the robotics variant has no
room for another project entry (D-339, and the comment in `slipknot.md` has the numbers).
Reverse by adding `robotics` to `resume_variants` here, writing the `bullets` list, and
re-running `npm run shots`.

There is a video of this robot at `context/assets/originals/2025RobotVideo.mp4`, on Victor's
machine only — that folder is gitignored (D-338). The site has no video support and the asset
sync only copies images, so it is not published either way.

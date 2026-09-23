---
updated: 2026-09-23
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
public: true
bullets:
  - >-
    Built the elevator subsystem for a FIRST Robotics competition robot as a Motion Magic
    closed-loop position controller over a leader-follower Kraken pair, with eight named
    scoring setpoints addressed by name across both teleoperated and autonomous control
  - >-
    Designed three independent safety interlocks — a time-of-flight range gate that refuses
    motion while game material is in the intake, a safe-stop flag that holds position on
    every enable, and a magnetic limit-switch bank backing the encoder at five heights
  - >-
    Implemented coral scoring actions and driver control bindings against a subsystem-and-
    looper architecture, including runtime-generated AprilTag approach paths
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
magnetic switches on DIO 0–4 backs the encoder at ground, L2, L3, L4 and the algae position,
and was live at competition — an encoder that has drifted still reports a plausible number,
and these are the sensors that do not. Stator and supply current are both limited to 40 A,
which is what turns a jam into a stall instead of a fire.

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

The binding constraint on this robot was not a control problem. It was time on the hardware.
Mechanical failures — the arm broke, among others — took the robot out of service repeatedly
during a six-week build, and every hour it spent being repaired was an hour the elevator
could not be tuned on. Software that closes a loop around a physical mechanism cannot be
finished away from it: the gains, the setpoint heights and the current limits are all numbers
that only the real machine can tell you, and they were found in whatever windows the robot
was actually assembled.

What that cost is legible in the constants file, which still carries "occasionally stalls at
bottom" beside the ground height and "stalls at top" beside L4. Both are the profile pushing
against a hard stop it was never given time to be trimmed away from, and both were shipped
rather than fixed, because the alternative was not shipping an elevator.

The move to closed loop happened in that same compressed window — "switched to PID based
system (untested)" on February 18, "elevator pid" the next day, "Elevator Working" on the
22nd. Four days from an untested rewrite to a working mechanism is fast, and it is fast
because there was no slower option available.

## Measured results

13th of 35 at the Pinnacles Regional and 19th of 41 at the San Francisco Regional.

The robot ran at the maximum allowed weight, as the 2023 robot did. Of the team's three
robots in this portfolio, only the 2024 one came in under the cap.

## Notes

100 Java files, roughly 12,700 lines, 384 commits from 14 contributors between January and
the March 2025 competition. Victor's 51 commits are the third largest share and sit almost
entirely in `Elevator`, `Constants`, `RobotContainer25`, the teleop `Controller`, the coral
shooter and the elevator autonomous actions.

**The magnetic switches were live at competition**, confirmed by Victor 2026-09-23. Worth
recording because the repository alone does not show it: `DigitalSensor` wires five channels,
but the only call to `getSensor` left in the final tree is a commented-out SmartDashboard
readout in `RobotContainer25`. Reading the code cold would suggest the bank was never used.

**Competition placings, the weight comparison and the account of what the mechanical failures
cost all come from Victor** (2026-09-23), not from the repository, which holds software only.

**Off the printed resume**, along with the other two robots — the robotics variant has no
room for another project entry (D-339, and the comment in `slipknot.md` has the numbers).
The `bullets` above are written and true, so enabling it is one field: add `robotics` to
`resume_variants` and re-run `npm run shots`.

There is a video of this robot at `context/assets/originals/2025RobotVideo.mp4`, on Victor's
machine only — that folder is gitignored (D-338). The site has no video support and the asset
sync only copies images, so it is not published either way.

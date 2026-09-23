---
updated: 2026-09-23
domain: engineering
stability: stable
summary: FRC 2024 robot that reached the World Championships on a four-note autonomous.
read_when: Portfolio, robotics resume bullets, or FRC, controls and state-machine questions.
title: Slipknot
slug: slipknot
order: 8
status: done
featured: true
year: 2024
category: robotics
tags: [frc, robotics, java, autonomous, state-machine, controls, pathplanner]
stack: [Java, WPILib 2024, CTRE Phoenix 6, PathPlanner, Choreo, navX]
links:
  github: https://github.com/FRC1458/2024Robot
image: /assets/slipknot_image1.jpg
# 847x476 against a 16:9 box, so `cover` fits it with no visible crop. Replaced an 805px
# field shot on 2026-09-23: this is the featured card, which is the largest image slot on
# the site, and the robot is side-on, moving, with its LEDs lit and the bumper legible.
image_fit: cover
figure_count: 3
event: FRC Team 1458
group_size: 7
# Empty, and measured rather than assumed. The robotics variant prints at 0.83 of a page
# without this entry and 0.90 with it — and 0.90 paginates to two pages, which is the gate
# D-117 set. One bullet overflows it as well (0.90), and so does trading two bullets off the
# FIRST Robotics role entry to pay for it. Adding any project to that variant now costs more
# room than the variant has, and which good content to cut for it is Victor's call, not a
# guess (D-339). `bullets` below is written and true, so this is one field from the resume
# the day there is room: set `resume_variants: [robotics]` and re-run `npm run shots`.
resume_variants: []
public: true
bullets:
  - >-
    Built the autonomous scoring routine for a FIRST Robotics competition robot that
    qualified for the FRC World Championships, chaining eight PathPlanner trajectories
    through a sixteen-state machine to score four notes in the fifteen-second period
  - >-
    Replaced fixed spin-up delays with a closed-loop readiness check, gating the feeder on
    measured flywheel speed from two TalonFX motors under CTRE Phoenix 6 velocity control
  - >-
    Designed a generic timestamp-driven state machine used for both teleoperated shot
    sequencing and autonomous routines, and an interface split that let the intake, feeder
    and shooter run under either manual or automatic control without duplicated logic
---

# Slipknot

Team 1458's robot for the 2024 FRC season, CRESCENDO, and the one that went to the World
Championships. Mechanically it was the opposite of the year before: the pneumatics were gone,
the mass came down, and the centre of mass came with it. In software that bought something
specific — a robot that could be asked to drive a path and shoot on the way, and would
actually arrive.

## The problem

Fifteen seconds of autonomous, and the scoring cycle is: shoot what you are holding, drive to
a note, pick it up, drive back, shoot. Four notes means that cycle four times with no human
in the loop, and every stage of it can fail silently. The note does not always get picked up.
The flywheels do not always reach speed before the feeder pushes. A path that assumes the
last one finished cleanly starts from the wrong pose.

A routine written as a list of timed steps handles none of that. It handles the run where
everything works, and on the run where the note slips it keeps going anyway and scores
nothing for the rest of the period.

## Architecture

**One state machine, two jobs.** `StateMachine<S>` is thirty lines: a map from a state to a
function of elapsed milliseconds, returning the next state or null to stay. Three helpers
build the states that come up — `addTimerState` for "do this for N ms then move on",
`addBoolState` for "do this until the condition holds", `addOffState` for a terminal state.
That is the whole abstraction, and it drives both the teleoperated shot sequence and every
autonomous routine, which means the autonomous is built out of pieces that have been running
all match rather than out of code that only executes in the first fifteen seconds.

**The four-note autonomous is sixteen states over eight trajectories.** `NonGoofyCenterAuto`
alternates in-and-out PathPlanner paths (`InN2`/`OutN2`, `InN3`/`OutN3`, …) with shoot states,
and the transitions are conditions rather than clocks: a shoot state ends when the IR
beam-break says the note has left, an approach state ends when the trajectory reports it has
finished sampling. The intake runs only after a per-path settling delay, tuned separately
per note, so the feeder is not dragging against a note that has not seated yet.

**Shot readiness is measured, not waited for.** `Shooter` runs two TalonFX flywheel motors
under Phoenix 6 `VelocityVoltage` with a velocity-feedforward gain, and `shooterRampedUp()`
reports true when the mean measured wheel speed passes 90 rps. The speaker shot transitions
`SPIN_UP → SHOOT` on that signal; the fixed 1500 ms timer version of the same transition is
still in the file directly above it, commented out. That one-line change is the difference
between a shot that is on time and a shot that is on schedule.

**An interface, so manual and automatic are not two copies.** `IFS` — intake, feeder,
shooter — is a four-method interface with two implementations. `IFSManual` maps controls
straight through; `IFSAuto` puts the same subsystems behind three state machines, one per
shot type (speaker, amp, and a max-power shot), and adds the operator overrides that matter
at competition: an intake override for when the beam-break is lying, and live amp-speed trim
on the second controller's D-pad.

**Hand-rolled PID with the two terms that were actually needed.** `swervedrive/PID` decays
the integral term instead of accumulating it without bound, and clamps output slew to a
configured maximum acceleration. Every gain is readable and writable from SmartDashboard, so
tuning happened between matches rather than between builds.

## What did not work

The autonomous was never finished, only improved. The commit trail is the honest record of
it: "Auto sorta-ish not working" on April 2, "3-Note Auto (not consistent needs tuning)" and
"4 Note auto worked once" on April 4, and "WORKING CODE: 4 NOTE AUTO" seventeen days later.
Between those two dates the routine did not get a new design; it got accuracy, one note at a
time.

What made it inconsistent was that the errors were not constant. Each note in the sequence
sits further from the starting position than the last, so each one gives the drivetrain more
distance to accumulate heading and translation error before the intake has to be in the right
place — and the carpet it accumulated that error on was not the same carpet twice. A routine
tuned on the practice field did not reproduce on a competition field, and a routine tuned for
three notes did not simply extend to four.

That shows up in the code as numbers that grow. The settling delay before the intake is
allowed to run is tuned per note rather than shared: 900 ms on the first, 1250 ms on the
second, 1350 ms on the third, and none at all on the fourth, where the approach is long
enough that the note has already seated. Those four constants are what three weeks of
iteration produced, and they are the reason the routine works at four notes rather than
scoring one and then dragging the intake against a note that had not arrived yet.

## Measured results

Second alliance at the East Bay Regional, knocked out in the finals, and the season ended at
the FRC World Championships — the only one of the team's three robots in this portfolio to
get there.

The robot also came in under the competition weight limit, which the 2023 and 2025 robots did
not: both of those ran at the cap. That is the whole of what "lighter" means here — the actual
figures are not recorded anywhere Victor still has.

## Notes

44 Java files, roughly 3,400 lines, 117 commits from 7 contributors over the season. Victor
is the largest single contributor at 41 commits, concentrated in `Robot`, the `IFSAuto` shot
sequencing, `Shooter`, the autonomous routines and the LED signalling.

**The pneumatics were removed rather than kept.** `CompressorWrapper` and `SolenoidWrapper`
carry over from the 2023 codebase with their bodies commented out — the compressor, the
tanks and their mass came off the robot, which is where the weight saving in this year's
design partly came from.

**The four-note autonomous was later commented out**, in the last commit on the repository
(2025-01-08, "removed auto (outdated), for driver practice"). It is live in the tree as of
the Worlds commit on 2024-04-19.

Mechanical claims on this page — lighter, lower centre of mass — come from Victor and are
not derivable from the repository, which holds software only.

**Bullets written, resume entry not taken.** The three `bullets` above are the resume lines
this project would contribute, and they are true as written — the variant simply has no room
for them yet (D-339). They are kept rather than deleted so that enabling the entry is one
field, not a rewrite.

**Competition results and the weight comparison come from Victor** (2026-09-23), not from the
repository, which holds software only.

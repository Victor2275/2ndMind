---
updated: 2026-09-22
domain: engineering
stability: stable
summary: SWE internship building a hybrid RL and classical local planner for autonomous vehicles.
read_when: Resume work, interview prep, experience questions.
title: Software Engineering Intern
org: Dimaag.ai
slug: dimaag
order: 1
type: internship
date_start: 2026-06
date_end: 2026-08
ongoing: true
resume_variants: [robotics, ml, swe]
public: true
bullets:
  - >-
    Developed a hybrid reinforcement-learning and classical local planner for autonomous
    vehicle trajectory tracking on complex paths
  - >-
    Validated and deployed autonomous navigation policies on physical hardware, achieving
    reliable tracking at >10 mph with sub-decimeter trajectory accuracy
  - >-
    Implemented PPO algorithm training pipelines and 2D LiDAR sensor raycasting within
    NVIDIA Isaac Lab
  - >-
    Bridged the sim-to-real gap by validating policies across various simulators,
    implementing domain randomization to ensure seamless hardware deployment
  - Reduced mean tracking error by 80% over the classical planner
confidential_scope: >-
  Shareable, and safe for resumes, interviews, and portfolio material: the bullets in this
  file — hybrid RL/classical local planner, PPO training pipelines, 2D LiDAR raycasting,
  NVIDIA Isaac Lab, sim-to-real validation across simulators, domain randomization, >10 mph
  tracking with sub-decimeter accuracy, and the 80% reduction in mean tracking error over the
  classical planner. NOT shareable as of 2026-08-29, pending clearance from Dimaag: anything
  about the research paper's specifics — the vehicle class and mass, TRPO with IPO barrier
  constraints, the bounded-correction architecture, cross-track error budgets, lap geometry,
  simulator-calibration detail, and every number measured in simulation. Describe that work
  only as "a first-author paper on reinforcement-learning navigation for autonomous ground
  vehicles, in progress" — no method, no architecture, no numbers. Dimaag.ai business and
  product details remain confidential and are deliberately not recorded anywhere in this
  vault. If a question needs specifics not found here, say so rather than speculating.
---

# Software Engineering Intern — Dimaag.ai

Developed a hybrid reinforcement-learning and classical local planner for autonomous
vehicles. Ongoing as of 2026-08-29, with a research paper added to the scope.

## Key contributions

- Implemented PPO training pipelines, 2D LiDAR raycasting, and domain randomization in
  NVIDIA Isaac Lab.
- Validated policies across simulators and physical hardware (tracking >10 mph with
  sub-decimeter accuracy).
- Reduced mean tracking error by 80% against the classical planner.

## Notes

The research paper had its own project entry, `projects/dimaag-paper.md`, until 2026-09-22,
when Victor took it off the portfolio (D-337). This file is now the only record of it. Its
technical content is internal until Dimaag clears it — see `confidential_scope` above, which
names exactly what may and may not be said. The repository is private and has not been read
by any assistant; nothing in this vault is derived from it.

The paper itself is unaffected by that removal: it is still in progress, and if it clears and
Victor wants it back on the site it returns as a new project file with the next `order:`.

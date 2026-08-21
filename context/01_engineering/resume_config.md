---
updated: 2026-08-21
domain: engineering
stability: stable
summary: Skill groups, coursework line, and per-variant headlines that configure the generated resume.
read_when: Resume generation, or changing what appears on a resume variant.
skills:
  - group: Programming Languages
    variants: [robotics, ml, swe]
    items: [Python, C++, C, Java, JavaScript, TypeScript, Assembly]
  - group: Robotics & Embedded
    variants: [robotics, ml]
    items:
      [ROS, NVIDIA Isaac Lab, ESP32, PID Control, LiDAR, Sensor Integration, Computer Vision]
  - group: Machine Learning
    variants: [ml, robotics]
    items: [PyTorch, Reinforcement Learning, PPO, Domain Randomization, Sim-to-Real]
  - group: Web & Backend
    variants: [swe, ml]
    items: [React, Node.js, Express, Socket.io, MongoDB, Next.js]
  - group: Tools & Hardware
    variants: [robotics, ml, swe]
    items: [Git, Docker, Linux, SolidWorks, 3D Printing]
coursework:
  [
    Algorithms and Complexity,
    Software Construction,
    Object-Oriented Design,
    Programming Languages,
    Discrete Structures,
    Linear Algebra,
    Logic Design,
  ]
variants:
  - id: robotics
    label: Robotics
    headline: Autonomous systems — reinforcement-learning planners, LiDAR and vision pipelines, and the embedded instrumentation underneath them.
  - id: ml
    label: Machine Learning
    headline: Reinforcement learning applied to physical systems, from PPO training pipelines in simulation through validated hardware deployment.
  - id: swe
    label: Software Engineering
    headline: Full-stack systems with real-time synchronization and AI-assisted data pipelines, built and tested end to end.
---

# Resume Configuration

Drives `/resume/[variant]` on the site and the generated `99_archive/resume.md`.

## Why this file exists

The resume must be a **generated artifact**, not a maintained document. Experience and project
bullets already live in their own canonical entries, and duplicating them into a hand-written
resume guarantees the two drift. What was *not* already in the vault is the connective tissue:
which skills to list, in what groups, and which of the three variants each group belongs to.
That is what this file holds, and nothing else.

## Editing rules

- **Skills** appear in file order, filtered by `variants`. To emphasise a group for a
  particular variant, move it up; to drop it, remove that variant from its list.
- **Coursework** is a single line on every variant. Keep it to courses that signal capability
  to an engineer reading quickly; grades are never published.
- **Headlines** are one sentence, written in the third person implied by a resume summary
  line. They are the only variant-specific prose on the document.

Everything else — which roles, projects, and labs appear — comes from the `resume_variants`
field on each canonical entry. Add or remove a variant there, not here.

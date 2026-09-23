---
updated: 2026-08-29
domain: engineering
stability: stable
summary: Java maze-solving simulator with Flood Fill pathfinding and a visualization engine.
read_when: Portfolio, resume bullets, or "what have you built" questions.
title: Micromouse Simulator
slug: micromouse-simulator
order: 5
status: done
year: 2023
category: robotics
tags: [algorithms, simulation, visualization]
stack: [Java, Java Graphics]
links:
  github: https://github.com/Victor2275/MicroMouseSim
image: /assets/MicromouseSim.png
# 606x649 — nearly square. `cover` would crop the top and bottom off the maze and upscale
# what is left, so it is fitted whole onto a padded surface instead.
image_fit: contain
resume_variants: [robotics, swe]
public: true
bullets:
  - Designed a full maze-solving simulator for Micromouse competitions using Java
  - Implemented Flood Fill pathfinding algorithm to autonomously solve unknown mazes
  - >-
    Built a graphical visualization engine using Java Graphics to animate traversal and
    decisions
  - Developed file parsing pipeline to load and replay real competition mazes
---

# Micromouse Simulator

## The problem

Micromouse is a popular competition where you build a small robot to traverse a maze quickly and return back to the start. While maze-solving algorithms are available to research and find online, if someone wants to test a certain algorithm against a maze prior to testing on Hardware, is is important that a clean visualizer is used.

## Architecture

Maze-solving simulator featuring Flood Fill pathfinding algorithm and a graphical
visualization engine. Uses a file parsing pipeline to load competition mazes. Run on Java

## What did not work

When originally testing this project, it ran very slowly due to attempting to re-generate the entire maze/re-run maze solving algorithms every frame. This was fixed using concepts/algorithms learned to reduce time complexity, and now the program runs much faster.

## Measured results

The solver runs one wavefront pass per distance layer over the 16x16 grid — O(n·d) for n
cells and d the longest path, bounded by the grid rather than by the maze, so a full solve is
instant. The first implementation was not: it copied the visited-set at every recursive call,
making each step O(n) on its own and the whole solve visibly slow to watch.

## Post-mortem

Learned various algorithms to solve mazes, and learned how to iterate and understand big O. I also got more familiar with the Java programming language.

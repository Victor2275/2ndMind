---
updated: 2026-08-29
domain: engineering
stability: volatile
summary: Full-stack recipe PWA with AI-assisted import and real-time cross-device timers.
read_when: Portfolio, resume bullets, or "what have you built" questions.
title: Proof
slug: proof
order: 4
status: done
year: 2026
category: software
tags: [web, ai, pwa, full-stack]
stack: [React, MongoDB, Cheerio, Gemini API, Socket.io]
links:
  live: https://proof-cdvj.onrender.com
image: /assets/Proof.png
# 1869x964 (1.94:1) against a 16:9 box -- close enough that `cover` crops a few pixels off
# the sides rather than beheading anything, which is the right trade for a UI screenshot
# that should fill its card.
image_fit: cover
resume_variants: [swe, ml, robotics]
# Two bullets on robotics, three elsewhere. Proof earns a place on the robotics resume for
# the engineering behind it, but a robotics reader does not need the Socket.io timers or the
# test count -- and the variant has to stay on one printed page.
resume_bullets:
  robotics: 2
public: true
bullets:
  - >-
    Architected a full-stack progressive web application (PWA) with MongoDB and React to
    version-control recipe iterations and manage real-time inventory states
  - >-
    Integrated the Gemini API and web scraping (Cheerio) to autonomously extract,
    intelligently restructure, and import recipes directly from raw URLs
  - >-
    Engineered a real-time, cross-device timer synchronization system using Socket.io to
    track concurrent baking stages across multiple platforms
  - >-
    Maintained application stability by creating over 100 automated test cases to prevent
    bugs during new feature deployments
---

# Proof

## The problem

Often, when I am trying to bake, I like to take photos of my food and make changes to recipes that I am making. While other online recipe books do exist, they were either behind a paywall, or did not have features that I wanted like photo storage, 1-off recipe corrections, and ease-of-use features. I made this website to not only store my recipes, but also easily look at them while baking with hands-free features and sharing posts of baked goods I created.

## Architecture

Full-stack progressive web app (PWA) with MongoDB/React. Real-time cross-device sync via
Socket.io. Gemini API handles extracting and restructuring recipe data from scraped URLs.

## What did not work

Originally, got too trigger happy with adding features without considering ease of use. While on computer using the app was fine, using the app on mobile (the intended usage) was very cramped and bloated, making it hard to work with. This required UI and feature revision to ensure that the app stays clean on mobile and computer.

## Measured results

99 automated tests across 22 test files guard the app, which runs to 40 React components and
roughly 9,000 lines across client and server, on 31 runtime dependencies.

## Post-mortem

Still in progress, no post-mortem yet.

## Notes

Hosted on Render's free tier, which sleeps after roughly 15 minutes idle. A external pinger
hits the backend every 5 minutes to keep it warm. This works, but it consumes most of a free
Render account's monthly instance-hour allowance on a single service.

---
updated: 2026-08-20
domain: engineering
stability: volatile
summary: Full-stack recipe PWA with AI-assisted import and real-time cross-device timers.
read_when: Portfolio, resume bullets, or "what have you built" questions.
title: Proof
slug: proof
tier: 1
status: active
year: 2026
category: software
tags: [web, ai, pwa, full-stack]
stack: [React, MongoDB, Cheerio, Gemini API, Socket.io]
links:
  live: https://proof-cdvj.onrender.com
resume_variants: [swe, ml]
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

> **To write:** what were you actually solving, and what made it hard? The constraint
> is the interesting part - what you could not do, or could not afford, or could not
> measure. This is the section interviewers open with.

## Architecture

Full-stack progressive web app (PWA) with MongoDB/React. Real-time cross-device sync via
Socket.io. Gemini API handles extracting and restructuring recipe data from scraped URLs.

## What did not work

> **To write:** what you tried first and abandoned, and why. Almost no student
> portfolio has this section, which is exactly why it is convincing to an engineer.

## Measured results

> **To write:** one number, ideally more. Accuracy, latency, throughput, uptime, scale.
> A result without a number reads as a claim; with one it reads as engineering.

## Post-mortem

Still in progress, no post-mortem yet.

## Notes

Hosted on Render's free tier, which sleeps after roughly 15 minutes idle. A external pinger
hits the backend every 5 minutes to keep it warm. This works, but it consumes most of a free
Render account's monthly instance-hour allowance on a single service.

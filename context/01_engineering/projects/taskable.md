---
updated: 2026-08-29
domain: engineering
stability: stable
summary: Hackathon education app linking student and teacher views with AI task breakdowns.
read_when: Portfolio, resume bullets, or "what have you built" questions.
title: TaskAble
slug: taskable
order: 8
status: done
year: 2026
category: software
tags: [web, ai, hackathon, education]
stack: [React, Firebase Firestore, Gemini API]
event: UCLA HOTH
links:
  github: https://github.com/Victor2275/HOTHproject
image: /assets/taskable.png
# 1428x910 (1.57:1) against a 16:9 box — `cover` cropped the "TaskAble (Teacher View)"
# heading off the top. A UI screenshot is worth seeing whole.
image_fit: contain
resume_variants: [swe, ml]
public: true
bullets:
  - >-
    Built an educational web app linking student interfaces to a teacher dashboard through
    Firebase Firestore, developed with a small team during UCLA HOTH
  - >-
    Integrated the Gemini API to generate task breakdowns that decompose assignments into
    manageable steps for students
  - >-
    Implemented a reward system and emotion logging to track student engagement alongside
    task completion
---

# TaskAble

Built at UCLA HOTH (Hack on the Hill).

## The problem

The idea behind the app was to have a learning tool to help teachers assist children with learning disabilities. One of the project members worked with a developmental learning lab, and mentioned that some kids need simple, repeated tasks need to be broken down more for kids to understand what to do (i.e getting started for class, the student needs to sit down, take their pencils out, take their book out, turn to a blank page, etc). This project intends to help teachers do that, while keeping students engaged through a point system.

## Architecture

Educational web app linking student interfaces to a teacher dashboard via Firebase. Gemini
API generates task breakdowns. Features reward system and emotion logging.

## What did not work

Many features were difficult to implement as this was a short hackathon, and we had to accomodate for the fact that the primary audience was both teachers and students who struggled with learning, meaning the UI had to be simple to navigate while also getting the necessary point across.

## Post-mortem

Began to understand how to use AI workflows, as well as working in a small team of
non-technical people.

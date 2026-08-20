# 2ndMind Dashboard

This dashboard aggregates data across the 2ndMind context repository using Obsidian Dataview. 

## Active Projects
```dataview
TABLE status, date
FROM "01_engineering" OR "context/01_engineering"
WHERE contains(status, "Active") OR contains(status, "In Progress")
```

## Professional Experience
```dataview
TABLE role, date
FROM "01_engineering" OR "context/01_engineering"
WHERE role != null
```

## Coursework Status
*(Note: Dataview table queries work best when each item is its own file. Because we stored multiple courses and projects in single files, Dataview groups them by the file name.)*
```dataview
TABLE grade
FROM "01_engineering/coursework_and_labs.md" OR "context/01_engineering/coursework_and_labs.md"
WHERE contains(grade, "In Progress")
```

---
updated: 2026-09-06
domain: engineering
stability: volatile
summary: Scoping questionnaire for V4, the UI overhaul. 484 questions. Answers become docs/V4_PLAN.md.
read_when: Scoping V4, or answering these.
---

# V4 — Scoping Questions

**484 questions.** V3 was scoped by 44 and that was enough because V3 was mechanism: it either
syncs or it does not. V4 is judgement, and judgement cannot be inferred from a codebase. Every
question below is one where a wrong guess costs a rebuild.

## How to answer

Every question carries a **default** marked `→`. The defaults are a coherent design on their
own — answering nothing at all still produces a buildable plan. So:

- Answer **by number**, in any order, in any batch size: `12: no`, `47: steel`, `88–94: default`.
- `d` or silence means take the default.
- **The fast path is §0.** Twelve questions decide roughly 80% of everything downstream. If you
  answer only those, the rest can be defaulted with a straight face.
- Where a question is a real fork rather than a preference, it is marked **[FORK]** — those
  cannot be sensibly defaulted and I will come back to them.

Contradictions between your answers and something already built are logged as they are found,
naming the decision entry, the same way `V3_PLAN.md` §2 did.

---

## What V4 inherits

Stated plainly, because several questions below only make sense against it.

| | |
|---|---|
| **Palette** | Magenta `#d94f93` primary, steel `#5484a4` secondary, peach `#f6c992` warm note, near-black magenta-hued grounds `#140a10` / `#1e1018` |
| **Light mode** | Ships, but is a **placeholder** — contrast-computed, not designed (D-184) |
| **Type** | Bricolage Grotesque (display), Instrument Sans (body), IBM Plex Mono (data). Self-hosted, three files |
| **Ground** | Three drifting radial pools + SVG grain on `body::before/::after`. Drift disabled under 40rem (D-179) |
| **Motion** | `card-scan`, `link-wipe`, `rise` — three utilities in `globals.css`, nothing else |
| **Components** | shadcn/ui vendored (`components/ui/*`, Prettier-ignored), `@base-ui/react`, lucide-react, recharts, sonner |
| **Public routes** | `/`, `/now`, `/projects`, `/projects/[slug]`, `/resume/[variant]`, `/signin`, `/offline` |
| **Private routes** | `/private`, `/now`, `/log`, `/athletics`, `/academics`, `/academics/plan`, `/work`, `/work/tailor`, `/calendar`, `/hobbies`, `/sync`, plus `/cached` |
| **Hard gates** | `npm test` (582+), `npm run typecheck`, `npm run shots` (overflow, 40px targets, 12px text, resume page count, first-action depth), `npm run e2e` |
| **Budget** | $0. Vercel Hobby. No network at build time |

---

## §0 · Fast path — the twelve that decide the rest

1. Is V4 a **refinement** of what exists, or a **redesign** that may throw away the current look entirely? → *refinement — the bones are good, the execution is uneven*  **[FORK]**
2. Which surface matters more if the two ever conflict: the **public portfolio** (hiring managers, first impressions, desktop) or the **private app** (you, daily, one-handed, phone)? → *private — it is the one you actually use*  **[FORK]**
3. Name the single strongest complaint you have about how the site looks today, in your own words. → *Adding something that doesnt have a category already preset is difficult to organize. For example, if I want to add a recipe I would like to try, it is hard to organize it after logging, as there is no recipe section. Note: This does not mean add a recipe section, but more about a general complaint of difficulty organizing information that is not in an existing category*
4. Name one site, app, or product whose UI you want this to feel closer to. → *Notion*
5. Name one thing about the current design you would be annoyed to lose. → *The quicklog. I really like it, even though it needs some rework*
6. Does the **magenta** stay as the primary accent? → *yes, but let me explore other themes/set other themes in a settings mode*  **[FORK]**
7. Is **light mode** a first-class theme in V4, or still the fallback nobody uses? → *first-class — designed, not computed*  **[FORK]**
8. Should the public site and the private app look like **one product**, or like a portfolio and a separate tool that happen to share a palette? → *Seperate tool, share a palette. Not a big deal if this doesnt happen, as long as both look nice*  **[FORK]**
9. Is the **display face (Bricolage Grotesque)** staying? → *yes*
10. Is there an appetite for a **brand mark / logo** in V4, or does the wordmark stay text-only? → *build one — the vault has asked for it since 2026-08-20 and it does not exist*
11. Roughly how many hours is V4 worth to you? There is no deadline, but there is an opportunity cost. → *~120-140h, taken in term-time blocks*
12. Is any part of V4 allowed to change **behaviour**, or is it strictly appearance? → *appearance plus interaction feel; no new features*  **[FORK]**

---

## §1 · Direction and ambition

13. Should V4 have a stated design thesis — one sentence the whole overhaul is judged against? → *yes, and it goes at the top of V4_PLAN.md*
14. Which adjective is closest to the target: *instrument*, *notebook*, *terminal*, *editorial*, *lab bench*? → *instrument*
15. And which is furthest from it? → *editorial*
16. Should the design read as **built by an engineer** or **designed by a designer**? → *built by an engineer, finished by a designer*
17. Is "looks expensive" a goal, or is "looks precise" the goal? → *precise and clean*
18. Does the site need to look **current in 2029**, or is dating it to 2026 acceptable? → *durable — avoid anything that will read as a 2026 trend*
19. Is any amount of visual playfulness wanted, or is restraint absolute? → *one or two moments, earned, nowhere near the resume*
20. Should the private app be allowed to look **more opinionated** than the public site, since only you see it? → *yes*
21. Is consistency between screens more important than each screen being individually optimal? → *yes — the current drift is a named problem. However, things should be optimized*
22. Should V4 produce a written **design system document** in the repo, or just better CSS? → *a document — `web/DESIGN.md`, referenced from context.md*
23. Should the design system be enforced by tests (token usage, no raw hex in components), or by discipline? → *by test — discipline already failed once, see the `#0a161b` theme-color that outlived its palette*
24. Is a **component gallery route** (`/private/kitchen-sink`) worth building to review every component in both themes at once? → *yes — it is the only way to review 40 components without clicking through 20 screens*
25. Should V4 be shipped **all at once** behind a flag, or **screen by screen** to production? → *screen by screen, public site last*
26. If shipped screen by screen, is a period of visible inconsistency acceptable? → *yes, on private only*
27. Does anything about V4 need to be reviewable **offline** (`npm run freeze`), given travel? → *No, it does not*
28. Should the V4 plan carry hour estimates per item like V3 did? → *Yes, but do not live by them. These are more to determine the difficulty of a task, rather than an actual time estimate*
29. Should V4 include a **before/after** screenshot record for each screen? → *yes — `.shots/` already exists, add a compare mode*
30. Is there anything in the current UI you consider **finished** and off-limits to V4? → *No*

## §2 · Brand identity and the mark

31. Does the logo concept in `brand_and_voice.md` — 3D printing, baking, robotics, dragon boat, CS — still describe you? → *Yes, please have all of those*
32. Should a mark be **abstract** (a glyph) or **representational** (an object)? → *representational*
33. Should the mark work at 16px (favicon) as its primary constraint? → *yes — design at 16px first, scale up*
34. Monogram (VG), single letter (V), or non-letterform? → *non-letterform*
35. Should the mark carry the magenta, or be monochrome and take the accent from context? → *monochrome, tinted by context*
36. Does the current header dot — `size-1.5 rounded-full bg-primary` with a hover glow — get replaced by the mark, or does the mark sit beside it? → *replaced*
37. Is an **animated** mark wanted anywhere (loading, install splash)? → *no*
38. Should the favicon stop being `favicon.ico` and become an SVG with light/dark variants? → *yes*
39. Does the PWA install icon need to differ from the favicon? → *yes — the maskable icon needs padding the favicon does not*
40. Should the installed app's **splash screen** be designed, or left to the browser default? → *designed*
41. Is a **wordmark** wanted — "Victor Gusev" set deliberately rather than in the body face? → *yes, in the display face, tracked tight*
42. Should the wordmark ever be replaced by the mark alone at narrow widths? → *yes, under 380px*
43. There is currently **no OG image**, though `layout.tsx` declares `summary_large_image`. Build one? → *yes — generated per-route with `next/og`*
44. Should the OG image be **generic** (one image for the site) or **per-page** (project title, resume variant)? → *per-page for projects, generic elsewhere*
45. Should the OG image carry a photograph of you, or be typographic? → *typographic*
46. Is `themeColor` in the viewport export still correct at `GROUND`, or should it change per theme? → *per theme — the light theme currently gets a near-black status bar*

## §3 · Colour — dark theme

47. `brand_and_voice.md` still names **teal `#09A1A1` as the primary** and has since 2026-08-20; the site has been magenta since V2. Which is wrong — the doc or the site? → *the doc; update it as V4 §0*
48. Is the magenta `#d94f93` the exact right value, or is it a placeholder for "a very dark pink/magenta"? → *close but re-tune against the new grounds*
49. Should the accent get **more** saturated or **less**? → *slightly less, and warmer*
50. Should the primary accent have a **full ramp** (50–950) rather than one value plus `color-mix` calls? → *yes — `color-mix(in oklab, ...)` is scattered across ten files and is unauditable*
51. Should the palette be defined in **OKLCH** rather than hex? → *yes — it makes the light/dark pairing mechanical instead of eyeballed*
52. Is steel `#5484a4` earning its place as secondary, or is it just "the other one"? → *re-scope it to data and structure only, never to interactive elements*
53. Peach `#f6c992` is currently eyebrows and tier markers only. Expand its role, keep it, or cut it? → *keep, unchanged — the restraint is the point*
54. Do you want a **fourth** accent, or is three the ceiling? → *More accents is ok, keep 3 for now though*
55. The grounds are `#140a10` (page) and `#1e1018` (card). Are they too close to read as distinct layers? → *yes — widen the gap*
56. Should there be **three** ground levels (page / card / raised) rather than two? → *yes*
57. Should the card ground stay tinted magenta, or go neutral so the accent has more room? → *stay tinted, but weaker*
58. Is the dark theme currently too dark, about right, or not dark enough? → *about right*
59. `--border: #3a1f2c` is a tinted low-contrast line. Should borders be **lighter**, or should V4 lean on ground-shifts instead of borders? → *ground-shifts primary, borders secondary*
60. Is a **hairline** (0.5px at 2x) border wanted anywhere, or is 1px everywhere? → *1px everywhere; hairlines vanish on Samsung AMOLED*
61. Should `--destructive` stay red, given it sits next to a magenta accent that reads as warm? → *shift it toward orange-red to separate it from the primary*
62. Is a **success** colour wanted? There is currently none — completed tasks use muted foreground. → *yes, a desaturated green*
63. Is a **warning** colour wanted separate from `warn` on `Stat`? → *yes*
64. Should link colour differ from primary accent colour? → *no*
65. Should visited links be styled? → *no*
66. Is `--muted-foreground: #b6a2ac` legible enough at 12px on a phone in daylight? → *no — raise it*
67. Should there be **two** muted foregrounds (secondary text, tertiary/metadata) rather than one? → *yes*
68. Should selection colour (`::selection`) be styled? → *yes — currently browser default*
69. Should focus rings use the primary, or a dedicated high-contrast colour? → *dedicated, so focus is visible on primary-filled buttons*
70. Should scrollbars be styled? → *yes, on desktop only*
71. Is a **high-contrast** variant of the dark theme wanted for outdoor phone use? → *Yes*  **[FORK]**
72. Should colour ever encode meaning **alone** anywhere, or must every colour signal be doubled (icon, text, weight)? → *always doubled*

## §4 · Colour — light theme

73. Light mode currently exists but was never designed (D-184). Is it something you actually use, or a box ticked? → *I may try it, along with other themes. Build out several themes to try, then I will determine my favorite*  **[FORK]**
74. If light mode is real, is it the **default** on the public site? → *no, it should be dark. However, I should be able to change it easily*  **[FORK]**
75. Should light mode follow the **system preference** by default, or be a stored choice? → *system, overridable*
76. Should the public site and private app be allowed to have **different** default themes? → *yes — public follows system, private defaults dark*
77. Is the light ground white, off-white, or warm paper? → *warm paper*
78. Current light ground is `#fbf7f9` — magenta-tinted near-white. Keep the tint? → *For light mode, use teal, not magenta*
79. In light mode the accent is darkened to `#b8306f` for contrast, which reads as a different colour. Accept, or find a value that survives both? → *accept two values; one hue that works on both grounds does not exist at this saturation*
80. Should light mode use **shadows** where dark mode uses ground-shifts? → *yes — this is the main structural difference between them*
81. Should the ambient radial pools appear in light mode at all? → *yes, much weaker*
82. Should the SVG grain appear in light mode? → *no — it reads as a dirty screen on white*
83. Should light-mode cards be pure white, or a step off the ground? → *a step off*
84. Should the light theme's borders be warm grey or tinted magenta? → *tinted, very weakly*
85. Is the light theme allowed to be **higher contrast** than the dark one? → *yes*
86. Should charts use a different series palette per theme, or one that works on both? → *per theme — the current dark set has two values that vanish on white*
87. Should the theme toggle appear on the **public** site? It currently does not. → *yes, in the footer*
88. Should the toggle be two-state (light/dark) or three-state (light/dark/system)? → *three*
89. Should there be a **transition** when the theme flips, or an instant swap? → *instant — a 300ms cross-fade of every colour on the page is the single most expensive animation in an app*
90. Is there a risk you will never look at light mode again after V4 ships? If so, say now and it gets less time. → *no default*

## §5 · Typography

91. Bricolage Grotesque is the display face. Is it doing the job? → *yes*
92. Is it used **enough**? It is currently headings only, and most headings are small. → *no — give it more range*
93. Should Bricolage's variable axes (it is `200 800`) be exploited — very light large headings, very heavy small ones? → *yes*
94. Instrument Sans is the body face. Keep, or replace? → *keep*
95. Is body text currently too small anywhere? → *yes, on the private app*
96. IBM Plex Mono carries dates, splits, PRs, file paths. Is it overused? → *yes — it has crept into nav labels, eyebrows and tab bars where it is decoration, not data*  **[FORK]**
97. Should mono be restricted to **actual data** and nothing else? → *yes, and enforced in review*
98. If mono leaves the nav, what replaces it — body face at small size, or display face? → *body face, tracked*
99. Should a **fourth** face be added (a serif, for case-study prose)? → *no*
100. Three faces × up to three weights is currently ~7 files. Is the payload budget a concern? → *no, they are subset and cached, but do not add a fourth*
101. Should the type scale be **modular** (a fixed ratio) or hand-picked per step? → *modular, 1.2 minor third, hand-adjusted at the extremes*
102. How many steps in the scale? → *nine*
103. Should the scale be **fluid** (`clamp()` between breakpoints) or stepped at breakpoints? → *fluid for display sizes, stepped for body*
104. Is `text-4xl` for `/projects` and `/now` H1s the right weight of arrival, or too loud? → *too loud on a phone; make it fluid*
105. The About page H1 is `text-4xl sm:text-5xl font-extrabold`. Is extrabold right? → *no — go lighter and larger*
106. Should headings be **tracked tighter** as they get larger? → *yes, optical tracking by step*
107. `text-wrap: balance` is applied to h1–h4. Extend to lede paragraphs with `pretty`? → *yes*
108. Is the current line length (`max-w-[60ch]` / `62ch`) right for prose? → *narrow it to 58ch*
109. Should body line-height differ between public prose and private UI? → *yes — 1.6 public, 1.45 private*
110. Should there be a dedicated **lede** style, larger than body, on public pages? → *yes*
111. Eyebrows are `font-mono text-[0.62rem] tracking-[0.16em] uppercase`. Keep the pattern? → *keep the idea, drop the mono, raise to 0.7rem*
112. Is `0.55rem` (8.8px) mono in the tab bar and `Stat` labels too small? `npm run shots` flags sub-12px text — how is this passing? → *check the gate's selector; 8.8px is below any reasonable floor*  **[FORK]**
113. Should there be a hard **minimum font size** enforced by the shots gate, with an explicit allowlist? → *yes, 11px floor, allowlist by data attribute*
114. Should numbers everywhere use tabular figures, or only in columns? → *everywhere a number can change in place*
115. `.tabular` is applied by hand per element. Should it be automatic inside `Stat`, tables, and charts? → *yes*
116. Should uppercase be used less? It is on every eyebrow, every `Stat` label, every panel meta. → *yes — cut it roughly in half*
117. Should letter-spacing on uppercase be reduced from `0.16em`? → *yes, to 0.12em*
118. Is **italic** used anywhere intentionally? Neither Instrument nor Bricolage has an italic loaded. → *no italics anywhere; do not add the files*
119. Should headings ever be coloured (primary/highlight), or always foreground? → *always foreground; colour goes on the eyebrow*
120. Should there be a distinct style for **inline code** in case studies? → *yes, currently unstyled*
121. Should prose in case studies get drop caps, pull quotes, or neither? → *neither*
122. Should long project titles be allowed to wrap to two lines in cards, or truncate? → *wrap, max two lines*
123. Should the resume's typography be touched at all, given it is print-tuned and page-count-gated? → *screen only; print block frozen*

## §6 · Space, scale, grid, density

124. `max-w-5xl` (64rem) is the public content width; `/now` uses `max-w-3xl`. Should there be one width or a documented set? → *a documented set of three: prose, content, wide*
125. Is the public site too narrow, about right, or too wide on a 27" monitor? → *too narrow — it strands the design in a column*  **[FORK]**
126. Should any public page use the **full width** (a projects grid that breathes at 1600px)? → *yes, projects only*
127. Should the spacing scale be Tailwind's default, or a restricted subset (a "spacing vocabulary")? → *restricted subset of eight values*
128. Section rhythm on the About page is `mt-16` between everything. Is uniform rhythm right, or should section weight vary? → *vary — hierarchy is currently carried only by heading size*
129. Is the public site's vertical rhythm too loose, too tight, or right? → *slightly loose on desktop, right on phone*
130. Is the private app's density too loose, too tight, or right? → *In some places, too dense. In a lot of places it is straight text, and is hard to process. Also note: The point of this project is to list my ideas. Too much read-only text defeats the point.*
131. Should the private app offer a **density toggle** (comfortable/compact)? → *At first yes, to determine which I like. This should go in a settings tab*  **[FORK]**
132. `PageHeader` is `border-b pb-6` on every private page. Is that header earning its vertical cost on a phone? → *no — it costs ~110px above the first action on every screen*
133. Should the private `PageHeader` collapse into the nav on phones? → *yes*
134. Should the private page header **stick** on scroll? → *no*
135. Should the public header stay sticky? It is `h-14` with backdrop blur. → *yes*
136. Should the public header shrink or hide on scroll-down? → *hide on scroll-down, show on scroll-up, phone only*
137. Is the 8-point grid worth enforcing, or is 4-point granularity needed? → *4-point, documented*
138. Should card padding be uniform (`p-6` / `p-5` / `p-4` are all in use)? → *uniform per card size class*
139. Should there be a **card size vocabulary** (sm/md/lg) rather than per-instance padding? → *yes*
140. Should grids use `auto-fit` / `minmax` rather than fixed breakpoint column counts? → *yes — the projects grid jumps from 1 to 2 and never to 3*
141. Should the projects grid go to **three columns** above 1280px? → *yes*
142. Should the hobbies grid stay at `lg:grid-cols-3`? → *yes*
143. Should there be a documented **breakpoint set**? The app currently mixes `sm:`, `min-[380px]:`, `@media (width < 40rem)`, and `lg:`. → *yes — and reconcile the two "phone" definitions*  **[FORK]**
144. `40rem` is the line the app uses to define "phone" (nav switch, mesh-drift). Is that still right at 640px? → *yes, but name it as a token*
145. Should tablet (768–1024) get its own treatment, or fall to desktop? → *its own — the bottom tab bar disappears at 640px and desktop nav is cramped until 900px*
146. Should landscape phone be handled explicitly? → *yes, minimally — the tab bar plus a keyboard leaves ~180px*
147. Should safe-area insets be applied on more than the tab bar? → *yes, on the left/right in landscape*
148. Should content ever be **centre-aligned**? Almost nothing currently is. → *no*
149. Should the private app's max width match the public site's, or be narrower? → *narrower — a form at 64rem is unreadable*
150. Should any private screen become a **two-column** layout on desktop? → *yes — Today, Athletics, Academics*

## §7 · Surfaces, depth, borders, radius

151. `--radius: 0.625rem` with a multiplier scale. Is 10px the right base? → *yes*
152. Should radius be **uniform** or should small controls be tighter and large surfaces looser? → *scale with size, which the multipliers already allow but nothing uses*
153. Should anything be fully square (0 radius)? → *tables and the resume sheet*
154. Should anything be a pill? Filter chips currently are. → *chips and badges only*
155. Are shadows wanted in dark mode at all? Currently only on hover. → *sparingly, on floating surfaces only*
156. Should there be a documented **elevation scale** (rest / raised / floating / overlay)? → *yes, four levels*
157. Should elevation be expressed as shadow, ground-shift, border-brightening, or a combination? → *ground-shift + border in dark, shadow in light*
158. Should cards have a **visible border** at rest, or only a ground-shift? → *ground-shift; border on hover and focus*  **[FORK]**
159. `bg-card/70` and `bg-card/60` are used on translucent cards over the ambient layer. Keep translucency? → *yes, but standardise the opacity*
160. Is `backdrop-blur` used in enough places, or too many? Currently header, tab bar, sheet overlay. → *right; do not add more, it is the most expensive thing on a phone*
161. Should the ambient gradient layer stay at all? → *yes — it is the design's one memorable idea*  **[FORK]**
162. Should the gradient be **redesigned** — different positions, colours, count? → *yes, it was placed by eye once*
163. Should the gradient respond to the route (a different pool position per section)? → *no — cute, and it will make every navigation feel like a repaint*
164. Should the SVG grain stay? → *yes in dark, no in light*
165. Is the grain at `opacity: 0.04` visible enough to be doing its job (dithering gradient banding)? → *measure it on the Samsung; raise if banding is visible*
166. Should the grain be a static asset rather than an inline data URI? → *no — it is ~500 bytes and a request is worse*
167. Should dividers (`<Separator>`, `border-t`) be used less, with space doing the work? → *yes*
168. Should panels nest? Currently `Panel` inside `Panel` happens on Athletics. → *no — flatten*
169. Should the collapsible `<details>` panel keep its chevron on the left, or move it right? → *left*
170. Should collapsed panels look different from expanded ones beyond the chevron? → *yes, dimmer heading*
171. Should there be a "raised" treatment for the **one thing on the page you should act on** (the first-action element)? → *yes — this is what the fold gate is measuring and nothing visually marks it*
172. Should sheets/dialogs be full-height on phone or partial? → *partial, dragged to full*
173. Is `rounded-t-xl` on the More sheet enough, or does it need a grabber? → *add a grabber*

## §8 · Motion and interaction feel

174. Three motion utilities exist: `card-scan`, `link-wipe`, `rise`. Is three too few, about right, or too many? → *about right — add two, not ten*
175. `card-scan` sweeps a highlight across a card on hover, "the way a scope refreshes". Keep it? → *keep — it is the most identity-carrying thing in the CSS*
176. Should `card-scan` be **subtler**? It currently also lifts 3px, shifts background, changes border, and casts a glow. → *yes, drop one of the four*
177. Should the lift (`translateY(-3px)`) survive? → *no — the sweep alone is the idea*
178. `link-wipe` grows an underline from the leading edge. Keep? → *keep*
179. Should `link-wipe` apply to all links or only navigational ones? → *navigational and footer only; in prose it is noise*
180. `rise` staggers content in on load with `animationDelay` set inline per element. Keep the stagger? → *keep the idea, drive it from CSS not inline styles*  **[FORK]**
181. D-171 removed the above-the-fold entrance fade because it delayed FCP by ~900ms. Should any entrance animation exist above the fold? → *no, ever*
182. Should scroll-triggered reveals be used further down the page? → *yes, on the public site only, via `animation-timeline: view()` with no JS*
183. Should page **transitions** exist between routes? → *no*  **[FORK]**
184. Should View Transitions API be used for the private tab bar? → *no — it costs a full-page snapshot on a phone*
185. What is the default duration for a small state change (hover, focus, toggle)? → *150ms*
186. For a medium one (panel open, sheet)? → *250ms*
187. For a large one (route, overlay)? → *350ms*
188. Should there be a documented **easing set**, or is one curve enough? → *three: standard, entrance, exit*
189. The current curve is `cubic-bezier(0.22, 0.72, 0.28, 1)` almost everywhere. Keep it as "standard"? → *yes*
190. Should anything **spring** rather than ease? → *no — no physics library on a $0 budget*
191. `mesh-drift` is off below 40rem for battery (D-179). Should it be off everywhere? → *no, keep the desktop drift*
192. Should the drift be slower than 38s? → *no*
193. Should hover states exist at all on touch devices, or be fully stripped? → *fully stripped via `@media (hover: hover)`*
194. Is there anywhere the app currently shows a hover-only affordance that a phone can never reveal? → *audit and list; one was already found and fixed in the project cards*
195. Should **active/pressed** states be designed? They are currently mostly absent. → *yes — this is the biggest single miss on the phone*  **[FORK]**
196. Should taps produce a visible press within 100ms even when the action is slow? → *yes, always*
197. Should haptics be used where the API allows (`navigator.vibrate`)? → *yes, on swipe-complete and save only*
198. Swipe rows: right completes, left deletes (D-180). Should the swipe visuals be redesigned? → *yes*
199. Should the swipe reveal show an icon, a colour, or both? → *both, colour arriving before the icon*
200. Should pull-to-refresh (D-181) get a designed indicator rather than the current one? → *yes*
201. Should long-press do anything anywhere? → *no*
202. Should the "More" sheet animate up, or appear? → *animate, 250ms*
203. Should focus-visible rings animate in? → *no*
204. Should skeletons pulse, shimmer, or be static? → *static — a shimmer on a screen that resolves in 200ms is worse than nothing*  **[FORK]**
205. Should number changes (PRs, counts) animate? → *no*
206. Should charts animate on mount? → *no — recharts defaults to yes; turn it off*
207. `prefers-reduced-motion` currently collapses everything to 0.01ms. Should reduced motion instead get **designed** alternatives (opacity only)? → *yes, that is the correct reading of the media query*
208. Should reduced motion also disable the ambient drift? → *yes — it currently does, keep it*

## §9 · Icons, illustration, imagery

209. lucide-react is the icon set. Keep? → *keep*
210. Are icons used enough? They currently appear only in the phone tab bar and a few buttons. → *no — the private app is almost entirely text*  **[FORK]**
211. Should every private nav item get an icon on desktop too? → *no — desktop nav stays textual*
212. Should icons ever appear without labels? → *only in the tab bar, and only with `aria-label`*
213. What stroke width? lucide defaults to 2. → *1.75 — 2 is heavy against this type*
214. Should icon size be tokenised (16/20/24) rather than per-instance `size-4` / `size-5`? → *yes*
215. Should there be any **custom** icons (dragon boat, filament spool, erg)? → *yes, three, drawn to lucide's grid*
216. Should the project cards without images keep the accent rail, or get something richer? → *keep the rail; it is honest*
217. Should generated/placeholder imagery ever be used? D-? removed decorative charts for costing 180px each. → *never*
218. Should the portrait photo treatment change? It is a square crop with a magenta bloom behind it. → *yes — the bloom reads as a glow effect rather than a design element*
219. Should the portrait be circular, square, or asymmetric-radius? → *square, larger*
220. Should project images get a consistent aspect ratio (currently `aspect-16/9` with `contain` or `cover` per project)? → *yes, 16:9, with `contain` on a tinted ground for diagrams*
221. Should images have a border, an inset ring, or neither? → *inset ring*
222. Should lab images (`context/assets/labs/`) ever surface publicly? → *no*
223. Should there be a lightbox for project images? → *yes, native `<dialog>`, no library*
224. Should any diagrams be authored for the case studies (system diagrams, not screenshots)? → *yes — this is the highest-value visual work on the public site*  **[FORK]**
225. If so, hand-drawn SVG, Mermaid, or Excalidraw-style? → *hand-authored SVG, themed with CSS variables*
226. Should the site ever use emoji? → *no*

## §10 · Data visualisation

227. recharts renders the athletics charts. Keep, replace with hand-rolled SVG, or replace with a lighter library? → *keep for now; revisit only if the bundle cost shows up*  **[FORK]**
228. Are the charts currently readable on a 390px phone? → *no*
229. Should charts on a phone show fewer series, a shorter window, or a different chart type entirely? → *shorter window plus a summary number above*
230. Should every chart be preceded by the **one number** it exists to show? → *yes*
231. Should axes be visible, or should charts be near-sparklines with labelled endpoints? → *near-sparklines on phone, full axes on desktop*
232. Should gridlines exist? → *horizontal only, very faint*
233. Should the chart series palette be the five `--chart-*` values, or a purpose-built sequential ramp? → *categorical for series, a separate ramp for anything ordered*
234. Should PR/goal lines be drawn on the chart (a horizontal rule at the sub-2:00 target)? → *yes — the vault's single athletic goal is currently invisible on its own chart*
235. Should tooltips exist on touch? → *no — tap-to-pin a value instead*
236. Should charts have a fixed height, or an aspect ratio? → *aspect ratio*
237. Should the adjusted-split table be a table or a chart? → *table, and make it a real one*
238. Should tables scroll horizontally on a phone, or restructure into cards? → *restructure into cards under 40rem*
239. Should numbers be right-aligned in tables? → *yes, and tabular*
240. Should deltas (+/−) be coloured, or carry an arrow only? → *both, per the "never colour alone" rule*
241. Should a **freshness/staleness** visual language exist across the app (the `FreshnessBadge` idea generalised)? → *yes*
242. Should sparklines appear inline in text ("bodyweight ▁▂▃▅▂")? → *no*

## §11 · Forms and controls

243. `LogForm` is 658 lines and is the most-used surface in the app. Does it get a full redesign in V4? → *yes — it is the single highest-value screen*  **[FORK]**
244. Is the log form currently too slow to fill on a phone? → *yes*
245. Should inputs be larger on touch than the current shadcn defaults? → *yes, 48px minimum*
246. Should input labels sit above, inside (floating), or beside the field? → *above*
247. Should placeholder text be used as a label anywhere? → *never*
248. Should required/optional be marked? → *mark optional, not required*
249. Should validation appear on blur, on submit, or live? → *on blur*
250. Should errors appear beside the field, below it, or in a summary? → *below the field, plus a summary if more than two*
251. Should the save button be fixed to the bottom of the viewport on long forms? → *yes*
252. Should forms show a dirty/unsaved indicator? → *yes*
253. Chips, keypads, sticky values and clipboard shortcuts are declared per field (D-155). Are they visually distinct enough from each other? → *no*
254. Should the numeric keypad be a custom control, or the OS keyboard with `inputmode`? → *OS keyboard with `inputmode="decimal"`, plus chips for common values*
255. Should chips look like buttons, or like tokens? → *tokens*
256. Should a selected chip be filled, outlined, or ticked? → *filled*
257. Should the category tabs on `/private/log` stay as wrapping tabs, or become a select on a phone? → *stay tabs — a select hides the whole vocabulary*
258. Should tabs scroll horizontally instead of wrapping (D-164 chose wrapping)? → *keep wrapping Note: the top bar on the private website is scrolling. This is more of an indication of too much going on there. It needs to be corrected.*
259. Should the capture box be visually the loudest thing on Today and Log? → *yes*
260. Should the capture box grow as you type? → *yes*
261. Should voice entry (D-186) have a designed state machine (idle/listening/parsing/review)? → *yes — it currently has states but not a visual language for them*
262. Should the dictate button be a mic icon, a labelled button, or both? → *both*
263. Should toggles be switches or checkboxes? → *checkboxes for lists, switches for settings*
264. Should the rehab checklist look like a checklist or like a set of chips? → *checklist*
265. Should destructive actions require confirmation, or be undoable? → *undoable, via the toast*
266. sonner renders toasts. Should toast styling be customised? → *yes, currently default*
267. Where should toasts appear on a phone — top, or bottom above the tab bar? → *bottom, above the tab bar*
268. Should toasts carry an undo affordance by default? → *where an undo exists, yes*
269. Should the sign-in screen be designed, or stay minimal? → *designed — it is the first private screen and currently the plainest*
270. Should `/signin` show anything about the site, or be a bare passkey prompt? → *bare, but well set*
271. Should buttons have more than the current variants? → *no — fewer: primary, secondary, ghost, destructive*
272. Should there be a documented rule for **which** button is primary on a screen (max one)? → *yes, max one*
273. Should icon-only buttons exist outside the tab bar? → *only in dense toolbars*
274. Should disabled states be styled, or should disabled controls be hidden? → *styled, with a reason on hover/focus*

## §12 · States — empty, loading, error, offline

275. `Empty` renders a dashed box with a sentence. Is that enough? → *no — an empty state should name the action that fills it and offer it*
276. Should empty states carry an illustration? → *no*
277. Should empty states differ between "nothing yet" and "nothing matched a filter"? → *yes*
278. Skeletons exist for the dashboard (`SkeletonPanel`, `SkeletonStats`). Should every Suspense boundary have one? → *no — a skeleton at the bottom of the page reserves space nobody is looking at, which D-? already decided*
279. Should skeletons match the exact shape of what loads, or be generic? → *exact shape*
280. Should there be a global loading indicator for route changes? → *yes, a top progress bar, phone only*
281. `ErrorPanel` is one line until opened (D-168). Is that the right weight? → *yes*
282. Should error text be styled distinctly from body text? → *yes*
283. Should the error boundary page (`app/error.tsx`) be designed? → *yes*
284. Should `/offline` and `/cached` share the private app's visual language exactly (D-174 says they should)? → *yes, and V4 must not break that*
285. Should cached/stale data be visually marked everywhere, always? D-? requires the age be shown. → *yes — design one "as of" component and use it everywhere*
286. Should the stale marker be a badge, a dimming, or a line of text? → *a badge plus tabular timestamp*
287. Should the outbox/"Not sent" count appear as a badge on the tab bar? → *yes*
288. Should the app look visibly different when offline? → *subtly — a single persistent strip, not a colour change*
289. Should a failed save look different from a queued save? → *yes, and the distinction must be unmissable*
290. Should the sync screen show progress, or just a list? → *list plus per-item state*
291. Should 404 be designed? → *yes, minimally*
292. Should there be a designed state for "database is behind this build" (D-156)? → *yes, it already has good copy and no design*

## §13 · Public site — chrome and global

293. Four nav links plus the conditional private link. Is that the right set? → *yes*
294. Should the nav ever collapse to a menu on a phone? → *no — four items fit*
295. Should the active-link underline stay? → *yes*
296. Should the header show a progress indicator for long pages (case studies)? → *yes, on case studies only*
297. Should the footer carry more than three links and a name line? → *yes — add the theme toggle and a "last updated"*
298. Should the footer show when the site was last built? → *yes, mono, small*
299. Should there be a link to the GitHub repo of the site itself? → *yes*
300. Should the public site have a **/uses** or **colophon** page describing the stack? → *no — the case studies carry it*  **[FORK]**
301. Should `PrivateLink` look different from the other nav items? It is currently magenta. → *no — make it identical, it draws attention to itself*
302. Should the public site have any page-level chrome differences per route? → *no*
303. Should scroll position be restored on back navigation? → *yes, verify it works*
304. Should external links carry an indicator? → *yes, a small glyph*

## §14 · Public — About (`/`)

305. Is the About page's current order — hero, facts, most recent role, previous roles, pointers, hobbies — right? → *yes*  **[FORK]**
306. Should the hero be taller, with more empty space around it? → *yes*
307. Should the hero carry a one-line positioning statement above the name, below it, or neither? → *below, larger than now*
308. The persona eyebrow reads "Robotics Engineer". Should that stay the first text on the page? → *yes*
309. Should "View resume" be the only call to action in the hero? → *add a second: the most recent project*
310. Should the contact row stay in the hero, or move to the footer only? → *keep a reduced version in the hero*
311. Should the phone number be on the public site at all? → *yes*  **[FORK]**
312. The facts row shows Degree, School, Graduating, GPA. Should GPA be public? → *yes, it is 3.64*
313. Should facts be a row of cards, or a single dense line? → *a line at phone width, cards above*
314. Is "Most recent" the right heading for the spotlighted role? → *yes*
315. Should the spotlight card's radial hover glow survive V4? → *yes*
316. Should previous experience stay as a left-ruled timeline? → *yes, refined*
317. Should the timeline show dates in a fixed left gutter on desktop? → *yes*
318. Should the hobbies section stay on the About page, or move to its own route? → *stay*
319. Should hobbies be three cards, or a denser list? → *three cards, shorter*
320. Should the About page mention the 2ndMind project explicitly, given the reader is looking at it? → *yes, one line in the footer of the page*
321. Should there be an "About" long-form section (a paragraph of prose about you)? → *yes, one paragraph, below the hero*

## §15 · Public — Projects and case studies

322. Is the projects grid the right primary presentation, or should it be a list? → *grid*
323. Should the filter chips stay at the top? → *yes*
324. Should filter state be in the URL? → *yes, currently it is not — a filtered view cannot be linked*
325. Should projects be sortable (by year, by category)? → *yes*
326. Should the card show status (`active`/`done`) as a badge? → *yes, but restyle — `default` and `outline` variants read as unrelated*
327. Should the card show the stack, or is that noise at index level? → *show three, as now*
328. Should the "Read more →" hover affordance be replaced by making the whole card obviously clickable? → *yes*
329. Should cards be equal height? D-? deliberately made them unequal. → *keep unequal*
330. Should the grid show a featured/hero card for the top project? → *yes, spanning two columns at the top*  **[FORK]**
331. Case study pages: is the current structure working? → *I like it, but needs restructuring. I want it to be clean if someone views it. This includes hiding missing information, among other things.*
332. Should case studies have a persistent table of contents on desktop? → *yes*
333. Should case studies open with a summary block (problem / approach / result / stack)? → *yes*
334. Should case study prose width be narrower than the page? → *yes, 58ch*
335. Should code blocks appear in case studies? → *yes, styled, no syntax highlighting library*
336. Should there be a "next project" link at the foot of each case study? → *yes*
337. Should the `## Updates` timeline on a project page be visually distinct from the case study body? → *yes*
338. Should updates show relative dates ("3 weeks ago") or absolute? → *absolute, with relative in a title attribute*
339. Should draft case studies be marked visibly on the public site? → *no*
340. Should project pages carry the GitHub/demo links prominently at the top? → *yes*

## §16 · Public — `/now`

341. Is `/now` doing its job as a status board? → *yes*
342. Should `/now` show more than two updates per project? → *no, for now*
343. Should `/now` lead with the single most recent update across all projects? → *yes*
344. Should `/now` show anything non-project (reading, training, coursework)? → *no — it would leak private data by degrees*
345. Should `/now` be denser than `/projects` or airier? → *airier*
346. Should `/now` link from the About hero? → *yes*

## §17 · Public — Resume and print

347. The print stylesheet is page-count-gated and works. Is the **screen** presentation of the resume acceptable? → *no — it is the print sheet shown on a dark background*
348. Should the screen resume look like a document, or like a web page? → *like a document, on a designed surface*
349. Should the screen resume be readable on a phone? It is currently a Letter sheet scaled down. → *yes, reflow it*  **[FORK]**
350. Should the three variants (swe/ml/robotics) be switchable in the UI? → *yes, currently they are separate URLs with no switcher*
351. Should the variant switcher be visible to a recruiter, or does it read as under-preparation? → *should be visible for now*  **[FORK]**
352. D-188 offers a PDF beside the generated sheet. Should the download be the primary action on the page? → *yes*
353. Should the resume page carry the site header? → *yes on screen, never in print*
354. Should the resume sheet show a paper edge / shadow on screen? → *yes in light mode, no in dark*
355. Is anything about the **print** output allowed to change in V4? → *no, except colour if light mode changes the source values*
356. Should a light-mode screen resume simply be the print sheet? → *yes — that is the one place they should converge*
357. Should the resume have its own OG image per variant? → *no*

## §18 · Private — navigation and chrome

358. Two nav components over one route set — `PrivateNav` (desktop) and `PrivateTabBar` (phone). Should V4 unify them? → *no — D-132 declined this deliberately; keep two*  **[FORK]**
359. Eight desktop nav items in a scrolling mono row. Is that the right presentation at desktop width? → *no — it is a horizontally scrolling bar on a 1440px screen*
360. Should desktop private navigation become a **sidebar**? → *yes*  **[FORK]**
361. If a sidebar, should it be collapsible? → *yes, icon-only collapsed*
362. Should the sidebar persist its collapsed state? → *yes, localStorage*
363. Should the private app keep the same content max-width with a sidebar? → *no, wider*
364. Phone tab bar: Today, Train, **Log**, Next, More. Is that the right five? → *yes*
365. Should the centre Log button be a true FAB (raised, circular, overlapping the bar)? → *no — the current filled tab is more honest and does not cover content*  **[FORK]**
366. Should the tab bar show labels, icons, or both? → *both, as now*
367. Should the tab bar icons change to filled variants when active? → *yes — colour alone is currently the only active signal*
368. Should the "More" sheet be a sheet, or a full screen? → *sheet*
369. Should the More sheet's settings row (theme, push, install, sign out) become a real **Settings** screen? → *yes*  **[FORK]**
370. Should there be a `/private/settings` route? → *yes*
371. Should the theme toggle live in settings only, or stay reachable in the More sheet? → *Settings. Anything that affects the website and is not used regularly should be in settings.*
372. Should the private app show which page you are on in a title bar on a phone? → *yes, compact*
373. Should the private app have a search? Offline search exists (D-183) but only on the log. → *Yes, but only once the website is more built out. V5 potential feature*  **[FORK]**
374. Should `PublicSiteLink` be more prominent, or less? → *less — it is an exit*
375. Should the private app show a connection/sync status indicator persistently? → *yes, one glyph in the header Also, I do not like the manual sync being in more. It should be in settings (the Match the ...)*

## §19 · Private — Today (`/private`)

376. Order is: errors, capture, tasks, stats, schedule, daily summary, weekly summary, archive. Right? → *yes, it was measured*
377. Is the page too long? → *It is ok for now*
378. Should anything on Today be collapsible by default? → *the summaries*
379. Should the day's date be the eyebrow or the title? → *eyebrow, as now*
380. Should the capture box be visually separated from the task list, or continuous with it? → *separated*
381. Should tasks show their domain (engineering/athletics/academics) with colour, icon, or text? → *icon plus text*
382. Should overdue tasks be visually loud? → *yes, but not red — red is for failure, late is not failure*
383. Should completed tasks stay on the page for the rest of the day? → *yes, collapsed*
384. Should the stats row be three across on a phone, as now? → *yes*
385. Should `Stat` hints be shown on a phone? They are currently hidden below `sm`. → *no, keep hidden*
386. Should the agenda show a time axis, or a list? → *list*
387. Should the agenda show "now" as a marker? → *yes*
388. Should AI summaries be visually marked as machine-written? → *yes, and the model name stays*
389. Should the summary panels look different from data panels? → *yes, quieter*
390. Should the summary archive stay on Today, or move? → *move to a `/private/log` archive view*

## §20 · Private — Log (`/private/log`)

391. Is the log the screen you most want fixed? → *Training logging is hard to read/understand. I want it to be easy to log/add workouts. Add a database of pre-existing workouts (similar to hevy), to choose from. This should also allow me to add my own workouts. There should be a fuzzy search, as well as an "AI ADD" workout where I describe a workout and it either adds/finds the workout in the database. Finally, Training should let me log a workout, similar to Hevy. This means having sets and different exercises logged as one. If this takes me to a different page, that is fine. I want this to be good, so it should be its own large task to complete. Other tabs look ok.*
392. How many taps should a training set take, ideally? → *three*
393. Should the log open on the last-used category, or always the first? → *last-used*
394. Should the log remember partially-filled entries across app restarts? → *yes*
395. Should the unsorted capture pile be above or below the tabs? → *below, as now*
396. Should filing a note from the pile be a swipe, a menu, or a tap-then-choose? → *swipe right to file, choose category from a sheet*
397. Should row `shapes` (D-162) transitions be animated as fields swap? → *no — fields appearing and disappearing is already enough motion*
398. Should the training rows show a running total (volume, sets)? → *Should be similar to Hevy*
399. Should the set rows be numbered? → *yes*
400. Should adding a set duplicate the previous one? → *yes — this is the single largest tap saving available*
401. Should the log show today's already-logged entries on the same screen? → *yes, below the form*
402. Should entries be editable after saving? Currently only `fileEntry` moves them. → *no default — this is behaviour, not appearance*  **[FORK]**
403. Should the log show a per-category streak or count? → *no*
404. Should search results look different from the log list? → *yes, with the matched term marked*

## §21 · Private — Athletics

405. Is the athletics page currently useful, or a wall of panels? → *a wall*
406. Should it lead with the one number that matters (adjusted 500m split vs the sub-2:00 goal)? → *yes*
407. Should that goal be rendered as a progress element? → *yes, a gauge*
408. Should recent sessions be a list or a calendar heatmap? → *list, with a small heatmap above*
409. Should PRs get their own visual treatment (a record board)? → *yes. I should also be able to see any PRs of any exercise in a table-like format that is searchable, and should also be viewable when doing a training, to see what my PRs are.*
410. Should the rehab checklist be on this page or on Today? → *both — Today when incomplete*
411. Should bodyweight be visible on this page? → *yes — it is private by construction*
412. Should the weekly split / programme parsed from the vault look like a schedule? → *yes*
413. Should a parse miss "read as a parse miss" visually, not just in copy? → *yes — design that state*
414. Should charts on this page be above or below the tables they summarise? → *above*

## §22 · Private — Academics, Work, Calendar, Hobbies, Sync

415. Academics: should the degree audit render as a progress structure (requirements met/remaining)? → *yes*
416. Should the course planner's three-year grid be a table or a board? → *board on desktop, table on phone*
417. Should the planner mark what it **cannot verify** distinctly from what fails? → *yes — D-187 made that distinction in logic and it is invisible in the UI*
418. Should GPA appear on the private academics page? → *yes*
419. Work: should the internship pipeline be a kanban, a table, or a list? → *kanban*
420. Should application status use colour? → *yes, doubled with text*
421. Should the tailor tool's before/after diff be visual? → *yes*
422. Calendar: should it be a month grid, an agenda, or both? → *agenda, with a month strip.I also want to be able to switch between calendar view and agenda view*
423. Should the calendar show which events are from Google vs the vault? → *yes*
424. Hobbies: should the filament and printer panels be visual (spool levels, printer state)? → *yes*
425. Should filament colour be shown as an actual colour swatch? → *yes*
426. Sync: should `/private/sync` look alarming when it has entries? → *no — it is a normal state offline*
427. Should sync entries show their age prominently? → *yes*
428. Should the sync page explain **why** an item has not sent, per item? → *yes, it already does; design it*

## §23 · Offline, PWA, and system surfaces

429. Should the installed app look different from the browser tab version? → *no*
430. Should the app handle `display-mode: standalone` styling differences at all? → *only for safe areas*
431. Should `/cached` be visually indistinguishable from `/private`, or clearly marked as a copy? → *clearly marked, one strip*
432. Should the offline shell show the age of its data at the top? → *yes*
433. Should the install prompt be designed, or left to Chrome? → *design the trigger, not the prompt*
434. Should the app show a "new version available" prompt? It does. Should it be redesigned? → *yes, quieter*
435. Should push notification content be styled (icon, badge)? → *yes, add a badge icon*
436. Should the manifest's shortcuts (D-178) get custom icons? → *yes*
437. Should the app's status bar colour change with theme? → *yes*
438. Should there be a designed splash/loading state for a cold start? → *yes*

## §24 · Accessibility

439. Is WCAG **AA** the bar, or AAA for body text? → *AA everywhere, AAA for body text*
440. Should contrast be **tested**, not eyeballed? → *yes — a test over the token pairs, failing the build*  **[FORK]**
441. Should the 40px tap-target floor in `npm run shots` rise to 44px? → *yes*
442. Should focus order be tested? → *yes, on the log form at minimum*
443. Should every interactive element have a visible focus state, including cards? → *yes*
444. Should skip links exist? → *yes, one per layout*
445. Should landmarks (`<main>`, `<nav>`, `<aside>`) be audited? → *yes*
446. Should headings be audited for level order? → *yes*
447. Should the app be usable entirely by keyboard on desktop? → *yes*
448. Should keyboard shortcuts exist in the private app? → *yes, three: capture, log, search*  **[FORK]**
449. Should screen-reader announcements exist for async saves? → *yes, one live region*
450. Should charts have a text alternative? → *yes, a table behind a disclosure*
451. Should `prefers-contrast: more` be supported? → *yes, minimally*
452. Should `prefers-reduced-transparency` be supported (it would disable the backdrop blurs)? → *yes*
453. Should the app respect `forced-colors` (Windows high contrast)? → *yes, minimally*
454. Should font size respect the OS text-size setting (rem-based everywhere)? → *yes — audit for `px`*
455. Is there anyone other than you who will use the private app? → *no*
456. Is there any accessibility requirement driven by how you personally use the phone (one-handed, outdoors, gloves)? → *One handed ideally, also "wet hands", where its hard to tap things because the phone screen is wet. This requirement is a lesser requirement though.*

## §25 · Performance and gates

457. Should V4 have a **performance budget** stated as numbers? → *yes*
458. What is the LCP target on a mid-range phone over 4G? → *under 1.5s*
459. What is the JS budget for a public page? → *under 90KB gzipped*
460. Should the public site ship any JS it does not need? Currently `ProjectGrid` is a client component for a filter. → *move the filter to URL state and drop the client boundary*
461. Should V4 add a bundle-size gate to `npm run shots` or CI? → *yes*
462. Should the ambient layer's paint cost be measured on the Samsung? → *yes, before and after*
463. Should `npm run shots` gain a **contrast** sweep? → *yes*
464. Should it gain a **theme** sweep (every page in both themes)? → *yes*
465. Should it gain a visual-regression comparison (pixel diff against a baseline)? → *no — a pixel baseline for a design in flux is a full-time job*  **[FORK]**
466. Should the shots sweep add more widths? It currently runs four. → *add 1440 and 1920*
467. Should the first-action depth gate's thresholds tighten in V4? → *yes, once the header collapses*
468. Should the resume page-count gate stay untouched? → *yes*
469. Should V4 add tests for the design tokens themselves (every token defined in both themes)? → *yes*
470. Should any V4 work be allowed to reduce the 582-test count? → *no*

## §26 · Process, scope, and sequencing

471. Should V4 start with **tokens and primitives**, or with one screen end-to-end? → *tokens first — every screen depends on them*  **[FORK]**
472. If tokens first, is a period where every screen looks half-migrated acceptable? → *yes*
473. Should the shadcn `ui/` components be **re-vendored** at the new tokens, or hand-edited? → *hand-edited, and remove them from `.prettierignore` once they stop being vendored*  **[FORK]**
474. Does re-vendoring shadcn risk anything V4 should know about? → *yes — `form.tsx` is hand-authored and must survive*
475. Should V4 remove `tw-animate-css` if the motion set is hand-authored? → *yes, if unused after*
476. Should V4 touch `web/context.md` and `brand_and_voice.md` as part of the work? → *yes, both, and it is item zero*
477. Should every V4 change get a `DECISIONS.md` entry, as now? → *yes*
478. Should V4 have its own decision prefix, or continue D-190+? → *continue*
479. Should V4 be a branch, or land on main as it goes? → *main, as now*
480. Should there be a review round like the 2026-08-29 one (`npm run freeze` + `SITE-REVIEW.md`)? → *yes, two of them*
481. Should those review rounds be scheduled in the plan with hours? → *yes*
482. Who reviews the public site other than you? → *no default*
483. Is there a date by which the public site must look finished (an application deadline)? → *no default — this is the one thing that could impose an order*  **[FORK]**
484. Should the private app's overhaul wait until fall term is underway, so the redesign is tested against real daily use? → *no — do it first, term is when you will use it*  **[FORK]**

---

## What happens next

Answer what you want, in any order. When the fast path (§0) is answered I will draft
`docs/V4_PLAN.md` in the shape `V3_PLAN.md` used:

1. **TLDR table** — goal, scope, budget, done-when, biggest risk.
2. **What was decided** — every answer, grouped, with contradictions against existing
   decisions named explicitly.
3. **The build** — ordered phases with hour estimates.
4. **Ordered summary** — the list to work through.
5. **What is deliberately not in V4.**
6. **Risks, stated plainly.**
7. **Blocked on Victor.**

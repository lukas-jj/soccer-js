# Soccer Rogue — designer handoff

## The assignment

Redesign Soccer Rogue’s interface, copy and fictional football identities. The current implementation has connected game mechanics, but the presentation needs a substantial rethink.

The owner’s specific complaints are:

- The interfaces look poor.
- There is far too much text.
- The generated player names feel artificial and embarrassing.

Treat this as a product and interaction design job, not a colour refresh. Challenge the current layouts, information density, naming and tone. The existing screen structure is not a design requirement.

The desired result is a football management game that is satisfying to look at, quick to understand and easy to play repeatedly.

## Access

Repository: https://github.com/lukas-jj/soccer-js

Implementation branch: `codex/soccer-rogue`

Current pull request: https://github.com/lukas-jj/soccer-js/pull/1

```bash
git clone https://github.com/lukas-jj/soccer-js.git
cd soccer-js
git switch codex/soccer-rogue
npm install
npm run build
npm run dev
```

Open http://localhost:8080/html/soccer-rogue.html

The original Match Simulator is at http://localhost:8080/html/index.html. It is a separate tool and must remain available.

## Understand the game before redesigning it

You manage a fictional football club through three divisions. Players move and play automatically in a real football simulation. The manager develops the squad, chooses the lineup and tactics, makes substitutions and manages money.

The repeating loop is:

1. Spend three preparation days on training, rest, scouting, the transfer market or the shop.
2. Select a squad and formation. This does not consume a day.
3. Watch, accelerate or rapidly simulate the match; make substitutions when needed.
4. Review the result and player changes, then prepare for the next fixture.

There are four teams per division and three rounds per season. First place promotes; last place relegates. The first top-division title wins the run, with an option to continue. Bankruptcy or relegation out of the lowest division ends it.

A player’s archetype describes their attribute distribution. It is separate from their position. Actual match minutes build positional proficiency and earn overall XP. Level-ups require the manager to choose an upgrade. Training improves attributes directly and gives no overall XP.

## Creative direction

Create a clear football identity with the energy of an indie sports game. Make it feel like managing a club, with a strong connection between the squad screen and the pitch.

Avoid generic dashboard styling: repeated rounded cards, identical panels everywhere, badge clutter and promotional hero sections occupying space needed for play. Avoid cute fantasy language and motivational slogans.

Use typography, spacing, alignment and a deliberate colour system to establish hierarchy. Club identity, competition, player condition and match events should have distinct visual purposes. Decorative elements should earn their place.

Bring one recommended direction with reasons, plus a small number of visual references annotated for what they demonstrate. References are for principles and mood; do not copy another product’s branding or assets.

## Priority 1: rebuild the information hierarchy

At a glance, the main screen should answer:

- Who are we playing next?
- How many preparation days remain?
- Is the squad ready?
- How much money do we have?
- What is the next useful action?

Put the next decision ahead of explanations. The current dashboard gives too many elements equal emphasis.

Make the squad a usable selection surface. A compact roster or pitch-and-roster layout is a strong candidate; a wall of large player cards is difficult to compare. Keep fitness, injury, selection and pending upgrades visible. Open detailed attributes, traits and positional history on demand.

During matches, the pitch and score should dominate. Substitutions should be quick to understand and operate on touch screens. Clearly distinguish a requested substitution from one that has happened. Show remaining substitutions and unavailable players.

Give match results a readable sequence: score, league consequence, meaningful player changes, next action. A full accounting table can remain available without leading the screen.

## Priority 2: remove the excess copy

Audit every visible string. Deliver replacement copy, not just a recommendation to shorten it.

Use these rules:

- Buttons name the action. Put costs and consequences beside the action consistently.
- Explain a rule once at the moment it matters.
- Put formulas, full trait descriptions and secondary rules in accessible details, help panels or tooltips.
- Keep essential consequences visible before confirmation: day consumed, price, fatigue, injury restriction and irreversible removal.
- Use short feedback after actions, ideally showing the actual change.
- Remove repeated onboarding, taglines, filler and implementation language.
- Never rely on hover alone to reveal important information; support touch and keyboard.

Examples of the intended editing direction:

| Current approach | Better direction |
| --- | --- |
| “From the district. To the extraordinary.” | Lead with the club selection or career state. |
| “Find the next club legend” | “Recruitment” |
| “Make today count” | “Preparation · 2 days left” |
| A paragraph explaining training on every visit | A compact gain/cost preview, with a separate explanation of training versus XP. |
| “Every match played on the soccer-js engine. Every decision yours.” | Remove from gameplay. Technical credits belong in About. |

Do not hide the distinction between training gains and match XP while shortening the copy. That distinction affects decisions.

## Priority 3: replace the naming system

The current player generator combines a tiny pool of names such as Ari, Kit, River, Sky, Vale, Moss, Finch and Wren. Repeated combinations make squads feel like a cast of whimsical fictional characters rather than footballers.

Develop a grounded fictional player naming system:

- Use substantial, culturally coherent given-name and surname pools.
- Generate plausible combinations within a chosen naming background; avoid arbitrary cross-pool mixing.
- Include a credible range of common and less common names, with appropriate spelling and diacritics.
- Prevent duplicate full names within a squad and excessive repetition across recruits and opponents.
- Define display rules: full name in details; surname or initial plus surname where space is tight; disambiguate collisions.
- Keep persistent player IDs separate from display names.
- Do not populate squads with real professional footballers or celebrity references.
- Preserve seed-based generation and specify how existing saves retain their players’ identities.

Supply an example starting squad of 16 names, two opponent squads and a sample recruitment list. Review them together: repetition and tone become obvious at squad scale.

Review club names, perk names, currency labels and item names as well. Harbor Lanterns, Orchard Comets and some current item labels may contribute to the same overly cute tone. Propose stronger fictional football identities with badges, colours and concise descriptions. Retain the clubs’ different gameplay strengths.

Use “perks”, “curses”, “strengths”, “flaws” or another vocabulary consistently. Choose language that fits the game while keeping effects clear.

## Required screen coverage

| Area | Essential interaction |
| --- | --- |
| New career | Compare three clubs and understand each permanent advantage and weakness. |
| Club / preparation | See the fixture, readiness, money and remaining days; choose an activity. |
| Squad / tactics | Compare players, choose the XI and formation, inspect a player, choose level upgrades. |
| Training / staff | Preview gains and fatigue, see locked sessions and unlock requirements, assign split training. |
| Recruitment | Understand scouting uncertainty versus market certainty; compare and recruit players. |
| Shop / inventory | Distinguish buying from using an owned item; select its target and see the result. |
| Live match | Read the score and clock, pause/speed up, select substitutions and understand queued changes. |
| Results / league | Understand match consequences, player progress, standings and season outcomes. |
| Endings | Distinguish promotion, relegation, victory and run failure; continue or start again. |
| Save controls | Locate export, import and reset without cluttering ordinary play; protect against accidental reset. |

Show realistic populated screens, not just empty states. Include an injured starter, a tired squad, insufficient funds, a locked training option, multiple pending level-ups and a queued substitution.

## Deliverables

1. A short critique of the current interface, ordered by impact on play.
2. A proposed navigation and screen hierarchy, including the preparation-to-match flow.
3. High-fidelity designs for desktop and mobile. Include a narrow phone layout around 390 px and a desktop layout around 1440 px.
4. A small reusable design system: typography, colours, spacing, icons, controls, tables/rosters, player details and feedback states.
5. A copy sheet with current strings, replacement strings and where longer explanations move.
6. A naming specification and the example datasets described above.
7. Annotated interaction states and an implementation handoff explaining responsive behaviour, focus order and component reuse.

Start by designing the dashboard, squad and live match together. They establish the main loop and need to feel like one game. Then extend the system to the remaining screens.

## Engineering constraints

- JavaScript, esbuild and Sass; no new backend is needed.
- Preserve the actual match engine and its rendering, rules, AI and weather.
- Preserve existing simulator tools, tests and assets.
- Keep game rules separate from presentation. A redesign should not silently alter prices, XP, fatigue or match balance.
- Keep all eight player attributes: speed, stamina, passing, dribbling, shooting, tackling, goalkeeping and accuracy.
- Preserve independent positional proficiency, player archetypes, functional traits and manager-selected upgrades.
- Maintain save compatibility or provide an explicit migration if display data changes.
- Include keyboard focus, readable contrast, text alternatives and touch targets of at least 44 px. Colour alone must not communicate injury, selection or affordability.

Relevant files:

| File | Responsibility |
| --- | --- |
| `kernel/apps/soccer-rogue/app.js` | Current layouts, interactions and most interface copy. |
| `scss/rogue.scss` | Current visual styling and responsive layouts. |
| `html/soccer-rogue.html` | Browser entry and page shell. |
| `kernel/rogue/players.js` | Player generation and current name pools; progression rules. |
| `kernel/rogue/data.js` | Club identities, traits, item/staff labels and balance constants. |
| `kernel/rogue/career.js` | Career flow, activities, purchases, saves and league progression. |
| `kernel/rogue/match.js` | Integration with the real match engine and manager substitutions. |
| `tests/rogue*.js` | Career, engine, UI interaction and full-season checks. |

The current UI is a functional implementation, not an approved visual direction. Visual browser QA was not completed in its initial implementation environment. Review the running app on desktop and mobile before signing off the redesign.

## Acceptance criteria

- A new player can identify their next opponent, remaining days, balance and primary action without reading explanatory paragraphs.
- A returning player can choose a lineup and substitute efficiently without opening every player’s full details.
- The main screens contain substantially less always-visible copy, with essential consequences still apparent.
- Player names read as plausible football squads and have no accidental full-name duplicates within a squad.
- Club and player identities have a consistent, grounded tone.
- Mobile layouts are deliberately designed; ordinary actions do not require desktop-width controls.
- Empty, disabled, loading, error and success states are specified.
- A preparation → match → results → next fixture walkthrough works as a coherent interaction prototype.
- Designs include enough detail for implementation without inventing missing interactions or changing the game rules.

# AI Writing Patterns: Complete Reference

## Words and phrases to replace

Words are organized into three tiers based on how reliably they signal AI-generated text. This tiered approach, adapted from [brandonwise/humanizer](https://github.com/brandonwise/humanizer)'s vocabulary research, reduces false positives on words that are fine in isolation but suspicious in clusters.

- **Tier 1**: Always flag. These words appear 5–20x more often in AI text than human text. Replace on sight.
- **Tier 2**: Flag in clusters. Individually fine, but two or more in the same paragraph is a strong AI signal.
- **Tier 3**: Flag by density. Common words that AI simply overuses. Only flag when they make up a noticeable fraction of the text (roughly 3%+ of total words).

### Tier 1: Always replace

| Replace | With |
|---|---|
| delve / delve into | explore, dig into, look at |
| landscape (metaphor) | field, space, industry, world |
| tapestry | (describe the actual complexity) |
| realm | area, field, domain |
| paradigm | model, approach, framework |
| embark | start, begin |
| beacon | (rewrite entirely) |
| testament to | shows, proves, demonstrates |
| robust | strong, reliable, solid |
| comprehensive | thorough, complete, full |
| cutting-edge | latest, newest, advanced |
| leverage (verb) | use |
| pivotal | important, key, critical |
| underscores | highlights, shows |
| meticulous / meticulously | careful, detailed, precise |
| seamless / seamlessly | smooth, easy, without friction |
| game-changer / game-changing | describe what specifically changed and why it matters |
| utilize | use |
| watershed moment | turning point, shift (or describe what changed) |
| marking a pivotal moment | (state what happened) |
| the future looks bright | (cut, say something specific or nothing) |
| only time will tell | (cut, say something specific or nothing) |
| nestled | is located, sits, is in |
| vibrant | (describe what makes it active, or cut) |
| thriving | growing, active (or cite a number) |
| despite challenges… continues to thrive | (name the challenge and the response, or cut) |
| showcasing | showing, demonstrating (or cut the clause) |
| deep dive / dive into | look at, examine, explore |
| unpack / unpacking | explain, break down, walk through |
| bustling | busy, active (or cite what makes it busy) |
| intricate / intricacies | complex, detailed (or name the specific complexity) |
| complexities | (name the actual complexities, or use "problems" / "details") |
| ever-evolving | changing, growing (or describe how) |
| enduring | lasting, long-running (or cite how long) |
| daunting | hard, difficult, challenging |
| holistic / holistically | complete, full, whole (or describe what's included) |
| actionable | practical, useful, concrete |
| impactful | effective, significant (or describe the impact) |
| learnings | lessons, findings, takeaways |
| thought leader / thought leadership | expert, authority (or describe their actual contribution) |
| best practices | what works, proven methods, standard approach |
| at its core | (cut, just state the thing) |
| synergy / synergies | (describe the actual combined effect) |
| interplay | relationship, connection, interaction |
| in order to | to |
| due to the fact that | because |
| serves as | is |
| features (verb) | has, includes |
| boasts | has |
| presents (inflated) | is, shows, gives |
| commence | start, begin |
| ascertain | find out, determine, learn |
| endeavor | effort, attempt, try |

### Tier 2: Flag when 2+ appear in the same paragraph

| Replace | With |
|---|---|
| harness | use, take advantage of |
| navigate / navigating | work through, handle, deal with |
| foster | encourage, support, build |
| elevate | improve, raise, strengthen |
| unleash | release, enable, unlock |
| streamline | simplify, speed up |
| empower | enable, let, allow |
| bolster | support, strengthen, back up |
| spearhead | lead, drive, run |
| resonate / resonates with | connect with, appeal to, matter to |
| revolutionize | change, transform, reshape (or describe what changed) |
| facilitate / facilitates | enable, help, allow, run |
| underpin | support, form the basis of |
| nuanced | specific, subtle, detailed (or name the actual nuance) |
| crucial | important, key, necessary |
| multifaceted | (describe the actual facets, or cut) |
| ecosystem (metaphor) | system, community, network, market |
| myriad | many, numerous (or give a number) |
| plethora | many, a lot of (or give a number) |
| encompass | include, cover, span |
| catalyze | start, trigger, accelerate |
| reimagine | rethink, redesign, rebuild |
| galvanize | motivate, rally, push |
| augment | add to, expand, supplement |
| cultivate | build, develop, grow |
| illuminate | clarify, explain, show |
| elucidate | explain, clarify, spell out |
| juxtapose | compare, contrast, set side by side |
| paradigm-shifting | (describe what actually shifted) |
| transformative / transformation | (describe what changed and how) |
| cornerstone | foundation, basis, key part |
| paramount | most important, top priority |
| poised (to) | ready, set, about to |
| burgeoning | growing, emerging (or cite a number) |
| nascent | new, early-stage, emerging |
| quintessential | typical, classic, defining |
| overarching | main, central, broad |
| underpinning / underpinnings | basis, foundation, what supports |

### Tier 3: Flag only at high density

These are normal words. Only flag them when the text is saturated with them.

| Word | What to do |
|---|---|
| significant / significantly | Replace some with specifics: numbers, comparisons, examples |
| innovative / innovation | Describe what's actually new |
| effective / effectively | Say how or cite a metric |
| dynamic / dynamics | Name the actual forces or changes |
| scalable / scalability | Describe what scales and to what |
| compelling | Say why it compels |
| unprecedented | Name the precedent it breaks (or cut) |
| exceptional / exceptionally | Cite what makes it an exception |
| remarkable / remarkably | Say what's worth remarking on |
| sophisticated | Describe the sophistication |
| instrumental | Say what role it played |
| world-class / state-of-the-art / best-in-class | Cite a benchmark or comparison |

---

## Template phrases

These slot-fill constructions signal that a sentence was generated, not written. If a phrase has a blank where a noun or adjective could go and still sound the same, it's too generic.

- "a [adjective] step towards [adjective] AI infrastructure" → describe the specific capability, benchmark, or outcome
- "a [adjective] step forward for [noun]" → say what actually changed

---

## Transition phrases to remove or rewrite

- "Moreover" / "Furthermore" / "Additionally" → restructure so the connection is obvious, or use "and," "also," "on top of that"
- "In today's [X]" / "In an era where" → cut or state specific context
- "It's worth noting that" / "Notably" → just state the fact
- "In conclusion" / "To summarize" → your conclusion should be obvious
- "When it comes to" → just talk about the thing directly
- "At the end of the day" → cut
- "That said" / "That being said" → cut or use "but," "yet," or "however." Don't overuse any one of them.

---

## Pattern categories

### Significance inflation
Phrases like "marking a pivotal moment in the evolution of..." or "a watershed moment for the industry" inflate routine events into history-making ones. State what happened and let the reader judge significance. If the sentence still works after you delete the inflation clause, delete it.

### Copula avoidance
AI text avoids "is" and "has" by substituting fancier verbs: "serves as," "features," "boasts," "presents," "represents." These sound like a press release. Default to "is" or "has" unless a more specific verb genuinely adds meaning.

### Synonym cycling
AI rotates synonyms to avoid repeating a word: "developers… engineers… practitioners… builders" in the same paragraph. Human writers repeat the clearest word. If the same noun or verb appears three times in a paragraph and that's the right word, keep all three. Forced variation reads as thesaurus abuse.

### Vague attributions
"Experts believe," "Studies show," "Research suggests," "Industry leaders agree" without naming the expert, study, or leader. Either cite a specific source or drop the attribution and state the claim directly.

### Filler phrases
Strip mechanical padding that adds words without meaning:
- "It is important to note that" → (just state it)
- "In terms of" → (rewrite)
- "The reality is that" → (cut or just state the claim)

### Generic conclusions
"The future looks bright," "Only time will tell," "One thing is certain," "As we move forward" are filler disguised as conclusions. Cut them. If the piece needs a closing thought, make it specific to the argument.

### Chatbot artifacts
"I hope this helps!", "Certainly!", "Absolutely!", "Great question!", "Feel free to reach out," "Let me know if you need anything else." Also: "In this article, we will explore…" or "Let's dive in!" Cut or rewrite with a direct opening.

### "Let's" constructions
"Let's explore," "Let's take a look," "Let's break this down," "Let's examine." AI uses "let's" as a false-collaborative opener to ease into a topic. It's filler that delays the actual point. Just start with the point.

### Notability name-dropping
AI piles on prestigious citations to manufacture credibility: "cited in The New York Times, BBC, Financial Times, and The Hindu." If a source matters, use it with context: "In a 2024 NYT interview, she argued..." One specific reference beats four name-drops.

### Superficial -ing analyses
Strings of present participles used as pseudo-analysis: "symbolizing the region's commitment to progress, reflecting decades of investment, and showcasing a new era of collaboration." These say nothing. Replace with specific facts or cut entirely.

### Promotional language
AI defaults to tourism-brochure prose: "nestled within the breathtaking foothills," "a vibrant hub of innovation," "a thriving ecosystem." Replace with plain description. If you wouldn't say it in conversation, cut it.

### Formulaic challenges
"Despite challenges, [subject] continues to thrive" or "While facing headwinds, the organization remains resilient." This is a non-statement. Name the actual challenge and the actual response, or cut the sentence.

### False ranges
AI creates false breadth by pairing unrelated extremes: "from the Big Bang to dark matter," "from ancient civilizations to modern startups." These sound sweeping but say nothing. List the actual topics or pick the one that matters.

### Inline-header lists
Bullet lists where each item starts with a bold header that repeats itself: "**Performance:** Performance improved by..." Strip the bold header and write the point directly.

### Title case headings
AI over-capitalizes headings: "Strategic Negotiations And Key Partnerships" instead of "Strategic negotiations and key partnerships." Use sentence case for subheadings. Title case only for the piece's main title, if at all.

### Cutoff disclaimers
"While specific details are limited based on available information," "As of my last update," "I don't have access to real-time data." These are model limitations leaking into prose. Either find the information or remove the hedge.

### Emotional flatline
AI claims emotions as a structural crutch without conveying them through the writing: "What surprised me most," "I was fascinated to discover," "What struck me was." If you claim an emotion, the writing around it should earn it. Otherwise cut the claim and present the thing directly.

### Reasoning chain artifacts
"Let me think step by step," "Breaking this down," "To approach this systematically," "Here's my thought process." These are artifacts of chain-of-thought reasoning leaking into published prose. State the conclusion, then the evidence.

### Sycophantic tone
"Great question!", "Excellent point!", "You're absolutely right!", "That's a really insightful observation." Remove entirely.

### Acknowledgment loops
"You're asking about," "The question of whether," "To answer your question." AI restates the prompt before answering. In writing, this is pure filler. Just answer.

### Confidence calibration phrases
"It's worth noting that," "Interestingly," "Surprisingly," "Importantly," "Significantly," "Notably," "Certainly," "Undoubtedly." AI uses these to signal how the reader should feel about a fact instead of letting the fact speak for itself. One "notably" in a 2,000-word piece is fine. Three in 500 words is emphasis stacking. Flag by density.

### Excessive structure
Too many headers in short text: more than 3 headings in under 300 words is AI trying to look organized. Too many list items: 8+ bullet points in under 200 words means the content should be a paragraph. Formulaic section headers: "Overview," "Key Points," "Summary," "Conclusion," "Introduction" are default AI scaffolding. Use headers that tell the reader something specific.

---

## Rhythm and uniformity

These aren't individual word or phrase problems. They're patterns in how the text flows as a whole. AI text is metronomic; human text has varied rhythm.

- **Sentence length uniformity**: If most sentences are 15–25 words, the text sounds robotic. Mix short punchy sentences (3–8 words) with longer flowing ones (20+). Fragments work. Questions break the monotony.
- **Paragraph length uniformity**: If every paragraph is 3–5 sentences and roughly the same size, vary deliberately. Some paragraphs should be one sentence.
- **Vocabulary repetition vs. synonym cycling**: AI either repeats the same word mechanically or cycles through synonyms conspicuously. Human writers repeat when the word is right and vary when it's natural.
- **Read-aloud test**: If the text sounds like it could be read by a text-to-speech engine without sounding weird, it's probably too uniform.
- **Missing first-person perspective**: Where appropriate, the writer should have opinions, preferences, and reactions. AI is relentlessly neutral. If the piece is supposed to have a voice, the absence of "I think," "in my experience," or a stated preference is itself an AI tell.

---

## Replacement table caveat

The replacement table provides defaults, not mandates. If a flagged word is clearly the right choice in context, preserve it.

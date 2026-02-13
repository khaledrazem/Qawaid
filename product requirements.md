

Project Name
09.04.20XX
─
Overview
A Typescript React app that's UX optimized for both desktops and mobiles because it will be ported to web and mobile apps, built to teach and train native arabic speaker who grew up with weak grammatical foundations in arabic to improve, it does so by providing exercises and lessons to teach a few key concepts with simple, aesthetically pleasing, easy to read visuals. And fun, educational, cultural quizzes that will be the core focus of the app.
^v1 is intended as a private beta; MVP can exclude lessons, login, online features, and offline caching, but all other features should be implemented.^
Goals
Explain basic naho concepts in a simple manner with useful and fun visualisations
Provide training questions using a variety of different question types for naho and i3rab
Target audience
This app is targeted to people who already speak arabic natively, or are good enough to speak and read it, but have weak understanding of the foundations in its grammatical aspects, like naho and i3rab, who might have trouble guessing the diacritic of their sentences.
Specifications
The app should be built using a react typescript framework to allow easy porting to a web server and also an android and ios app, it should work offline, only requiring to be online for updating the global leaderboard and account statistics. (offline mode not required for MVP)
Everything in the game should be in Arabic, this document design is written in English for ease of use, but all visuals and texts in the app should be translated to Arabic.
Supabase will be used as a backend, so there will be no need for a built-in backend container, our service will be purely frontend and will use Supabase RLS and google integration for security and authentication. 
The app should be usable without login, AWS S3 will be used to store images. (images not required for MVP)
While there is not back-end container, the app should still be split into a front end layer which handles all the UI components and user interactions, and a processing / API layer which handles any data processing and api calls, they are both in frontend and react components but this allows separation of concern and makes it easier to migrate to a proper backend in the future.
All UI labels and texts (excluding prompts,  questions, and definitions) should be stored in a json file to allow for language switching, each language will have its own json file and the ui labels get the actual value from them depending on the selected language. 
The user can still do the questions as a guest but certain features will be locked until they login, these features are:
contributing to global leaderboard and stats
adding friends
track progress
^v1 is private beta; stability and reliability are the priority^
Key words
Question: A generalised grammatical question, not specific to any sentence, linked to a definition (eg:  أين الفاعل في الجملة)
Definition: A grammatical definition, links to the prompt and to to the questions to build a complete exercise (eg: فاعل)
Category: A group of definitions that hold possible answers to the question (eg: اركان:    اسم, فعل, فاعل, مفعول به)
 Prompt: This is any raw sentence that's usually selected to be rich with grammatical variety, holds no meaning on its own, but each word or letter can be linked to a definition to give it meaning.  (eg: جلس الولد)
Features
Play
The main feature of the app is practicing grammatical Arabic questions, the user can customize what categories of questions should be included, and click start to begin the session. the user will have 3 hearts per session, once three mistakes are made then the session is over and the session summary is shown 
The questions are built dynamically from a question building pipeline defined later, the questions that a user gets should be selected randomly from the filtered pool of all questions, the distribution should be only affected by the difficulty of the question prompt, every user should have a default global distribution of question difficulties (eg: [easy: 0.5, medium: 0.3, hard: 0.2]) then if the user logs in these probabilities should adapt to their performance. (difficulty is per user, updated every session).
Some extra random ideas for questions:
use poems or literature references in some prompts
have custom drawn backgrounds for prompts that reference literature
keep track of what questions the user answers incorrectly and recommend the appropriate lessons to help with them
smooth animations between questions dependant on correct or wrong answer
MVP skips offline; full product will pre-generate 100–200 questions and store them locally
Session logic:
Endless until 3 mistakes
Average session: 10–15 minutes^
No session resume if exited mid-session; exiting goes to summary screen^
Optional timer per question not used initially^

[Start Session] 
      │
      ▼
[Fetch User Difficulty Profile] ^per user, used to bias question selection^
      │
      ▼
[Fetch Pool of Active Prompts] 
      │
      ├─ Filter by difficulty distribution
      │      Prompts must me distinct
      │      ^difficulty tied to prompt only^
      │
      ▼
[For each Prompt → Fetch one random Compatible Question] ^based on linked definitions^
      │
      ├─ Check question category has >=4 definitions
      └─ Check question is active
      │
      ▼
[Build Question Object]
{
  questionType: MCQ | click_word | click_letter
  promptText: string
  questionText: string
  possibleAnswers: DefinitionOptionDTO[4]  ^includes correct answer + 3 random from category^
  correctAnswerId: DefinitionOptionDTO
  difficulty: easy | medium | hard ^from prompt^
  points: int ^computed per difficulty^
}
      │
      ▼
[Load Questions in Batches] ^e.g., 30 questions preloaded^
      │
      ▼
[Present First Question to User]
      │
      ├─ User Answers
      │      ├─ Correct → increment session points, increment comboMultiplier, increment correctStreak
      │      └─ Incorrect → decrement hearts, log incorrectCategoryIds
      │
      ▼
[Check Session End Condition]
      ├─ Hearts = 0 → Go to Finish Screen
      └─ Else → Present Next Question
      │       ^preload next batch if near end of loaded questions^
      │
      ▼
[Finish Screen]
{
  totalQuestionsAnswered: int
  totalPoints: int
  maxCombo: int
  incorrectCategoryIds: UUID[] ^deduplicated^
  recommendedLessons: LessonRecommendationDTO[] ^based on incorrectCategoryIds^
}
      │
      ▼
[Update Monthly Global Points] ^send to Supabase if online^
      │
      ▼
[Update User Difficulty Profile] ^adjust weights based on performance^
      │
      ▼
[End Session / Back to Main Menu]



Points
The app will have two point counters:
1- session based point system, 
Every session of questions has a score counter, the counter increases for every question answered correctly, the amount it increases by is based on the difficulty of the question [easy, medium, hard], and there's a combo multiplier which increases for every 5 questions answered correctly, the multiplier resets when user answers a question incorrectly or ends the session. 

2- monthly global points system with a leaderboard 
Each user has a global score which can be seen by anyone, it is the accumulation of all session points so far this month, at the end of every session the total points of the session are added to the user’s global points for the current month. These global points can be shown on a global leaderboard which shows everyone's scores (truncated to maybe 6 to 12 neighboring users + top 5 users). This global score resets for all users at the beginning of every month, allowing people to start from a new slate every month.  (actually, reset not required; query aggregates by month)

More user statistics should be shown in another tab:
-total questions answered
-most questions answered in one session
-lifetime points

Lessons
The lessons in the app are like more handcrafted experiences that are tailored to explain core grammar concepts in simple, visual ways, and incorporate memorable aspects like animations or interactive examples to ensure full understanding of every concept. Rules can be broken down to their simplest parts, and then either grouped alone or together, each chapter can be represented as a 3 to 5 page booklet to properly drive through the grammatical rule, How it is used, some examples, some visualisations, and interactable animation. (eg: 3 pages to explain how a فاعل  and مفعول به interact together, one page can define them with a simple visualization of one using the other, the second page can be just the text فاعل  with a prompt to click it, which reveals a guy with a broomstick next to him, and once the broomstick is clicked on it shows  مفعول )
Not required for MVP^
Each chapter can be represented as a 3–5 page booklet

Phases
MVP
Core functionality required to run a session and track progress locally / in Supabase
Features / Components:
Questions Engine
All question types: MCQ, click word, click letter
Dynamic question generation from prompts and definitions
Correct answer linked to definition; actual word/letter resolved via prompt_definition
Batch loading of questions (~30 at a time)


Session Management
3 lives per session
Endless session until all hearts lost
Score calculation per question, combo multiplier applied
Track correct streak, total questions answered, max combo
Finish Screen
Summary of session: total questions answered, total points, max combo
Update monthly global points (if online)
Basic UI Components
Main Menu (Play button, Settings modal for category filters, Profile button)
Questions / Play screen (question text, prompt, answers, score, lives)
Finish screen
Data / Backend Integration
Supabase for storing users, scores, categories, definitions, prompts, questions
Local storage for preloaded question batches
Minimal API / processing layer in React for question generation, scoring, aggregation


Admin Page (Web Only)
Add/edit/delete prompts, questions, definitions, categories
FK / integrity checks
Warnings if category <4 definitions
V1
advanced features for private beta
Prompt
Difficulty applied per prompt
Lessons
Interactive lesson pages (animations, visualizations, multi-page booklets)
Explanation of grammar concepts per category
Lesson recommendations (based on incorrect categories)
Login / Online Features
Google login / authentication
Unlock leaderboard contribution
Track progress across devices
Add friends
Offline Mode
Pre-generate questions (~100–200) and store locally
Sync progress and points when online
Cultural / Advanced Prompts
Prompts referencing poems, literature, or cultural content, will have a flag in db for cultural prompt and will have different ui background
Timers / Question Time Limits
Optional per-question timers (not used in MVP)
Advanced Animations / UI Effects
Subtle radial blooms, unfolding tiles, other visual flourishes
Extended Admin / Reporting
Bug reports tab (planned, not fully designed)
More sophisticated category and definition management features
Leaderboard
Fetch and display monthly scores (top users + surrounding users)
Update user global points per session
Other UX Features
Progress tracking dashboards in profile
Multi-language support beyond default Arabic

UI Components
1 - Main menu
The main menu will include the logo of the app with the name, below it will be a highlighted button that has more emphasis which says “play”, and below it two standard buttons, one to view lessons, and the other to view the leaderboard, next to the play button there is a settings button which when clicked, allows users to select what categories of questions to include through a modal, by default they are all included, it also has a select and deselect all button. There should be a profile icon in the top right which when clicked navigates to the profile screen.

2-Profile
If the user is not logged in this will display a prompt to login to unlock features and a google login button, if the user is logged in it will show the email linked, the display username which defaults to the first part of the email, a logout button, and a delete account button. There should also be a button to switch languages, initially, arabic is default, and english is a supported language.

3 - Leaderboard
This will display a global monthly leaderboard, top left will be a back button that's just an arrow, if clicked returns to the main menu, a table should show the top 3 users, then some dots to signify a gap and then a highlighted row of where the current user is and the 10 users around him. There should also be another tab to show some personal stats, and a third tab to show some global stats.

4- lessons 
A simple scrollable list of buttons each button points to a page for the concept it's for, and  a back button to go back to the main menu, the actual lessons will be custom made pages.

5 - questions / play
Questions will start a series of randomly selected questions from all categories (unless specified otherwise), the user has 3 lives / attempts, after that he loses and moves on to the finish screen. the actual ui of the questions will differ based on category, but the main screen will include the actual question, the current total points of the session and the number of questions answered the possible answers if applicable, an X at the top left top cancel, which should have a confirmation bubble if clicked, and then leads to the finish screen. If the user breaks a new record on the number of questions answered then the number for it should do a celebratory animation. 

6 - finish screen
When the user loses all 3 lives, he is taken to a summary page which shows the total number of questions answered. total points made, their points should be added to their monthly accumulated points and his new position in the leaderboard should be shown, and then there is a retry button and a main menu button, it should also keep track of the questions the user got wrong, and recommend the lessons they could check, which lesson to recommend will depend on the category, Lessons and questions both have specified categories, that will be used to know which lesson to recommend, make sure that the recommended lessons have no duplicates so if all 3 mistakes were on the same lesson then just show that one lesson once.

7 - admin page
This page will only be available on the web app and will be password protected, it should have a different url completely than the main app, this page allows us to add,delete,or edit questions, prompts, and definitions, each will have its own tab.
Prompts should allow me to add, delete, edit, activate, deactivate a sentence, to make a new one, we must specify its difficulty from a drop down and click confirm, the edit button will just change the prompt and category texts to an editable field. I can add multiple definitions to a prompt. The tab should show a list of existing prompts, i can click on any of them to expand and show me the list of definitions it has and an ability to add and delete and edit, activate, deactivate them, i can click an add definition button, which will open a modal, i have to specify first if the definition points to a letter or a word in the prompt, The user will be shown the prompt and asked to click on the letter / word they would like to add a definition to, hovering over the words / letter should highlight either the entire word, or the letter depending on the earlier choice, in the system it should be storing the index of the letter or first letter of the word the user selected. The next user input will be the definition, which  will be an autocomplete dropdown showing all definitions in the db, once these are all selected users can confirm and the relationship can be saved to db. If a prompt was edited, the existing definitions should be checked to make sure the associated word or letter has not been changed. Warning icon should be displayed next to a prompt if it doesn't have any definitions.
Category is simple, just give the user the ability to add, edit, activate, deactivate, delete categories, be careful of fk, user only need to enter category name to create new category. Category is basically a group of definitions with a group name. For each category you should also have a list of multiselect definitions, and you can add or remove definitions that are assigned to it. If a category has less than 4 definitions, it should display some kind of warning logo next to it with a tooltip saying that the category can't be used because it doesn't have enough answers / definitions
 The definitions tab is simple, users can add, edit, activate, deactivate and delete definitions, which is just a string input and optionally add it to a category, that's it. The only complicated part is handling fk relationships, do questions and prompts that use that definition get deleted? Or maybe the user has to select a replacement definition. This tab should also allow users to create categories when selecting the optional category from the category dropdown list, similar to how in youtube you can create a new playlist when creating a video, which is also as simple, just enter the category name, which then shows it in the category dropdown field for the definition, it should also be multiselect. Clicking edit on an existing definition will expand the tab to reveal editable fields.
 Questions should allow users to add, edit, delete, activate, deactivate the questions, to add a question user will need to enter the question prompt, its associated category which includes the pool of possible answers(definitions), and the correct answer (definition) which is part of that selected category. The user also needs to select a question type which is an enum, and the category is from the db.Clicking edit on an existing question will expand the tab to reveal editable fields.
Bug reports tab, idk just maybe show them show didn't figure out the architecture of this yet

Web-only, password protected
Add/edit/delete prompts, definitions, categories, questions
Warn if categories <4 definitions^
Attempt automatic reindexing if prompt edited^





Question generation
The link between a prompt and a question is the definition, when a session is started the app has to pull a pool of random prompts, and then using the definitions that are linked to that prompt pull a pool of random questions and 3 other definitions from the category linked to the question, for each question, it will have to create an object that looks something like this:
{
Question_text: String
Prompt_text: String
Possible_answers: List<String>[4]  (4 definitions included in question category, maybe with id is better)
Correct_answer: String (a definition, maybe id is better)
Points: int
}
These will have to be loaded in batches, so load 30 questions, if the user gets near them then load more, it will probably be helpful to have a db index for this
Prompt → definitions -> compatible question
Avoid prompts with no questions, or categories with <4 definitions
For MCQs, pull correct definition and 3 random definitions from correct answer’s category 
Correct answer that's stored in question table is a definition; The actual answer from the prompt can be pulled by checking the definition linked to a word or letter in a prompt via prompt_definition



UML







User stories
Prompt & Grammar Setup

As a content creator, I want to add a prompt with a difficulty level so learners can be challenged appropriately.
As a content creator, I want to define grammar elements by word or letter index so the system understands sentence structure.
As a content creator, I want to reuse the same definition across multiple prompts to avoid duplication.
As a content creator, I want to mark whether a definition refers to a word or a letter to support harakah-based questions.

Question Creation

As a content creator, I want to create a question and select its type (MCQ, click word, click letter).
As a content creator, I want to link a question to a category so it's linked to a pool of definitions and works across many prompts.
As a content creator, I want to define categories of grammatical definitions
As a content creator, I want to assign the question a category
As a content creator, I want to add a set of definitions to a category.


👨‍🎓 Learner Stories

As a learner, I want to start a quiz and receive random prompts.
As a learner, I want questions to feel dynamic and not repetitive.
As a learner, I want to click words or letters directly in the sentence when answering.
As a learner, I want to receive immediate feedback after answering.
As a learner, I want my monthly score to be tracked automatically.
As a learner, I want questions to vary in difficulty over time. (difficulty tied to prompt only)


As a learner, I want to learn about arabian culture while practicing my grammar.
As a learner, I want to find relevant resources to learn from my mistakes during practice.
As a learner, I want to see my global standing on a leaderboard.

🧠 System-Level Stories

As a system, I want to generate questions dynamically, not hardcoded questions.
As a system, I want to support new questions and question types without schema changes.
Track mistakes, adjust difficulty per user per session
As a system, I want to reuse the same question across multiple prompts and vice versa when possible.
As a system, I want to pull prompts randomly and generate a random question for each.
As a system, I want to keep track of the mistakes a user makes and adjust the rate of difficult questions accordingly.


Database data model


enum question_type {
  MCQ
  click_word
  click_letter
}


enum difficulty {
  easy
  medium
  hard
}
Table users {
  id uuid [pk]
  google_id varchar [not null, unique]
  display_name varchar
  avatar_url varchar
  created_at timestamp
}
Table user_stats {
  user_id uuid [pk]
  lifetime_points int [default: 0]
  total_questions_answered int [default: 0]
  best_session_questions int [default: 0]
  updated_at timestamp
}
Table monthly_scores {
  id uuid [pk]
  user_id uuid [not null]
  month char(7) [note: 'YYYY-MM']
  points int [default: 0]
  updated_at timestamp


  indexes {
    (user_id, month) [unique]
  }
}
Table user_difficulty_profile {
  user_id uuid [pk]
  easy_weight float
  medium_weight float
  hard_weight float
  updated_at timestamp
}
Table categories {
  id uuid [pk]
  name varchar [unique]
  is_active bool [default: true]
}
Table definitions {
  id uuid [pk]
  label varchar [unique]
  is_active bool [default: true]
}


Table category_definitions {
  category_id uuid
  definition_id uuid


  indexes {
    (category_id, definition_id) [unique]
  }
}


Table prompts {
  id uuid [pk]
  prompt_text text
  difficulty difficulty
  is_active bool [default: true]
  version int [default: 1]
  created_at timestamp
  updated_at timestamp
}


Table prompt_definitions {
  id uuid [pk]
  prompt_id uuid
  definition_id uuid
  index_start int
  is_letter bool
  created_at timestamp
  updated_at timestamp
}


Table questions {
  id uuid [pk]
  question_text varchar
  category_id uuid
  type question_type
  correct_definition_id uuid
  is_active bool [default: true]
}
Table lessons {
  id uuid [pk]
  title varchar [unique]
  content_html text
  category_id uuid
  is_active bool [default: true]
}
Table bug_reports {
  id uuid [pk]
  user_id uuid
  description text
  status varchar
  created_at timestamp
}
Ref: user_stats.user_id > users.id
Ref: monthly_scores.user_id > users.id
Ref: user_difficulty_profile.user_id > users.id


Ref: category_definitions.category_id > categories.id
Ref: category_definitions.definition_id > definitions.id


Ref: prompt_definitions.prompt_id > prompts.id
Ref: prompt_definitions.definition_id > definitions.id


Ref: questions.category_id > categories.id
Ref: questions.correct_definition_id > definitions.id


Ref: lessons.category_id > categories.id


Ref: bug_reports.user_id > users.id


questions.correct_definition_id stores definition, not exact prompt word/letter
Prompt difficulty affects user performance scoring
Questions and prompts reusable across multiple relationships
Inactive definitions excluded from question generation

DTOs
QuestionDTO
 {
  questionType: 'MCQ' | 'click_word' | 'click_letter'
  promptText: string
  questionText: string
  possibleAnswers: DefinitionOptionDTO[]   // length = 4 (including correctAnser)
  correctAnswerId: DefinitionOptionDTO
  difficulty: 'easy' | 'medium' | 'hard'
  points: number
}


DefinitionOptionDTO
 {
  id: UUID
  label: string
}


SessionStateDTO 
{
  startedAt: ISODate
  livesRemaining: number        // starts at 3
  currentScore: number
  comboMultiplier: number
  questionsAnswered: number
  correctStreak: number
  incorrectCategoryIds: UUID[]
  currentQuestion?: QuestionDTO
 nextQuestion?: QuestionDTO
}

SessionSummaryDTO 
{
  totalQuestionsAnswered: number
  totalPoints: number
  maxCombo: number
  incorrectCategoryIds: UUID[]   // de-duplicated
}


LessonRecommendationDTO
 {
  lessonId: UUID
  title: string
  categoryId: UUID
  reason: string
}

LeaderboardEntryDTO 
{
  userId: UUID
  displayName: string
  avatarUrl?: string
  rank: number
  points: number
}
LeaderboardDTO
 {
  topUsers: LeaderboardEntryDTO[]     // top 3–5
  surroundingUsers: LeaderboardEntryDTO[] // ±6–12
  currentUserRank: number
}


Style and themes
1. Brand Essence
Sahra is an educational platform for mastering Arabic grammar, inspired by ancient Arabian manuscripts and Arabesque geometry — but executed with modern UX clarity.

It blends:
Traditional Arabesque aesthetics
Educational structure
Subtle artistic expression
Modern UI clarity

The goal is to create a focused, culturally rich, and visually calm experience that feels intelligent and refined.

2. Brand Positioning
Core Traits
Clear
Confident
Traditional
Educational
Focused
Artistic
Culturally rooted
Visually calm
Sahra stands for:
Cultural intelligence
Structured learning
Calm authority
Elegant but not flashy

It blends:
Traditional Arabesque aesthetics
Educational structure
Subtle artistic expression
Modern UI logic
3. Visual Philosophy
From Tradition:
Arabesque geometry
Manuscript warmth
Gold detailing
Cultural symmetry
Structured knowledge

From Modern UX:
Clean grid systems
Clear hierarchy
Strong whitespace
Modular components
Accessibility-first design

The product must feel modern first.
The culture enhances it — not overwhelms it.
5. Color System
We keep the parchment + emerald + muted gold direction as the core aesthetic.

5.1 Primary Base
Warm Parchment
Soft off-white with subtle beige tone
Feels like manuscript paper
Reduces eye strain

This replaces flat white.

5.2 Core Palette
Deep Emerald
Primary interaction color
Used for:
Buttons
Sidebar
Active states
Section headers
Symbolizes knowledge and rootedness.

Muted Gold
Used sparingly.
Micro-dividers.
Icons.
Section lines.
Achievement markers.

Never large fills.
Never gradients.

Gold = refinement, not decoration.

Deep Black / Charcoal
Primary text.
Structural elements.
Authority and clarity.

Supporting Educational Blue
Used for:
Highlights
Grammar role color coding
Interactive learning feedback
Blue communicates logic and clarity.

Optional Purple Accent
Used minimally for:
Wisdom highlight
Special modules
Advanced content
Not dominant.

6. Typography Direction
Headings
Inspired by classical manuscript tone but simplified.
Semi-serif or refined Arabic display style.
Confident.
High readability.
Slight artistic elegance.

Body Text
Modern sans-serif.
Clean.
Readable.
Generous line spacing.

The balance:
Heading = heritage
Body = modern clarity
Never overly calligraphic.

7. Layout & UI System
7.1 Layout Principles

Strong grid structure (8pt system)
Clear visual hierarchy
Generous whitespace
No heavy gradients
Balanced spacing
Clear grouping
Decoration never dictates layout.

7.2 Card System (Core Component)

Learning happens in modular cards.

Characteristics:
Soft corners (not overly rounded)
Subtle elevation
Parchment background
Thin gold divider
Structured content sections

Card structure:
Title
Explanation
Example
Diagram / Concept Map
Practice CTA

Cards echo geometric modularity — but remain modern SaaS-like.

8. Pattern & Texture System

Arabesque Patterns

Allowed:
Header overlays (3–5% opacity)
Onboarding screens
Section dividers
Achievement screens

Not allowed:
Full tiled screens
Competing with text
High-contrast patterns
Patterns must feel embossed, not printed.

Texture
Subtle grain.
Oil-paint softness.
Very low opacity overlay.

The texture should feel organic and slightly historic — but subtle enough that users barely notice it consciously.

9. Iconography
Thin-line.
Geometric.
Elegant.

Colors: Gold or deep emerald.

Avoid:
Cartoon icons.
Filled playful shapes.
Illustrative overload.

Icons should feel architectural.

10. Interaction Design

Motion should feel:
Measured.
Intentional.
Confident.

Transitions:
200–300ms
Soft ease-in-out
Minimal bounce

Examples:

Expanding lesson = unfolding tile effect
Completion = subtle radial bloom
Navigation = smooth slide
No energetic animations.

11. Educational Architecture

This is the strongest part of your logic.

The interface should visually communicate:
Structured learning
Conceptual mapping
Hierarchy of rules
System expansion

Possible UI structures:
Expandable rule clusters
Concept maps
Diagram trees
Structured modules
Cultural context side panels

Learning should feel:
Systematic.
Layered.
Intelligent.

12. Imagery Direction

If illustrations are used:
Oil-paint inspired
Slightly textured
Desert tones
Manuscript edges
Geometric symmetry

No clichés.
No camels.
No stereotypical overuse of calligraphy.

Inspired by culture — not themed around it.

13. UX Principles
Clarity over decoration
Education over entertainment
Calm focus over distraction
Hierarchy over chaos
Depth over trendiness

The interface should always feel:
Focused.
Unrushed.
Purposeful.

14. Cultural Integrity

Important guardrails:
Respectful pattern usage
No ornamental overload
Avoid trend-driven “Islamic aesthetic” clichés
No artificial nostalgia
Culture is foundation — not ornament.

15. Design Do’s & Don’ts

✅ Do:
Use gold as refined accent
Keep layouts clean
Use patterns subtly
Maintain strong contrast
Use calm motion
Protect whitespace

❌ Don’t:
Overload patterns
Use neon tones
Overuse gradients
Make it playful
Over-animate
Sacrifice clarity for beauty

16. Final Brand Expression

Sahra is:

A digital manuscript system
Built with modern UX architecture
Inspired by Arabesque geometry
Grounded in educational clarity

It should feel like:

If ancient Arabian scholars designed a contemporary learning platform.

Categories
1 - harakah
2 - questions
3 - structure
4 - Time

Definition groups
This is literally the same as categories merge them together (groups, defenitions still needed)
سؤال:    هَلْ | مَنْ | مَاذَا | مَا 
حركات:    فَتْحَة | كَسْرَة | ضَمَّة | مَدَّة | سُكُونْ | تَنْوِين | شَدَّة
اركان:    اسم, فعل, فاعل, مفعول به
زمن:  ماضي , الْمُضارعُ , مستقبل

Question type
MCQ: Multiple choice question
Word-in-sentence: select a word from the prompt
Letter-in-sentence: select a letter from the sentence
Letter indices are raw string indices; No restrictions in code, admin should know what to avoid
Questions
Extra details:
- multiple choice will show 3 to 4 possible options that are randomly selected from the pool of possible answers, must be including the actual correct answer


1 -
Question: What is the diacritic of the highlighted letter?
 description: displays a sentence with no harakats, with one of the letters highlighted
Type: MCQ
category:حركات

2 - 
Question: What signifies this sentence is a question
Description: displays a sentence that's a question.
Type: word-in-sentence
category: سؤال 

3 - 
Question: What is the role of the highlighted word
Description: display a sentence with a word that is structural highlighted
Type: MCQ
category: اركان


4 - 
Question: What word in the sentence is X (x could be any definition from the group ])
Description: User has to click on the word in the sentence that is grammatically the definition chosen
Type: word-in-sentence
category: اركان


5 - Time
Question: A sentence that highlights one of the فعل words
Answer: the user has to select whether the highlighted word is in the past, present or future
Possible answers:  ماضي , الْمُضارعُ , مستقبل 

Prompts
Cultural prompts can come later^
Lessons
Lessons optional for MVP


Other clarifications
Sessions endless until 3 mistakes
Average session: 10–15 minutes
No session resume if exited mid-session
Points and combo logic as defined
Adaptive difficulty per user, updated every session
Offline strategy pre-generates questions for full product; MVP skips
Admin warning added for small categories (<4 definitions)
Supabase temporary backend; local processing/API layer in React handles aggregation logic



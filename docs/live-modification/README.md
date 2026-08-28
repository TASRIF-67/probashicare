# ProbashiCare Live Modification Practice

This directory is a student-readable study area for the ProbashiCare live modification test.

The code exercises are intentionally implemented on the branch:

~~~text
practice/live-modification
~~~

The deployed main branch is not changed unless this practice branch is later merged intentionally.

## Study order

1. Elderly Health Profile Management
2. Gemini Wellness Summaries and Fallback Logic
3. In-app Notifications
4. Family Subscription and Payment Management
5. Family Account Management and Email Re-verification

This order begins with normal CRUD and gradually introduces authorization, transactions, external services, and fallbacks.

## Read these first

1. **LIVE_TEST_PRIORITY_AND_ADVANCED_REFERENCE.md**: the highest-value full-stack blocks first, followed by moderate-to-advanced JavaScript, React, Express, MongoDB, security, testing, and deployment.
2. **COPY_PASTE_PATTERNS.md**: requirement-to-pattern index and reusable project-compatible blocks.
3. The full-stack guide for the feature being practised.

## Documents

- **LIVE_TEST_PRIORITY_AND_ADVANCED_REFERENCE.md**: urgent exam workflow plus moderate-to-advanced concepts and code.
- **MY_FEATURES_FILE_MAP.md**: where each assigned feature lives.
- **MY_FEATURE_FUNCTION_INVENTORY.md**: the necessary functions in each feature file and their responsibilities.
- **JS_REACT_MERN_CHEATSHEET.md**: JavaScript, React, Express, and Mongoose basics used in this project.
- **SYNTAX_AND_DATABASE_REFERENCE.md**: dot notation, Promises, React syntax, Mongoose CRUD, operators, aggregation, indexes, and transactions.
- **ELDERLY_PROFILE_FULL_STACK_GUIDE.md**: complete first-feature flow, API contracts, database logic, errors, viva notes, and a practice modification.
- **GEMINI_WELLNESS_FULL_STACK_GUIDE.md**: complete privacy, Gemini/fallback, cache, API, database, frontend, test, and viva flow.
- **NOTIFICATION_SYSTEM_FULL_STACK_GUIDE.md**: complete event producer, idempotency, API, MongoDB, context, polling, UI, tests, modifications, and viva flow.
- **SUBSCRIPTION_PAYMENT_FULL_STACK_GUIDE.md**: complete plan, access, expiry, prototype payment, Stripe webhook, history, Admin analytics, tests, modifications, and viva flow.
- **FAMILY_ACCOUNT_REVERIFICATION_FULL_STACK_GUIDE.md**: complete account update, password confirmation, token, mail, session, MongoDB, frontend, tests, deployment, and viva flow.
- **COPY_PASTE_PATTERNS.md**: small project-compatible patterns for live modifications.

## How to practise

For each exercise:

1. Write the requirement in one sentence.
2. Identify the page, service, route, controller, and model.
3. Write the database query first on paper.
4. Write the backend response shape.
5. Write the frontend state and request.
6. Add loading, empty, success, and error states.
7. Run syntax checks and the frontend build.
8. Explain the complete flow aloud without reading.

## Safety

A separate practice database is safest. If you intentionally use the configured learning database, inspect every query first and ensure a smoke script deletes only fixtures it created. Never place credentials in Markdown or commit a real environment file.

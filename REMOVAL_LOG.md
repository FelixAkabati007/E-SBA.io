# Removal Log

## Entry
- Feature: Supabase Edge Function `greet`
- Description: JSON greeting endpoint deployed as example edge function
- Removal Date: 2025-12-13
- Author: AI Assistant
- Impact Assessment: No impact on core SBA workflows; endpoint unused by app
- Rationale: Does not support core requirements; removal reduces code surface and maintenance
- Dependencies/Affected: None in app; file at `supabase/functions/greet/index.ts` removed
- Regression Testing: App server routes, uploads, templates, Supabase assessments unaffected; run typecheck, lint, tests
- Requirement Reference: N/A (example-only implementation)

## Entry
- Feature: Supabase Edge Function `read-text`
- Description: CORS-enabled reader for text file from Storage bucket
- Removal Date: 2025-12-13
- Author: AI Assistant
- Impact Assessment: No impact on core SBA workflows; not referenced by app
- Rationale: Non-essential demo endpoint; removal simplifies repository and avoids stray env needs
- Dependencies/Affected: None in app; file at `supabase/functions/read-text/index.ts` removed
- Regression Testing: Ensure storage features used by app (signatures) remain unaffected; run typecheck, lint, tests
- Requirement Reference: N/A (example-only implementation)

## Entry
- Feature: Supabase Query Router (`/api/supabase/data`)
- Description: Express router for querying public tables via anon client
- Removal Date: 2025-12-13
- Author: AI Assistant
- Impact Assessment: Not part of core workflows; removal reduces API surface and potential attack vectors
- Rationale: Non-essential; overlaps with existing server-side `supabaseAdmin` flows
- Dependencies/Affected: Import and route registration removed from `server/index.ts`
- Regression Testing: Verify `/api/supabase/health`, assessments upload, template generation; run typecheck, lint, tests
- Requirement Reference: N/A (auxiliary access endpoint)

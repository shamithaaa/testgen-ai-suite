# Team Backend & Frontend Ground Rules

The following rules MUST be strictly adhered to during code reviews. If a developer's code violates ANY of these constraints, you must explicitly flag it as a finding with a HIGH or CRITICAL severity.

## 1. Architectural Integrity
- **No Circular Imports:** Ensure that there are no circular dependencies introduced between modules.
- **Service Layer Pattern:** API controllers/routers must NEVER contain heavy business logic. All business logic must be delegated to dedicated `_service.py` files.
- **Pure Functions:** Utility functions MUST be pure. They should not mutate global states or modify input arguments directly.

## 2. Security Requirements
- **No Hardcoded Secrets:** Check carefully for hardcoded tokens, passwords, API keys, or PATs (Personal Access Tokens) within the files. Any such instance is CRITICAL.
- **Data Validation:** Ensure all incoming API payloads use Pydantic models (backend) and Zod/Yup schemas (frontend) for strict validation.

## 3. Formatting & Code Style
- **Type Hinting:** All Python functions must include proper type hints for both arguments and return values.
- **Typescript over Javascript:** The frontend must use strict TypeScript. The use of the `any` type is heavily discouraged unless explicitly commented with a valid reason.
- **Console Logs:** `console.log()` statements are forbidden in production code. They must be removed or replaced with proper structured logging (`logger.info`, `logger.error`).

## 4. Error Handling
- **Graceful Failure:** API endpoints must return standardized JSON error payloads with correct HTTP status codes (e.g., 400 for bad input, 404 for not found, 500 for internal errors).
- **Silent Catching:** Empty `try/except` blocks (or catch blocks) are strictly forbidden. All caught errors should be properly logged or handled.

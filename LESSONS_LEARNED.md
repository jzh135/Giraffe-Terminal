# Lessons Learned: Account Detail Debugging (2025-12-08)

## 1. Import Strategy: Namespace vs. Named Imports
**Issue:**
The application was using wildcard imports (`import * as api from '../api'`) to access backend functions. While syntactically correct, this caused runtime issues where specific methods (e.g., `api.getCashMovements`) were undefined, likely due to module resolution complexities or circular dependencies in the bundler (Vite).

**Lesson:**
Prefer **Named Imports** (`import { getCashMovements } from '../api'`) for local modules.
-   **Why:** It forces the bundler to verify the existence of the export at build time and avoids runtime "undefined" errors if the module object isn't fully constructed when accessed.

## 2. Vite & Browser Caching ("Zombie Code")
**Issue:**
Despite code changes, the browser seemed to persist with old behavior or blank screens.
-   Development servers like Vite aggressively cache modules for performance.
-   Renaming the file (creating `AccountDetailV2.jsx`) immediately resolved the issue, proving that the problem was partly due to the bundler holding onto a stale or corrupted version of the original file.

**Lesson:**
When a component behaves inexplicably (e.g., blank screen with no errors, or errors that don't match the code):
1.  **Hard Restart:** Stop and restart the dev server (`npm run dev`).
2.  **File Renaming:** Temporarily renaming the component (e.g., `ComponentV2`) is a powerful debugging technique to force the bundler to process the file as a fresh module, bypassing all caches.

## 3. Defensive Programming: Data Safety
**Issue:**
The "White Screen of Death" occurred because the component assumed API calls always returned arrays. If an API call returned `null`, `undefined`, or an error object, methods like `.map()` caused an immediate crash.

**Lesson:**
Always wrap API responses in safety checks before setting state or rendering.
```javascript
// BAD
setHoldings(data); // If data is null, the app crashes later

// GOOD
setHoldings(Array.isArray(data) ? data : []); 
```
This ensures the UI remains stable (rendering an empty state) rather than crashing entirely if the backend has a hiccup.

## 4. Incremental Reconstruction
**Issue:**
Trying to debug a large, complex component with many dependencies (Modals, API calls, Tabs) all at once was inefficient.

**Lesson:**
When facing total failure (blank page):
1.  Strip the component down to a "Level 1" implementation (just a `div` and static text).
2.  Verify it renders.
3.  Add one layer of complexity at a time (e.g., fetch one API -> render; add Tabs -> render; add Modals -> render).
This isolates exactly *where* the break occurs.

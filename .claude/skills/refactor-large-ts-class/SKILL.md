---
name: refactor-large-ts-class
description: 'Refactor a huge TypeScript class into a directory module: keep the class in index.ts and move methods into one-file-per-method regular functions that use a typed `this` parameter (class interface). Use when splitting oversized classes, improving maintainability, or preparing safer incremental refactors.'
argument-hint: 'Path to class file and class name (for example: src/foo/BigService.ts BigService)'
---

# Refactor Large TypeScript Class

## Outcome

Convert one large class into a folderized module:

- `index.ts` keeps the class definition, constructor, fields, and public API surface.
- Each method body is moved to a separate file as a regular function.
- Each extracted function uses a typed `this` parameter where type is the class interface.

Target shape:

```ts
// index.ts
import { calculateTotals } from './calculateTotals';

export interface BigServiceShape {
  taxRate: number;
  round(value: number): number;
}

export class BigService {
  public taxRate = 0.1;

  public round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  public calculateTotals(order: Order): Totals {
    return calculateTotals.call(this as BigServiceShape, order);
  }
}
```

```ts
// calculateTotals.ts
import type { BigServiceShape } from './index';

export function calculateTotals(this: BigServiceShape, order: Order): Totals {
  // previous method body, now using `this` with explicit interface typing
}
```

## When To Use

- A TypeScript class is too large to reason about safely.
- You need method-level ownership, testing, or review.
- You want incremental extraction without changing external callers.

## Inputs

- File path and class name.
- Output folder location (usually adjacent to original file).
- Naming convention for extracted functions.
- Interface name for extracted function `this` typing (for example `BigServiceShape`).

## Procedure

1. Baseline and safety checks.
- Run typecheck and tests to establish a clean baseline.
- Snapshot current public class API (method names, signatures, visibility).
- Identify external callers and critical paths.

2. Create target module folder.
- Create a folder named after the class module.
- Add `index.ts` for the class shell.
- Move or copy the original class into `index.ts` first with no behavior changes.

3. Select extraction order.
- Extract low-dependency private helpers first.
- Then extract internal methods used by many others.
- Extract public methods last unless needed for risk reduction.

4. Extract one method at a time.
- Create `<methodName>.ts`.
- Convert method to `export function <methodName>(this: ClassShape, ...args)`.
- Keep `this` in method logic; do not rename to a service/context argument.
- Keep return type and parameter types explicit.
- In `index.ts`, keep a thin delegating method that calls the extracted function with `.call(this as ClassShape, ...)`.

5. Preserve behavior and encapsulation.
- If extracted code touches `private`/`protected` fields, choose one path:
  - Path A (preferred): expose minimal internal getters/helpers in class and call those.
  - Path B (allowed): controlled visibility widening with explicit warnings and narrow scope.
- Do not change external method signatures unless explicitly requested.

Visibility widening warning template:

- Warning: widened `private` to `protected`/`public` for extraction compatibility.
- Why: extracted function needs stable access to internal state.
- Scope: list exact fields/methods widened.
- Mitigation: add TODO to reduce visibility after follow-up refactor.

6. Handle cross-method calls.
- If method A called `this.methodB()`, update to either:
  - delegate through class method (`this.methodB(...)`) to preserve class-level hooks, or
  - import `methodB` function directly when safe and acyclic.
- Prefer acyclic dependency direction from `index.ts` to leaf method files.

7. Imports and type hygiene.
- Use `import type` for class/type-only references to avoid runtime cycles.
- Keep each extracted file focused on one function.
- Co-locate method-specific helper types when not reused.

8. Validate after each extraction.
- Run typecheck and targeted tests.
- Confirm no API surface regressions.
- Commit in small steps when working in VCS.

## Decision Points

- If a method mutates many internals:
  - keep it in class for now, extract dependencies first, then retry.
- If extraction creates circular imports:
  - move shared types to `types.ts` or switch to class delegation call path.
- If visibility changes are required:
  - issue explicit warning, widen only the minimal members, and record mitigation follow-up.

## Completion Criteria

- Class is in `index.ts` and compiles.
- Targeted methods are extracted into separate files.
- Each extracted function is a regular function with a typed `this` parameter based on class interface.
- Class methods remain as delegating wrappers (or are intentionally removed with approval).
- Typecheck passes and affected tests pass.
- No unintended API or behavior change.

## Quality Checklist

- [ ] One method per file.
- [ ] Explicit function and return types.
- [ ] Extracted functions use typed `this` parameter via class interface.
- [ ] No new circular runtime dependencies.
- [ ] Public API compatibility preserved.
- [ ] Delegation wrappers are simple and readable.
- [ ] Any visibility widening has warning + scope + mitigation note.
- [ ] Tests updated or added for extracted logic.

## Example Prompt

- `/refactor-large-ts-class src/services/BigService.ts BigService`
- "Refactor `BigService` into `index.ts` + one file per method using typed `this` (`BigServiceShape`)."

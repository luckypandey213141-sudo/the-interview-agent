# AI Prompts & Tools Log (PROMPTS.md)

This log records the tool calls, prompts, and planning steps used by the AI Coding Assistant (Antigravity) to build the Interview Agent application. This serves as the authenticity log for Stage 2 review.

---

## Stage 1: Environment & Workspace Discovery
- **Action:** Investigated the user workspace and local directories to locate resource files.
- **Tool Calls:**
  - `list_dir("c:\\Users\\lucky\\Downloads\\problem statement")` to inspect the project root (found it was empty).
  - `list_dir("c:\\Users\\lucky\\Downloads")` to find resource files (located `curriculum.json`, `candidates.json`, and `technical-spec.md`).
  - `view_file("c:\\Users\\lucky\\Downloads\\technical-spec.md")` to read the API contract and specifications.
  - `run_command("node -v; npm -v")` to verify node versions (Node: v24.12.0, npm: 11.6.2).
  - `run_command("Get-Process | Where-Object {$_.ProcessName -like '*ollama*'}")` to check for local Ollama instances (none found).
  - `run_command("Get-ChildItem Env:")` to search for environment variables.

---

## Stage 2: Clarifying Questions & Planning
- **Action:** Formulated the architectural proposal and presented choices to the user.
- **Tool Calls:**
  - `ask_question`: Clarified preferences regarding LLM provider and SDK structure. The user selected: *(Recommended) Use Google Gemini API (via @google/genai SDK, e.g., gemini-2.5-flash) and read GEMINI_API_KEY from .env.local*.
  - `write_to_file("implementation_plan.md")`: Created the high-level implementation plan specifying the hybrid deterministic + generative structure, modular design (planner, engine, store, llm), and premium vanilla CSS UI styling.

---

## Stage 3: Scaffolding the Next.js App
- **Action:** Initialized Next.js. Since the folder name "problem statement" contains spaces and caused npm naming restrictions, scaffolded inside a subdirectory and moved files up.
- **Tool Calls:**
  - `run_command("npx -y create-next-app@latest --help")` to inspect CLI parameters.
  - `run_command("npx -y create-next-app@latest interview-agent --ts --eslint --app --no-src-dir --no-tailwind --import-alias \"@/*\" --use-npm --disable-git --yes")`
  - `run_command` moving all files to the root directory and deleting the `interview-agent` folder:
    ```powershell
    Move-Item -Path .\interview-agent\* -Destination .\ -Force
    Move-Item -Path .\interview-agent\.* -Destination .\ -Force -ErrorAction SilentlyContinue
    Remove-Item -Path .\interview-agent -Recurse -Force
    ```
  - `run_command` copying the data resources:
    ```powershell
    New-Item -ItemType Directory -Path .\lib -Force
    Copy-Item -Path ..\curriculum.json -Destination .\lib\curriculum.json -Force
    Copy-Item -Path ..\candidates.json -Destination .\lib\candidates.json -Force
    ```
  - `run_command("npm install @google/genai")` to add the official Google Gen AI SDK.

---

## Stage 4: Writing Modules & Frontend Code
- **Action:** Created all source files in the project.
- **Tool Calls:**
  - `write_to_file("lib/planner.ts")` to implement candidate classification (struggled, skipped, medium, strong, backfill).
  - `write_to_file("lib/store.ts")` to implement session memory and evaluation storage.
  - `write_to_file("lib/llm.ts")` to define Gemini SDK clients, prompting schemas, and high-fidelity mock fallbacks (`MOCK_LLM`).
  - `write_to_file("lib/engine.ts")` to write the interview state machine and logic.
  - `write_to_file("app/api/interview/route.ts")` to expose the required endpoint.
  - `write_to_file("app/globals.css")` to create a beautiful dark theme with glassmorphic accents, responsive grid cards, and typing loaders.
  - `write_to_file("app/page.tsx")` to implement the interactive single page application, sidebar plan checklist, and feedback display.
  - `write_to_file(".env.local")` to add placeholders.

---

## Stage 5: Verification & Verification Testing
- **Action:** Created an automated TypeScript script to run simulated candidate runs and verified the production build.
- **Tool Calls:**
  - `write_to_file("scratch/verify-flow.ts")` to simulate Sarah Johnson (struggled/skipped day flow) and Emily Chen (strong candidate flow).
  - `run_command("npx tsx scratch/verify-flow.ts")` to run the test script. (Exited with 0, matching planned constraints: >= 8 questions, >= 4 days, valid feedback).
  - `run_command("npm run build")` to verify typescript compilation and client-side code rendering. (Build completed successfully).

---

## Stage 6: Frontend Polish & Custom UI Integrations
- **Action:** Enhanced UI aesthetics to feel more "live" (typewriter animations, background blur orbs) and integrated custom React components (MeshGradientSVG, compound ChatInput).
- **Tool Calls:**
  - `run_command("npm install framer-motion @paper-design/shaders-react")` to add interactive WebGL shader dependencies.
  - `write_to_file("components/ui/shader-svg.tsx")` to implement the eye-tracking mesh gradient robot.
  - `run_command("npm install lucide-react @radix-ui/react-slot class-variance-authority clsx tailwind-merge")` to add standard shadcn library dependencies.
  - `write_to_file("lib/utils.ts")` to define the classname-merging `cn` function.
  - `write_to_file("components/ui/button.tsx")` to create the Radix-Slot-capable Button component.
  - `write_to_file("components/ui/textarea.tsx")` to create the custom text area.
  - `write_to_file("hooks/use-textarea-resize.ts")` to implement auto-resizing text area height calculations.
  - `write_to_file("components/ui/chat-input.tsx")` to write the compound ChatInput field component.
  - `write_to_file("app/page.tsx")` (Overwrite) to integrate the `TypewriterText` effect, the background glowing ambient orbs, the `MeshGradientSVG` welcome robot, and the compound `<ChatInput>` structure.
  - `write_to_file("app/globals.css")` (Overwrite) to map Tailwind class utilities to Vanilla CSS and style the interactive elements.
  - `replace_file_content("app/globals.css")` to resolve button styling regressions by restoring the original `.btn-send` and `.btn-primary` selectors.
  - `run_command("npm run build")` to ensure compilation and typing checks pass with 0 errors.
  - `run_command` to commit and push changes:
    ```bash
    git add .
    git commit -m "feat: integrate shader robot, compound chat input, and styling updates"
    git push origin main
    ```

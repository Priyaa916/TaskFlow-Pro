\# AI Tool Declaration



This document discloses how AI is used inside TaskFlow Pro at runtime, and which AI tools were used to help build the project.



\---



\## 1. AI Used at Runtime (In-App AI Copilot)



\### What it is



TaskFlow Pro includes an \*\*AI Workflow Copilot\*\* that answers natural-language questions about the live task and dependency graph.



Example questions include:



\* "What happens if Backend API is delayed?"

\* "What are the prerequisites for Integration Tests?"

\* "Which tasks are affected if Database Schema is delayed?"



The Copilot analyzes the current workflow state and provides dependency, schedule, impact, and workflow-related analysis.



\### Model and How It Runs



\* \*\*Model:\*\* Llama 3.2 3B

\* \*\*Runtime:\*\* Ollama

\* \*\*Execution:\*\* Local

\* \*\*External cloud LLM API key:\*\* Not required

\* \*\*Data transmission:\*\* No task/dependency data is sent to a third-party cloud AI API for the Copilot feature.



The model runs locally on the developer's/user's machine through Ollama after the required model has been downloaded.



\### What Data It Receives



The backend provides the Copilot with the workflow information needed to answer the user's question, including:



\* Task IDs

\* Task titles

\* Task statuses

\* Start and end dates

\* Task durations

\* Dependency relationships

\* Relevant downstream task information



No unrelated personal data is intentionally included in the AI prompt.



\### How Hallucination Risk Is Reduced



The AI Copilot is designed to remain grounded in the application's current workflow data.



\* The backend supplies the live task and dependency information at query time.

\* The AI is instructed to base its analysis on the supplied workflow data rather than inventing tasks or dependencies.

\* Dependency relationships are determined by the application's backend logic.

\* Schedule projections follow the application's dependency and date rules.

\* AI responses are treated as \*\*advisory analysis and projections\*\*, not automatic actions.

\* The AI does not directly create, modify, or delete tasks or dependencies in the database.

\* Structural dependency changes continue to go through deterministic backend validation, including cycle detection and duplicate-dependency checks.



\### Known Limitation



The runtime Copilot uses a relatively small local model with \*\*3B parameters\*\*. As a result, responses may occasionally be less accurate, detailed, or consistently formatted than responses from larger hosted models.



AI-generated responses are therefore presented as \*\*decision-support information\*\* rather than an authoritative source.



Users should verify important AI-generated analysis before making project-management decisions.



\---



\## 2. AI Tools Used During Development



\### ChatGPT



\*\*Purpose:\*\*



ChatGPT was used as an AI-assisted development and problem-solving tool during the construction of TaskFlow Pro.



It was used for:



\* Software architecture and implementation planning

\* Java and Spring Boot development support

\* React frontend development support

\* REST API design and debugging

\* PostgreSQL and database troubleshooting

\* DAG and dependency-graph logic reasoning

\* READY/BLOCKED workflow logic

\* Schedule propagation logic

\* Debugging development errors

\* Designing and refining the AI Copilot

\* Prompt engineering and response-structure design

\* Testing workflow scenarios and identifying edge cases

\* README and project documentation preparation



The generated suggestions and code were reviewed, integrated, tested, and modified by the developer as required.



\### Ollama



Ollama was used as the \*\*local runtime environment\*\* for the application's AI Workflow Copilot.



It runs the \*\*Llama 3.2 3B\*\* model locally and allows the application to perform AI-assisted workflow analysis without requiring a cloud LLM API for the runtime Copilot.



Ollama is therefore both part of the application's AI runtime stack and a development/testing component.



\### Other AI Coding Tools



No other AI coding tools were intentionally used for the development of this project.



\---



\## 3. Developer Review and Verification



AI assistance was used to support development, but the final implementation was reviewed and tested by the developer before being committed.



Core workflow functionality was manually verified through test scenarios including:



\* Dependency creation

\* Dependency deletion

\* Dependency-chain execution

\* READY/BLOCKED status behavior

\* Circular dependency rejection

\* Downstream impact analysis

\* Schedule propagation

\* AI-based schedule projections

\* Frontend/backend API integration



The deterministic backend logic remains responsible for enforcing dependency rules and validating structural workflow changes.



AI-generated recommendations do not override these backend rules.



\---



\## 4. AI Data Flow



The runtime AI workflow can be summarized as:



```text

User Question

&#x20;     ↓

React Frontend

&#x20;     ↓

Spring Boot Backend

&#x20;     ↓

Live Task + Dependency Data

&#x20;     ↓

Ollama

&#x20;     ↓

Llama 3.2 3B

&#x20;     ↓

AI Analysis / Projection

&#x20;     ↓

Spring Boot Backend

&#x20;     ↓

React AI Copilot

&#x20;     ↓

User

```



The AI response is returned to the user as analysis. It does not automatically modify the underlying task or dependency data.



\---



\## 5. Summary



| Component           | AI Used                 | Purpose                                                         | Data Sent                                                       |

| ------------------- | ----------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |

| AI Workflow Copilot | Llama 3.2 3B via Ollama | Answer questions about live workflow state                      | Task/dependency data supplied by the backend; processed locally |

| Development Process | ChatGPT                 | Architecture, coding support, debugging, testing, documentation | Development context provided during development                 |

| AI Runtime          | Ollama                  | Local model execution                                           | Workflow prompt remains on the local runtime                    |



\---



\## 6. Declaration



AI tools were used as development assistants and as part of the application's local AI runtime.



The developer remains responsible for reviewing, testing, integrating, and validating the final implementation.



The AI Workflow Copilot is intended to provide \*\*decision-support analysis\*\* and does not independently make or execute project-management decisions.




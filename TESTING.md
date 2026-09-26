# Testing and Validation

This document summarizes the testing and validation performed for TaskFlow Pro.

## 1. Test Environment

- Frontend: React + Vite
- Backend: Java + Spring Boot
- Database: PostgreSQL
- AI Runtime: Ollama with Llama 3.2 3B
- API Testing: Browser / PowerShell HTTP requests
- Development Environment: Windows 11

---

## 2. Functional Test Cases

| Test ID | Test Case | Expected Result | Result |
|---|---|---|---|
| TC-01 | Create a task | Task is created and appears in the Kanban board | PASS |
| TC-02 | Update task status | Task moves to the selected valid workflow state | PASS |
| TC-03 | Create a dependency | Prerequisite-to-dependent relationship is created | PASS |
| TC-04 | Delete a dependency | Dependency is removed successfully | PASS |
| TC-05 | Detect circular dependency | Invalid circular dependency is rejected | PASS |
| TC-06 | Block task with unfinished prerequisite | Dependent task is shown as BLOCKED | PASS |
| TC-07 | Make dependent task ready | Dependent task can become READY after prerequisites are completed | PASS |
| TC-08 | Propagate schedule changes | Downstream task dates are recalculated according to dependency order | PASS |
| TC-09 | Calculate downstream impact | Direct and indirect affected tasks are identified | PASS |
| TC-10 | Display dependency graph | Tasks and dependency relationships are represented as a DAG | PASS |
| TC-11 | Persist drag-and-drop status changes | Updated workflow status remains persisted | PASS |
| TC-12 | Frontend/backend integration | React frontend successfully communicates with Spring Boot APIs | PASS |
| TC-13 | AI workflow analysis | AI Copilot analyzes the supplied workflow and dependency data | PASS |
| TC-14 | AI delay scenario | AI provides projected downstream impact for a task delay | PASS |
| TC-15 | AI does not directly modify workflow data | AI response remains advisory and does not automatically change database records | PASS |

---

## 3. Dependency and DAG Validation

The dependency chain was tested using:

**Database Schema → Backend API → Integration Tests**

The following behavior was verified:

- A dependent task remains blocked while its required prerequisite is incomplete.
- Completing the prerequisite allows the dependent task to become READY when other workflow conditions are satisfied.
- Dependencies follow the direction from prerequisite to dependent.
- Circular dependency creation is rejected by the backend.
- Downstream tasks can be identified through dependency traversal.

---

## 4. Schedule Propagation Validation

A multi-level dependency chain was tested with scheduled tasks.

Example:

**Database Schema → Backend API → Integration Tests**

When an upstream task's schedule was changed, downstream task schedules were recalculated while preserving their configured durations and dependency order.

This was used to verify that schedule changes propagate through the dependency graph.

---

## 5. AI Copilot Validation

The AI Workflow Copilot was tested with natural-language workflow questions.

Example:

> What happens if Backend API is delayed by 3 days?

The Copilot successfully returned workflow-related analysis including:

- The affected task
- Current task status
- Task duration
- Dependency information
- Downstream affected tasks
- Direct dependents
- Impact analysis
- Schedule-related reasoning
- A recommendation

The Copilot uses live workflow data supplied by the Spring Boot backend and runs locally through Ollama using Llama 3.2 3B.

AI responses are advisory and do not directly modify task or dependency records.

---

## 6. Known Failure Cases and Limitations

### Local AI Runtime Dependency

The AI Workflow Copilot requires Ollama and the configured Llama 3.2 3B model to be available locally. If Ollama is not running, the AI functionality cannot generate a model response.

### Small Local Language Model

The application uses a 3B parameter local model. Complex or ambiguous natural-language questions may occasionally produce less detailed or less consistently formatted responses than larger models.

### AI Response Accuracy

AI-generated analysis is decision-support information and should be verified by the user. Deterministic dependency and workflow rules remain enforced by the backend.

### Schedule Projection

Schedule propagation follows the application's configured dependency and date rules. Real-world factors such as holidays, weekends, resource availability, team capacity, or external project constraints are not automatically modeled.

### Browser and Local Environment

The project is currently designed to run in a local development environment. Backend, PostgreSQL, and Ollama services must be available for the complete feature set.

### No Automatic AI Mutation

The AI Copilot does not independently create, delete, or modify tasks or dependencies. Workflow changes continue to use the application's deterministic backend APIs and validation rules.

---

## 7. Validation Summary

The core TaskFlow Pro workflow was manually validated across task management, dependency management, DAG behavior, READY/BLOCKED logic, circular dependency prevention, schedule propagation, downstream impact analysis, frontend/backend integration, and AI-assisted workflow analysis.

The final implementation was reviewed and tested by the developer before submission.

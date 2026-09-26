# TaskFlow Pro

> AI-powered dependency-aware Kanban and workflow management system built around Directed Acyclic Graphs (DAGs).

TaskFlow Pro is a smart workflow management application that helps teams manage tasks, dependencies, execution status, schedules, and downstream impact from a single interface.

Unlike a traditional Kanban board, TaskFlow Pro understands **task dependencies**. A task can automatically become **BLOCKED** when its prerequisites are incomplete and become **READY** when all required prerequisites are completed.

The system also provides an **AI Workflow Copilot** that analyzes the live workflow and answers questions about delays, dependencies, prerequisites, and affected downstream tasks.

---

## 🚀 Key Features

### 📋 Dependency-Aware Kanban

Manage tasks across four workflow stages:

* Backlog
* In Progress
* Review
* Done

Tasks maintain their workflow state while dependency rules determine whether they are ready or blocked.

### 🔗 DAG Dependency Management

Tasks are represented as a Directed Acyclic Graph:

```text
Database Schema
       ↓
Backend API
       ↓
Integration Tests
```

The system:

* Creates prerequisite → dependent relationships
* Prevents circular dependencies
* Calculates dependency levels
* Identifies downstream tasks
* Highlights dependency impact
* Automatically manages READY/BLOCKED states

### 🚦 Automatic READY / BLOCKED Logic

A dependent task becomes **BLOCKED** when one or more prerequisites are incomplete.

When all prerequisites are completed, the task can become **READY**.

The workflow therefore reflects the actual execution order of the project.

### 📅 Schedule Propagation

Task schedules can be updated using:

* Start date
* Duration

When an upstream task is delayed, downstream schedules are automatically recalculated according to the dependency chain.

Example:

```text
Backend API delayed
        ↓
Integration Tests start later
        ↓
Downstream schedule shifts
```

### 💥 Downstream Impact Analysis

TaskFlow Pro can identify tasks affected by a change in an upstream task.

The impact analysis distinguishes between:

* Direct dependents
* Indirect downstream tasks
* Total affected tasks

### 🤖 AI Workflow Copilot

The integrated AI Copilot uses a locally running Ollama model to analyze the current workflow.

It can answer questions such as:

```text
What happens if Backend API is delayed by 3 days?

What are the prerequisites for Integration Tests?

Which tasks are affected if Database Schema is delayed?
```

The AI response is generated using the application's live task and dependency data.

The AI layer can provide:

* Task identification
* Prerequisites
* Affected tasks
* Direct dependents
* Schedule projections
* Workflow analysis
* Recommendations

The AI analysis is **projected analysis** and does not directly modify the database.

---

## 🧠 How TaskFlow Pro Works

The application combines a traditional Kanban workflow with a dependency graph.

```text
                  ┌─────────────────┐
                  │   Task Creation │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │     Kanban      │
                  │ Backlog → Done  │
                  └────────┬────────┘
                           ↓
                  ┌─────────────────┐
                  │  Dependency DAG │
                  └────────┬────────┘
                           ↓
              ┌────────────┴────────────┐
              ↓                         ↓
        READY / BLOCKED            Schedule
              ↓                    Propagation
              └────────────┬────────────┘
                           ↓
                  ┌─────────────────┐
                  │   AI Copilot    │
                  └─────────────────┘
```

---

## 🏗️ System Architecture

```text
┌──────────────────────────────┐
│        React Frontend        │
│                              │
│  Dashboard                   │
│  Kanban Board                │
│  DAG Visualization           │
│  AI Copilot                  │
└──────────────┬───────────────┘
               │ REST API
               ↓
┌──────────────────────────────┐
│       Spring Boot Backend    │
│                              │
│  Task Service                │
│  Dependency Service          │
│  Schedule Engine             │
│  Impact Analysis             │
│  AI Service                  │
└───────┬──────────────┬───────┘
        │              │
        ↓              ↓
┌─────────────┐   ┌─────────────┐
│ PostgreSQL  │   │   Ollama     │
│   Database  │   │  Local LLM   │
└─────────────┘   └─────────────┘
```

---

## 🛠️ Tech Stack

### Frontend

* React
* Vite
* JavaScript
* CSS
* Axios

### Backend

* Java
* Spring Boot
* Spring Data JPA
* REST APIs
* Maven

### Database

* PostgreSQL

### AI

* Ollama
* Llama 3.2 3B

### Development Tools

* Git
* GitHub
* Visual Studio Code

---

## 📁 Project Structure

```text
TaskFlow-Pro/
│
├── backend/
│   └── taskflow-backend/
│       ├── src/
│       ├── pom.xml
│       └── mvnw.cmd
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── .gitignore
├── AI_DECLARATION.md
└── README.md
```

---

## 🔌 API Endpoints

### Tasks

```text
GET    /api/tasks
POST   /api/tasks
PATCH  /api/tasks/{id}/status
```

### Dependencies

```text
GET     /api/tasks/dependencies
GET     /api/tasks/{id}/dependencies
POST    /api/tasks/{dependentId}/dependencies/{prerequisiteId}
DELETE  /api/tasks/{dependentId}/dependencies/{prerequisiteId}
```

### Scheduling

```text
PATCH   /api/tasks/{id}/schedule
```

### Impact Analysis

```text
GET     /api/tasks/{id}/impact
```

### AI Copilot

```text
POST    /api/ai/ask
```

---

## ⚙️ Local Setup

### Prerequisites

Install:

* Java
* Maven
* Node.js
* PostgreSQL
* Ollama

---

### 1. Clone the Repository

```bash
git clone https://github.com/Priyaa916/TaskFlow-Pro.git
cd TaskFlow-Pro
```

---

### 2. Create PostgreSQL Database

Create a PostgreSQL database named:

```text
taskflow
```

The backend expects PostgreSQL to be available locally.

---

### 3. Configure Database Password

The backend uses an environment variable for the PostgreSQL password.

Windows PowerShell:

```powershell
$env:DB_PASSWORD="YOUR_POSTGRES_PASSWORD"
```

The password is intentionally not stored in the repository.

---

### 4. Start the Backend

```powershell
cd backend\taskflow-backend
.\mvnw.cmd spring-boot:run
```

Backend:

```text
http://localhost:8080
```

---

### 5. Start Ollama

Make sure Ollama is running and the required model is available:

```bash
ollama run llama3.2:3b
```

Ollama is used locally by the backend AI service.

---

### 6. Start the Frontend

Open another terminal:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Frontend:

```text
http://localhost:5173
```

---

## 🧪 Example Workflow

A typical dependency chain can be:

```text
Database Schema
       ↓
Backend API
       ↓
Integration Tests
```

If **Database Schema** is incomplete:

```text
Database Schema → IN PROGRESS
Backend API     → BLOCKED
Integration     → BLOCKED
```

After Database Schema is completed:

```text
Database Schema → DONE
Backend API     → READY
Integration     → BLOCKED
```

After Backend API is completed:

```text
Backend API     → DONE
Integration     → READY
```

This allows the board to represent actual execution readiness rather than only manually assigned status.

---

## 🔄 Schedule Propagation Example

Suppose:

```text
Database Schema
Start: 2026-10-01
Duration: 5 days
```

Then:

```text
Backend API
starts after Database Schema
```

and:

```text
Integration Tests
starts after Backend API
```

If Backend API is delayed, its dependent tasks are projected forward automatically.

---

## 🛡️ Dependency Safety

TaskFlow Pro prevents invalid dependency graphs by detecting cycles.

For example:

```text
A → B → C
```

Trying to create:

```text
C → A
```

would create a cycle.

The backend rejects such a dependency instead of allowing an invalid DAG.

---

# 🔍 Key Assumptions and Limitations

## Key Assumptions

* The current implementation is designed primarily for a single-user/local development workflow.
* Dependencies follow a **finish-to-start** model: a dependent task becomes ready after its prerequisite tasks are completed.
* The dependency graph must remain a **DAG (Directed Acyclic Graph)**; circular dependencies are rejected.
* Task scheduling uses calendar dates and task durations.
* Downstream schedule propagation is based on the dependency chain.
* The AI Copilot analyzes the current workflow data available from the application.
* Ollama must be running locally for AI-powered functionality.
* The current AI runtime uses the **Llama 3.2 3B** model through Ollama.
* AI-generated schedule analysis is projected analysis and does not directly modify task data.

## Limitations

* Multi-user authentication and authorization are not currently implemented.
* Real-time collaboration between multiple users is not currently supported.
* The current dependency model primarily supports finish-to-start relationships.
* The AI Copilot depends on the local Ollama service and configured model being available.
* AI responses may contain inaccuracies because they are generated by a local language model.
* AI-generated recommendations should therefore be treated as decision-support information rather than authoritative project decisions.
* Cloud deployment and distributed infrastructure are outside the current implementation scope.
* Advanced project-management features such as resource allocation, workload balancing, and full critical-path optimization are not currently implemented.
* The current application is intended as a hackathon prototype demonstrating dependency-aware workflow management and AI-assisted project analysis.

---

## 📊 Dashboard

The dashboard provides a high-level view of the workflow, including:

* Total tasks
* Ready tasks
* Blocked tasks
* Completed tasks
* Scheduled tasks
* AI-powered workflow analysis

---

## 🎯 Project Objective

TaskFlow Pro aims to make project execution more predictable by connecting:

**Tasks + Dependencies + Status + Schedule + AI**

into one workflow management system.

Instead of simply showing what tasks exist, the system helps answer:

> **What can be worked on now, what is blocked, and what will be affected if something changes?**

---

## 🔮 Future Scope

Potential future enhancements include:

* Multi-user collaboration
* Authentication and role-based access
* Team-level dashboards
* Gantt chart visualization
* Advanced critical-path analysis
* Notification system
* AI-generated task decomposition
* Automatic dependency suggestions
* Cloud deployment
* Persistent AI conversation history

---

## 🤖 AI Tool Declaration

Details regarding AI-assisted development and the application's runtime AI configuration are documented separately in:

**AI_DECLARATION.md**

The declaration documents:

* AI used at runtime
* Llama 3.2 3B and Ollama configuration
* Data supplied to the Copilot
* Measures used to reduce hallucination risk
* AI tools used during development
* Developer review and verification

---

## 👩‍💻 Project

**TaskFlow Pro**

AI-powered dependency-aware workflow management for intelligent project execution.

**GitHub Repository:**
https://github.com/Priyaa916/TaskFlow-Pro

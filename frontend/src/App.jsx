import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "https://taskflow-pro-d2dp.onrender.com/api/tasks";
const AI_API_URL = "https://taskflow-pro-d2dp.onrender.com/api/ai/analyze";

const COLUMNS = [
  {
    key: "BACKLOG",
    title: "Backlog",
    subtitle: "Tasks waiting to start",
  },
  {
    key: "IN_PROGRESS",
    title: "In Progress",
    subtitle: "Currently being worked on",
  },
  {
    key: "REVIEW",
    title: "Review",
    subtitle: "Waiting for verification",
  },
  {
    key: "DONE",
    title: "Done",
    subtitle: "Completed work",
  },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getErrorMessage(error, fallback = "Something went wrong.") {
  const data = error?.response?.data;

  if (typeof data === "string" && data.trim()) {
    return data;
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return fallback;
}

function App() {
  const [tasks, setTasks] = useState([]);
  const [dependencies, setDependencies] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    startDate: "",
    durationDays: 1,
  });
  const [creatingTask, setCreatingTask] = useState(false);

  const [showDependencyModal, setShowDependencyModal] = useState(false);
  const [dependencyTask, setDependencyTask] = useState(null);
  const [selectedPrerequisite, setSelectedPrerequisite] = useState("");
  const [addingDependency, setAddingDependency] = useState(false);
  const [dependencyError, setDependencyError] = useState("");

  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTask, setScheduleTask] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    startDate: "",
    durationDays: 1,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactTask, setImpactTask] = useState(null);
  const [impactData, setImpactData] = useState([]);
  const [loadingImpact, setLoadingImpact] = useState(false);

  const [movingTaskId, setMovingTaskId] = useState(null);
  const [removingDependencyId, setRemovingDependencyId] =
    useState(null);

  const [aiQuestion, setAiQuestion] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [selectedDagTaskId, setSelectedDagTaskId] = useState(null);
  const [graphFocusId, setGraphFocusId] = useState(null);

  const fetchBoardData = async (showInitialLoader = false) => {
    try {
      if (showInitialLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const [tasksResponse, dependenciesResponse] =
        await Promise.all([
          axios.get(API_URL),
          axios.get(`${API_URL}/dependencies`),
        ]);

      setTasks(tasksResponse.data);
      setDependencies(dependenciesResponse.data);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to connect to the TaskFlow backend."
        )
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBoardData(true);
  }, []);

  useEffect(() => {
    if (!successMessage) return;

    const timer = setTimeout(() => {
      setSuccessMessage("");
    }, 3500);

    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleAddTask = async (event) => {
    event.preventDefault();

    if (!newTask.title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setCreatingTask(true);
      setError("");

      const taskData = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        workflowStatus: "BACKLOG",
        durationDays:
          Number(newTask.durationDays) > 0
            ? Number(newTask.durationDays)
            : 1,
      };

      if (newTask.startDate) {
        taskData.startDate = newTask.startDate;
      }

      await axios.post(API_URL, taskData);

      setNewTask({
        title: "",
        description: "",
        startDate: "",
        durationDays: 1,
      });

      setShowCreateModal(false);
      setSuccessMessage("Task created successfully.");

      await fetchBoardData(false);
    } catch (err) {
      setError(getErrorMessage(err, "Unable to create task."));
    } finally {
      setCreatingTask(false);
    }
  };

  const updateTaskStatus = async (task, newStatus) => {
    try {
      setMovingTaskId(task.id);
      setError("");

      await axios.patch(
        `${API_URL}/${task.id}/status`,
        null,
        {
          params: {
            status: newStatus,
          },
        }
      );

      setSuccessMessage(
        `${task.title} moved to ${getStatusLabel(newStatus)}.`
      );

      await fetchBoardData(false);
    } catch (err) {
      setError(
        getErrorMessage(err, "Unable to update task status.")
      );

      await fetchBoardData(false);
    } finally {
      setMovingTaskId(null);
    }
  };

  const getNextStatus = (status) => {
    if (status === "BACKLOG" || status === "READY") {
      return "IN_PROGRESS";
    }

    if (status === "IN_PROGRESS") {
      return "REVIEW";
    }

    if (status === "REVIEW") {
      return "DONE";
    }

    return null;
  };

  const getPreviousStatus = (status) => {
    if (status === "IN_PROGRESS") {
      return "READY";
    }

    if (status === "REVIEW") {
      return "IN_PROGRESS";
    }

    if (status === "DONE") {
      return "REVIEW";
    }

    return null;
  };

  const getPrerequisites = (taskId) => {
    return dependencies.filter(
      (dependency) =>
        dependency.dependentTaskId === taskId
    );
  };

  const getDependents = (taskId) => {
    return dependencies.filter(
      (dependency) =>
        dependency.prerequisiteTaskId === taskId
    );
  };

  const openDependencyModal = (task) => {
    setDependencyTask(task);
    setSelectedPrerequisite("");
    setDependencyError("");
    setShowDependencyModal(true);
  };

  const handleAddDependency = async () => {
    if (!dependencyTask || !selectedPrerequisite) {
      setDependencyError(
        "Please select a prerequisite task."
      );
      return;
    }

    try {
      setAddingDependency(true);
      setDependencyError("");
      setError("");

      const prerequisiteTask = tasks.find(
        (task) =>
          task.id === Number(selectedPrerequisite)
      );

      await axios.post(
        `${API_URL}/${dependencyTask.id}/dependencies/${selectedPrerequisite}`
      );

      setShowDependencyModal(false);
      setDependencyTask(null);
      setSelectedPrerequisite("");

      setSuccessMessage(
        `Dependency added: ${
          prerequisiteTask?.title || "Prerequisite"
        } ${"\u2192"} ${dependencyTask.title}`
      );

      await fetchBoardData(false);
    } catch (err) {
      setDependencyError(
        getErrorMessage(
          err,
          "Unable to add dependency."
        )
      );
    } finally {
      setAddingDependency(false);
    }
  };

  const handleRemoveDependency = async (
    dependentId,
    prerequisiteId
  ) => {
    const dependency = dependencies.find(
      (item) =>
        item.dependentTaskId === dependentId &&
        item.prerequisiteTaskId === prerequisiteId
    );

    try {
      setRemovingDependencyId(
        dependency?.id ||
          `${dependentId}-${prerequisiteId}`
      );

      setError("");

      await axios.delete(
        `${API_URL}/${dependentId}/dependencies/${prerequisiteId}`
      );

      setSuccessMessage(
        "Dependency removed successfully."
      );

      await fetchBoardData(false);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to remove dependency."
        )
      );
    } finally {
      setRemovingDependencyId(null);
    }
  };

  const openScheduleModal = (task) => {
    setScheduleTask(task);

    setScheduleForm({
      startDate: task.startDate || getToday(),
      durationDays: task.durationDays || 1,
    });

    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async (event) => {
    event.preventDefault();

    if (!scheduleTask) return;

    if (!scheduleForm.startDate) {
      setError("Start date is required.");
      return;
    }

    if (
      !scheduleForm.durationDays ||
      Number(scheduleForm.durationDays) <= 0
    ) {
      setError("Duration must be greater than zero.");
      return;
    }

    try {
      setSavingSchedule(true);
      setError("");

      await axios.patch(
        `${API_URL}/${scheduleTask.id}/schedule`,
        null,
        {
          params: {
            startDate: scheduleForm.startDate,
            durationDays: Number(
              scheduleForm.durationDays
            ),
          },
        }
      );

      setShowScheduleModal(false);
      setScheduleTask(null);

      setSuccessMessage(
        `Schedule updated for ${scheduleTask.title}.`
      );

      await fetchBoardData(false);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to update schedule."
        )
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const askAI = async (question = aiQuestion) => {
    const trimmedQuestion = question.trim();

    if (!trimmedQuestion) {
      return;
    }

    try {
      setAiLoading(true);
      setAiError("");
      setAiResult(null);

      const response = await axios.post(
        AI_API_URL,
        {
          question: trimmedQuestion,
        }
      );

      setAiResult(response.data);
    } catch (err) {
      console.error("AI Assistant error:", err);

      setAiError(
        getErrorMessage(
          err,
          "AI Assistant could not analyze the workflow."
        )
      );
    } finally {
      setAiLoading(false);
    }
  };

  const openImpactModal = async (task) => {
    try {
      setImpactTask(task);
      setImpactData([]);
      setShowImpactModal(true);
      setLoadingImpact(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/${task.id}/impact`
      );

      setImpactData(response.data);
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          "Unable to load downstream impact."
        )
      );
    } finally {
      setLoadingImpact(false);
    }
  };

  const graphLevels = useMemo(() => {
    if (!tasks.length) {
      return [];
    }

    const indegree = {};
    const adjacency = {};

    tasks.forEach((task) => {
      indegree[task.id] = 0;
      adjacency[task.id] = [];
    });

    dependencies.forEach((dependency) => {
      const prerequisiteId =
        dependency.prerequisiteTaskId;

      const dependentId =
        dependency.dependentTaskId;

      if (
        adjacency[prerequisiteId] &&
        indegree[dependentId] !== undefined
      ) {
        adjacency[prerequisiteId].push(
          dependentId
        );

        indegree[dependentId] += 1;
      }
    });

    const queue = [];

    tasks.forEach((task) => {
      if (indegree[task.id] === 0) {
        queue.push(task.id);
      }
    });

    const levels = [];
    const levelMap = {};

    tasks.forEach((task) => {
      levelMap[task.id] = 0;
    });

    while (queue.length > 0) {
      const currentId = queue.shift();

      const currentLevel =
        levelMap[currentId] || 0;

      if (!levels[currentLevel]) {
        levels[currentLevel] = [];
      }

      levels[currentLevel].push(currentId);

      adjacency[currentId].forEach((nextId) => {
        levelMap[nextId] = Math.max(
          levelMap[nextId] || 0,
          currentLevel + 1
        );

        indegree[nextId] -= 1;

        if (indegree[nextId] === 0) {
          queue.push(nextId);
        }
      });
    }

    const usedTaskIds = new Set(
      levels.flat()
    );

    tasks.forEach((task) => {
      if (!usedTaskIds.has(task.id)) {
        if (!levels[0]) {
          levels[0] = [];
        }

        levels[0].push(task.id);
      }
    });

    return levels
      .filter(Boolean)
      .map((level) =>
        level
          .map((taskId) =>
            tasks.find(
              (task) => task.id === taskId
            )
          )
          .filter(Boolean)
      );
  }, [tasks, dependencies]);

  const getDownstreamTaskIds = (taskId) => {
    const visited = new Set();
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      dependencies
        .filter(
          (dependency) =>
            dependency.prerequisiteTaskId ===
            currentId
        )
        .forEach((dependency) => {
          const nextId =
            dependency.dependentTaskId;

          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push(nextId);
          }
        });
    }

    return visited;
  };

  const getUpstreamTaskIds = (taskId) => {
    const visited = new Set();
    const queue = [taskId];

    while (queue.length > 0) {
      const currentId = queue.shift();

      dependencies
        .filter(
          (dependency) =>
            dependency.dependentTaskId ===
            currentId
        )
        .forEach((dependency) => {
          const previousId =
            dependency.prerequisiteTaskId;

          if (!visited.has(previousId)) {
            visited.add(previousId);
            queue.push(previousId);
          }
        });
    }

    return visited;
  };

  const selectedDagTask = tasks.find(
    (task) => task.id === selectedDagTaskId
  );

  const downstreamTaskIds = graphFocusId
    ? getDownstreamTaskIds(graphFocusId)
    : new Set();

  const upstreamTaskIds = graphFocusId
    ? getUpstreamTaskIds(graphFocusId)
    : new Set();

  const handleDagNodeClick = (task) => {
    setSelectedDagTaskId(task.id);
    setGraphFocusId(task.id);
  };

  const clearDagSelection = () => {
    setSelectedDagTaskId(null);
    setGraphFocusId(null);
  };

  const getColumnTasks = (columnKey) => {
    return tasks
      .filter((task) => {
        if (
          task.workflowStatus === "READY" ||
          task.workflowStatus === "BLOCKED"
        ) {
          return columnKey === "BACKLOG";
        }

        return task.workflowStatus === columnKey;
      })
      .sort(
        (a, b) =>
          (a.boardPosition || 9999) -
          (b.boardPosition || 9999)
      );
  };

  const getStatusClass = (status) => {
    if (status === "DONE") return "status-done";
    if (status === "IN_PROGRESS") return "status-progress";
    if (status === "REVIEW") return "status-review";
    if (status === "READY") return "status-ready";
    if (status === "BLOCKED") return "status-blocked";

    return "status-backlog";
  };

  const getStatusLabel = (status) => {
    return status
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  const getBlockedReason = (task) => {
    const prerequisites = getPrerequisites(task.id);

    if (
      task.workflowStatus !== "BLOCKED" ||
      prerequisites.length === 0
    ) {
      return null;
    }

    const incomplete = prerequisites.filter(
      (dependency) => {
        const prerequisiteTask = tasks.find(
          (item) =>
            item.id ===
            dependency.prerequisiteTaskId
        );

        return (
          prerequisiteTask?.workflowStatus !== "DONE"
        );
      }
    );

    if (incomplete.length === 0) {
      return null;
    }

    const names = incomplete.map(
      (dependency) => {
        const prerequisiteTask = tasks.find(
          (item) =>
            item.id ===
            dependency.prerequisiteTaskId
        );

        return prerequisiteTask
          ? prerequisiteTask.title
          : `Task #${dependency.prerequisiteTaskId}`;
      }
    );

    return `Waiting for: ${names.join(", ")}`;
  };

  const getReadyReason = (task) => {
    if (task.workflowStatus !== "READY") {
      return null;
    }

    const prerequisites = getPrerequisites(task.id);

    if (prerequisites.length === 0) {
      return "No dependencies";
    }

    return "All dependencies completed";
  };

  const totalTasks = tasks.length;

  const readyTasks = tasks.filter(
    (task) => task.workflowStatus === "READY"
  ).length;

  const blockedTasks = tasks.filter(
    (task) => task.workflowStatus === "BLOCKED"
  ).length;

  const completedTasks = tasks.filter(
    (task) => task.workflowStatus === "DONE"
  ).length;

  const scheduledTasks = tasks.filter(
    (task) =>
      task.startDate &&
      task.endDate
  ).length;

  const availablePrerequisites =
    dependencyTask
      ? tasks.filter((task) => {
          if (task.id === dependencyTask.id) {
            return false;
          }

          const alreadyExists =
            dependencies.some(
              (dependency) =>
                dependency.dependentTaskId ===
                  dependencyTask.id &&
                dependency.prerequisiteTaskId ===
                  task.id
            );

          return !alreadyExists;
        })
      : [];

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-orbit"></div>

        <h2>Loading TaskFlow Pro</h2>

        <p>
          Connecting to your workflow engine...
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">

      <header className="topbar">

        <div className="brand">

          <div className="brand-mark">
            TF
          </div>

          <div>
            <div className="brand-name">
              TaskFlow Pro
            </div>

            <div className="brand-subtitle">
              Dependency-aware workflow engine
            </div>
          </div>

        </div>

        <div className="topbar-actions">

          {refreshing && (
            <div className="refresh-indicator">
              Syncing...
            </div>
          )}

          <button
            className="primary-button"
            onClick={() =>
              setShowCreateModal(true)
            }
          >
            <span>+</span>
            New Task
          </button>

        </div>

      </header>

      {error && (
        <div className="error-banner">

          <div>
            <strong>Action failed</strong>
            <span>{error}</span>
          </div>

          <button
            onClick={() => setError("")}
          >
            {"\u00D7"}
          </button>

        </div>
      )}

      {successMessage && (
        <div className="success-banner">

          <div>
            <strong>Success</strong>
            <span>{successMessage}</span>
          </div>

          <button
            onClick={() =>
              setSuccessMessage("")
            }
          >
            {"\u00D7"}
          </button>

        </div>
      )}

      <main className="dashboard">

        <section className="hero-section">

          <div>

            <div className="eyebrow">
              PROJECT CONTROL CENTER
            </div>

            <h1>
              Engineering Workflow
              <span> at a glance.</span>
            </h1>

            <p>
              Track execution, dependencies,
              schedules and downstream impact
              from one connected workspace.
            </p>

          </div>

          <div className="hero-status">
            <div className="live-dot"></div>
            <span>SYSTEM ONLINE</span>
          </div>

        </section>

        <section className="stats-grid">

          <div className="stat-card">
            <div className="stat-label">
              TOTAL TASKS
            </div>

            <div className="stat-value">
              {totalTasks}
            </div>

            <div className="stat-caption">
              Active workflow nodes
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              READY
            </div>

            <div className="stat-value accent-green">
              {readyTasks}
            </div>

            <div className="stat-caption">
              Unblocked tasks
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              BLOCKED
            </div>

            <div className="stat-value accent-red">
              {blockedTasks}
            </div>

            <div className="stat-caption">
              Waiting on dependencies
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              COMPLETED
            </div>

            <div className="stat-value accent-blue">
              {completedTasks}
            </div>

            <div className="stat-caption">
              Finished workflow nodes
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-label">
              SCHEDULED
            </div>

            <div className="stat-value">
              {scheduledTasks}
            </div>

            <div className="stat-caption">
              Tasks with dates
            </div>
          </div>

        </section>

        {/* AI TASKFLOW ASSISTANT */}

        <section
          className="section-block"
          style={{
            marginTop: "28px",
          }}
        >

          <div
            style={{
              padding: "28px",
              borderRadius: "20px",
              border:
                "1px solid rgba(255,255,255,0.08)",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.045), rgba(92,145,255,0.055))",
              boxShadow:
                "0 18px 45px rgba(0,0,0,0.18)",
            }}
          >

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                marginBottom: "20px",
              }}
            >

              <div>

                <div
                  style={{
                    display: "inline-block",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    background:
                      "rgba(92,145,255,0.12)",
                    color: "#8db5ff",
                    fontSize: "10px",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    marginBottom: "8px",
                  }}
                >
                  AI POWERED
                </div>

                <h2
                  style={{
                    margin: 0,
                    fontSize: "24px",
                  }}
                >
                  AI TaskFlow Assistant
                </h2>

                <p
                  style={{
                    marginTop: "7px",
                    color: "#8f9bb3",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Ask questions about dependencies,
                  delays, blocked tasks and workflow impact.
                </p>

              </div>

              <div
                style={{
                  fontSize: "11px",
                  color: "#57d694",
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                }}
              >
                WORKFLOW INTELLIGENCE
              </div>

            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
              }}
            >

              <input
                type="text"
                value={aiQuestion}
                onChange={(event) =>
                  setAiQuestion(event.target.value)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    askAI();
                  }
                }}
                placeholder="e.g. What happens if Backend API is delayed?"
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: "46px",
                  padding: "0 15px",
                  borderRadius: "11px",
                  border:
                    "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.18)",
                  color: "#ffffff",
                  outline: "none",
                  fontSize: "13px",
                }}
              />

              <button
                className="primary-button"
                onClick={() => askAI()}
                disabled={
                  aiLoading ||
                  !aiQuestion.trim()
                }
              >
                {aiLoading
                  ? "Analyzing..."
                  : "Ask AI"}
              </button>

            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginTop: "13px",
              }}
            >

              {[
                "What happens if Backend API is delayed?",
                "What tasks depend on Database Schema?",
                "Which tasks are blocked?",
                "Show me the current workflow status.",
              ].map((question) => (

                <button
                  key={question}
                  onClick={() => {
                    setAiQuestion(question);
                    askAI(question);
                  }}
                  style={{
                    border:
                      "1px solid rgba(92,145,255,0.18)",
                    background:
                      "rgba(92,145,255,0.07)",
                    color: "#a9c4ff",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  {question}
                </button>

              ))}

            </div>

            {aiError && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "13px",
                  borderRadius: "10px",
                  background:
                    "rgba(239,68,68,0.08)",
                  border:
                    "1px solid rgba(239,68,68,0.2)",
                  color: "#fca5a5",
                  fontSize: "12px",
                }}
              >
                {aiError}
              </div>
            )}

            {aiLoading && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "15px",
                  borderRadius: "11px",
                  background:
                    "rgba(255,255,255,0.025)",
                  color: "#8f9bb3",
                  fontSize: "12px",
                }}
              >
                AI is analyzing your workflow...
              </div>
            )}

            {aiResult && !aiLoading && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px",
                  borderRadius: "15px",
                  background:
                    "rgba(255,255,255,0.035)",
                  border:
                    "1px solid rgba(255,255,255,0.08)",
                }}
              >

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "15px",
                  }}
                >

                  <div>

                    <div
                      style={{
                        fontSize: "9px",
                        color: "#8db5ff",
                        fontWeight: 800,
                        letterSpacing: "0.12em",
                        marginBottom: "5px",
                      }}
                    >
                      AI WORKFLOW ANALYSIS
                    </div>

                    <h3
                      style={{
                        margin: 0,
                        fontSize: "19px",
                      }}
                    >
                      {aiResult.task?.title ||
                        "Workflow Analysis"}
                    </h3>

                  </div>

                  {aiResult.type && (
                    <span
                      style={{
                        padding: "6px 9px",
                        borderRadius: "7px",
                        background:
                          "rgba(255,255,255,0.06)",
                        color: "#aeb9cc",
                        fontSize: "9px",
                        fontWeight: 800,
                      }}
                    >
                      {aiResult.type.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  )}

                </div>

                {aiResult.task && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(4, minmax(0, 1fr))",
                      gap: "9px",
                      marginTop: "17px",
                    }}
                  >

                    <div className="ai-mini-box">
                      <span>TASK</span>
                      <strong>
                        #{aiResult.task.id}{" "}
                        {aiResult.task.title}
                      </strong>
                    </div>

                    <div className="ai-mini-box">
                      <span>STATUS</span>
                      <strong>
                        {aiResult.task.status}
                      </strong>
                    </div>

                    <div className="ai-mini-box">
                      <span>DURATION</span>
                      <strong>
                        {aiResult.task.durationDays ??
                          "\u2014"}{" "}
                        days
                      </strong>
                    </div>

                    <div className="ai-mini-box">
                      <span>SCHEDULE</span>
                      <strong>
                        {aiResult.task.startDate ||
                          "\u2014"}
                        {" \u2192 "}
                        {aiResult.task.endDate ||
                          "\u2014"}
                      </strong>
                    </div>

                  </div>
                )}

                {aiResult.analysis && (
                  <div
                    style={{
                      marginTop: "16px",
                      padding: "15px",
                      borderRadius: "11px",
                      background:
                        "rgba(92,145,255,0.06)",
                      border:
                        "1px solid rgba(92,145,255,0.12)",
                    }}
                  >

                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        color: "#a9c4ff",
                        marginBottom: "7px",
                      }}
                    >
                      WORKFLOW INSIGHT
                    </div>

                    <p
                      style={{
                        margin: 0,
                        color: "#c7d2e5",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      {aiResult.analysis}
                    </p>

                  </div>
                )}

                {aiResult.affectedTasks &&
                  aiResult.affectedTasks.length > 0 && (
                    <div
                      style={{
                        marginTop: "17px",
                      }}
                    >

                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          color: "#8f9bb3",
                          marginBottom: "9px",
                          letterSpacing: "0.08em",
                        }}
                      >
                        DOWNSTREAM IMPACT
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "7px",
                        }}
                      >

                        {aiResult.affectedTasks.map(
                          (task) => (
                            <div
                              key={task.taskId}
                              style={{
                                display: "flex",
                                justifyContent:
                                  "space-between",
                                alignItems: "center",
                                gap: "12px",
                                padding:
                                  "11px 13px",
                                borderRadius: "9px",
                                border:
                                  "1px solid rgba(255,255,255,0.07)",
                                background:
                                  "rgba(255,255,255,0.025)",
                              }}
                            >

                              <div>
                                <strong
                                  style={{
                                    display:
                                      "block",
                                    fontSize:
                                      "12px",
                                  }}
                                >
                                  #{task.taskId}{" "}
                                  {task.title}
                                </strong>

                                <span
                                  style={{
                                    color:
                                      "#7f8ba3",
                                    fontSize:
                                      "10px",
                                  }}
                                >
                                  {task.impactType}
                                  {" \u00B7 "}
                                  Level{" "}
                                  {task.impactLevel}
                                </span>
                              </div>

                              <span
                                className={`status-badge ${getStatusClass(
                                  task.workflowStatus
                                )}`}
                              >
                                {getStatusLabel(
                                  task.workflowStatus
                                )}
                              </span>

                            </div>
                          )
                        )}

                      </div>
                    </div>
                  )}

                {aiResult.prerequisites &&
                  aiResult.prerequisites.length > 0 && (
                    <div
                      style={{
                        marginTop: "17px",
                      }}
                    >

                      <div
                        style={{
                          fontSize: "10px",
                          fontWeight: 800,
                          color: "#8f9bb3",
                          marginBottom: "9px",
                          letterSpacing: "0.08em",
                        }}
                      >
                        PREREQUISITES
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "7px",
                        }}
                      >

                        {aiResult.prerequisites.map(
                          (item) => (
                            <span
                              key={item.taskId}
                              style={{
                                padding:
                                  "7px 10px",
                                borderRadius:
                                  "8px",
                                background:
                                  "rgba(92,145,255,0.08)",
                                border:
                                  "1px solid rgba(92,145,255,0.16)",
                                color: "#b8c9ee",
                                fontSize: "11px",
                              }}
                            >
                              #{item.taskId}{" "}
                              {item.title}
                            </span>
                          )
                        )}

                      </div>
                    </div>
                  )}

                {aiResult.recommendation && (
                  <div
                    style={{
                      marginTop: "17px",
                      padding: "13px",
                      borderRadius: "10px",
                      background:
                        "rgba(87,214,148,0.06)",
                      border:
                        "1px solid rgba(87,214,148,0.13)",
                    }}
                  >

                    <strong
                      style={{
                        display: "block",
                        color: "#8de0b1",
                        fontSize: "11px",
                        marginBottom: "5px",
                      }}
                    >
                      RECOMMENDED ACTION
                    </strong>

                    <span
                      style={{
                        color: "#b9ead0",
                        fontSize: "12px",
                        lineHeight: 1.5,
                      }}
                    >
                      {aiResult.recommendation}
                    </span>

                  </div>
                )}

              </div>
            )}

          </div>

        </section>

        {/* KANBAN BOARD */}

        <section className="section-block">

          <div className="section-heading">

            <div>

              <div className="section-kicker">
                EXECUTION BOARD
              </div>

              <h2>
                Kanban Workflow
              </h2>

              <p>
                Move work through the pipeline
                while the dependency engine keeps
                blocked work protected.
              </p>

            </div>

            <div className="board-count">
              {totalTasks} TASKS
            </div>

          </div>

          <div className="kanban-grid">

            {COLUMNS.map((column) => {

              const columnTasks =
                getColumnTasks(column.key);

              return (
                <div
                  className="kanban-column"
                  key={column.key}
                >

                  <div className="column-header">

                    <div>
                      <h3>
                        {column.title}
                      </h3>

                      <p>
                        {column.subtitle}
                      </p>
                    </div>

                    <span className="column-count">
                      {columnTasks.length}
                    </span>

                  </div>

                  <div className="column-body">

                    {columnTasks.length === 0 ? (
                      <div className="empty-column">
                        <div className="empty-icon">
                          {"\u2014"}
                        </div>

                        <span>
                          No tasks here
                        </span>
                      </div>
                    ) : (
                      columnTasks.map((task) => {

                        const prerequisites =
                          getPrerequisites(task.id);

                        const dependents =
                          getDependents(task.id);

                        const nextStatus =
                          getNextStatus(
                            task.workflowStatus
                          );

                        const previousStatus =
                          getPreviousStatus(
                            task.workflowStatus
                          );

                        const blockedReason =
                          getBlockedReason(task);

                        const readyReason =
                          getReadyReason(task);

                        return (
                          <article
                            className={`task-card ${
                              task.workflowStatus ===
                              "BLOCKED"
                                ? "task-blocked"
                                : ""
                            }`}
                            key={task.id}
                          >

                            <div className="task-card-top">

                              <span className="task-id">
                                #{task.id}
                              </span>

                              <span
                                className={`status-badge ${getStatusClass(
                                  task.workflowStatus
                                )}`}
                              >
                                {getStatusLabel(
                                  task.workflowStatus
                                )}
                              </span>

                            </div>

                            <h4>
                              {task.title}
                            </h4>

                            {task.description && (
                              <p className="task-description">
                                {task.description}
                              </p>
                            )}

                            {blockedReason && (
                              <div className="status-reason blocked-reason">
                                <span>!</span>
                                {blockedReason}
                              </div>
                            )}

                            {readyReason && (
                              <div className="status-reason ready-reason">
                                <span>
                                  {"\u2713"}
                                </span>
                                {readyReason}
                              </div>
                            )}

                            {prerequisites.length > 0 && (
                              <div className="task-dependency-box">

                                <div className="dependency-label">
                                  DEPENDS ON
                                </div>

                                <div className="dependency-chips">

                                  {prerequisites.map(
                                    (dependency) => (
                                      <div
                                        className="dependency-chip"
                                        key={
                                          dependency.id
                                        }
                                      >

                                        <span>
                                          #
                                          {
                                            dependency.prerequisiteTaskId
                                          }{" "}
                                          {
                                            dependency.prerequisiteTitle
                                          }
                                        </span>

                                        <button
                                          title="Remove dependency"
                                          disabled={
                                            removingDependencyId ===
                                            dependency.id
                                          }
                                          onClick={() =>
                                            handleRemoveDependency(
                                              dependency.dependentTaskId,
                                              dependency.prerequisiteTaskId
                                            )
                                          }
                                        >
                                          {"\u00D7"}
                                        </button>

                                      </div>
                                    )
                                  )}

                                </div>

                              </div>
                            )}

                            {dependents.length > 0 && (
                              <div className="blocks-info">

                                <span className="blocks-dot"></span>

                                Blocks{" "}
                                <strong>
                                  {dependents.length}
                                </strong>{" "}
                                downstream{" "}
                                {dependents.length === 1
                                  ? "task"
                                  : "tasks"}

                              </div>
                            )}

                            <div className="schedule-box">

                              <div className="schedule-heading">

                                <span>
                                  SCHEDULE
                                </span>

                                {task.durationDays && (
                                  <span>
                                    {task.durationDays} day
                                    {task.durationDays !==
                                    1
                                      ? "s"
                                      : ""}
                                  </span>
                                )}

                              </div>

                              {task.startDate &&
                              task.endDate ? (
                                <div className="schedule-dates">

                                  <div>
                                    <small>
                                      START
                                    </small>

                                    <strong>
                                      {task.startDate}
                                    </strong>
                                  </div>

                                  <span className="date-arrow">
                                    {"\u2192"}
                                  </span>

                                  <div>
                                    <small>
                                      END
                                    </small>

                                    <strong>
                                      {task.endDate}
                                    </strong>
                                  </div>

                                </div>
                              ) : (
                                <div className="unscheduled">
                                  No schedule assigned
                                </div>
                              )}

                            </div>

                            <div className="task-actions">

                              <button
                                className="task-action-button"
                                onClick={() =>
                                  openDependencyModal(
                                    task
                                  )
                                }
                              >
                                + Dependency
                              </button>

                              <button
                                className="task-action-button"
                                onClick={() =>
                                  openScheduleModal(
                                    task
                                  )
                                }
                              >
                                Schedule
                              </button>

                              <button
                                className="task-action-button impact-button"
                                onClick={() =>
                                  openImpactModal(
                                    task
                                  )
                                }
                              >
                                Impact
                              </button>

                            </div>

                            {(previousStatus ||
                              nextStatus) && (
                              <div className="movement-row">

                                {previousStatus ? (
                                  <button
                                    className="move-button"
                                    disabled={
                                      movingTaskId ===
                                      task.id
                                    }
                                    onClick={() =>
                                      updateTaskStatus(
                                        task,
                                        previousStatus
                                      )
                                    }
                                  >
                                    {"\u2190"}
                                  </button>
                                ) : (
                                  <span />
                                )}

                                {nextStatus ? (
                                  <button
                                    className="move-button move-forward"
                                    disabled={
                                      movingTaskId ===
                                      task.id
                                    }
                                    onClick={() =>
                                      updateTaskStatus(
                                        task,
                                        nextStatus
                                      )
                                    }
                                  >
                                    {movingTaskId ===
                                    task.id
                                      ? "..."
                                      : "\u2192"}
                                  </button>
                                ) : (
                                  <span />
                                )}

                              </div>
                            )}

                          </article>
                        );
                      })
                    )}

                  </div>
                </div>
              );
            })}

          </div>

        </section>

        {/* REAL DAG */}

        <section className="section-block">

          <div className="section-heading">

            <div>

              <div className="section-kicker">
                DEPENDENCY ENGINE
              </div>

              <h2>
                Real Task DAG
              </h2>

              <p>
                Live dependency graph generated
                from PostgreSQL relationships.
                Click a node to trace its workflow.
              </p>

            </div>

            <div className="graph-meta">

              <span>
                {tasks.length} NODES
              </span>

              <span>
                {dependencies.length} EDGES
              </span>

            </div>

          </div>

          {dependencies.length === 0 ? (

            <div className="no-dependencies">

              <div className="large-empty-icon">
                {"\u2026"}
              </div>

              <h3>
                No dependency edges yet
              </h3>

              <p>
                Add a dependency from any task card
                to start building your DAG.
              </p>

            </div>

          ) : (

            <div className="dag-container">

              <div className="dag-header">

                <div>
                  <strong>
                    Dependency Flow
                  </strong>

                  <span>
                    Prerequisite {"\u2192"} Dependent
                  </span>
                </div>

                <div className="dag-legend">

                  <span>
                    <i className="legend-dot done"></i>
                    Done
                  </span>

                  <span>
                    <i className="legend-dot ready"></i>
                    Ready
                  </span>

                  <span>
                    <i className="legend-dot blocked"></i>
                    Blocked
                  </span>

                </div>

              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  borderBottom:
                    "1px solid rgba(255,255,255,0.07)",
                  background:
                    "rgba(255,255,255,0.025)",
                  flexWrap: "wrap",
                }}
              >

                <div
                  style={{
                    fontSize: "12px",
                    color: "#8f9bb3",
                  }}
                >
                  {graphFocusId
                    ? "Dependency chain highlighted"
                    : "Select any node to trace downstream impact"}
                </div>

                {graphFocusId && (
                  <button
                    className="secondary-button"
                    style={{
                      padding: "7px 12px",
                      fontSize: "11px",
                    }}
                    onClick={clearDagSelection}
                  >
                    Clear Graph Selection
                  </button>
                )}

              </div>

              <div className="dag-flow">

                {graphLevels.map(
                  (level, levelIndex) => (

                    <div
                      className="dag-level"
                      key={levelIndex}
                    >

                      <div className="level-marker">
                        LEVEL{" "}
                        {String(levelIndex).padStart(
                          2,
                          "0"
                        )}
                      </div>

                      <div className="dag-level-content">

                        {level.map((task) => {

                          const incoming =
                            getPrerequisites(
                              task.id
                            ).length;

                          const outgoing =
                            getDependents(
                              task.id
                            ).length;

                          const isSelected =
                            graphFocusId === task.id;

                          const isDownstream =
                            downstreamTaskIds.has(
                              task.id
                            );

                          const isUpstream =
                            upstreamTaskIds.has(
                              task.id
                            );

                          const isRelated =
                            isSelected ||
                            isDownstream ||
                            isUpstream;

                          return (
                            <div
                              className={`dag-node ${getStatusClass(
                                task.workflowStatus
                              )}`}
                              key={task.id}
                              onClick={() =>
                                handleDagNodeClick(
                                  task
                                )
                              }
                              title="Click to inspect dependency flow"
                              style={{
                                cursor: "pointer",
                                position: "relative",
                                transform: isSelected
                                  ? "translateY(-5px) scale(1.025)"
                                  : "none",
                                opacity:
                                  graphFocusId &&
                                  !isRelated
                                    ? 0.35
                                    : 1,
                                boxShadow: isSelected
                                  ? "0 0 0 2px rgba(255,255,255,0.5), 0 16px 35px rgba(0,0,0,0.35)"
                                  : isDownstream
                                  ? "0 0 0 1px rgba(87, 214, 148, 0.45)"
                                  : isUpstream
                                  ? "0 0 0 1px rgba(92, 145, 255, 0.45)"
                                  : undefined,
                                transition:
                                  "all 180ms ease",
                              }}
                            >

                              {isSelected && (
                                <div
                                  style={{
                                    position:
                                      "absolute",
                                    top: "-9px",
                                    right: "-9px",
                                    width: "18px",
                                    height: "18px",
                                    borderRadius:
                                      "50%",
                                    display: "grid",
                                    placeItems:
                                      "center",
                                    background:
                                      "#ffffff",
                                    color: "#111827",
                                    fontSize: "10px",
                                    fontWeight: 900,
                                    zIndex: 5,
                                  }}
                                >
                                  {"\u2713"}
                                </div>
                              )}

                              <div className="dag-node-top">

                                <span className="dag-node-id">
                                  #{task.id}
                                </span>

                                <span
                                  className={`dag-mini-status ${getStatusClass(
                                    task.workflowStatus
                                  )}`}
                                >
                                  {getStatusLabel(
                                    task.workflowStatus
                                  )}
                                </span>

                              </div>

                              <div className="dag-node-title">
                                {task.title}
                              </div>

                              <div className="dag-node-footer">

                                <span>
                                  {incoming} incoming
                                </span>

                                <span>
                                  {outgoing} outgoing
                                </span>

                              </div>

                              {isSelected && (
                                <div
                                  style={{
                                    marginTop:
                                      "10px",
                                    paddingTop:
                                      "8px",
                                    borderTop:
                                      "1px solid rgba(255,255,255,0.1)",
                                    fontSize:
                                      "10px",
                                    color:
                                      "#c7d2e5",
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {outgoing > 0
                                    ? `${outgoing} downstream ${
                                        outgoing ===
                                        1
                                          ? "task"
                                          : "tasks"
                                      }`
                                    : "End of dependency chain"}
                                </div>
                              )}

                            </div>
                          );
                        })}

                      </div>

                      {levelIndex <
                        graphLevels.length - 1 && (

                        <div className="dag-connector">

                          <div className="connector-line"></div>

                          <div className="connector-arrow">
                            {"\u2193"}
                          </div>

                        </div>

                      )}

                    </div>

                  )
                )}

              </div>

              {selectedDagTask && (

                <div
                  className="edge-panel"
                  style={{
                    marginTop: "18px",
                    borderTop:
                      "1px solid rgba(255,255,255,0.08)",
                  }}
                >

                  <div
                    className="edge-panel-title"
                    style={{
                      display: "flex",
                      justifyContent:
                        "space-between",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >

                    <span>
                      Selected Node
                    </span>

                    <span
                      className={`status-badge ${getStatusClass(
                        selectedDagTask.workflowStatus
                      )}`}
                    >
                      {getStatusLabel(
                        selectedDagTask.workflowStatus
                      )}
                    </span>

                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(180px, 1.4fr) repeat(3, minmax(90px, 1fr))",
                      gap: "12px",
                      marginTop: "14px",
                    }}
                  >

                    <div>
                      <small
                        style={{
                          display: "block",
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          marginBottom:
                            "5px",
                        }}
                      >
                        TASK
                      </small>

                      <strong
                        style={{
                          fontSize: "14px",
                        }}
                      >
                        #{selectedDagTask.id}{" "}
                        {selectedDagTask.title}
                      </strong>
                    </div>

                    <div>
                      <small
                        style={{
                          display: "block",
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          marginBottom:
                            "5px",
                        }}
                      >
                        PREREQUISITES
                      </small>

                      <strong>
                        {
                          getPrerequisites(
                            selectedDagTask.id
                          ).length
                        }
                      </strong>

                      <div
                        style={{
                          color: "#7f8ba3",
                          fontSize: "10px",
                        }}
                      >
                        incoming
                      </div>
                    </div>

                    <div>
                      <small
                        style={{
                          display: "block",
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          marginBottom:
                            "5px",
                        }}
                      >
                        DEPENDENTS
                      </small>

                      <strong>
                        {
                          getDependents(
                            selectedDagTask.id
                          ).length
                        }
                      </strong>

                      <div
                        style={{
                          color: "#7f8ba3",
                          fontSize: "10px",
                        }}
                      >
                        downstream
                      </div>
                    </div>

                    <div>
                      <small
                        style={{
                          display: "block",
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          marginBottom:
                            "5px",
                        }}
                      >
                        DURATION
                      </small>

                      <strong>
                        {selectedDagTask.durationDays ||
                          0}
                      </strong>

                      <div
                        style={{
                          color: "#7f8ba3",
                          fontSize: "10px",
                        }}
                      >
                        days
                      </div>
                    </div>

                  </div>

                  {getPrerequisites(
                    selectedDagTask.id
                  ).length > 0 && (

                    <div
                      style={{
                        marginTop: "18px",
                      }}
                    >

                      <div
                        style={{
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          fontWeight: 800,
                          marginBottom: "9px",
                        }}
                      >
                        UPSTREAM PREREQUISITES
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "7px",
                        }}
                      >

                        {getPrerequisites(
                          selectedDagTask.id
                        ).map((dependency) => (

                          <span
                            key={dependency.id}
                            style={{
                              padding:
                                "6px 10px",
                              borderRadius:
                                "8px",
                              background:
                                "rgba(92,145,255,0.08)",
                              border:
                                "1px solid rgba(92,145,255,0.18)",
                              color: "#b8c9ee",
                              fontSize:
                                "11px",
                            }}
                          >
                            #{dependency.prerequisiteTaskId}{" "}
                            {
                              dependency.prerequisiteTitle
                            }
                          </span>

                        ))}

                      </div>

                    </div>

                  )}

                  {getDependents(
                    selectedDagTask.id
                  ).length > 0 && (

                    <div
                      style={{
                        marginTop: "18px",
                      }}
                    >

                      <div
                        style={{
                          color: "#7f8ba3",
                          fontSize: "9px",
                          letterSpacing:
                            "0.12em",
                          fontWeight: 800,
                          marginBottom: "9px",
                        }}
                      >
                        DOWNSTREAM IMPACT
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "7px",
                        }}
                      >

                        {getDependents(
                          selectedDagTask.id
                        ).map((dependency) => {

                          const dependent =
                            tasks.find(
                              (task) =>
                                task.id ===
                                dependency.dependentTaskId
                            );

                          return (
                            <span
                              key={dependency.id}
                              style={{
                                padding:
                                  "6px 10px",
                                borderRadius:
                                  "8px",
                                background:
                                  "rgba(87,214,148,0.08)",
                                border:
                                  "1px solid rgba(87,214,148,0.18)",
                                color: "#b9ead0",
                                fontSize:
                                  "11px",
                              }}
                            >
                              #{dependency.dependentTaskId}{" "}
                              {dependent?.title ||
                                dependency.dependentTitle}
                            </span>
                          );
                        })}

                      </div>

                    </div>

                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "18px",
                      flexWrap: "wrap",
                    }}
                  >

                    <button
                      className="task-action-button"
                      onClick={() =>
                        openImpactModal(
                          selectedDagTask
                        )
                      }
                    >
                      View Full Impact
                    </button>

                    <button
                      className="task-action-button"
                      onClick={() =>
                        openDependencyModal(
                          selectedDagTask
                        )
                      }
                    >
                      + Dependency
                    </button>

                    <button
                      className="task-action-button"
                      onClick={() =>
                        openScheduleModal(
                          selectedDagTask
                        )
                      }
                    >
                      Schedule
                    </button>

                  </div>

                </div>

              )}

              <div className="edge-panel">

                <div className="edge-panel-title">
                  Dependency Edges
                </div>

                {dependencies.map(
                  (dependency) => {

                    const edgeIsHighlighted =
                      graphFocusId ===
                        dependency.prerequisiteTaskId ||
                      downstreamTaskIds.has(
                        dependency.dependentTaskId
                      );

                    return (
                      <div
                        className="edge-row"
                        key={dependency.id}
                        style={{
                          opacity:
                            graphFocusId &&
                            !edgeIsHighlighted
                              ? 0.35
                              : 1,
                          transition:
                            "opacity 180ms ease",
                        }}
                      >

                        <div className="edge-task">

                          <span className="edge-id">
                            #
                            {
                              dependency.prerequisiteTaskId
                            }
                          </span>

                          <span>
                            {
                              dependency.prerequisiteTitle
                            }
                          </span>

                        </div>

                        <div className="edge-arrow">
                          {"\u2192"}
                        </div>

                        <div className="edge-task">

                          <span className="edge-id">
                            #
                            {
                              dependency.dependentTaskId
                            }
                          </span>

                          <span>
                            {
                              dependency.dependentTitle
                            }
                          </span>

                        </div>

                      </div>
                    );
                  }
                )}

              </div>

            </div>

          )}

        </section>

      </main>

      {/* CREATE TASK MODAL */}

      {showCreateModal && (

        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowCreateModal(false);
            }
          }}
        >

          <div className="modal-card">

            <div className="modal-header">

              <div>

                <div className="modal-kicker">
                  NEW WORKFLOW NODE
                </div>

                <h2>
                  Create Task
                </h2>

              </div>

              <button
                className="modal-close"
                onClick={() =>
                  setShowCreateModal(false)
                }
              >
                {"\u00D7"}
              </button>

            </div>

            <form onSubmit={handleAddTask}>

              <label>
                Task title

                <input
                  type="text"
                  value={newTask.title}
                  onChange={(event) =>
                    setNewTask({
                      ...newTask,
                      title:
                        event.target.value,
                    })
                  }
                  placeholder="e.g. Integration Tests"
                  autoFocus
                />
              </label>

              <label>
                Description

                <textarea
                  value={newTask.description}
                  onChange={(event) =>
                    setNewTask({
                      ...newTask,
                      description:
                        event.target.value,
                    })
                  }
                  placeholder="Describe what needs to be completed..."
                  rows="4"
                />
              </label>

              <div className="form-two-column">

                <label>
                  Start date

                  <input
                    type="date"
                    value={newTask.startDate}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        startDate:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Duration (days)

                  <input
                    type="number"
                    min="1"
                    value={newTask.durationDays}
                    onChange={(event) =>
                      setNewTask({
                        ...newTask,
                        durationDays:
                          event.target.value,
                      })
                    }
                  />
                </label>

              </div>

              <div className="modal-note">
                Dependencies can be added after
                the task is created.
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowCreateModal(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={creatingTask}
                >
                  {creatingTask
                    ? "Creating..."
                    : "Create Task"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* DEPENDENCY MODAL */}

      {showDependencyModal &&
        dependencyTask && (

          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowDependencyModal(false);
                setDependencyError("");
              }
            }}
          >

            <div className="modal-card">

              <div className="modal-header">

                <div>

                  <div className="modal-kicker">
                    DEPENDENCY GRAPH
                  </div>

                  <h2>
                    Add Dependency
                  </h2>

                </div>

                <button
                  className="modal-close"
                  onClick={() => {
                    setShowDependencyModal(false);
                    setDependencyError("");
                  }}
                >
                  {"\u00D7"}
                </button>

              </div>

              <div className="dependency-target">

                <span>
                  Dependent task
                </span>

                <strong>
                  #{dependencyTask.id}{" "}
                  {dependencyTask.title}
                </strong>

              </div>

              <div className="dependency-direction">

                <div>
                  PREREQUISITE
                </div>

                <span>
                  {"\u2193"}
                </span>

                <div>
                  DEPENDENT
                </div>

              </div>

              <label>
                Select prerequisite

                <select
                  value={selectedPrerequisite}
                  onChange={(event) => {
                    setSelectedPrerequisite(
                      event.target.value
                    );
                    setDependencyError("");
                  }}
                >

                  <option value="">
                    Select a task...
                  </option>

                  {availablePrerequisites.map(
                    (task) => (
                      <option
                        key={task.id}
                        value={task.id}
                      >
                        #{task.id}{" "}
                        {"\u2014"}{" "}
                        {task.title}
                      </option>
                    )
                  )}

                </select>

              </label>

              {dependencyError && (

                <div className="dependency-error-box">

                  <div className="dependency-error-icon">
                    !
                  </div>

                  <div>

                    <strong>
                      Dependency not added
                    </strong>

                    <span>
                      {dependencyError}
                    </span>

                  </div>

                </div>

              )}

              <div className="modal-note">

                The selected task must be completed
                before{" "}
                <strong>
                  {dependencyTask.title}
                </strong>{" "}
                can become ready.

              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setShowDependencyModal(false);
                    setDependencyError("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    addingDependency ||
                    !selectedPrerequisite
                  }
                  onClick={
                    handleAddDependency
                  }
                >
                  {addingDependency
                    ? "Adding..."
                    : "Add Dependency"}
                </button>

              </div>

            </div>

          </div>

        )}

      {/* SCHEDULE MODAL */}

      {showScheduleModal &&
        scheduleTask && (

          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowScheduleModal(false);
              }
            }}
          >

            <div className="modal-card">

              <div className="modal-header">

                <div>

                  <div className="modal-kicker">
                    SCHEDULING ENGINE
                  </div>

                  <h2>
                    Schedule Task
                  </h2>

                </div>

                <button
                  className="modal-close"
                  onClick={() =>
                    setShowScheduleModal(false)
                  }
                >
                  {"\u00D7"}
                </button>

              </div>

              <div className="schedule-target">

                <span>
                  TASK #{scheduleTask.id}
                </span>

                <strong>
                  {scheduleTask.title}
                </strong>

              </div>

              <form
                onSubmit={
                  handleSaveSchedule
                }
              >

                <label>
                  Start date

                  <input
                    type="date"
                    value={
                      scheduleForm.startDate
                    }
                    onChange={(event) =>
                      setScheduleForm({
                        ...scheduleForm,
                        startDate:
                          event.target.value,
                      })
                    }
                  />
                </label>

                <label>
                  Duration

                  <div className="input-with-suffix">

                    <input
                      type="number"
                      min="1"
                      value={
                        scheduleForm.durationDays
                      }
                      onChange={(event) =>
                        setScheduleForm({
                          ...scheduleForm,
                          durationDays:
                            event.target.value,
                        })
                      }
                    />

                    <span>
                      days
                    </span>

                  </div>

                </label>

                {getPrerequisites(
                  scheduleTask.id
                ).length > 0 && (

                  <div className="schedule-warning">

                    <div className="warning-icon">
                      !
                    </div>

                    <div>

                      <strong>
                        Dependency-aware
                        scheduling
                      </strong>

                      <p>
                        If this date is earlier
                        than the latest
                        prerequisite completion,
                        the backend will automatically
                        move the start date forward.
                      </p>

                    </div>

                  </div>

                )}

                <div className="modal-actions">

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setShowScheduleModal(
                        false
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={savingSchedule}
                  >
                    {savingSchedule
                      ? "Saving..."
                      : "Save Schedule"}
                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

      {/* IMPACT MODAL */}

      {showImpactModal &&
        impactTask && (

          <div
            className="modal-overlay"
            onMouseDown={(event) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowImpactModal(false);
              }
            }}
          >

            <div className="modal-card impact-modal">

              <div className="modal-header">

                <div>

                  <div className="modal-kicker">
                    DOWNSTREAM ANALYSIS
                  </div>

                  <h2>
                    Impact Analysis
                  </h2>

                </div>

                <button
                  className="modal-close"
                  onClick={() =>
                    setShowImpactModal(false)
                  }
                >
                  {"\u00D7"}
                </button>

              </div>

              <div className="impact-root">

                <div className="impact-root-label">
                  ROOT TASK
                </div>

                <strong>
                  #{impactTask.id}{" "}
                  {impactTask.title}
                </strong>

              </div>

              {loadingImpact ? (

                <div className="impact-loading">
                  <div className="small-spinner"></div>
                  Calculating downstream impact...
                </div>

              ) : impactData.length === 0 ? (

                <div className="impact-empty">

                  <div>
                    {"\u2713"}
                  </div>

                  <h3>
                    No downstream impact
                  </h3>

                  <p>
                    This task currently does
                    not block any other task.
                  </p>

                </div>

              ) : (

                <div className="impact-content">

                  <div className="impact-summary">

                    <div>

                      <span>
                        AFFECTED TASKS
                      </span>

                      <strong>
                        {impactData.length}
                      </strong>

                    </div>

                    <div>

                      <span>
                        MAX DEPENDENCY LEVEL
                      </span>

                      <strong>
                        {Math.max(
                          ...impactData.map(
                            (item) =>
                              item.impactLevel
                          )
                        )}
                      </strong>

                    </div>

                  </div>

                  <div className="impact-list">

                    {impactData.map(
                      (impact) => (

                        <div
                          className="impact-item"
                          key={impact.taskId}
                        >

                          <div className="impact-level">

                            <span>
                              L
                            </span>

                            {impact.impactLevel}

                          </div>

                          <div className="impact-main">

                            <div className="impact-title-row">

                              <strong>
                                #{impact.taskId}{" "}
                                {impact.title}
                              </strong>

                              <span
                                className={`impact-type ${
                                  impact.impactType ===
                                  "DIRECT"
                                    ? "direct"
                                    : "indirect"
                                }`}
                              >
                                {impact.impactType}
                              </span>

                            </div>

                            <div className="impact-details">

                              <span>
                                Status:{" "}
                                <strong>
                                  {getStatusLabel(
                                    impact.workflowStatus
                                  )}
                                </strong>
                              </span>

                              <span>
                                Duration:{" "}
                                <strong>
                                  {
                                    impact.durationDays
                                  }{" "}
                                  days
                                </strong>
                              </span>

                              <span>
                                {impact.currentStartDate
                                  ? `${impact.currentStartDate} ${"\u2192"} ${impact.currentEndDate}`
                                  : "Not scheduled"}
                              </span>

                            </div>

                          </div>

                        </div>

                      )
                    )}

                  </div>

                </div>

              )}

            </div>

          </div>

        )}

    </div>
  );
}

export default App;
package com.taskflow.taskflow_backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.taskflow_backend.model.Dependency;
import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.repository.DependencyRepository;
import com.taskflow.taskflow_backend.repository.TaskRepository;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;

@Service
public class AIService {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String OLLAMA_URL =
            "http://127.0.0.1:11434/api/generate";

    private static final String MODEL =
            "llama3.2:3b";

    public AIService(
            TaskRepository taskRepository,
            DependencyRepository dependencyRepository) {

        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        this.objectMapper = new ObjectMapper();
    }

    public Map<String, Object> analyze(String question) {

        List<Task> tasks = taskRepository.findAll();
        List<Dependency> dependencies =
                dependencyRepository.findAll();

        String normalizedQuestion =
                question == null
                        ? ""
                        : question.toLowerCase();

        Task mentionedTask =
                findMentionedTask(
                        normalizedQuestion,
                        tasks
                );

        List<Map<String, Object>> affectedTasks =
                mentionedTask == null
                        ? new ArrayList<>()
                        : getDownstreamImpact(
                                mentionedTask.getId(),
                                tasks,
                                dependencies
                        );

        List<Map<String, Object>> prerequisites =
                mentionedTask == null
                        ? new ArrayList<>()
                        : getPrerequisites(
                                mentionedTask.getId(),
                                dependencies
                        );

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put("question", question);

        result.put(
                "type",
                detectQuestionType(normalizedQuestion)
        );

        if (mentionedTask != null) {

            result.put(
                    "task",
                    taskSummary(mentionedTask)
            );

            result.put(
                    "prerequisites",
                    prerequisites
            );

            result.put(
                    "affectedTasks",
                    affectedTasks
            );

            result.put(
                    "affectedTaskCount",
                    affectedTasks.size()
            );

            result.put(
                    "directDependents",
                    dependencies.stream()
                            .filter(d ->
                                    d.getPrerequisiteTask()
                                            .getId()
                                            .equals(
                                                    mentionedTask.getId()
                                            )
                            )
                            .count()
            );

            result.put(
                    "recommendation",
                    buildRecommendation(
                            mentionedTask,
                            affectedTasks
                    )
            );
        } else {

            result.put(
                    "affectedTasks",
                    new ArrayList<>()
            );

            result.put(
                    "affectedTaskCount",
                    0
            );
        }

        Map<String, Object> workflowData =
                buildWorkflowData(
                        tasks,
                        dependencies
                );

        result.put(
                "workflowData",
                workflowData
        );

        try {

            String prompt =
                    buildPrompt(
                            question,
                            workflowData,
                            mentionedTask,
                            affectedTasks,
                            prerequisites
                    );

            String aiAnswer =
                    callOllama(prompt);

            result.put(
                    "analysis",
                    aiAnswer
            );

            result.put(
                    "model",
                    MODEL
            );

            result.put(
                    "aiPowered",
                    true
            );

        } catch (Exception e) {

            result.put(
                    "analysis",
                    buildFallbackAnalysis(
                            mentionedTask,
                            affectedTasks,
                            prerequisites,
                            normalizedQuestion
                    )
            );

            result.put(
                    "model",
                    "local-fallback"
            );

            result.put(
                    "aiPowered",
                    false
            );

            result.put(
                    "error",
                    "Local AI request failed."
            );

            result.put(
                    "details",
                    e.getMessage()
            );
        }

        return result;
    }

    private String callOllama(String prompt)
            throws Exception {

        Map<String, Object> requestBody =
                new LinkedHashMap<>();

        requestBody.put(
                "model",
                MODEL
        );

        requestBody.put(
                "prompt",
                prompt
        );

        requestBody.put(
                "stream",
                false
        );

        Map<String, Object> options =
                new LinkedHashMap<>();

        options.put(
                "temperature",
                0.2
        );

        options.put(
                "num_predict",
                500
        );

        requestBody.put(
                "options",
                options
        );

        String requestJson =
                objectMapper.writeValueAsString(
                        requestBody
                );

        HttpRequest request =
                HttpRequest.newBuilder()
                        .uri(
                                URI.create(
                                        OLLAMA_URL
                                )
                        )
                        .timeout(
                                Duration.ofSeconds(120)
                        )
                        .header(
                                "Content-Type",
                                "application/json"
                        )
                        .POST(
                                HttpRequest.BodyPublishers
                                        .ofString(requestJson)
                        )
                        .build();

        HttpResponse<String> response =
                httpClient.send(
                        request,
                        HttpResponse.BodyHandlers
                                .ofString()
                );

        if (response.statusCode() < 200
                || response.statusCode() >= 300) {

            throw new RuntimeException(
                    "Ollama returned HTTP "
                            + response.statusCode()
                            + ": "
                            + response.body()
            );
        }

        JsonNode root =
                objectMapper.readTree(
                        response.body()
                );

        String answer =
                root.path("response")
                        .asText();

        if (answer == null
                || answer.isBlank()) {

            throw new RuntimeException(
                    "Ollama returned an empty response."
            );
        }

        return answer.trim();
    }

    private String buildPrompt(
            String question,
            Map<String, Object> workflowData,
            Task mentionedTask,
            List<Map<String, Object>> affectedTasks,
            List<Map<String, Object>> prerequisites) {

        String workflowJson;

        try {

            workflowJson =
                    objectMapper
                            .writerWithDefaultPrettyPrinter()
                            .writeValueAsString(
                                    workflowData
                            );

        } catch (Exception e) {

            workflowJson =
                    workflowData.toString();
        }

        String taskContext =
                mentionedTask == null
                        ? "No specific task was identified."
                        : "Mentioned task: "
                                + mentionedTask.getTitle();

        return """
                You are TaskFlow Pro AI Workflow Copilot.

                Analyze the user's project workflow using ONLY the
                workflow data supplied below.

                IMPORTANT RULES:

                1. Do not invent tasks.
                2. Do not invent dependencies.
                3. Do not invent dates.
                4. Do not invent statuses.
                5. Dependency direction is:
                   prerequisite task -> dependent task.
                6. A dependent task is BLOCKED when a prerequisite
                   is not DONE.
                7. A dependent task can become READY when all
                   prerequisites are DONE.
                8. Distinguish direct and indirect downstream impact.
                9. If the user asks about a delay, calculate the
                   conceptual downstream effect using the supplied
                   dates and durations.
                10. Do not claim that you actually changed anything.
                11. Use concise project-management language.
                12. If information is unavailable, say so clearly.

                VERY IMPORTANT FOR DELAY QUESTIONS:

If the user says a task is delayed by N days,
calculate the downstream schedule using these exact rules:

1. Add N calendar days to the delayed task's current end date.
2. A dependent task must start on the NEXT calendar day
   after its prerequisite finishes.
3. Preserve the dependent task's existing duration.
4. Therefore:
   dependentStartDate = prerequisiteEndDate + 1 day
   dependentEndDate = dependentStartDate + durationDays - 1 day
5. Do not change the actual database.
6. Clearly distinguish between:
   - projected schedule after the hypothetical delay
   - actual schedule currently stored in the database

Example:

Backend API:
Current end = 2026-10-22
Delay = 3 days
Projected end = 2026-10-25

Integration Tests:
Current duration = 2 days
It depends directly on Backend API.

Therefore:
Projected start = 2026-10-26
Projected end = 2026-10-27

Never say that Integration Tests starts on the same
day that Backend API finishes.

Use the exact dates calculated from the workflow data.

                For example, if:
                Backend API ends on October 22
                Integration Tests starts on October 23

                and Backend API is delayed by 3 days, explain that
                its projected end would move to October 25 and the
                dependent Integration Tests would need to move
                accordingly.

                RESPONSE FORMAT:

                TASK
                STATUS
                CURRENT SCHEDULE
                DEPENDENCY ANALYSIS
                DOWNSTREAM IMPACT
                RECOMMENDED ACTION

                Keep the answer understandable for a dashboard.

                USER QUESTION:
                """ + question + """

                """ + taskContext + """

                CURRENT WORKFLOW DATA:
                """ + workflowJson;
    }

    private Map<String, Object> buildWorkflowData(
            List<Task> tasks,
            List<Dependency> dependencies) {

        Map<String, Object> data =
                new LinkedHashMap<>();

        List<Map<String, Object>> taskList =
                new ArrayList<>();

        for (Task task : tasks) {

            Map<String, Object> item =
                    new LinkedHashMap<>();

            item.put(
                    "id",
                    task.getId()
            );

            item.put(
                    "title",
                    task.getTitle()
            );

            item.put(
                    "status",
                    task.getWorkflowStatus() == null
                            ? null
                            : task.getWorkflowStatus().name()
            );

            item.put(
                    "startDate",
                    task.getStartDate()
            );

            item.put(
                    "endDate",
                    task.getEndDate()
            );

            item.put(
                    "durationDays",
                    task.getDurationDays()
            );

            item.put(
                    "description",
                    task.getDescription()
            );

            taskList.add(item);
        }

        List<Map<String, Object>> dependencyList =
                new ArrayList<>();

        for (Dependency dependency : dependencies) {

            Map<String, Object> edge =
                    new LinkedHashMap<>();

            edge.put(
                    "prerequisiteTaskId",
                    dependency
                            .getPrerequisiteTask()
                            .getId()
            );

            edge.put(
                    "prerequisiteTask",
                    dependency
                            .getPrerequisiteTask()
                            .getTitle()
            );

            edge.put(
                    "dependentTaskId",
                    dependency
                            .getDependentTask()
                            .getId()
            );

            edge.put(
                    "dependentTask",
                    dependency
                            .getDependentTask()
                            .getTitle()
            );

            dependencyList.add(edge);
        }

        data.put(
                "tasks",
                taskList
        );

        data.put(
                "dependencies",
                dependencyList
        );

        return data;
    }

    private Task findMentionedTask(
            String question,
            List<Task> tasks) {

        Task bestMatch = null;

        int bestLength = 0;

        for (Task task : tasks) {

            if (task.getTitle() == null) {
                continue;
            }

            String title =
                    task.getTitle()
                            .toLowerCase();

            if (question.contains(title)
                    && title.length() > bestLength) {

                bestMatch = task;
                bestLength = title.length();
            }
        }

        return bestMatch;
    }

    private String detectQuestionType(
            String question) {

        if (question.contains("delay")
                || question.contains("late")
                || question.contains("shift")) {

            return "SCHEDULE_IMPACT";
        }

        if (question.contains("depend")
                || question.contains("downstream")
                || question.contains("impact")) {

            return "DEPENDENCY_IMPACT";
        }

        if (question.contains("blocked")) {

            return "BLOCKED_ANALYSIS";
        }

        if (question.contains("status")
                || question.contains("progress")) {

            return "WORKFLOW_STATUS";
        }

        return "WORKFLOW_ANALYSIS";
    }

    private List<Map<String, Object>> getDownstreamImpact(
            Long rootId,
            List<Task> tasks,
            List<Dependency> dependencies) {

        List<Map<String, Object>> result =
                new ArrayList<>();

        Set<Long> visited =
                new HashSet<>();

        Queue<Long> queue =
                new LinkedList<>();

        Map<Long, Integer> levels =
                new HashMap<>();

        queue.add(rootId);

        levels.put(
                rootId,
                0
        );

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            int currentLevel =
                    levels.getOrDefault(
                            currentId,
                            0
                    );

            for (Dependency dependency :
                    dependencies) {

                if (!dependency
                        .getPrerequisiteTask()
                        .getId()
                        .equals(currentId)) {

                    continue;
                }

                Long nextId =
                        dependency
                                .getDependentTask()
                                .getId();

                if (visited.contains(nextId)) {
                    continue;
                }

                visited.add(nextId);

                int nextLevel =
                        currentLevel + 1;

                levels.put(
                        nextId,
                        nextLevel
                );

                queue.add(nextId);

                Task task =
                        tasks.stream()
                                .filter(
                                        t ->
                                                t.getId()
                                                        .equals(
                                                                nextId
                                                        )
                                )
                                .findFirst()
                                .orElse(null);

                if (task != null) {

                    Map<String, Object> item =
                            new LinkedHashMap<>();

                    item.put(
                            "taskId",
                            task.getId()
                    );

                    item.put(
                            "title",
                            task.getTitle()
                    );

                    item.put(
                            "impactLevel",
                            nextLevel
                    );

                    item.put(
                            "impactType",
                            nextLevel == 1
                                    ? "DIRECT"
                                    : "INDIRECT"
                    );

                    item.put(
                            "workflowStatus",
                            task.getWorkflowStatus() == null
                                    ? null
                                    : task.getWorkflowStatus()
                                            .name()
                    );

                    item.put(
                            "startDate",
                            task.getStartDate()
                    );

                    item.put(
                            "endDate",
                            task.getEndDate()
                    );

                    item.put(
                            "durationDays",
                            task.getDurationDays()
                    );

                    result.add(item);
                }
            }
        }

        result.sort(
                Comparator.comparing(
                        item ->
                                (Integer)
                                        item.get(
                                                "impactLevel"
                                        )
                )
        );

        return result;
    }

    private List<Map<String, Object>> getPrerequisites(
            Long taskId,
            List<Dependency> dependencies) {

        List<Map<String, Object>> result =
                new ArrayList<>();

        for (Dependency dependency :
                dependencies) {

            if (!dependency
                    .getDependentTask()
                    .getId()
                    .equals(taskId)) {

                continue;
            }

            Task prerequisite =
                    dependency
                            .getPrerequisiteTask();

            Map<String, Object> item =
                    new LinkedHashMap<>();

            item.put(
                    "taskId",
                    prerequisite.getId()
            );

            item.put(
                    "title",
                    prerequisite.getTitle()
            );

            item.put(
                    "workflowStatus",
                    prerequisite
                            .getWorkflowStatus() == null
                            ? null
                            : prerequisite
                                    .getWorkflowStatus()
                                    .name()
            );

            item.put(
                    "endDate",
                    prerequisite.getEndDate()
            );

            result.add(item);
        }

        return result;
    }

    private Map<String, Object> taskSummary(
            Task task) {

        Map<String, Object> summary =
                new LinkedHashMap<>();

        summary.put(
                "id",
                task.getId()
        );

        summary.put(
                "title",
                task.getTitle()
        );

        summary.put(
                "status",
                task.getWorkflowStatus() == null
                        ? null
                        : task.getWorkflowStatus().name()
        );

        summary.put(
                "startDate",
                task.getStartDate()
        );

        summary.put(
                "endDate",
                task.getEndDate()
        );

        summary.put(
                "durationDays",
                task.getDurationDays()
        );

        return summary;
    }

    private String buildRecommendation(
            Task task,
            List<Map<String, Object>> affectedTasks) {

        if (affectedTasks.isEmpty()) {

            return "No downstream scheduling action is currently required.";
        }

        Map<String, Object> first =
                affectedTasks.get(0);

        return "Review "
                + first.get("title")
                + " first because it is the nearest downstream task "
                + "in the dependency chain.";
    }

    private String buildFallbackAnalysis(
            Task task,
            List<Map<String, Object>> affectedTasks,
            List<Map<String, Object>> prerequisites,
            String question) {

        if (task == null) {

            return "I could not identify a specific task from the question. "
                    + "Please mention a task such as Backend API or Database Schema.";
        }

        StringBuilder analysis =
                new StringBuilder();

        analysis.append("TASK\n")
                .append(task.getTitle())
                .append("\n\n");

        analysis.append("STATUS\n")
                .append(task.getWorkflowStatus())
                .append("\n\n");

        analysis.append("CURRENT SCHEDULE\n")
                .append(task.getStartDate())
                .append(" → ")
                .append(task.getEndDate())
                .append("\n\n");

        analysis.append("DEPENDENCY ANALYSIS\n");

        if (prerequisites.isEmpty()) {

            analysis.append(
                    "No prerequisite tasks are recorded."
            );

        } else {

            for (Map<String, Object> prerequisite :
                    prerequisites) {

                analysis.append(
                        prerequisite.get("title")
                )
                .append(" — ")
                .append(
                        prerequisite.get(
                                "workflowStatus"
                        )
                )
                .append("\n");
            }
        }

        analysis.append("\nDOWNSTREAM IMPACT\n")
                .append(
                        affectedTasks.size()
                )
                .append(
                        " downstream task(s) affected."
                );

        return analysis.toString();
    }
}
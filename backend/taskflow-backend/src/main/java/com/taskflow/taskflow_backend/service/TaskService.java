package com.taskflow.taskflow_backend.service;

import com.taskflow.taskflow_backend.model.Dependency;
import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.model.WorkflowStatus;
import com.taskflow.taskflow_backend.repository.DependencyRepository;
import com.taskflow.taskflow_backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final DependencyRepository dependencyRepository;

    public TaskService(
            TaskRepository taskRepository,
            DependencyRepository dependencyRepository) {

        this.taskRepository = taskRepository;
        this.dependencyRepository = dependencyRepository;
    }

    // =========================================================
    // TASKS
    // =========================================================

    @Transactional
    public List<Task> getAllTasks() {

        refreshAllDerivedStatuses();

        return taskRepository.findAll();
    }

    @Transactional
    public Task createTask(Task task) {

        validateTask(task);

        if (task.getWorkflowStatus() == null) {
            task.setWorkflowStatus(WorkflowStatus.BACKLOG);
        }

        if (task.getDurationDays() == null) {
            task.setDurationDays(1);
        }

        if (task.getDurationDays() <= 0) {
            throw new RuntimeException(
                    "Duration must be greater than zero"
            );
        }

        if (task.getStartDate() != null) {

            task.setEndDate(
                    calculateEndDate(
                            task.getStartDate(),
                            task.getDurationDays()
                    )
            );

        } else {
            task.setEndDate(null);
        }

        Task saved = taskRepository.save(task);

        refreshAllDerivedStatuses();

        return saved;
    }

    @Transactional
    public Task updateTaskStatus(
            Long id,
            WorkflowStatus status) {

        Task task = findTask(id);

        if (status == null) {
            throw new RuntimeException(
                    "Status cannot be null"
            );
        }

        /*
         * BACKLOG is allowed as a manual status.
         *
         * After saving it, refreshAllDerivedStatuses()
         * decides whether the task should actually be
         * READY or BLOCKED according to dependencies.
         */
        task.setWorkflowStatus(status);

        taskRepository.save(task);

        /*
         * IMPORTANT:
         *
         * Recalculate the complete dependency graph in
         * prerequisite -> dependent order.
         */
        refreshAllDerivedStatuses();

        return findTask(id);
    }

    // =========================================================
    // SCHEDULING
    // =========================================================

    @Transactional
    public Task updateTaskSchedule(
            Long id,
            LocalDate startDate,
            Integer durationDays) {

        Task task = findTask(id);

        if (startDate == null) {
            throw new RuntimeException(
                    "Start date cannot be null"
            );
        }

        if (durationDays == null || durationDays <= 0) {
            throw new RuntimeException(
                    "Duration must be greater than zero"
            );
        }

        LocalDate actualStartDate = startDate;

        LocalDate latestPrerequisiteEnd =
                getLatestPrerequisiteEnd(task);

        if (latestPrerequisiteEnd != null) {

            LocalDate earliestAllowedStart =
                    latestPrerequisiteEnd.plusDays(1);

            if (actualStartDate.isBefore(
                    earliestAllowedStart)) {

                actualStartDate =
                        earliestAllowedStart;
            }
        }

        task.setStartDate(actualStartDate);

        task.setDurationDays(durationDays);

        task.setEndDate(
                calculateEndDate(
                        actualStartDate,
                        durationDays
                )
        );

        taskRepository.save(task);

        recalculateDownstreamTasks(id);

        return findTask(id);
    }

    private void recalculateDownstreamTasks(
            Long changedTaskId) {

        Set<Long> affectedTasks =
                collectDownstreamTasks(changedTaskId);

        if (affectedTasks.isEmpty()) {
            return;
        }

        Map<Long, Integer> indegree =
                new HashMap<>();

        for (Long taskId : affectedTasks) {
            indegree.put(taskId, 0);
        }

        for (Long taskId : affectedTasks) {

            List<Dependency> dependencies =
                    dependencyRepository
                            .findByDependentTaskId(taskId);

            for (Dependency dependency : dependencies) {

                Long prerequisiteId =
                        dependency
                                .getPrerequisiteTask()
                                .getId();

                if (affectedTasks.contains(prerequisiteId)) {

                    indegree.put(
                            taskId,
                            indegree.get(taskId) + 1
                    );
                }
            }
        }

        Queue<Long> queue =
                new LinkedList<>();

        /*
         * Start with nodes whose prerequisites outside
         * the affected subgraph are already resolved.
         */
        for (Map.Entry<Long, Integer> entry :
                indegree.entrySet()) {

            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            Task currentTask =
                    findTask(currentId);

            LocalDate latestPrerequisiteEnd =
                    getLatestPrerequisiteEnd(currentTask);

            if (latestPrerequisiteEnd != null) {

                Integer duration =
                        currentTask.getDurationDays();

                if (duration == null || duration <= 0) {

                    duration = 1;

                    currentTask.setDurationDays(
                            duration
                    );
                }

                LocalDate newStartDate =
                        latestPrerequisiteEnd.plusDays(1);

                LocalDate newEndDate =
                        calculateEndDate(
                                newStartDate,
                                duration
                        );

                currentTask.setStartDate(
                        newStartDate
                );

                currentTask.setEndDate(
                        newEndDate
                );

                taskRepository.save(currentTask);
            }

            List<Dependency> outgoing =
                    dependencyRepository
                            .findByPrerequisiteTaskId(
                                    currentId
                            );

            for (Dependency dependency : outgoing) {

                Long downstreamId =
                        dependency
                                .getDependentTask()
                                .getId();

                if (!affectedTasks.contains(
                        downstreamId)) {
                    continue;
                }

                int newIndegree =
                        indegree.get(downstreamId) - 1;

                indegree.put(
                        downstreamId,
                        newIndegree
                );

                if (newIndegree == 0) {
                    queue.add(downstreamId);
                }
            }
        }

        taskRepository.flush();
    }

    // =========================================================
    // DEPENDENCIES
    // =========================================================

    @Transactional
    public Map<String, Object> addDependency(
            Long dependentId,
            Long prerequisiteId) {

        if (dependentId.equals(prerequisiteId)) {

            throw new RuntimeException(
                    "A task cannot depend on itself."
            );
        }

        Task dependent =
                findTask(dependentId);

        Task prerequisite =
                findTask(prerequisiteId);

        Optional<Dependency> existing =
                dependencyRepository
                        .findByPrerequisiteTaskIdAndDependentTaskId(
                                prerequisiteId,
                                dependentId
                        );

        if (existing.isPresent()) {

            throw new RuntimeException(
                    "This dependency already exists."
            );
        }

        if (wouldCreateCycle(
                dependentId,
                prerequisiteId)) {

            throw new RuntimeException(
                    "Cannot add dependency because it would create a cycle."
            );
        }

        Dependency dependency =
                new Dependency();

        dependency.setPrerequisiteTask(
                prerequisite
        );

        dependency.setDependentTask(
                dependent
        );

        Dependency saved =
                dependencyRepository.save(dependency);

        synchronizeTaskScheduleFromPrerequisites(
                dependent
        );

        recalculateDownstreamTasks(
                prerequisiteId
        );

        refreshAllDerivedStatuses();

        return dependencyToMap(saved);
    }

    @Transactional
    public Map<String, Object> removeDependency(
            Long dependentId,
            Long prerequisiteId) {

        Dependency dependency =
                dependencyRepository
                        .findByPrerequisiteTaskIdAndDependentTaskId(
                                prerequisiteId,
                                dependentId
                        )
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Dependency not found."
                                )
                        );

        Map<String, Object> result =
                dependencyToMap(dependency);

        dependencyRepository.delete(dependency);

        Task dependent =
                findTask(dependentId);

        List<Dependency> remaining =
                dependencyRepository
                        .findByDependentTaskId(
                                dependentId
                        );

        if (remaining.isEmpty()
                && dependent.getWorkflowStatus()
                == WorkflowStatus.BLOCKED) {

            dependent.setWorkflowStatus(
                    WorkflowStatus.READY
            );

            taskRepository.save(dependent);
        }

        refreshAllDerivedStatuses();

        return result;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllDependencies() {

        List<Dependency> dependencies =
                dependencyRepository.findAll();

        List<Map<String, Object>> result =
                new ArrayList<>();

        for (Dependency dependency : dependencies) {
            result.add(
                    dependencyToMap(dependency)
            );
        }

        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTaskDependencies(
            Long taskId) {

        Task task = findTask(taskId);

        List<Map<String, Object>> prerequisites =
                new ArrayList<>();

        List<Dependency> incoming =
                dependencyRepository
                        .findByDependentTaskId(taskId);

        for (Dependency dependency : incoming) {

            prerequisites.add(
                    dependencyToMap(dependency)
            );
        }

        List<Map<String, Object>> dependents =
                new ArrayList<>();

        List<Dependency> outgoing =
                dependencyRepository
                        .findByPrerequisiteTaskId(taskId);

        for (Dependency dependency : outgoing) {

            dependents.add(
                    dependencyToMap(dependency)
            );
        }

        Map<String, Object> result =
                new LinkedHashMap<>();

        result.put("taskId", task.getId());
        result.put("title", task.getTitle());

        result.put(
                "prerequisites",
                prerequisites
        );

        result.put(
                "dependents",
                dependents
        );

        return result;
    }

    // =========================================================
    // CYCLE DETECTION
    // =========================================================

    private boolean wouldCreateCycle(
            Long dependentId,
            Long prerequisiteId) {

        Set<Long> visited =
                new HashSet<>();

        Queue<Long> queue =
                new LinkedList<>();

        queue.add(dependentId);

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            if (!visited.add(currentId)) {
                continue;
            }

            if (currentId.equals(prerequisiteId)) {
                return true;
            }

            List<Dependency> outgoing =
                    dependencyRepository
                            .findByPrerequisiteTaskId(
                                    currentId
                            );

            for (Dependency dependency : outgoing) {

                Long nextId =
                        dependency
                                .getDependentTask()
                                .getId();

                if (!visited.contains(nextId)) {
                    queue.add(nextId);
                }
            }
        }

        return false;
    }

    // =========================================================
    // AUTOMATIC READY / BLOCKED
    // =========================================================

    /**
     * Recalculates statuses in true dependency order.
     *
     * Example:
     *
     * Database Schema -> Backend API -> Integration Tests
     *
     * Database Schema is processed first.
     * Backend API is processed second.
     * Integration Tests is processed third.
     *
     * This prevents Integration Tests from looking at an
     * outdated Backend API status.
     */
    private void refreshAllDerivedStatuses() {

        List<Task> tasks =
                taskRepository.findAll();

        if (tasks.isEmpty()) {
            return;
        }

        Map<Long, Task> taskMap =
                new LinkedHashMap<>();

        for (Task task : tasks) {
            taskMap.put(
                    task.getId(),
                    task
            );
        }

        /*
         * indegree = number of prerequisites.
         */
        Map<Long, Integer> indegree =
                new HashMap<>();

        /*
         * adjacency:
         *
         * prerequisite -> dependents
         */
        Map<Long, List<Long>> adjacency =
                new HashMap<>();

        for (Task task : tasks) {

            indegree.put(
                    task.getId(),
                    0
            );

            adjacency.put(
                    task.getId(),
                    new ArrayList<>()
            );
        }

        List<Dependency> dependencies =
                dependencyRepository.findAll();

        for (Dependency dependency :
                dependencies) {

            Long prerequisiteId =
                    dependency
                            .getPrerequisiteTask()
                            .getId();

            Long dependentId =
                    dependency
                            .getDependentTask()
                            .getId();

            if (!taskMap.containsKey(prerequisiteId)
                    || !taskMap.containsKey(dependentId)) {
                continue;
            }

            adjacency
                    .get(prerequisiteId)
                    .add(dependentId);

            indegree.put(
                    dependentId,
                    indegree.get(dependentId) + 1
            );
        }

        /*
         * Kahn's algorithm.
         *
         * Every root task (no prerequisites) is processed first.
         * Then its dependents become eligible.
         */
        Queue<Long> queue =
                new LinkedList<>();

        for (Task task : tasks) {

            if (indegree.get(task.getId()) == 0) {
                queue.add(task.getId());
            }
        }

        Set<Long> processed =
                new HashSet<>();

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            if (!processed.add(currentId)) {
                continue;
            }

            Task currentTask =
                    taskMap.get(currentId);

            /*
             * Current task status is now reliable because all
             * of its prerequisites have already been processed.
             */
            updateDerivedStatus(
                    currentTask
            );

            List<Long> dependents =
                    adjacency.getOrDefault(
                            currentId,
                            Collections.emptyList()
                    );

            for (Long dependentId :
                    dependents) {

                int newIndegree =
                        indegree.get(dependentId) - 1;

                indegree.put(
                        dependentId,
                        newIndegree
                );

                if (newIndegree == 0) {
                    queue.add(dependentId);
                }
            }
        }

        /*
         * Cycles should never exist because addDependency()
         * rejects them.
         *
         * This fallback is only defensive. It does NOT
         * incorrectly mark unresolved nodes as READY.
         */
        if (processed.size() != tasks.size()) {

            for (Task task : tasks) {

                if (!processed.contains(task.getId())) {

                    task.setWorkflowStatus(
                            WorkflowStatus.BLOCKED
                    );

                    taskRepository.save(task);
                }
            }
        }

        taskRepository.flush();
    }

    /**
     * Calculates the status of ONE task.
     *
     * Rules:
     *
     * No prerequisites:
     *     keep manually selected status.
     *
     * Has prerequisites:
     *
     *     all DONE
     *          -> READY
     *
     *     one or more not DONE
     *          -> BLOCKED
     *
     * IN_PROGRESS / REVIEW / DONE are preserved only when
     * every prerequisite is DONE.
     */
    private boolean updateDerivedStatus(
            Task task) {

        List<Dependency> dependencies =
                dependencyRepository
                        .findByDependentTaskId(
                                task.getId()
                        );

        /*
         * No dependency means this is a root task.
         * Do not automatically change its status.
         */
        if (dependencies.isEmpty()) {
            return false;
        }

        boolean allDone =
                allPrerequisitesDone(task);

        WorkflowStatus current =
                task.getWorkflowStatus();

        WorkflowStatus target;

        if (!allDone) {

            /*
             * A dependent task can NEVER be READY,
             * IN_PROGRESS, REVIEW or DONE while one of
             * its prerequisites is unfinished.
             */
            target =
                    WorkflowStatus.BLOCKED;

        } else {

            /*
             * All prerequisites are DONE.
             *
             * If the task was already actively progressing
             * or completed, preserve that state.
             *
             * Otherwise it becomes READY.
             */
            if (current == WorkflowStatus.IN_PROGRESS
                    || current == WorkflowStatus.REVIEW
                    || current == WorkflowStatus.DONE) {

                target = current;

            } else {

                target =
                        WorkflowStatus.READY;
            }
        }

        if (current != target) {

            task.setWorkflowStatus(target);

            taskRepository.save(task);

            return true;
        }

        return false;
    }

    private boolean allPrerequisitesDone(
            Task task) {

        List<Dependency> dependencies =
                dependencyRepository
                        .findByDependentTaskId(
                                task.getId()
                        );

        if (dependencies.isEmpty()) {
            return true;
        }

        for (Dependency dependency :
                dependencies) {

            Task prerequisite =
                    dependency
                            .getPrerequisiteTask();

            if (prerequisite.getWorkflowStatus()
                    != WorkflowStatus.DONE) {

                return false;
            }
        }

        return true;
    }

    // =========================================================
    // DOWNSTREAM IMPACT
    // =========================================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getImpact(
            Long taskId) {

        Task root =
                findTask(taskId);

        Map<Long, Integer> levels =
                collectDownstreamLevels(taskId);

        List<Map.Entry<Long, Integer>> entries =
                new ArrayList<>(
                        levels.entrySet()
                );

        entries.sort(
                Comparator
                        .comparing(
                                Map.Entry<Long, Integer>::getValue
                        )
                        .thenComparing(
                                Map.Entry::getKey
                        )
        );

        List<Map<String, Object>> result =
                new ArrayList<>();

        for (Map.Entry<Long, Integer> entry :
                entries) {

            Task task =
                    findTask(entry.getKey());

            int level =
                    entry.getValue();

            Map<String, Object> impact =
                    new LinkedHashMap<>();

            impact.put(
                    "taskId",
                    task.getId()
            );

            impact.put(
                    "title",
                    task.getTitle()
            );

            impact.put(
                    "dependsOn",
                    root.getTitle()
            );

            impact.put(
                    "impactLevel",
                    level
            );

            impact.put(
                    "impactType",
                    level == 1
                            ? "DIRECT"
                            : "INDIRECT"
            );

            impact.put(
                    "currentStartDate",
                    task.getStartDate()
            );

            impact.put(
                    "currentEndDate",
                    task.getEndDate()
            );

            impact.put(
                    "durationDays",
                    task.getDurationDays()
            );

            impact.put(
                    "workflowStatus",
                    task.getWorkflowStatus()
            );

            result.add(impact);
        }

        return result;
    }

    private Map<Long, Integer>
    collectDownstreamLevels(Long rootId) {

        Map<Long, Integer> levels =
                new LinkedHashMap<>();

        Queue<Long> queue =
                new LinkedList<>();

        Map<Long, Integer> distance =
                new HashMap<>();

        queue.add(rootId);

        distance.put(rootId, 0);

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            int currentLevel =
                    distance.get(currentId);

            List<Dependency> outgoing =
                    dependencyRepository
                            .findByPrerequisiteTaskId(
                                    currentId
                            );

            for (Dependency dependency :
                    outgoing) {

                Long downstreamId =
                        dependency
                                .getDependentTask()
                                .getId();

                int nextLevel =
                        currentLevel + 1;

                if (!distance.containsKey(
                        downstreamId)) {

                    distance.put(
                            downstreamId,
                            nextLevel
                    );

                    levels.put(
                            downstreamId,
                            nextLevel
                    );

                    queue.add(downstreamId);
                }
            }
        }

        return levels;
    }

    private Set<Long> collectDownstreamTasks(
            Long taskId) {

        Set<Long> visited =
                new LinkedHashSet<>();

        Queue<Long> queue =
                new LinkedList<>();

        queue.add(taskId);

        while (!queue.isEmpty()) {

            Long currentId =
                    queue.poll();

            List<Dependency> dependencies =
                    dependencyRepository
                            .findByPrerequisiteTaskId(
                                    currentId
                            );

            for (Dependency dependency :
                    dependencies) {

                Long downstreamId =
                        dependency
                                .getDependentTask()
                                .getId();

                if (visited.add(downstreamId)) {
                    queue.add(downstreamId);
                }
            }
        }

        return visited;
    }

    // =========================================================
    // SCHEDULE HELPERS
    // =========================================================

    private void synchronizeTaskScheduleFromPrerequisites(
            Task task) {

        LocalDate latestPrerequisiteEnd =
                getLatestPrerequisiteEnd(task);

        if (latestPrerequisiteEnd == null) {
            return;
        }

        Integer duration =
                task.getDurationDays();

        if (duration == null || duration <= 0) {

            duration = 1;

            task.setDurationDays(duration);
        }

        LocalDate requiredStart =
                latestPrerequisiteEnd.plusDays(1);

        if (task.getStartDate() == null
                || task.getStartDate()
                .isBefore(requiredStart)) {

            task.setStartDate(requiredStart);

            task.setEndDate(
                    calculateEndDate(
                            requiredStart,
                            duration
                    )
            );

            taskRepository.save(task);
        }
    }

    private LocalDate getLatestPrerequisiteEnd(
            Task task) {

        List<Dependency> dependencies =
                dependencyRepository
                        .findByDependentTaskId(
                                task.getId()
                        );

        LocalDate latest = null;

        for (Dependency dependency :
                dependencies) {

            Task prerequisite =
                    dependency
                            .getPrerequisiteTask();

            LocalDate end =
                    prerequisite.getEndDate();

            if (end == null) {
                continue;
            }

            if (latest == null
                    || end.isAfter(latest)) {

                latest = end;
            }
        }

        return latest;
    }

    // =========================================================
    // RESPONSE HELPERS
    // =========================================================

    private Map<String, Object> dependencyToMap(
            Dependency dependency) {

        Map<String, Object> result =
                new LinkedHashMap<>();

        Task prerequisite =
                dependency.getPrerequisiteTask();

        Task dependent =
                dependency.getDependentTask();

        result.put(
                "id",
                dependency.getId()
        );

        result.put(
                "prerequisiteTaskId",
                prerequisite.getId()
        );

        result.put(
                "prerequisiteTitle",
                prerequisite.getTitle()
        );

        result.put(
                "dependentTaskId",
                dependent.getId()
        );

        result.put(
                "dependentTitle",
                dependent.getTitle()
        );

        return result;
    }

    // =========================================================
    // COMMON HELPERS
    // =========================================================

    private Task findTask(Long id) {

        return taskRepository
                .findById(id)
                .orElseThrow(() ->
                        new RuntimeException(
                                "Task not found: " + id
                        )
                );
    }

    private LocalDate calculateEndDate(
            LocalDate startDate,
            Integer durationDays) {

        return startDate.plusDays(
                durationDays - 1L
        );
    }

    private void validateTask(Task task) {

        if (task.getTitle() == null
                || task.getTitle()
                .trim()
                .isEmpty()) {

            throw new RuntimeException(
                    "Task title cannot be empty"
            );
        }

        if (task.getDurationDays() != null
                && task.getDurationDays() <= 0) {

            throw new RuntimeException(
                    "Duration must be greater than zero"
            );
        }

        if (task.getStartDate() != null
                && task.getEndDate() != null
                && task.getEndDate()
                .isBefore(task.getStartDate())) {

            throw new RuntimeException(
                    "End date cannot be before start date"
            );
        }
    }
}
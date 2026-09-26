package com.taskflow.taskflow_backend.service;

import com.taskflow.taskflow_backend.model.Dependency;
import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.repository.DependencyRepository;
import com.taskflow.taskflow_backend.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class DependencyService {

    private final DependencyRepository dependencyRepository;
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    public DependencyService(
            DependencyRepository dependencyRepository,
            TaskRepository taskRepository,
            TaskService taskService) {

        this.dependencyRepository =
                dependencyRepository;

        this.taskRepository =
                taskRepository;

        this.taskService =
                taskService;
    }

    // =========================================================
    // CREATE DEPENDENCY
    // =========================================================

    @Transactional
    public Dependency createDependency(
            Long prerequisiteId,
            Long dependentId) {

        Task prerequisite =
                taskRepository
                        .findById(prerequisiteId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Prerequisite task not found"
                                ));

        Task dependent =
                taskRepository
                        .findById(dependentId)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Dependent task not found"
                                ));

        // Self dependency
        if (prerequisiteId.equals(
                dependentId)) {

            throw new RuntimeException(
                    "A task cannot depend on itself"
            );
        }

        // Duplicate dependency
        List<Dependency> existing =
                dependencyRepository
                        .findByDependentTaskId(
                                dependentId
                        );

        for (Dependency dependency :
                existing) {

            if (dependency
                    .getPrerequisiteTask()
                    .getId()
                    .equals(prerequisiteId)) {

                throw new RuntimeException(
                        "Dependency already exists"
                );
            }
        }

        // Cycle detection
        if (createsCycle(
                prerequisiteId,
                dependentId)) {

            throw new RuntimeException(
                    "Dependency would create a cycle"
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
                dependencyRepository.save(
                        dependency
                );

        /*
         * Recalculate the board after
         * adding a dependency.
         */
        taskService.updateTaskStatus(
                dependentId,
                dependent.getWorkflowStatus()
        );

        return saved;
    }

    // =========================================================
    // CYCLE DETECTION
    // =========================================================

    private boolean createsCycle(
            Long prerequisiteId,
            Long dependentId) {

        Set<Long> visited =
                new HashSet<>();

        /*
         * To add:
         *
         * A -> B
         *
         * We check whether B can already
         * reach A.
         *
         * If yes, adding A -> B creates a cycle.
         */
        return canReach(
                dependentId,
                prerequisiteId,
                visited
        );
    }

    private boolean canReach(
            Long currentTaskId,
            Long targetTaskId,
            Set<Long> visited) {

        if (currentTaskId.equals(
                targetTaskId)) {

            return true;
        }

        if (!visited.add(currentTaskId)) {
            return false;
        }

        List<Dependency> dependencies =
                dependencyRepository
                        .findByPrerequisiteTaskId(
                                currentTaskId
                        );

        for (Dependency dependency :
                dependencies) {

            Long nextTaskId =
                    dependency
                            .getDependentTask()
                            .getId();

            if (canReach(
                    nextTaskId,
                    targetTaskId,
                    visited)) {

                return true;
            }
        }

        return false;
    }

    // =========================================================
    // GET ALL DEPENDENCIES
    // =========================================================

    public List<Dependency> getAllDependencies() {

        return dependencyRepository.findAll();
    }

    // =========================================================
    // DELETE DEPENDENCY
    // =========================================================

    @Transactional
    public void deleteDependency(Long id) {

        Dependency dependency =
                dependencyRepository
                        .findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Dependency not found"
                                ));

        Long dependentId =
                dependency
                        .getDependentTask()
                        .getId();

        dependencyRepository.delete(
                dependency
        );

        dependencyRepository.flush();

        /*
         * After removing a dependency,
         * the dependent task may become
         * READY or manually manageable again.
         */
        Task dependent =
                taskRepository
                        .findById(dependentId)
                        .orElse(null);

        if (dependent != null) {

            taskService.updateTaskStatus(
                    dependentId,
                    dependent.getWorkflowStatus()
            );
        }
    }
}
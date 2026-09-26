package com.taskflow.taskflow_backend.service;

import com.taskflow.taskflow_backend.model.Dependency;
import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.repository.DependencyRepository;
import com.taskflow.taskflow_backend.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DependencyServiceTest {

    @Mock
    private DependencyRepository dependencyRepository;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private TaskService taskService;

    @InjectMocks
    private DependencyService dependencyService;


    @Test
    void shouldCreateDependency() {

        Task prerequisite = new Task();
        prerequisite.setTitle("Database Schema");

        Task dependent = new Task();
        dependent.setTitle("Backend API");

        when(taskRepository.findById(1L))
                .thenReturn(Optional.of(prerequisite));

        when(taskRepository.findById(2L))
                .thenReturn(Optional.of(dependent));

        when(dependencyRepository
                .findByDependentTaskId(2L))
                .thenReturn(Collections.emptyList());

        when(dependencyRepository
                .findByPrerequisiteTaskId(2L))
                .thenReturn(Collections.emptyList());

        Dependency dependency = new Dependency();

        dependency.setPrerequisiteTask(prerequisite);
        dependency.setDependentTask(dependent);

        when(dependencyRepository
                .save(any(Dependency.class)))
                .thenReturn(dependency);

        Dependency result =
                dependencyService.createDependency(
                        1L,
                        2L
                );

        assertNotNull(result);

        assertEquals(
                prerequisite,
                result.getPrerequisiteTask()
        );

        assertEquals(
                dependent,
                result.getDependentTask()
        );

        verify(dependencyRepository)
                .save(any(Dependency.class));

        verify(taskService)
                .updateTaskStatus(
                        eq(2L),
                        eq(dependent.getWorkflowStatus())
                );
    }


    @Test
    void shouldRejectSelfDependency() {

        assertThrows(
                RuntimeException.class,
                () -> dependencyService.createDependency(
                        1L,
                        1L
                )
        );

        verify(
                dependencyRepository,
                never()
        ).save(any(Dependency.class));
    }


    @Test
    void shouldRejectDuplicateDependency() {

        Task prerequisite = new Task();
        prerequisite.setTitle("Database Schema");

        Task dependent = new Task();
        dependent.setTitle("Backend API");

        when(taskRepository.findById(1L))
                .thenReturn(Optional.of(prerequisite));

        when(taskRepository.findById(2L))
                .thenReturn(Optional.of(dependent));

        Dependency existingDependency =
                new Dependency();

        existingDependency.setPrerequisiteTask(
                prerequisite
        );

        existingDependency.setDependentTask(
                dependent
        );

        when(dependencyRepository
                .findByDependentTaskId(2L))
                .thenReturn(
                        Collections.singletonList(
                                existingDependency
                        )
                );

        assertThrows(
                RuntimeException.class,
                () -> dependencyService.createDependency(
                        1L,
                        2L
                )
        );

        verify(
                dependencyRepository,
                never()
        ).save(any(Dependency.class));
    }


    @Test
    void shouldRejectCycle() {

        Task task1 = new Task();
        task1.setTitle("Task A");

        Task task2 = new Task();
        task2.setTitle("Task B");

        when(taskRepository.findById(1L))
                .thenReturn(Optional.of(task1));

        when(taskRepository.findById(2L))
                .thenReturn(Optional.of(task2));

        when(dependencyRepository
                .findByDependentTaskId(2L))
                .thenReturn(Collections.emptyList());

        Dependency existingDependency =
                new Dependency();

        existingDependency.setPrerequisiteTask(task2);
        existingDependency.setDependentTask(task1);

        when(dependencyRepository
                .findByPrerequisiteTaskId(2L))
                .thenReturn(
                        Collections.singletonList(
                                existingDependency
                        )
                );

        assertThrows(
                RuntimeException.class,
                () -> dependencyService.createDependency(
                        1L,
                        2L
                )
        );

        verify(
                dependencyRepository,
                never()
        ).save(any(Dependency.class));
    }
}


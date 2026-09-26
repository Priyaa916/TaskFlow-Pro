package com.taskflow.taskflow_backend.service;

import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.model.WorkflowStatus;
import com.taskflow.taskflow_backend.repository.DependencyRepository;
import com.taskflow.taskflow_backend.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private DependencyRepository dependencyRepository;

    @InjectMocks
    private TaskService taskService;


    @Test
    void shouldCreateTask() {

        Task task = new Task();

        task.setTitle("Database Schema");
        task.setDescription("Create database schema");
        task.setWorkflowStatus(WorkflowStatus.BACKLOG);
        task.setBoardPosition(1);
        task.setDurationDays(3);

        when(taskRepository.save(any(Task.class)))
                .thenReturn(task);

        Task result =
                taskService.createTask(task);

        assertNotNull(result);

        assertEquals(
                "Database Schema",
                result.getTitle()
        );

        verify(taskRepository)
                .save(any(Task.class));
    }


    @Test
    void shouldUpdateTaskStatus() {

        Task task = new Task();

        task.setTitle("Backend API");
        task.setWorkflowStatus(
                WorkflowStatus.READY
        );

        when(taskRepository.findById(1L))
                .thenReturn(Optional.of(task));

        when(taskRepository.save(any(Task.class)))
                .thenReturn(task);

        Task result =
                taskService.updateTaskStatus(
                        1L,
                        WorkflowStatus.IN_PROGRESS
                );

        assertEquals(
                WorkflowStatus.IN_PROGRESS,
                result.getWorkflowStatus()
        );

        verify(taskRepository)
                .save(any(Task.class));
    }


    @Test
    void shouldUpdateSchedule() {

        Task task = new Task();

        task.setTitle("Database Schema");
        task.setDurationDays(3);
        task.setWorkflowStatus(
                WorkflowStatus.IN_PROGRESS
        );

        when(taskRepository.findById(1L))
                .thenReturn(Optional.of(task));

        when(dependencyRepository
                .findByPrerequisiteTaskId(1L))
                .thenReturn(Collections.emptyList());

        when(taskRepository.save(any(Task.class)))
                .thenReturn(task);

        Task result =
                taskService.updateTaskSchedule(
                        1L,
                        LocalDate.of(2026, 9, 28),
                        3
                );

        assertNotNull(result);

        assertEquals(
                LocalDate.of(2026, 9, 28),
                result.getStartDate()
        );

        assertEquals(
                LocalDate.of(2026, 9, 30),
                result.getEndDate()
        );
    }
}
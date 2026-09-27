package com.taskflow.taskflow_backend.controller;

import com.taskflow.taskflow_backend.model.Task;
import com.taskflow.taskflow_backend.model.WorkflowStatus;
import com.taskflow.taskflow_backend.service.TaskService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "https://taskflow-pro-rho-three.vercel.app"
})
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    // =========================================================
    // TASKS
    // =========================================================

    @GetMapping
    public List<Task> getAllTasks() {
        return taskService.getAllTasks();
    }

    @PostMapping
    public Task createTask(
            @RequestBody Task task) {

        return taskService.createTask(task);
    }

    @PatchMapping("/{id}/status")
    public Task updateTaskStatus(
            @PathVariable Long id,
            @RequestParam WorkflowStatus status) {

        return taskService.updateTaskStatus(
                id,
                status
        );
    }

    @PatchMapping("/{id}/schedule")
    public Task updateTaskSchedule(
            @PathVariable Long id,
            @RequestParam LocalDate startDate,
            @RequestParam Integer durationDays) {

        return taskService.updateTaskSchedule(
                id,
                startDate,
                durationDays
        );
    }

    // =========================================================
    // DEPENDENCIES
    // =========================================================

    @GetMapping("/dependencies")
    public List<Map<String, Object>> getAllDependencies() {
        return taskService.getAllDependencies();
    }

    @GetMapping("/{id}/dependencies")
    public Map<String, Object> getTaskDependencies(
            @PathVariable Long id) {

        return taskService.getTaskDependencies(id);
    }

    @PostMapping("/{dependentId}/dependencies/{prerequisiteId}")
    public Map<String, Object> addDependency(
            @PathVariable Long dependentId,
            @PathVariable Long prerequisiteId) {

        return taskService.addDependency(
                dependentId,
                prerequisiteId
        );
    }

    @DeleteMapping("/{dependentId}/dependencies/{prerequisiteId}")
    public Map<String, Object> removeDependency(
            @PathVariable Long dependentId,
            @PathVariable Long prerequisiteId) {

        return taskService.removeDependency(
                dependentId,
                prerequisiteId
        );
    }

    // =========================================================
    // IMPACT
    // =========================================================

    @GetMapping("/{id}/impact")
    public List<Map<String, Object>> getImpact(
            @PathVariable Long id) {

        return taskService.getImpact(id);
    }

    // =========================================================
    // ERROR HANDLING
    // =========================================================

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>>
    handleRuntimeException(RuntimeException exception) {

        return ResponseEntity
                .status(HttpStatus.BAD_REQUEST)
                .body(
                        Map.of(
                                "message",
                                exception.getMessage()
                        )
                );
    }
}
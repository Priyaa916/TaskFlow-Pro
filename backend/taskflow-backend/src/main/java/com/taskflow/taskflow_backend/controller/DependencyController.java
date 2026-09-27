package com.taskflow.taskflow_backend.controller;

import com.taskflow.taskflow_backend.model.Dependency;
import com.taskflow.taskflow_backend.service.DependencyService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dependencies")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "https://taskflow-pro-rho-three.vercel.app"
})
public class DependencyController {

    private final DependencyService dependencyService;

    public DependencyController(
            DependencyService dependencyService) {

        this.dependencyService =
                dependencyService;
    }

    // =========================
    // CREATE
    // =========================

    @PostMapping
    public Dependency createDependency(
            @RequestParam Long prerequisiteId,
            @RequestParam Long dependentId) {

        return dependencyService.createDependency(
                prerequisiteId,
                dependentId
        );
    }

    // =========================
    // GET ALL
    // =========================

    @GetMapping
    public List<Dependency> getAllDependencies() {

        return dependencyService
                .getAllDependencies();
    }

    // =========================
    // DELETE
    // =========================

    @DeleteMapping("/{id}")
    public void deleteDependency(
            @PathVariable Long id) {

        dependencyService.deleteDependency(id);
    }
}
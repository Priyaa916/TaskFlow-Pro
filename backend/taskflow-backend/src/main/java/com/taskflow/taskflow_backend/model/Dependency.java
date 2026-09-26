package com.taskflow.taskflow_backend.model;

import jakarta.persistence.*;

@Entity
@Table(
        name = "dependencies",
        uniqueConstraints = {
                @UniqueConstraint(
                        columnNames = {
                                "prerequisite_task_id",
                                "dependent_task_id"
                        }
                )
        },
        indexes = {
                @Index(
                        name = "idx_dependency_prerequisite",
                        columnList = "prerequisite_task_id"
                ),
                @Index(
                        name = "idx_dependency_dependent",
                        columnList = "dependent_task_id"
                )
        }
)
public class Dependency {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(
            name = "prerequisite_task_id",
            nullable = false
    )
    private Task prerequisiteTask;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(
            name = "dependent_task_id",
            nullable = false
    )
    private Task dependentTask;

    public Dependency() {
    }

    public Long getId() {
        return id;
    }

    public Task getPrerequisiteTask() {
        return prerequisiteTask;
    }

    public void setPrerequisiteTask(Task prerequisiteTask) {
        this.prerequisiteTask = prerequisiteTask;
    }

    public Task getDependentTask() {
        return dependentTask;
    }

    public void setDependentTask(Task dependentTask) {
        this.dependentTask = dependentTask;
    }
}
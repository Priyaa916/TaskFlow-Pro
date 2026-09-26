package com.taskflow.taskflow_backend.repository;

import com.taskflow.taskflow_backend.model.Dependency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DependencyRepository
        extends JpaRepository<Dependency, Long> {

    List<Dependency> findByPrerequisiteTaskId(Long prerequisiteId);

    List<Dependency> findByDependentTaskId(Long dependentId);

    Optional<Dependency> findByPrerequisiteTaskIdAndDependentTaskId(
            Long prerequisiteId,
            Long dependentId
    );
}
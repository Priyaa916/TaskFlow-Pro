package com.taskflow.taskflow_backend.controller;

import com.taskflow.taskflow_backend.service.AIService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(origins = "http://localhost:5173")
public class AIController {

    private final AIService aiService;

    public AIController(AIService aiService) {
        this.aiService = aiService;
    }

    @PostMapping("/analyze")
    public Map<String, Object> analyze(
            @RequestBody Map<String, String> request) {

        String question =
                request.getOrDefault("question", "");

        return aiService.analyze(question);
    }
}

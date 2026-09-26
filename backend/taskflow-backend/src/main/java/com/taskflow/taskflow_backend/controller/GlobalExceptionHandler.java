package com.taskflow.taskflow_backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String, String> handleRuntimeException(
            RuntimeException exception) {

        String message =
                exception.getMessage();

        if (message == null ||
                message.trim().isEmpty()) {

            message = "Request could not be processed";
        }

        return Map.of(
                "error",
                message
        );
    }
}




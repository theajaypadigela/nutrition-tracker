package com.habitbuilder.NutritionTracker.modules.auth.service;

public class UserAlreadyExistsException extends RuntimeException {

    public UserAlreadyExistsException() {
        super("Account already exists");
    }
}

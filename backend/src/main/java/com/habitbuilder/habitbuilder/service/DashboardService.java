package com.habitbuilder.habitbuilder.service;

import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    public String getDashboardData() {
        return "Hello from DashboardService";
    }

    public String getDashboardData(String date) {
        return "Hello from DashboardService Date: " + date;
    }
}

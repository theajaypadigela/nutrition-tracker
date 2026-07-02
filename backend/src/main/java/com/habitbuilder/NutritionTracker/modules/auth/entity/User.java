package com.habitbuilder.NutritionTracker.modules.auth.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.util.Collection;
import java.util.List;

@Document(collection = "users")
@Getter
@Setter
public class User implements UserDetails {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String password;

    private String name;

    /** Legacy numeric age, kept as a fallback for accounts created before DOB capture. */
    private String age;

    /** Date of birth in ISO {@code yyyy-MM-dd}. New source of truth for age. */
    private String dob;

    private String gender;

    private String role;

    /** IANA timezone id (e.g. "America/New_York"), sent by the client. Used to make
     *  server-side "today" computations timezone-aware near midnight / across zones. */
    private String timezone;

    private boolean enabled = true;

    private LocalDateTime createdAt = LocalDateTime.now();

    /**
     * Age in whole years, derived at runtime. Prefers {@link #dob} (ISO {@code yyyy-MM-dd});
     * falls back to the legacy {@link #age} field for accounts created before DOB capture.
     * Returns {@code null} when neither is usable.
     */
    public Integer getDerivedAge() {
        if (dob != null && !dob.isBlank()) {
            try {
                return Period.between(LocalDate.parse(dob.trim()), LocalDate.now()).getYears();
            } catch (Exception ignored) {
                // fall through to legacy age
            }
        }
        if (age != null && !age.isBlank()) {
            try {
                return Integer.parseInt(age.trim());
            } catch (Exception ignored) {
                // not a number
            }
        }
        return null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role));
    }

    @Override
    public String getUsername() {
        return email;
    }

    @JsonIgnore
    @Override
    public String getPassword() {
        return password;
    }

}

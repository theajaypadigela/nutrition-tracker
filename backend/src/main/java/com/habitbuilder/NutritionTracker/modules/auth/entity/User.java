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

import java.time.LocalDateTime;
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

    private String age;

    private String gender;

    private String role;

    /** IANA timezone id (e.g. "America/New_York"), sent by the client. Used to make
     *  server-side "today" computations timezone-aware near midnight / across zones. */
    private String timezone;

    private boolean enabled = true;

    private LocalDateTime createdAt = LocalDateTime.now();

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

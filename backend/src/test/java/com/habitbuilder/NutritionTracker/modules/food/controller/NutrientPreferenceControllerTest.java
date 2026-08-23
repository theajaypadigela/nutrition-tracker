package com.habitbuilder.NutritionTracker.modules.food.controller;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import com.habitbuilder.NutritionTracker.modules.food.dto.NutrientPreferenceResponse;
import com.habitbuilder.NutritionTracker.modules.food.service.NutrientPreferenceService;
import com.habitbuilder.NutritionTracker.support.ControllerSliceTest;

@ControllerSliceTest(NutrientPreferenceController.class)
class NutrientPreferenceControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NutrientPreferenceService nutrientPreferenceService;

    @Test
    void pinsTheNutrientNamedInThePath() throws Exception {
        when(nutrientPreferenceService.togglePin("iron"))
                .thenReturn(NutrientPreferenceResponse.builder()
                        .nutrientId("iron")
                        .pinned(true)
                        .customTarget(18.5)
                        .avoidedFoods(List.of())
                        .build());

        mockMvc.perform(post("/food/nutrient/iron/pin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrientId").value("iron"))
                .andExpect(jsonPath("$.pinned").value(true))
                .andExpect(jsonPath("$.customTarget").value(18.5))
                .andExpect(jsonPath("$.avoidedFoods").isArray());

        verify(nutrientPreferenceService).togglePin("iron");
    }

    @Test
    void setsTheCustomTargetCarriedByTheRequestBody() throws Exception {
        when(nutrientPreferenceService.setCustomTarget("iron", 18.5))
                .thenReturn(NutrientPreferenceResponse.builder()
                        .nutrientId("iron")
                        .pinned(false)
                        .customTarget(18.5)
                        .avoidedFoods(List.of())
                        .build());

        mockMvc.perform(put("/food/nutrient/iron/target")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"target\":18.5}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrientId").value("iron"))
                .andExpect(jsonPath("$.pinned").value(false))
                .andExpect(jsonPath("$.customTarget").value(18.5));

        verify(nutrientPreferenceService).setCustomTarget("iron", 18.5);
    }

    /**
     * Pinned, not endorsed: {@code SetTargetRequest} carries no validation annotation, so a
     * body without a target binds to a null {@code Double} and is handed to the service as a
     * request to clear the custom target rather than rejected as a 400.
     */
    @Test
    void acceptsABodyWithNoTargetAndPassesNullThrough() throws Exception {
        when(nutrientPreferenceService.setCustomTarget("iron", null))
                .thenReturn(NutrientPreferenceResponse.builder()
                        .nutrientId("iron")
                        .pinned(false)
                        .customTarget(null)
                        .avoidedFoods(List.of())
                        .build());

        mockMvc.perform(put("/food/nutrient/iron/target")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrientId").value("iron"))
                .andExpect(jsonPath("$.customTarget").isEmpty());

        verify(nutrientPreferenceService).setCustomTarget("iron", null);
    }

    @Test
    void setsTheAvoidedFoodsCarriedByTheRequestBody() throws Exception {
        when(nutrientPreferenceService.setAvoidedFoods("sodium", List.of("chips", "soy sauce")))
                .thenReturn(NutrientPreferenceResponse.builder()
                        .nutrientId("sodium")
                        .pinned(false)
                        .customTarget(null)
                        .avoidedFoods(List.of("chips", "soy sauce"))
                        .build());

        mockMvc.perform(put("/food/nutrient/sodium/avoid")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"foods\":[\"chips\",\"soy sauce\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nutrientId").value("sodium"))
                .andExpect(jsonPath("$.avoidedFoods").isArray())
                .andExpect(jsonPath("$.avoidedFoods[0]").value("chips"))
                .andExpect(jsonPath("$.avoidedFoods[1]").value("soy sauce"))
                .andExpect(jsonPath("$.avoidedFoods[2]").doesNotExist());

        verify(nutrientPreferenceService).setAvoidedFoods("sodium", List.of("chips", "soy sauce"));
    }

    /**
     * {@code /preferences} is a literal sibling of the {@code /{nutrientId}/...} routes, so the
     * assertion worth making is the one about routing: the list endpoint answers with the array
     * and no request is read as a nutrient id.
     */
    @Test
    void listsPreferencesAtItsOwnPathRatherThanThroughTheNutrientIdPattern() throws Exception {
        when(nutrientPreferenceService.getPreferences())
                .thenReturn(List.of(
                        NutrientPreferenceResponse.builder()
                                .nutrientId("iron")
                                .pinned(true)
                                .customTarget(18.5)
                                .avoidedFoods(List.of())
                                .build(),
                        NutrientPreferenceResponse.builder()
                                .nutrientId("sodium")
                                .pinned(false)
                                .customTarget(null)
                                .avoidedFoods(List.of("chips"))
                                .build()));

        mockMvc.perform(get("/food/nutrient/preferences"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].nutrientId").value("iron"))
                .andExpect(jsonPath("$[0].pinned").value(true))
                .andExpect(jsonPath("$[0].customTarget").value(18.5))
                .andExpect(jsonPath("$[0].avoidedFoods").isArray())
                .andExpect(jsonPath("$[1].nutrientId").value("sodium"))
                .andExpect(jsonPath("$[1].customTarget").isEmpty())
                .andExpect(jsonPath("$[1].avoidedFoods[0]").value("chips"))
                .andExpect(jsonPath("$[2]").doesNotExist());

        verify(nutrientPreferenceService).getPreferences();
        verify(nutrientPreferenceService, never()).togglePin(anyString());
    }

    /**
     * The controller has no authentication branch of its own; the 401 the client sees comes
     * from the service asking {@code CurrentUserProvider} for a user, so what is pinned here is
     * that {@code GlobalExceptionHandler} passes that status and reason through unchanged.
     */
    @Test
    void surfacesTheServicesResponseStatusExceptionWithItsOwnStatusAndReason() throws Exception {
        when(nutrientPreferenceService.getPreferences())
                .thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated"));

        mockMvc.perform(get("/food/nutrient/preferences"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("User not authenticated"))
                .andExpect(jsonPath("$.timestamp").exists());
    }
}

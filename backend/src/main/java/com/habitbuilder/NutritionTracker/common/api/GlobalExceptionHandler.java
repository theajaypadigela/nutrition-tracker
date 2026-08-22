package com.habitbuilder.NutritionTracker.common.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.lang.Nullable;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.habitbuilder.NutritionTracker.modules.auth.service.UserAlreadyExistsException;

import jakarta.validation.ConstraintViolationException;

/**
 * The single error model for the API: {@code {status, code, message}}, with no internal
 * exception messages in the body.
 *
 * <p>It extends {@link ResponseEntityExceptionHandler} so the statuses Spring MVC already
 * derives for its own exceptions (400, 404, 405, 415, …) survive. Without that, the
 * {@code Exception} catch-all below would shadow them and report every malformed request
 * as a 500.
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private static final String VALIDATION_MESSAGE = "Request validation failed";

    @ExceptionHandler(UserAlreadyExistsException.class)
    ResponseEntity<ApiError> handleRegistrationConflict(UserAlreadyExistsException exception) {
        return error(HttpStatus.CONFLICT, "ACCOUNT_EXISTS", "An account with this email already exists");
    }

    @ExceptionHandler(BadCredentialsException.class)
    ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException exception) {
        return error(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    /** Raised by {@code @Validated} beans; the MVC validation exceptions go through the base class. */
    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", VALIDATION_MESSAGE);
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiError> handleResponseStatus(ResponseStatusException exception) {
        HttpStatus status = resolve(exception.getStatusCode());
        return error(status, codeFor(status), publicMessageFor(status));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", publicMessageFor(HttpStatus.BAD_REQUEST));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpectedFailure(Exception exception) {
        log.error("Unhandled request failure: errorType={}", exception.getClass().getSimpleName());
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "An unexpected error occurred");
    }

    /**
     * Every exception the base class handles funnels through here, so the framework keeps
     * choosing the status while this class keeps owning the body.
     */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception exception,
            @Nullable Object body,
            HttpHeaders headers,
            HttpStatusCode statusCode,
            WebRequest request) {

        HttpStatus status = resolve(statusCode);
        if (status.is5xxServerError()) {
            log.error("Unhandled request failure: errorType={}", exception.getClass().getSimpleName());
        }
        String message = isValidationFailure(exception) ? VALIDATION_MESSAGE : publicMessageFor(status);
        ApiError apiError = new ApiError(status.value(), codeFor(status), message);
        return super.handleExceptionInternal(exception, apiError, headers, status, request);
    }

    private boolean isValidationFailure(Exception exception) {
        return exception instanceof BindException
                || exception instanceof HandlerMethodValidationException
                || exception instanceof HttpMessageNotReadableException;
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status)
                .body(new ApiError(status.value(), code, message));
    }

    private HttpStatus resolve(HttpStatusCode statusCode) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        return status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
    }

    private String codeFor(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "INVALID_REQUEST";
            case UNAUTHORIZED -> "UNAUTHENTICATED";
            case FORBIDDEN -> "ACCESS_DENIED";
            case NOT_FOUND -> "NOT_FOUND";
            case METHOD_NOT_ALLOWED -> "METHOD_NOT_ALLOWED";
            case NOT_ACCEPTABLE -> "NOT_ACCEPTABLE";
            case CONFLICT -> "CONFLICT";
            case UNSUPPORTED_MEDIA_TYPE -> "UNSUPPORTED_MEDIA_TYPE";
            case PAYLOAD_TOO_LARGE -> "PAYLOAD_TOO_LARGE";
            default -> status.is5xxServerError() ? "INTERNAL_ERROR" : "REQUEST_FAILED";
        };
    }

    private String publicMessageFor(HttpStatus status) {
        return switch (status) {
            case BAD_REQUEST -> "The request is invalid";
            case UNAUTHORIZED -> "Authentication is required";
            case FORBIDDEN -> "Access is denied";
            case NOT_FOUND -> "The requested resource was not found";
            case METHOD_NOT_ALLOWED -> "The request method is not supported";
            case NOT_ACCEPTABLE -> "The requested representation is not available";
            case CONFLICT -> "The request conflicts with the current state";
            case UNSUPPORTED_MEDIA_TYPE -> "The request media type is not supported";
            case PAYLOAD_TOO_LARGE -> "The request is too large";
            default -> status.is5xxServerError()
                    ? "An unexpected error occurred"
                    : "The request could not be completed";
        };
    }
}

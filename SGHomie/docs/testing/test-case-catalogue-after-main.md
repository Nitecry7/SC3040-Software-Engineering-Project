# SG Homie complete test-case catalogue

Generated 2026-10-28T14:41:19.803105+08:00. **640 leaf cases**: 2 FAIL, 638 PASS.

Reconciliation: Node 285 leaf cases from 287 reporter records (2 container completions excluded); pytest 319 parameter-expanded cases; pgTAP 36 assertions.

Every row preserves the executed case title and actual outcome. The source link is the executable specification: it supplies inputs, setup, and expected assertions; shared fixtures/helpers and parameter tables are in that source file. The JSON companion stores source excerpts and full suite snapshots. No test data, oracle, result, or coverage percentage is inferred from a passing title.

Technique/risk labels describe the source approach and likely impact. VM components and mocked handlers are local contract tests; they do not establish browser behavior, live provider behavior, hosted security, production accuracy, or complete branch coverage. Static SQL/CSS/source checks are labelled separately.

## Suite reconciliation

| Source suite | Cases | Outcomes |
|---|---:|---|
| MLPricePredictorV2/tests/test_api.py | 41 | 41 PASS |
| MLPricePredictorV2/tests/test_api_contract_gaps.py | 38 | 38 PASS |
| MLPricePredictorV2/tests/test_artifact_retrieval.py | 9 | 9 PASS |
| MLPricePredictorV2/tests/test_baselines.py | 11 | 11 PASS |
| MLPricePredictorV2/tests/test_boosted_models.py | 11 | 11 PASS |
| MLPricePredictorV2/tests/test_bundle_validation_gaps.py | 52 | 52 PASS |
| MLPricePredictorV2/tests/test_chronological_split.py | 5 | 5 PASS |
| MLPricePredictorV2/tests/test_configuration_selection.py | 4 | 4 PASS |
| MLPricePredictorV2/tests/test_data_validation.py | 3 | 3 PASS |
| MLPricePredictorV2/tests/test_diagnostics.py | 2 | 2 PASS |
| MLPricePredictorV2/tests/test_leakage_contract_gaps.py | 26 | 26 PASS |
| MLPricePredictorV2/tests/test_linear_models.py | 10 | 10 PASS |
| MLPricePredictorV2/tests/test_metrics.py | 4 | 4 PASS |
| MLPricePredictorV2/tests/test_model_robustness.py | 9 | 9 PASS |
| MLPricePredictorV2/tests/test_parsers.py | 18 | 18 PASS |
| MLPricePredictorV2/tests/test_preprocessing.py | 6 | 6 PASS |
| MLPricePredictorV2/tests/test_tree_models.py | 13 | 13 PASS |
| MLPricePredictorV2/tests/test_uncertainty.py | 28 | 28 PASS |
| MLPricePredictorV2/tests/test_valuation_bundle.py | 20 | 20 PASS |
| MLPricePredictorV2/tests/test_walk_forward.py | 9 | 9 PASS |
| SGHomie/BackEnd/supabase/tests/database/access-control.test.sql | 36 | 36 PASS |
| SGHomie/tests/admin-users-endpoint.test.mjs | 6 | 6 PASS |
| SGHomie/tests/amenities.test.mjs | 8 | 8 PASS |
| SGHomie/tests/auth-context-profile-dedupe.test.mjs | 15 | 15 PASS |
| SGHomie/tests/auth-modal-guards.test.mjs | 8 | 8 PASS |
| SGHomie/tests/auth-modal.test.mjs | 5 | 1 FAIL, 4 PASS |
| SGHomie/tests/buy-flow.test.mjs | 53 | 53 PASS |
| SGHomie/tests/chat-markdown-security.test.mjs | 7 | 7 PASS |
| SGHomie/tests/chat-onboarding.test.mjs | 24 | 24 PASS |
| SGHomie/tests/chat-provider.test.mjs | 8 | 8 PASS |
| SGHomie/tests/chat-session.test.mjs | 4 | 4 PASS |
| SGHomie/tests/chat-window.test.mjs | 4 | 4 PASS |
| SGHomie/tests/enquiry-behavior.test.mjs | 6 | 6 PASS |
| SGHomie/tests/enquiry-policy.test.mjs | 2 | 2 PASS |
| SGHomie/tests/enquiry-response-endpoint.test.mjs | 5 | 5 PASS |
| SGHomie/tests/hdb-location-endpoint.test.mjs | 13 | 13 PASS |
| SGHomie/tests/image-cleanup-endpoint.test.mjs | 8 | 8 PASS |
| SGHomie/tests/listing-analytics.test.mjs | 3 | 3 PASS |
| SGHomie/tests/listing-counts.test.mjs | 3 | 3 PASS |
| SGHomie/tests/property-details-lifecycle.test.mjs | 13 | 13 PASS |
| SGHomie/tests/property-valuation-frontend.test.mjs | 6 | 6 PASS |
| SGHomie/tests/protected-route-contract.test.mjs | 5 | 5 PASS |
| SGHomie/tests/protected-route.test.mjs | 16 | 16 PASS |
| SGHomie/tests/search-behavior.test.mjs | 9 | 9 PASS |
| SGHomie/tests/search-resources.test.mjs | 3 | 1 FAIL, 2 PASS |
| SGHomie/tests/sell-flow.test.mjs | 11 | 11 PASS |
| SGHomie/tests/supabase-config.test.mjs | 18 | 18 PASS |
| SGHomie/tests/valuation-range.test.mjs | 11 | 11 PASS |
| SGHomie/tests/valuation.test.mjs | 11 | 11 PASS |

## MLPricePredictorV2/tests/test_api.py

Level: HTTP/component integration (in-process FastAPI TestClient). Technique: Black-box request partitions/boundaries and white-box lifecycle/error probes. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-API-207F0A9E5E | test_health_and_model_info_expose_only_safe_fields | PASS | [inputs + assertions L125–145](../../../MLPricePredictorV2/tests/test_api.py#L125) |
| ML-API-1A7E291715 | test_openapi_docs_are_enabled | PASS | [inputs + assertions L148–150](../../../MLPricePredictorV2/tests/test_api.py#L148) |
| ML-API-A9B483D1FC | test_prediction_defaults_to_90_percent_and_returns_typed_interval | PASS | [inputs + assertions L153–172](../../../MLPricePredictorV2/tests/test_api.py#L153) |
| ML-API-06062F3A60 | test_supported_non_default_coverage_levels_work[0.8] | PASS | [inputs + assertions L175–181](../../../MLPricePredictorV2/tests/test_api.py#L175) |
| ML-API-6CF91907EF | test_supported_non_default_coverage_levels_work[0.95] | PASS | [inputs + assertions L175–181](../../../MLPricePredictorV2/tests/test_api.py#L175) |
| ML-API-068237959E | test_unsupported_or_coerced_coverage_is_rejected[0.85] | PASS | [inputs + assertions L184–189](../../../MLPricePredictorV2/tests/test_api.py#L184) |
| ML-API-729F5BE795 | test_unsupported_or_coerced_coverage_is_rejected[0.99] | PASS | [inputs + assertions L184–189](../../../MLPricePredictorV2/tests/test_api.py#L184) |
| ML-API-5C5262DC2F | test_unsupported_or_coerced_coverage_is_rejected[90%] | PASS | [inputs + assertions L184–189](../../../MLPricePredictorV2/tests/test_api.py#L184) |
| ML-API-A3FE421E52 | test_unsupported_or_coerced_coverage_is_rejected[0.9] | PASS | [inputs + assertions L184–189](../../../MLPricePredictorV2/tests/test_api.py#L184) |
| ML-API-2FE84C81F9 | test_unsupported_or_coerced_coverage_is_rejected[90] | PASS | [inputs + assertions L184–189](../../../MLPricePredictorV2/tests/test_api.py#L184) |
| ML-API-494D18E2A7 | test_non_finite_coverage_returns_structured_validation_error | PASS | [inputs + assertions L192–199](../../../MLPricePredictorV2/tests/test_api.py#L192) |
| ML-API-7C2FF1DEC3 | test_integral_numeric_inputs_are_accepted | PASS | [inputs + assertions L202–204](../../../MLPricePredictorV2/tests/test_api.py#L202) |
| ML-API-81BFFCF89E | test_numeric_strings_are_rejected[floor_area_sqm-92] | PASS | [inputs + assertions L207–214](../../../MLPricePredictorV2/tests/test_api.py#L207) |
| ML-API-7C4DD17A53 | test_numeric_strings_are_rejected[asking_price-500000] | PASS | [inputs + assertions L207–214](../../../MLPricePredictorV2/tests/test_api.py#L207) |
| ML-API-747EA4F08D | test_invalid_month_is_rejected[0] | PASS | [inputs + assertions L217–221](../../../MLPricePredictorV2/tests/test_api.py#L217) |
| ML-API-99D3C58F0E | test_invalid_month_is_rejected[13] | PASS | [inputs + assertions L217–221](../../../MLPricePredictorV2/tests/test_api.py#L217) |
| ML-API-68AFF1BA91 | test_invalid_month_is_rejected[1.5] | PASS | [inputs + assertions L217–221](../../../MLPricePredictorV2/tests/test_api.py#L217) |
| ML-API-09284AAB44 | test_blank_required_categories_are_rejected[town-   ] | PASS | [inputs + assertions L224–237](../../../MLPricePredictorV2/tests/test_api.py#L224) |
| ML-API-EDE41FB931 | test_blank_required_categories_are_rejected[flat_type-] | PASS | [inputs + assertions L224–237](../../../MLPricePredictorV2/tests/test_api.py#L224) |
| ML-API-F0D3B31BAA | test_blank_required_categories_are_rejected[block- ] | PASS | [inputs + assertions L224–237](../../../MLPricePredictorV2/tests/test_api.py#L224) |
| ML-API-FB3B4CE02D | test_blank_required_categories_are_rejected[street_name-] | PASS | [inputs + assertions L224–237](../../../MLPricePredictorV2/tests/test_api.py#L224) |
| ML-API-7A4EAA8364 | test_blank_required_categories_are_rejected[flat_model-\t] | PASS | [inputs + assertions L224–237](../../../MLPricePredictorV2/tests/test_api.py#L224) |
| ML-API-7F225E6E8C | test_invalid_numeric_inputs_are_rejected[floor_area_sqm-nan] | PASS | [inputs + assertions L240–247](../../../MLPricePredictorV2/tests/test_api.py#L240) |
| ML-API-F5CA80C3E4 | test_invalid_numeric_inputs_are_rejected[storey_mid-inf] | PASS | [inputs + assertions L240–247](../../../MLPricePredictorV2/tests/test_api.py#L240) |
| ML-API-BB1458F653 | test_invalid_numeric_inputs_are_rejected[remaining_lease_months--1] | PASS | [inputs + assertions L240–247](../../../MLPricePredictorV2/tests/test_api.py#L240) |
| ML-API-B0EF5CE4EB | test_missing_or_unexpected_fields_are_rejected | PASS | [inputs + assertions L250–256](../../../MLPricePredictorV2/tests/test_api.py#L250) |
| ML-API-200D09064C | test_known_town_normalizes_case_and_whitespace_and_unknown_falls_back | PASS | [inputs + assertions L259–271](../../../MLPricePredictorV2/tests/test_api.py#L259) |
| ML-API-DDD32EE31B | test_timing_log_reuses_the_private_correlation_id_without_logging_features_or_secrets | PASS | [inputs + assertions L274–307](../../../MLPricePredictorV2/tests/test_api.py#L274) |
| ML-API-78A3A26437 | test_asking_price_is_context_only_and_uses_existing_classifier | PASS | [inputs + assertions L310–341](../../../MLPricePredictorV2/tests/test_api.py#L310) |
| ML-API-0E4F1D74E9 | test_prediction_lock_is_held_only_for_model_call | PASS | [inputs + assertions L344–368](../../../MLPricePredictorV2/tests/test_api.py#L344) |
| ML-API-641EDE7349 | test_http_matches_direct_bundle_prediction | PASS | [inputs + assertions L371–387](../../../MLPricePredictorV2/tests/test_api.py#L371) |
| ML-API-325489443C | test_unseen_categories_and_absent_raw_csv_do_not_block_inference | PASS | [inputs + assertions L390–410](../../../MLPricePredictorV2/tests/test_api.py#L390) |
| ML-API-F78CEA68EE | test_bundle_loads_once_per_application_lifespan | PASS | [inputs + assertions L413–435](../../../MLPricePredictorV2/tests/test_api.py#L413) |
| ML-API-7960818AC3 | test_startup_fails_clearly_when_bundle_is_missing | PASS | [inputs + assertions L438–441](../../../MLPricePredictorV2/tests/test_api.py#L438) |
| ML-API-4ECC633F49 | test_startup_fails_clearly_on_checksum_corruption | PASS | [inputs + assertions L444–451](../../../MLPricePredictorV2/tests/test_api.py#L444) |
| ML-API-E4988166EC | test_bundle_path_defaults_and_environment_override | PASS | [inputs + assertions L454–459](../../../MLPricePredictorV2/tests/test_api.py#L454) |
| ML-API-3B172FB36A | test_unexpected_prediction_error_is_logged_and_sanitized | PASS | [inputs + assertions L462–470](../../../MLPricePredictorV2/tests/test_api.py#L462) |
| ML-API-1584E40E78 | test_hosted_auth_protects_prediction_and_model_info_but_not_health | PASS | [inputs + assertions L473–512](../../../MLPricePredictorV2/tests/test_api.py#L473) |
| ML-API-075CAB0611 | test_authenticated_http_prediction_matches_bundle_and_discards_artifact_secret | PASS | [inputs + assertions L515–539](../../../MLPricePredictorV2/tests/test_api.py#L515) |
| ML-API-D10C2F0332 | test_hosted_auth_configuration_fails_closed | PASS | [inputs + assertions L542–547](../../../MLPricePredictorV2/tests/test_api.py#L542) |
| ML-API-BC3D3C69F8 | test_configured_model_version_must_match_bundle | PASS | [inputs + assertions L550–559](../../../MLPricePredictorV2/tests/test_api.py#L550) |

## MLPricePredictorV2/tests/test_api_contract_gaps.py

Level: HTTP/component integration (in-process FastAPI TestClient). Technique: Black-box request partitions/boundaries and white-box lifecycle/error probes. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-API-CONTRACT-GAPS-D03236F595 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-2016] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-A736EC46C4 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-True] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-818D0AFA39 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-2026] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-9AC2DC56D2 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_month-True] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-9C6A81002B | test_api_rejects_lower_bound_and_type_confusion_inputs[floor_area_sqm-0] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-1C90047891 | test_api_rejects_lower_bound_and_type_confusion_inputs[floor_area_sqm-False] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-7C1A1D5A3A | test_api_rejects_lower_bound_and_type_confusion_inputs[storey_mid-0] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-1D1CE51061 | test_api_rejects_lower_bound_and_type_confusion_inputs[storey_mid-True] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-593D4CD325 | test_api_rejects_lower_bound_and_type_confusion_inputs[remaining_lease_months-False] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-1631FD4B29 | test_api_rejects_lower_bound_and_type_confusion_inputs[remaining_lease_months-780] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-7C56EC8DAC | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price-0] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-C38DEF52AD | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price--1] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-503CCDFF7E | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price-True] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-C31DF5F392 | test_api_rejects_lower_bound_and_type_confusion_inputs[coverage-True] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-4D9AADAF51 | test_api_rejects_lower_bound_and_type_confusion_inputs[town-123] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-FD2281F03A | test_api_rejects_lower_bound_and_type_confusion_inputs[flat_type-value15] | PASS | [inputs + assertions L18–44](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L18) |
| ML-API-CONTRACT-GAPS-C6DF676C8B | test_api_accepts_inclusive_month_and_zero_remaining_lease_boundaries[1] | PASS | [inputs + assertions L47–54](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L47) |
| ML-API-CONTRACT-GAPS-D629F0A644 | test_api_accepts_inclusive_month_and_zero_remaining_lease_boundaries[12] | PASS | [inputs + assertions L47–54](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L47) |
| ML-API-CONTRACT-GAPS-5264FB8B9B | test_api_rejects_target_derived_and_affordability_fields[resale_price] | PASS | [inputs + assertions L57–63](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L57) |
| ML-API-CONTRACT-GAPS-AC9E17726E | test_api_rejects_target_derived_and_affordability_fields[price_per_sqm] | PASS | [inputs + assertions L57–63](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L57) |
| ML-API-CONTRACT-GAPS-440EEFA249 | test_api_rejects_target_derived_and_affordability_fields[income] | PASS | [inputs + assertions L57–63](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L57) |
| ML-API-CONTRACT-GAPS-F3D77CA1D9 | test_api_auth_rejects_malformed_or_padded_credentials[Basic service-test-token] | PASS | [inputs + assertions L66–81](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L66) |
| ML-API-CONTRACT-GAPS-4D08C5E6E7 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer] | PASS | [inputs + assertions L66–81](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L66) |
| ML-API-CONTRACT-GAPS-0E0E79EDF7 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer ] | PASS | [inputs + assertions L66–81](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L66) |
| ML-API-CONTRACT-GAPS-D390B17AFD | test_api_auth_rejects_malformed_or_padded_credentials[Bearer  service-test-token] | PASS | [inputs + assertions L66–81](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L66) |
| ML-API-CONTRACT-GAPS-B339301895 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer service-test-token ] | PASS | [inputs + assertions L66–81](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L66) |
| ML-API-CONTRACT-GAPS-7886DF54A0 | test_api_auth_accepts_case_insensitive_bearer_scheme | PASS | [inputs + assertions L84–91](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L84) |
| ML-API-CONTRACT-GAPS-BE565E567A | test_api_health_reports_unavailable_before_lifespan_load | PASS | [inputs + assertions L94–100](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L94) |
| ML-API-CONTRACT-GAPS-348D4DAFF3 | test_api_invalid_auth_mode_stops_startup[unknown] | PASS | [inputs + assertions L103–107](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L103) |
| ML-API-CONTRACT-GAPS-07777E3C18 | test_api_invalid_auth_mode_stops_startup[REQUIRED] | PASS | [inputs + assertions L103–107](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L103) |
| ML-API-CONTRACT-GAPS-948E056C75 | test_api_invalid_auth_mode_stops_startup[ ] | PASS | [inputs + assertions L103–107](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L103) |
| ML-API-CONTRACT-GAPS-054C7B0703 | test_api_shutdown_clears_model_lock_and_service_secret | PASS | [inputs + assertions L110–120](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L110) |
| ML-API-CONTRACT-GAPS-89615F3E1B | test_api_model_failure_releases_prediction_lock_and_allows_retry | PASS | [inputs + assertions L123–137](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L123) |
| ML-API-CONTRACT-GAPS-4443F6D007 | test_api_classification_failure_is_sanitized_after_prediction | PASS | [inputs + assertions L140–152](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L140) |
| ML-API-CONTRACT-GAPS-F3C31B4DE3 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[not-a-uuid] | PASS | [inputs + assertions L155–168](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L155) |
| ML-API-CONTRACT-GAPS-2401EAC3E2 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[private-location-value] | PASS | [inputs + assertions L155–168](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L155) |
| ML-API-CONTRACT-GAPS-AFC1357E59 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[00000000-0000-0000-0000-000000000000] | PASS | [inputs + assertions L155–168](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L155) |
| ML-API-CONTRACT-GAPS-1571342F4F | test_api_relative_bundle_override_is_project_relative_not_working_directory | PASS | [inputs + assertions L171–174](../../../MLPricePredictorV2/tests/test_api_contract_gaps.py#L171) |

## MLPricePredictorV2/tests/test_artifact_retrieval.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-ARTIFACT-RETRIEVAL-0B110EB002 | test_release_bundle_download_is_verified_and_atomically_published | PASS | [inputs + assertions L131–148](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L131) |
| ML-ARTIFACT-RETRIEVAL-5A84CF70B7 | test_downloaded_fixture_bundle_passes_real_bundle_loader | PASS | [inputs + assertions L151–165](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L151) |
| ML-ARTIFACT-RETRIEVAL-1D99B199DF | test_bundle_manifest_mismatch_is_rejected_before_publication | PASS | [inputs + assertions L168–183](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L168) |
| ML-ARTIFACT-RETRIEVAL-7667A56CFE | test_existing_valid_bundle_is_reused_without_token_or_network | PASS | [inputs + assertions L186–198](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L186) |
| ML-ARTIFACT-RETRIEVAL-7649BC1FF7 | test_bad_asset_digest_does_not_publish_bundle | PASS | [inputs + assertions L201–217](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L201) |
| ML-ARTIFACT-RETRIEVAL-43A44453C4 | test_missing_release_asset_fails_without_publishing | PASS | [inputs + assertions L220–230](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L220) |
| ML-ARTIFACT-RETRIEVAL-2E8A577313 | test_failed_release_request_is_reported_without_publishing | PASS | [inputs + assertions L233–243](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L233) |
| ML-ARTIFACT-RETRIEVAL-3F2AC6910D | test_archive_with_unexpected_path_is_rejected | PASS | [inputs + assertions L246–253](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L246) |
| ML-ARTIFACT-RETRIEVAL-4B8FDFAD65 | test_redirects_never_forward_authorization_header | PASS | [inputs + assertions L256–274](../../../MLPricePredictorV2/tests/test_artifact_retrieval.py#L256) |

## MLPricePredictorV2/tests/test_baselines.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BASELINES-A5607B8021 | test_global_median_uses_only_strictly_earlier_history | PASS | [inputs + assertions L39–45](../../../MLPricePredictorV2/tests/test_baselines.py#L39) |
| ML-BASELINES-3BEB07B330 | test_town_flat_type_median_falls_back_to_global_deterministically | PASS | [inputs + assertions L48–56](../../../MLPricePredictorV2/tests/test_baselines.py#L48) |
| ML-BASELINES-625F10F061 | test_town_flat_type_median_uses_only_matching_prior_rows | PASS | [inputs + assertions L59–66](../../../MLPricePredictorV2/tests/test_baselines.py#L59) |
| ML-BASELINES-EFA96D4CDD | test_comparable_selector_uses_physical_distance_not_target_price | PASS | [inputs + assertions L69–89](../../../MLPricePredictorV2/tests/test_baselines.py#L69) |
| ML-BASELINES-7BEB6F27DF | test_candidate_prices_do_not_change_selected_comparable_indices | PASS | [inputs + assertions L92–110](../../../MLPricePredictorV2/tests/test_baselines.py#L92) |
| ML-BASELINES-8A8019F9F5 | test_same_month_and_future_candidates_are_excluded | PASS | [inputs + assertions L113–123](../../../MLPricePredictorV2/tests/test_baselines.py#L113) |
| ML-BASELINES-AB25B91790 | test_comparable_minimum_triggers_town_then_global_fallback | PASS | [inputs + assertions L126–137](../../../MLPricePredictorV2/tests/test_baselines.py#L126) |
| ML-BASELINES-CA99EED5DF | test_comparable_falls_back_to_global_when_town_flat_type_history_is_absent | PASS | [inputs + assertions L140–147](../../../MLPricePredictorV2/tests/test_baselines.py#L140) |
| ML-BASELINES-2CD681E7F7 | test_comparable_lookback_and_maximum_count_are_respected_deterministically | PASS | [inputs + assertions L150–167](../../../MLPricePredictorV2/tests/test_baselines.py#L150) |
| ML-BASELINES-A0947AE35E | test_equal_score_comparables_use_source_index_as_final_tie_breaker | PASS | [inputs + assertions L170–179](../../../MLPricePredictorV2/tests/test_baselines.py#L170) |
| ML-BASELINES-DE1816534F | test_predictors_require_target_rows_without_resale_price | PASS | [inputs + assertions L182–188](../../../MLPricePredictorV2/tests/test_baselines.py#L182) |

## MLPricePredictorV2/tests/test_boosted_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BOOSTED-MODELS-16F817F5C7 | test_boosted_schema_is_fixed_and_rejects_target_leakage | PASS | [inputs + assertions L45–53](../../../MLPricePredictorV2/tests/test_boosted_models.py#L45) |
| ML-BOOSTED-MODELS-F62E9FF26B | test_eight_fixed_configurations_and_device_parameters | PASS | [inputs + assertions L56–67](../../../MLPricePredictorV2/tests/test_boosted_models.py#L56) |
| ML-BOOSTED-MODELS-4C143EF4BC | test_xgboost_category_vocabularies_are_fit_only_from_training_rows | PASS | [inputs + assertions L70–78](../../../MLPricePredictorV2/tests/test_boosted_models.py#L70) |
| ML-BOOSTED-MODELS-220B4F68AB | test_catboost_receives_native_categories_and_unseen_values | PASS | [inputs + assertions L81–86](../../../MLPricePredictorV2/tests/test_boosted_models.py#L81) |
| ML-BOOSTED-MODELS-804D155500 | test_fit_rows_are_stably_sorted_by_transaction_month_and_keep_source_indices | PASS | [inputs + assertions L89–95](../../../MLPricePredictorV2/tests/test_boosted_models.py#L89) |
| ML-BOOSTED-MODELS-365E98D6F5 | test_cpu_estimators_fit_small_data_and_predict | PASS | [inputs + assertions L98–112](../../../MLPricePredictorV2/tests/test_boosted_models.py#L98) |
| ML-BOOSTED-MODELS-3EE6412B41 | test_selector_uses_validation_metrics_and_configured_one_percent_band | PASS | [inputs + assertions L115–120](../../../MLPricePredictorV2/tests/test_boosted_models.py#L115) |
| ML-BOOSTED-MODELS-79D622E2C8 | test_selector_zero_mae_band_requires_exact_equality | PASS | [inputs + assertions L123–127](../../../MLPricePredictorV2/tests/test_boosted_models.py#L123) |
| ML-BOOSTED-MODELS-936E820FAD | test_final_fit_uses_only_supplied_rows_and_freezes_best_round_count | PASS | [inputs + assertions L130–144](../../../MLPricePredictorV2/tests/test_boosted_models.py#L130) |
| ML-BOOSTED-MODELS-8A4AE4CC9D | test_validation_labels_are_only_passed_as_evaluation_data | PASS | [inputs + assertions L147–183](../../../MLPricePredictorV2/tests/test_boosted_models.py#L147) |
| ML-BOOSTED-MODELS-541115757B | test_selection_interface_has_no_test_result_parameter | PASS | [inputs + assertions L186–189](../../../MLPricePredictorV2/tests/test_boosted_models.py#L186) |

## MLPricePredictorV2/tests/test_bundle_validation_gaps.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BUNDLE-VALIDATION-GAPS-A0A3EED58E | test_bundle_metadata_rejects_incompatible_frozen_contract[bundle_format_version-99-Unsupported bundle format] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-18E917B7B7 | test_bundle_metadata_rejects_incompatible_frozen_contract[model_family-unreviewed_model-CatBoost] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-01B607310C | test_bundle_metadata_rejects_incompatible_frozen_contract[model_filename-other.cbm-CatBoost] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-6785BF604B | test_bundle_metadata_rejects_incompatible_frozen_contract[model_serialization_format-pickle-serialization] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-ADDEA2424F | test_bundle_metadata_rejects_incompatible_frozen_contract[model_version-../other-model-Invalid model version] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-9602E7713B | test_bundle_metadata_rejects_incompatible_frozen_contract[training_cutoff-2026-01-training cutoff] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-B092F5E077 | test_bundle_metadata_rejects_incompatible_frozen_contract[calibration_cutoff-2026-01-calibration cutoff] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-C4C55D4E5F | test_bundle_metadata_rejects_incompatible_frozen_contract[feature_schema_version-unknown-v99-feature schema] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-4C17C6BB3D | test_bundle_metadata_rejects_incompatible_frozen_contract[numeric_features-value8-numeric feature] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-7D4E957ECD | test_bundle_metadata_rejects_incompatible_frozen_contract[categorical_features-value9-categorical feature] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-09462A86EA | test_bundle_metadata_rejects_incompatible_frozen_contract[target_name-asking_price-Target] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-AC63E7FA0D | test_bundle_metadata_rejects_incompatible_frozen_contract[random_seed-0-seed or iteration] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-BC454FCD80 | test_bundle_metadata_rejects_incompatible_frozen_contract[iteration_count-1-seed or iteration] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-EB973F8DBA | test_bundle_metadata_rejects_incompatible_frozen_contract[catboost_parameters-value13-parameters must be an object] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-6D36A95D4B | test_bundle_metadata_rejects_incompatible_frozen_contract[catboost_parameters-value14-frozen model configuration] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-26FBEF8145 | test_bundle_metadata_rejects_incompatible_frozen_contract[training_row_count-0-positive integer] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-D8DD8E7099 | test_bundle_metadata_rejects_incompatible_frozen_contract[minimum_group_support-1-minimum group support] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-605F65D3BD | test_bundle_metadata_rejects_incompatible_frozen_contract[supported_coverage_levels-value17-coverage levels] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-83F3605F5E | test_bundle_metadata_rejects_incompatible_frozen_contract[default_coverage_level-0.8-default coverage] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-25F6A24E1B | test_bundle_metadata_rejects_incompatible_frozen_contract[uncertainty_method-unknown-uncertainty method] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-848B8CE803 | test_bundle_metadata_rejects_incompatible_frozen_contract[grouping_variable-income-grouping variable] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-EE1A1C1D92 | test_bundle_metadata_rejects_incompatible_frozen_contract[dataset-value21-must be an object] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-4E3D28197C | test_bundle_metadata_rejects_incompatible_frozen_contract[library_versions-value22-must be an object] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-297A155FBC | test_bundle_metadata_rejects_incompatible_frozen_contract[known_limitations-value23-non-empty list] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-1BCB01F827 | test_bundle_metadata_rejects_incompatible_frozen_contract[created_at-2026-10-08T12:00:00-timezone-aware] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-CB70ACD7E9 | test_bundle_metadata_rejects_incompatible_frozen_contract[created_at-invalid timestamp-timezone-aware] | PASS | [inputs + assertions L25–60](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L25) |
| ML-BUNDLE-VALIDATION-GAPS-D293C99F46 | test_bundle_metadata_requires_source_provenance_and_runtime_version_metadata | PASS | [inputs + assertions L63–76](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L63) |
| ML-BUNDLE-VALIDATION-GAPS-E5A3484428 | test_uncertainty_state_rejects_changed_calibration_policy[schema_version-99-schema version] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-0431ACD6F8 | test_uncertainty_state_rejects_changed_calibration_policy[method_name-unknown-calibration method] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-1FBF1DE102 | test_uncertainty_state_rejects_changed_calibration_policy[calibration_cutoff-2026-01-cutoff] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-92EB830884 | test_uncertainty_state_rejects_changed_calibration_policy[calibration_years-value3-2021-2025] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-CC8BCE5873 | test_uncertainty_state_rejects_changed_calibration_policy[grouping_variable-income-grouping variable] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-599AD16DEB | test_uncertainty_state_rejects_changed_calibration_policy[minimum_group_support-1-minimum group support] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-F41C58AAE1 | test_uncertainty_state_rejects_changed_calibration_policy[supported_coverage_levels-value6-coverage levels] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-F13E7DB390 | test_uncertainty_state_rejects_changed_calibration_policy[default_coverage_level-0.8-default coverage] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-C845F08ED8 | test_uncertainty_state_rejects_changed_calibration_policy[global-value8-records must be objects] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-E565FF20C7 | test_uncertainty_state_rejects_changed_calibration_policy[towns-value9-records must be objects] | PASS | [inputs + assertions L79–98](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L79) |
| ML-BUNDLE-VALIDATION-GAPS-62716E8D4F | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[-1] | PASS | [inputs + assertions L101–106](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L101) |
| ML-BUNDLE-VALIDATION-GAPS-108B4F7A02 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[nan] | PASS | [inputs + assertions L101–106](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L101) |
| ML-BUNDLE-VALIDATION-GAPS-888E968D86 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[inf] | PASS | [inputs + assertions L101–106](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L101) |
| ML-BUNDLE-VALIDATION-GAPS-0E4A33CBA6 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[invalid] | PASS | [inputs + assertions L101–106](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L101) |
| ML-BUNDLE-VALIDATION-GAPS-F6ABCAF6C7 | test_uncertainty_state_requires_all_coverages_and_sufficient_town_support | PASS | [inputs + assertions L109–117](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L109) |
| ML-BUNDLE-VALIDATION-GAPS-9776E0F913 | test_uncertainty_state_requires_canonical_town_keys_and_object_records | PASS | [inputs + assertions L120–128](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L120) |
| ML-BUNDLE-VALIDATION-GAPS-E456D9261B | test_bundle_write_failure_removes_partial_artifact_directory | PASS | [inputs + assertions L131–146](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L131) |
| ML-BUNDLE-VALIDATION-GAPS-FEBEE935AF | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[not JSON] | PASS | [inputs + assertions L149–155](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L149) |
| ML-BUNDLE-VALIDATION-GAPS-69170FE940 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[[]] | PASS | [inputs + assertions L149–155](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L149) |
| ML-BUNDLE-VALIDATION-GAPS-E85FE623C8 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[{"manifest_version":99,"hash_algorithm":"sha256"}] | PASS | [inputs + assertions L149–155](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L149) |
| ML-BUNDLE-VALIDATION-GAPS-8653D7B568 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[{"manifest_version":1,"hash_algorithm":"sha256","files":{}}] | PASS | [inputs + assertions L149–155](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L149) |
| ML-BUNDLE-VALIDATION-GAPS-B7D6CFFCC5 | test_direct_bundle_prediction_rejects_non_finite_model_outputs[nan] | PASS | [inputs + assertions L158–167](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L158) |
| ML-BUNDLE-VALIDATION-GAPS-62C08228D9 | test_direct_bundle_prediction_rejects_non_finite_model_outputs[inf] | PASS | [inputs + assertions L158–167](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L158) |
| ML-BUNDLE-VALIDATION-GAPS-C72DB0E548 | test_csv_discovery_requires_exactly_one_source_file | PASS | [inputs + assertions L170–179](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L170) |
| ML-BUNDLE-VALIDATION-GAPS-82969142FC | test_explicit_csv_load_preserves_source_rows_and_does_not_modify_file | PASS | [inputs + assertions L182–189](../../../MLPricePredictorV2/tests/test_bundle_validation_gaps.py#L182) |

## MLPricePredictorV2/tests/test_chronological_split.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-CHRONOLOGICAL-SPLIT-382522E492 | test_default_boundaries_split_by_month_and_preserve_partial_period | PASS | [inputs + assertions L9–25](../../../MLPricePredictorV2/tests/test_chronological_split.py#L9) |
| ML-CHRONOLOGICAL-SPLIT-578E1CB706 | test_configurable_contiguous_boundaries | PASS | [inputs + assertions L28–49](../../../MLPricePredictorV2/tests/test_chronological_split.py#L28) |
| ML-CHRONOLOGICAL-SPLIT-006E323D70 | test_dates_before_configured_train_start_fail_with_index | PASS | [inputs + assertions L52–58](../../../MLPricePredictorV2/tests/test_chronological_split.py#L52) |
| ML-CHRONOLOGICAL-SPLIT-B0319FA103 | test_non_contiguous_boundaries_fail | PASS | [inputs + assertions L61–63](../../../MLPricePredictorV2/tests/test_chronological_split.py#L61) |
| ML-CHRONOLOGICAL-SPLIT-FDBA8C1078 | test_misaligned_inputs_fail | PASS | [inputs + assertions L66–72](../../../MLPricePredictorV2/tests/test_chronological_split.py#L66) |

## MLPricePredictorV2/tests/test_configuration_selection.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-CONFIGURATION-SELECTION-8A5A8B716A | test_validation_grid_contains_expected_twelve_configs_and_default | PASS | [inputs + assertions L15–22](../../../MLPricePredictorV2/tests/test_configuration_selection.py#L15) |
| ML-CONFIGURATION-SELECTION-2C18A1C4BB | test_near_tie_prefers_lower_fallback_then_default_near_then_group_stability | PASS | [inputs + assertions L25–35](../../../MLPricePredictorV2/tests/test_configuration_selection.py#L25) |
| ML-CONFIGURATION-SELECTION-4E40A1935C | test_configuration_outside_one_percent_is_not_preferred_for_fallback | PASS | [inputs + assertions L38–46](../../../MLPricePredictorV2/tests/test_configuration_selection.py#L38) |
| ML-CONFIGURATION-SELECTION-D475CEB368 | test_selector_accepts_validation_summaries_only | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_configuration_selection.py#L49) |

## MLPricePredictorV2/tests/test_data_validation.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-DATA-VALIDATION-4D3A922F25 | test_required_column_set_matches_hdb_source_schema | PASS | [inputs + assertions L7–20](../../../MLPricePredictorV2/tests/test_data_validation.py#L7) |
| ML-DATA-VALIDATION-40C37859C3 | test_missing_required_column_fails | PASS | [inputs + assertions L23–27](../../../MLPricePredictorV2/tests/test_data_validation.py#L23) |
| ML-DATA-VALIDATION-43A42FE113 | test_valid_dataset_schema_is_accepted | PASS | [inputs + assertions L30–33](../../../MLPricePredictorV2/tests/test_data_validation.py#L30) |

## MLPricePredictorV2/tests/test_diagnostics.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-DIAGNOSTICS-E3CDBDEF57 | test_diagnostics_report_all_groups_fallbacks_and_comparable_counts | PASS | [inputs + assertions L7–35](../../../MLPricePredictorV2/tests/test_diagnostics.py#L7) |
| ML-DIAGNOSTICS-0CF0693B5A | test_comparable_count_summary_is_empty_when_all_predictions_fallback | PASS | [inputs + assertions L38–57](../../../MLPricePredictorV2/tests/test_diagnostics.py#L38) |

## MLPricePredictorV2/tests/test_leakage_contract_gaps.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-LEAKAGE-CONTRACT-GAPS-E4E1762963 | test_split_assigns_every_inclusive_boundary_once_and_preserves_later_partial_months | PASS | [inputs + assertions L32–41](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L32) |
| ML-LEAKAGE-CONTRACT-GAPS-29043B9028 | test_split_returns_isolated_copies_for_features_targets_and_periods | PASS | [inputs + assertions L44–53](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L44) |
| ML-LEAKAGE-CONTRACT-GAPS-626DFE1B5E | test_split_missing_transaction_period_fails_instead_of_silently_dropping_row | PASS | [inputs + assertions L56–60](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L56) |
| ML-LEAKAGE-CONTRACT-GAPS-D794EEDDDF | test_split_rejects_period_index_misalignment_even_when_lengths_match | PASS | [inputs + assertions L63–67](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L63) |
| ML-LEAKAGE-CONTRACT-GAPS-3301162957 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides0-Train start] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-16F749799A | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides1-Validation must start] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-CC513D2E68 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides2-Validation start] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-EEE5165C1A | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides3-Test must start] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-9EDE9D427D | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides4-Test start] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-6A2FBDE092 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides5-Partial period] | PASS | [inputs + assertions L70–83](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-C4A68B624A | test_preparation_excludes_income_price_derivatives_and_unexpected_source_columns | PASS | [inputs + assertions L86–94](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L86) |
| ML-LEAKAGE-CONTRACT-GAPS-CC471BB346 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[floor_area_sqm] | PASS | [inputs + assertions L97–108](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-C07054E9D9 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[storey_mid] | PASS | [inputs + assertions L97–108](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-5698B82008 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[remaining_lease_months] | PASS | [inputs + assertions L97–108](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-3F19BFDD17 | test_comparable_lookback_lower_month_is_included_but_month_before_is_excluded | PASS | [inputs + assertions L111–115](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L111) |
| ML-LEAKAGE-CONTRACT-GAPS-84B943A2B4 | test_comparable_index_cannot_be_reused_for_a_later_prediction_month | PASS | [inputs + assertions L118–122](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L118) |
| ML-LEAKAGE-CONTRACT-GAPS-8E45F01E77 | test_comparables_can_hide_source_ids_without_changing_estimate | PASS | [inputs + assertions L125–132](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L125) |
| ML-LEAKAGE-CONTRACT-GAPS-E92BDF8110 | test_calibration_rejects_duplicate_year_folds_instead_of_double_weighting | PASS | [inputs + assertions L141–144](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L141) |
| ML-LEAKAGE-CONTRACT-GAPS-68069B6C1F | test_calibration_requires_every_predeclared_year | PASS | [inputs + assertions L147–150](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L147) |
| ML-LEAKAGE-CONTRACT-GAPS-CF859AFEDB | test_calibration_rejects_reordered_prediction_indices | PASS | [inputs + assertions L153–157](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L153) |
| ML-LEAKAGE-CONTRACT-GAPS-5A5D62B7CA | test_calibration_rejects_missing_actual_targets | PASS | [inputs + assertions L160–163](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L160) |
| ML-LEAKAGE-CONTRACT-GAPS-0EE3302334 | test_calibration_rejects_fractional_years_before_integer_conversion[2021.5] | PASS | [inputs + assertions L166–172](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L166) |
| ML-LEAKAGE-CONTRACT-GAPS-8F19EEF290 | test_calibration_rejects_fractional_years_before_integer_conversion[2022.25] | PASS | [inputs + assertions L166–172](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L166) |
| ML-LEAKAGE-CONTRACT-GAPS-761636EBA6 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual0-predicted0] | PASS | [inputs + assertions L175–178](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L175) |
| ML-LEAKAGE-CONTRACT-GAPS-7402356426 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual1-predicted1] | PASS | [inputs + assertions L175–178](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L175) |
| ML-LEAKAGE-CONTRACT-GAPS-60ED60E909 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual2-predicted2] | PASS | [inputs + assertions L175–178](../../../MLPricePredictorV2/tests/test_leakage_contract_gaps.py#L175) |

## MLPricePredictorV2/tests/test_linear_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-LINEAR-MODELS-7258A17764 | test_model_feature_schema_is_fixed_and_excludes_redundant_fields | PASS | [inputs + assertions L49–60](../../../MLPricePredictorV2/tests/test_linear_models.py#L49) |
| ML-LINEAR-MODELS-60D5C9584D | test_target_column_is_rejected_and_missing_base_features_fail_clearly | PASS | [inputs + assertions L63–70](../../../MLPricePredictorV2/tests/test_linear_models.py#L63) |
| ML-LINEAR-MODELS-FB63A52805 | test_pipeline_keeps_ohe_sparse_and_unknown_categories_do_not_crash | PASS | [inputs + assertions L73–85](../../../MLPricePredictorV2/tests/test_linear_models.py#L73) |
| ML-LINEAR-MODELS-DBD5DE9916 | test_validation_candidates_fit_vocabulary_and_scaling_on_train_only | PASS | [inputs + assertions L88–102](../../../MLPricePredictorV2/tests/test_linear_models.py#L88) |
| ML-LINEAR-MODELS-7001778308 | test_validation_target_changes_metrics_but_not_fitted_preprocessing_or_coefficients | PASS | [inputs + assertions L105–122](../../../MLPricePredictorV2/tests/test_linear_models.py#L105) |
| ML-LINEAR-MODELS-C93F9499E2 | test_final_fit_takes_only_train_validation_rows_and_isolated_from_test_targets | PASS | [inputs + assertions L125–155](../../../MLPricePredictorV2/tests/test_linear_models.py#L125) |
| ML-LINEAR-MODELS-66EB1CAAD7 | test_validation_evaluation_is_deterministic_for_fixed_inputs | PASS | [inputs + assertions L158–169](../../../MLPricePredictorV2/tests/test_linear_models.py#L158) |
| ML-LINEAR-MODELS-1E8353F437 | test_default_alpha_grid_is_small_and_explicit | PASS | [inputs + assertions L172–174](../../../MLPricePredictorV2/tests/test_linear_models.py#L172) |
| ML-LINEAR-MODELS-A7AF830A6C | test_validation_selector_uses_one_percent_tie_band_then_metrics_and_simplicity | PASS | [inputs + assertions L177–183](../../../MLPricePredictorV2/tests/test_linear_models.py#L177) |
| ML-LINEAR-MODELS-7FF4925468 | test_zero_mae_requires_exact_tie_and_ridge_alpha_ties_are_stable | PASS | [inputs + assertions L186–192](../../../MLPricePredictorV2/tests/test_linear_models.py#L186) |

## MLPricePredictorV2/tests/test_metrics.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-METRICS-D07BF59BF3 | test_regression_metrics_match_hand_calculated_values | PASS | [inputs + assertions L6–16](../../../MLPricePredictorV2/tests/test_metrics.py#L6) |
| ML-METRICS-84A0474D71 | test_r_squared_is_undefined_for_insufficient_or_constant_actuals | PASS | [inputs + assertions L19–21](../../../MLPricePredictorV2/tests/test_metrics.py#L19) |
| ML-METRICS-72DDB5F144 | test_mape_is_undefined_when_actual_contains_zero | PASS | [inputs + assertions L24–25](../../../MLPricePredictorV2/tests/test_metrics.py#L24) |
| ML-METRICS-848EA46D62 | test_metrics_reject_empty_or_misaligned_inputs | PASS | [inputs + assertions L28–32](../../../MLPricePredictorV2/tests/test_metrics.py#L28) |

## MLPricePredictorV2/tests/test_model_robustness.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-MODEL-ROBUSTNESS-86816D3C38 | test_frozen_comparable_keeps_cutoff_history_constant_and_uses_cutoff_month | PASS | [inputs + assertions L43–57](../../../MLPricePredictorV2/tests/test_model_robustness.py#L43) |
| ML-MODEL-ROBUSTNESS-BD5281A9D0 | test_evaluation_year_target_mutation_cannot_change_frozen_comparable_predictions | PASS | [inputs + assertions L60–75](../../../MLPricePredictorV2/tests/test_model_robustness.py#L60) |
| ML-MODEL-ROBUSTNESS-9738A2ADF4 | test_frozen_comparable_rejects_rows_at_or_before_cutoff_and_partial_period | PASS | [inputs + assertions L78–90](../../../MLPricePredictorV2/tests/test_model_robustness.py#L78) |
| ML-MODEL-ROBUSTNESS-7D678252DC | test_expanding_year_partition_ends_training_before_year_and_excludes_other_years | PASS | [inputs + assertions L93–104](../../../MLPricePredictorV2/tests/test_model_robustness.py#L93) |
| ML-MODEL-ROBUSTNESS-CE5715BC5B | test_expanding_year_partition_can_stop_before_partial_month_but_rejects_it | PASS | [inputs + assertions L107–117](../../../MLPricePredictorV2/tests/test_model_robustness.py#L107) |
| ML-MODEL-ROBUSTNESS-2B8769410B | test_shared_frozen_year_helper_fits_only_before_evaluation_year | PASS | [inputs + assertions L120–154](../../../MLPricePredictorV2/tests/test_model_robustness.py#L120) |
| ML-MODEL-ROBUSTNESS-2106FC03A0 | test_fixed_catboost_fit_uses_only_supplied_labels_and_frozen_configuration | PASS | [inputs + assertions L157–208](../../../MLPricePredictorV2/tests/test_model_robustness.py#L157) |
| ML-MODEL-ROBUSTNESS-B32887706F | test_repeatability_summary_aggregates_runs_without_selecting_a_winner | PASS | [inputs + assertions L215–231](../../../MLPricePredictorV2/tests/test_model_robustness.py#L215) |
| ML-MODEL-ROBUSTNESS-96ECFE7560 | test_monthly_drift_and_group_support_summaries_match_hand_calculation | PASS | [inputs + assertions L234–251](../../../MLPricePredictorV2/tests/test_model_robustness.py#L234) |

## MLPricePredictorV2/tests/test_parsers.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-PARSERS-B35921B096 | test_parse_remaining_lease[61 years 04 months-736] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-D7266B4866 | test_parse_remaining_lease[62 years 01 month-745] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-23F2F853F0 | test_parse_remaining_lease[63 years-756] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-A8356B2CFB | test_parse_remaining_lease[60 years-720] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-40AA31FD99 | test_parse_remaining_lease[  1   year   1   month -13] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-2DC588D7C0 | test_parse_remaining_lease[5 months-5] | PASS | [inputs + assertions L8–20](../../../MLPricePredictorV2/tests/test_parsers.py#L8) |
| ML-PARSERS-69DEB1F3F5 | test_malformed_remaining_lease_fails[] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-A7083CD963 | test_malformed_remaining_lease_fails[unknown] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-27F744359A | test_malformed_remaining_lease_fails[61 years 12 months] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-8AB615CC5A | test_malformed_remaining_lease_fails[3 years ago] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-9F6BAB36C0 | test_malformed_remaining_lease_fails[None] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-E730BCEFCB | test_malformed_remaining_lease_fails[nan] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-D5FF49D99E | test_malformed_remaining_lease_fails[value6] | PASS | [inputs + assertions L23–28](../../../MLPricePredictorV2/tests/test_parsers.py#L23) |
| ML-PARSERS-C5CACA98D8 | test_parse_storey_range | PASS | [inputs + assertions L31–33](../../../MLPricePredictorV2/tests/test_parsers.py#L31) |
| ML-PARSERS-AD1DA3A503 | test_malformed_storey_range_fails[10-12] | PASS | [inputs + assertions L36–39](../../../MLPricePredictorV2/tests/test_parsers.py#L36) |
| ML-PARSERS-F3C15708B7 | test_malformed_storey_range_fails[12 TO 10] | PASS | [inputs + assertions L36–39](../../../MLPricePredictorV2/tests/test_parsers.py#L36) |
| ML-PARSERS-04C80BF2EF | test_malformed_storey_range_fails[unknown] | PASS | [inputs + assertions L36–39](../../../MLPricePredictorV2/tests/test_parsers.py#L36) |
| ML-PARSERS-B5F639B10F | test_malformed_storey_range_fails[None] | PASS | [inputs + assertions L36–39](../../../MLPricePredictorV2/tests/test_parsers.py#L36) |

## MLPricePredictorV2/tests/test_preprocessing.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-PREPROCESSING-B7FA45ADC8 | test_features_separate_target_and_parse_transaction_month | PASS | [inputs + assertions L26–41](../../../MLPricePredictorV2/tests/test_preprocessing.py#L26) |
| ML-PREPROCESSING-2CEA4BAE2F | test_malformed_values_fail_with_source_index_and_value[month-2025-13] | PASS | [inputs + assertions L44–58](../../../MLPricePredictorV2/tests/test_preprocessing.py#L44) |
| ML-PREPROCESSING-33D42F13A5 | test_malformed_values_fail_with_source_index_and_value[storey_range-upper floor] | PASS | [inputs + assertions L44–58](../../../MLPricePredictorV2/tests/test_preprocessing.py#L44) |
| ML-PREPROCESSING-20C04CB723 | test_malformed_values_fail_with_source_index_and_value[remaining_lease-about 60 years] | PASS | [inputs + assertions L44–58](../../../MLPricePredictorV2/tests/test_preprocessing.py#L44) |
| ML-PREPROCESSING-1184F6DF21 | test_duplicate_source_rows_and_indices_are_preserved | PASS | [inputs + assertions L61–71](../../../MLPricePredictorV2/tests/test_preprocessing.py#L61) |
| ML-PREPROCESSING-72AB0A3F40 | test_validation_and_test_target_values_do_not_influence_features | PASS | [inputs + assertions L74–81](../../../MLPricePredictorV2/tests/test_preprocessing.py#L74) |

## MLPricePredictorV2/tests/test_tree_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-TREE-MODELS-07C8485CCE | test_tree_schemas_exclude_target_derived_and_keep_deterministic_columns | PASS | [inputs + assertions L50–64](../../../MLPricePredictorV2/tests/test_tree_models.py#L50) |
| ML-TREE-MODELS-C7225E4C82 | test_search_has_six_fixed_deterministic_configurations | PASS | [inputs + assertions L67–76](../../../MLPricePredictorV2/tests/test_tree_models.py#L67) |
| ML-TREE-MODELS-8E48335C14 | test_forest_pipeline_uses_sparse_one_hot_and_no_numeric_scaling | PASS | [inputs + assertions L79–91](../../../MLPricePredictorV2/tests/test_tree_models.py#L79) |
| ML-TREE-MODELS-F991956644 | test_random_forest_pipeline_uses_fixed_seed | PASS | [inputs + assertions L94–99](../../../MLPricePredictorV2/tests/test_tree_models.py#L94) |
| ML-TREE-MODELS-E4F010CBA8 | test_fixed_seed_tree_predictions_are_reproducible | PASS | [inputs + assertions L102–110](../../../MLPricePredictorV2/tests/test_tree_models.py#L102) |
| ML-TREE-MODELS-DCF7F0B979 | test_histogram_categories_are_learned_from_training_and_unknowns_become_missing | PASS | [inputs + assertions L113–125](../../../MLPricePredictorV2/tests/test_tree_models.py#L113) |
| ML-TREE-MODELS-F0EB0B3894 | test_histogram_pipeline_supports_native_categories_and_unseen_validation_categories | PASS | [inputs + assertions L128–138](../../../MLPricePredictorV2/tests/test_tree_models.py#L128) |
| ML-TREE-MODELS-63E94C9407 | test_validation_target_changes_do_not_change_fitted_pipeline_or_predictions | PASS | [inputs + assertions L141–162](../../../MLPricePredictorV2/tests/test_tree_models.py#L141) |
| ML-TREE-MODELS-A5A7617400 | test_final_refit_receives_only_history_and_ignores_test_only_categories | PASS | [inputs + assertions L165–188](../../../MLPricePredictorV2/tests/test_tree_models.py#L165) |
| ML-TREE-MODELS-AC9F671B89 | test_model_selection_uses_only_validation_results_and_one_percent_band | PASS | [inputs + assertions L191–213](../../../MLPricePredictorV2/tests/test_tree_models.py#L191) |
| ML-TREE-MODELS-0B20485A86 | test_tree_selection_requires_exact_mae_tie_when_best_mae_is_zero | PASS | [inputs + assertions L216–241](../../../MLPricePredictorV2/tests/test_tree_models.py#L216) |
| ML-TREE-MODELS-C5B7C30119 | test_tree_feature_importances_aggregate_one_hot_values_to_source_features | PASS | [inputs + assertions L244–252](../../../MLPricePredictorV2/tests/test_tree_models.py#L244) |
| ML-TREE-MODELS-ABD8A5E4E7 | test_partial_period_is_not_in_validation_or_test | PASS | [inputs + assertions L255–279](../../../MLPricePredictorV2/tests/test_tree_models.py#L255) |

## MLPricePredictorV2/tests/test_uncertainty.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-UNCERTAINTY-FAEDF2BD16 | test_finite_sample_quantile_uses_ceiling_order_statistic_without_interpolation | PASS | [inputs + assertions L40–42](../../../MLPricePredictorV2/tests/test_uncertainty.py#L40) |
| ML-UNCERTAINTY-1AB67FF1E1 | test_finite_sample_quantile_returns_infinity_if_rank_exceeds_sample | PASS | [inputs + assertions L45–46](../../../MLPricePredictorV2/tests/test_uncertainty.py#L45) |
| ML-UNCERTAINTY-D1DC71491C | test_conformal_quantile_rejects_invalid_coverage[0.0] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-2D9BD7EAB7 | test_conformal_quantile_rejects_invalid_coverage[1.0] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-554214DCE7 | test_conformal_quantile_rejects_invalid_coverage[-0.1] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-9546D0A6E8 | test_conformal_quantile_rejects_invalid_coverage[1.1] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-80978FA901 | test_conformal_quantile_rejects_invalid_coverage[nan] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-45FD0BFABE | test_conformal_quantile_rejects_invalid_coverage[inf] | PASS | [inputs + assertions L49–52](../../../MLPricePredictorV2/tests/test_uncertainty.py#L49) |
| ML-UNCERTAINTY-2D3C8C64D6 | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals0] | PASS | [inputs + assertions L55–58](../../../MLPricePredictorV2/tests/test_uncertainty.py#L55) |
| ML-UNCERTAINTY-262C205B4A | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals1] | PASS | [inputs + assertions L55–58](../../../MLPricePredictorV2/tests/test_uncertainty.py#L55) |
| ML-UNCERTAINTY-0229CE3717 | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals2] | PASS | [inputs + assertions L55–58](../../../MLPricePredictorV2/tests/test_uncertainty.py#L55) |
| ML-UNCERTAINTY-0AD352DFDD | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals3] | PASS | [inputs + assertions L55–58](../../../MLPricePredictorV2/tests/test_uncertainty.py#L55) |
| ML-UNCERTAINTY-FE4E9B8E75 | test_symmetric_intervals_preserve_index_and_compute_bounds_and_width | PASS | [inputs + assertions L61–67](../../../MLPricePredictorV2/tests/test_uncertainty.py#L61) |
| ML-UNCERTAINTY-359558F491 | test_interval_metrics_match_hand_calculated_coverage_and_width | PASS | [inputs + assertions L70–85](../../../MLPricePredictorV2/tests/test_uncertainty.py#L70) |
| ML-UNCERTAINTY-4980613280 | test_prior_residual_selection_excludes_evaluation_and_future_years | PASS | [inputs + assertions L88–92](../../../MLPricePredictorV2/tests/test_uncertainty.py#L88) |
| ML-UNCERTAINTY-07EACE6726 | test_recent_window_uses_only_previous_calendar_years | PASS | [inputs + assertions L95–99](../../../MLPricePredictorV2/tests/test_uncertainty.py#L95) |
| ML-UNCERTAINTY-C9095A0994 | test_evaluation_target_mutation_cannot_change_frozen_intervals | PASS | [inputs + assertions L102–116](../../../MLPricePredictorV2/tests/test_uncertainty.py#L102) |
| ML-UNCERTAINTY-F321DA5F5F | test_group_quantiles_use_minimum_support_and_global_fallback | PASS | [inputs + assertions L119–139](../../../MLPricePredictorV2/tests/test_uncertainty.py#L119) |
| ML-UNCERTAINTY-9068F8D9D0 | test_group_coverage_summary_flags_evaluation_groups_below_support_threshold | PASS | [inputs + assertions L142–156](../../../MLPricePredictorV2/tests/test_uncertainty.py#L142) |
| ML-UNCERTAINTY-B58856BF36 | test_method_selector_is_deterministic_and_uses_simplicity_for_exact_ties | PASS | [inputs + assertions L177–178](../../../MLPricePredictorV2/tests/test_uncertainty.py#L177) |
| ML-UNCERTAINTY-AEB115955B | test_method_selector_rejects_final_test_results | PASS | [inputs + assertions L181–187](../../../MLPricePredictorV2/tests/test_uncertainty.py#L181) |
| ML-UNCERTAINTY-1C6E545ECC | test_ninety_percent_gate_uses_pooled_ninety_and_each_year_eighty_five | PASS | [inputs + assertions L190–203](../../../MLPricePredictorV2/tests/test_uncertainty.py#L190) |
| ML-UNCERTAINTY-028CF76ED3 | test_asking_price_interval_classification_boundaries[99.99-below_estimated_market_range] | PASS | [inputs + assertions L206–217](../../../MLPricePredictorV2/tests/test_uncertainty.py#L206) |
| ML-UNCERTAINTY-10EAA3C723 | test_asking_price_interval_classification_boundaries[100.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](../../../MLPricePredictorV2/tests/test_uncertainty.py#L206) |
| ML-UNCERTAINTY-2835097073 | test_asking_price_interval_classification_boundaries[150.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](../../../MLPricePredictorV2/tests/test_uncertainty.py#L206) |
| ML-UNCERTAINTY-8136F38CB3 | test_asking_price_interval_classification_boundaries[200.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](../../../MLPricePredictorV2/tests/test_uncertainty.py#L206) |
| ML-UNCERTAINTY-EE7647D712 | test_asking_price_interval_classification_boundaries[200.01-above_estimated_market_range] | PASS | [inputs + assertions L206–217](../../../MLPricePredictorV2/tests/test_uncertainty.py#L206) |
| ML-UNCERTAINTY-06E7B7ACE0 | test_asking_price_classification_rejects_invalid_inputs | PASS | [inputs + assertions L220–224](../../../MLPricePredictorV2/tests/test_uncertainty.py#L220) |

## MLPricePredictorV2/tests/test_valuation_bundle.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-VALUATION-BUNDLE-821A4B33A6 | test_calibration_persists_only_precomputed_supported_thresholds | PASS | [inputs + assertions L112–124](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L112) |
| ML-VALUATION-BUNDLE-4824B51F00 | test_calibration_rejects_residuals_after_cutoff | PASS | [inputs + assertions L127–138](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L127) |
| ML-VALUATION-BUNDLE-977A01CD60 | test_future_target_mutation_does_not_change_bundle_calibration | PASS | [inputs + assertions L141–167](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L141) |
| ML-VALUATION-BUNDLE-B1E4C878A1 | test_future_year_fold_is_rejected_for_calibration | PASS | [inputs + assertions L170–180](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L170) |
| ML-VALUATION-BUNDLE-7A7A7FED89 | test_town_lookup_normalizes_whitespace_and_case_with_global_fallback | PASS | [inputs + assertions L183–196](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L183) |
| ML-VALUATION-BUNDLE-2797417D45 | test_all_supported_coverages_return_half_and_full_width[0.8] | PASS | [inputs + assertions L199–204](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L199) |
| ML-VALUATION-BUNDLE-ED0AFFA384 | test_all_supported_coverages_return_half_and_full_width[0.9] | PASS | [inputs + assertions L199–204](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L199) |
| ML-VALUATION-BUNDLE-61C60F9EB4 | test_all_supported_coverages_return_half_and_full_width[0.95] | PASS | [inputs + assertions L199–204](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L199) |
| ML-VALUATION-BUNDLE-4C75595C43 | test_unsupported_coverage_is_rejected | PASS | [inputs + assertions L207–209](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L207) |
| ML-VALUATION-BUNDLE-77950D508A | test_feature_and_bundle_metadata_contract_rejects_changes | PASS | [inputs + assertions L212–231](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L212) |
| ML-VALUATION-BUNDLE-76540EC2EB | test_metadata_rejects_invalid_cutoffs_and_version | PASS | [inputs + assertions L234–241](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L234) |
| ML-VALUATION-BUNDLE-D1F7E9BEE3 | test_bundle_save_load_prediction_shape_and_threshold_round_trip | PASS | [inputs + assertions L244–272](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L244) |
| ML-VALUATION-BUNDLE-7F72ECADBE | test_prediction_requires_exact_feature_names_and_valid_values | PASS | [inputs + assertions L275–294](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L275) |
| ML-VALUATION-BUNDLE-96E6714F5C | test_loader_rejects_missing_files_and_invalid_manifest_hashes | PASS | [inputs + assertions L297–307](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L297) |
| ML-VALUATION-BUNDLE-1E25E3B7F8 | test_loader_checks_each_bundle_file_digest[model.cbm] | PASS | [inputs + assertions L310–316](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L310) |
| ML-VALUATION-BUNDLE-B560A33AB5 | test_loader_checks_each_bundle_file_digest[uncertainty.json] | PASS | [inputs + assertions L310–316](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L310) |
| ML-VALUATION-BUNDLE-AE0EAB377B | test_loader_checks_each_bundle_file_digest[metadata.json] | PASS | [inputs + assertions L310–316](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L310) |
| ML-VALUATION-BUNDLE-85A85A3541 | test_loader_rejects_metadata_even_when_manifest_matches | PASS | [inputs + assertions L319–330](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L319) |
| ML-VALUATION-BUNDLE-78479AF704 | test_bundle_version_is_immutable_and_not_overwritten | PASS | [inputs + assertions L333–338](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L333) |
| ML-VALUATION-BUNDLE-ABA36854C2 | test_town_normalization_matches_backend_canonical_form | PASS | [inputs + assertions L341–344](../../../MLPricePredictorV2/tests/test_valuation_bundle.py#L341) |

## MLPricePredictorV2/tests/test_walk_forward.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-WALK-FORWARD-03862357CF | test_same_month_targets_cannot_influence_each_others_predictions | PASS | [inputs + assertions L34–45](../../../MLPricePredictorV2/tests/test_walk_forward.py#L34) |
| ML-WALK-FORWARD-1A7E83634B | test_same_month_actual_mutation_does_not_change_comparable_prediction | PASS | [inputs + assertions L48–60](../../../MLPricePredictorV2/tests/test_walk_forward.py#L48) |
| ML-WALK-FORWARD-9FAFDB1C27 | test_future_actual_mutation_cannot_change_earlier_predictions | PASS | [inputs + assertions L63–72](../../../MLPricePredictorV2/tests/test_walk_forward.py#L63) |
| ML-WALK-FORWARD-73B8E3A9FF | test_future_missing_target_cannot_change_earlier_prediction | PASS | [inputs + assertions L75–84](../../../MLPricePredictorV2/tests/test_walk_forward.py#L75) |
| ML-WALK-FORWARD-4C181995D5 | test_prior_completed_month_updates_history_for_later_month | PASS | [inputs + assertions L87–97](../../../MLPricePredictorV2/tests/test_walk_forward.py#L87) |
| ML-WALK-FORWARD-0AB3B741CD | test_prior_completed_month_can_change_later_comparable_prediction | PASS | [inputs + assertions L100–113](../../../MLPricePredictorV2/tests/test_walk_forward.py#L100) |
| ML-WALK-FORWARD-A3F29CB3B2 | test_partial_period_rows_are_rejected_from_evaluation | PASS | [inputs + assertions L116–121](../../../MLPricePredictorV2/tests/test_walk_forward.py#L116) |
| ML-WALK-FORWARD-BDFDE2C709 | test_months_are_evaluated_in_chronological_order | PASS | [inputs + assertions L124–134](../../../MLPricePredictorV2/tests/test_walk_forward.py#L124) |
| ML-WALK-FORWARD-2EA2446D82 | test_comparable_grid_reuses_walk_forward_history_without_changing_predictions | PASS | [inputs + assertions L137–154](../../../MLPricePredictorV2/tests/test_walk_forward.py#L137) |

## SGHomie/BackEnd/supabase/tests/database/access-control.test.sql

Level: Local PostgreSQL integration. Technique: Black-box role operations and white-box RLS/trigger assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| DB-01 | DB-01 sensitive application tables have RLS enabled | PASS | [inputs + assertions L35–39](../../BackEnd/supabase/tests/database/access-control.test.sql#L35) |
| DB-02 | DB-02 authenticated users cannot read verification tokens | PASS | [inputs + assertions L40–41](../../BackEnd/supabase/tests/database/access-control.test.sql#L40) |
| DB-03 | DB-03 anonymous users cannot mint verification tokens | PASS | [inputs + assertions L42–43](../../BackEnd/supabase/tests/database/access-control.test.sql#L42) |
| DB-04 | DB-04 anonymous users see approved listings only | PASS | [inputs + assertions L46–46](../../BackEnd/supabase/tests/database/access-control.test.sql#L46) |
| DB-05 | DB-05 anonymous users cannot read profiles | PASS | [inputs + assertions L47–47](../../BackEnd/supabase/tests/database/access-control.test.sql#L47) |
| DB-06 | DB-06 anonymous users cannot read enquiries | PASS | [inputs + assertions L48–48](../../BackEnd/supabase/tests/database/access-control.test.sql#L48) |
| DB-07 | DB-07 anonymous visitors cannot submit an enquiry under the authenticated policy | PASS | [inputs + assertions L49–51](../../BackEnd/supabase/tests/database/access-control.test.sql#L49) |
| DB-08 | DB-08 seller reads own profile only | PASS | [inputs + assertions L56–56](../../BackEnd/supabase/tests/database/access-control.test.sql#L56) |
| DB-09 | DB-09 seller cannot escalate to administrator | PASS | [inputs + assertions L57–58](../../BackEnd/supabase/tests/database/access-control.test.sql#L57) |
| DB-10 | DB-10 seller sees approved and own draft | PASS | [inputs + assertions L59–59](../../BackEnd/supabase/tests/database/access-control.test.sql#L59) |
| DB-11 | DB-11 seller cannot read another seller draft | PASS | [inputs + assertions L60–61](../../BackEnd/supabase/tests/database/access-control.test.sql#L60) |
| DB-12 | DB-12 seller cannot update another seller listing | PASS | [inputs + assertions L62–65](../../BackEnd/supabase/tests/database/access-control.test.sql#L62) |
| DB-13 | DB-13 seller can edit price on own draft without new address verification | PASS | [inputs + assertions L66–69](../../BackEnd/supabase/tests/database/access-control.test.sql#L66) |
| DB-14 | DB-14 seller cannot approve own draft | PASS | [inputs + assertions L70–72](../../BackEnd/supabase/tests/database/access-control.test.sql#L70) |
| DB-15 | DB-15 seller reads own private unit only | PASS | [inputs + assertions L73–73](../../BackEnd/supabase/tests/database/access-control.test.sql#L73) |
| DB-16 | DB-16 unverified seller insert is rejected | PASS | [inputs + assertions L74–77](../../BackEnd/supabase/tests/database/access-control.test.sql#L74) |
| DB-17 | DB-17 expired verification token is rejected | PASS | [inputs + assertions L78–80](../../BackEnd/supabase/tests/database/access-control.test.sql#L78) |
| DB-18 | DB-18 valid seller-bound token applies trusted address | PASS | [inputs + assertions L81–84](../../BackEnd/supabase/tests/database/access-control.test.sql#L81) |
| DB-19 | DB-19 verified address overwrites spoofed fields and clears bearer token | PASS | [inputs + assertions L85–87](../../BackEnd/supabase/tests/database/access-control.test.sql#L85) |
| DB-20 | DB-20 another seller cannot reuse verification token | PASS | [inputs + assertions L92–94](../../BackEnd/supabase/tests/database/access-control.test.sql#L92) |
| DB-21 | DB-21 buyer sees approved properties only | PASS | [inputs + assertions L99–99](../../BackEnd/supabase/tests/database/access-control.test.sql#L99) |
| DB-22 | DB-22 buyer cannot read private unit numbers | PASS | [inputs + assertions L100–100](../../BackEnd/supabase/tests/database/access-control.test.sql#L100) |
| DB-23 | DB-23 buyer sees own enquiries with case-insensitive email matching | PASS | [inputs + assertions L101–101](../../BackEnd/supabase/tests/database/access-control.test.sql#L101) |
| DB-24 | DB-24 buyer cannot answer own enquiry as administrator | PASS | [inputs + assertions L102–105](../../BackEnd/supabase/tests/database/access-control.test.sql#L102) |
| DB-25 | DB-25 buyer can record own property interest | PASS | [inputs + assertions L106–108](../../BackEnd/supabase/tests/database/access-control.test.sql#L106) |
| DB-26 | DB-26 buyer cannot impersonate another user interest | PASS | [inputs + assertions L109–111](../../BackEnd/supabase/tests/database/access-control.test.sql#L109) |
| DB-27 | DB-27 duplicate property interest is rejected | PASS | [inputs + assertions L112–114](../../BackEnd/supabase/tests/database/access-control.test.sql#L112) |
| DB-28 | DB-28 administrator can review all listings | PASS | [inputs + assertions L119–119](../../BackEnd/supabase/tests/database/access-control.test.sql#L119) |
| DB-29 | DB-29 administrator can inspect private units | PASS | [inputs + assertions L120–120](../../BackEnd/supabase/tests/database/access-control.test.sql#L120) |
| DB-30 | DB-30 administrator can approve a pending review item | PASS | [inputs + assertions L121–124](../../BackEnd/supabase/tests/database/access-control.test.sql#L121) |
| DB-31 | DB-31 administrator and seller roles remain exclusive | PASS | [inputs + assertions L125–126](../../BackEnd/supabase/tests/database/access-control.test.sql#L125) |
| DB-32 | DB-32 administrator can answer enquiries | PASS | [inputs + assertions L127–130](../../BackEnd/supabase/tests/database/access-control.test.sql#L127) |
| DB-33 | DB-33 4 ROOM pattern matches hyphenated listing text | PASS | [inputs + assertions L132–136](../../BackEnd/supabase/tests/database/access-control.test.sql#L132) |
| DB-34 | DB-34 4 ROOM pattern accepts case and whitespace variant | PASS | [inputs + assertions L137–138](../../BackEnd/supabase/tests/database/access-control.test.sql#L137) |
| DB-35 | DB-35 room-type pattern excludes numeric and word suffix false matches | PASS | [inputs + assertions L139–141](../../BackEnd/supabase/tests/database/access-control.test.sql#L139) |
| DB-36 | DB-36 executive pattern is valid PostgreSQL case-insensitive regex | PASS | [inputs + assertions L142–144](../../BackEnd/supabase/tests/database/access-control.test.sql#L142) |

## SGHomie/tests/admin-users-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-ADM-01 | BE-ADM-01 CORS preflight does not initialize any Supabase client | PASS | [inputs + assertions L40–45](../../tests/admin-users-endpoint.test.mjs#L40) |
| BE-ADM-02 | BE-ADM-02 missing or invalid sessions cannot initialize the privileged client | PASS | [inputs + assertions L46–54](../../tests/admin-users-endpoint.test.mjs#L46) |
| BE-ADM-03 | BE-ADM-03 buyer seller and absent profile cannot enumerate users counts or auth emails | PASS | [inputs + assertions L55–63](../../tests/admin-users-endpoint.test.mjs#L55) |
| BE-ADM-04 | BE-ADM-04 admin enumeration preserves profiles joins counts and adds emails only after authorization | PASS | [inputs + assertions L64–75](../../tests/admin-users-endpoint.test.mjs#L64) |
| BE-ADM-05 | BE-ADM-05 per-user auth email errors and throws degrade to Unknown without dropping profiles | PASS | [inputs + assertions L76–87](../../tests/admin-users-endpoint.test.mjs#L76) |
| BE-ADM-06 | BE-ADM-06 required configuration role and database failures return errors instead of success | PASS | [inputs + assertions L88–95](../../tests/admin-users-endpoint.test.mjs#L88) |

## SGHomie/tests/amenities.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AMENITIES-85D598BDCA | amenities sort by distance and use stable name and id tie breaks | PASS | [inputs + assertions L21–27](../../tests/amenities.test.mjs#L21) |
| JS-AMENITIES-C24710E1B8 | category selection filters without mutating the source list | PASS | [inputs + assertions L28–36](../../tests/amenities.test.mjs#L28) |
| JS-AMENITIES-7E9BA9AC56 | All includes known and future categories | PASS | [inputs + assertions L37–42](../../tests/amenities.test.mjs#L37) |
| JS-AMENITIES-362F66C4A6 | supported categories expose shared visual metadata and unknown categories use neutral tone | PASS | [inputs + assertions L43–63](../../tests/amenities.test.mjs#L43) |
| JS-AMENITIES-0FC5F96E8E | distance displays metres below one kilometre and kilometres at or above it | PASS | [inputs + assertions L64–72](../../tests/amenities.test.mjs#L64) |
| JS-AMENITIES-4A74F47510 | demo source is explicit and non-demo sources remain distinguishable | PASS | [inputs + assertions L73–77](../../tests/amenities.test.mjs#L73) |
| JS-AMENITIES-2BF26548B5 | coordinate validation rejects missing, non-finite, zero and out-of-bound values | PASS | [inputs + assertions L78–93](../../tests/amenities.test.mjs#L78) |
| JS-AMENITIES-80D15302F6 | coordinate validation accepts inclusive Singapore sanity-bound edges | PASS | [inputs + assertions L94–98](../../tests/amenities.test.mjs#L94) |

## SGHomie/tests/auth-context-profile-dedupe.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-E61C70E770 | Profile sign-out success shows only the appropriate notification | PASS | [inputs + assertions L201–219](../../tests/auth-context-profile-dedupe.test.mjs#L201) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-A9EA4EB9DE | Profile sign-out returned-error shows only the appropriate notification | PASS | [inputs + assertions L201–219](../../tests/auth-context-profile-dedupe.test.mjs#L201) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-90BDAA7A1C | Profile sign-out rejection shows only the appropriate notification | PASS | [inputs + assertions L201–219](../../tests/auth-context-profile-dedupe.test.mjs#L201) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-3253445626 | intentional sign-out (before-result) removes protected content without a guest warning | PASS | [inputs + assertions L220–262](../../tests/auth-context-profile-dedupe.test.mjs#L220) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-97CA6791C8 | intentional sign-out (after-result) removes protected content without a guest warning | PASS | [inputs + assertions L220–262](../../tests/auth-context-profile-dedupe.test.mjs#L220) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-5F3108066C | sign-out returned-error propagates without clearing the session or storage | PASS | [inputs + assertions L263–275](../../tests/auth-context-profile-dedupe.test.mjs#L263) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-E3E75AE895 | sign-out rejection propagates without clearing the session or storage | PASS | [inputs + assertions L263–275](../../tests/auth-context-profile-dedupe.test.mjs#L263) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-20DC570CD1 | a token refresh during intentional sign-out does not clear its reason | PASS | [inputs + assertions L276–291](../../tests/auth-context-profile-dedupe.test.mjs#L276) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-6B974FE6A8 | protected authorization remains loading through profile and role lookup | PASS | [inputs + assertions L292–315](../../tests/auth-context-profile-dedupe.test.mjs#L292) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-8951DFCA47 | auth events deduplicate startup lookup and refresh roles after it resolves | PASS | [inputs + assertions L316–347](../../tests/auth-context-profile-dedupe.test.mjs#L316) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-FD6C77F9F7 | seller registration refreshes the current profile role before protected navigation | PASS | [inputs + assertions L348–373](../../tests/auth-context-profile-dedupe.test.mjs#L348) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-3FFF5DD770 | sign-out clears role state and ignores a late profile response | PASS | [inputs + assertions L374–394](../../tests/auth-context-profile-dedupe.test.mjs#L374) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-798C27B155 | Supabase anonymous sessions resolve as guests without a profile-role lookup | PASS | [inputs + assertions L395–407](../../tests/auth-context-profile-dedupe.test.mjs#L395) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-492D616191 | profile lookup failures resolve closed instead of leaving authorization loading forever | PASS | [inputs + assertions L408–422](../../tests/auth-context-profile-dedupe.test.mjs#L408) |
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-7FFA4214F9 | a stalled profile lookup times out and resolves authorization closed | PASS | [inputs + assertions L423–438](../../tests/auth-context-profile-dedupe.test.mjs#L423) |

## SGHomie/tests/auth-modal-guards.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-AUTH-01 | FE-AUTH-01 current confirmation action returns to sign-in and clears the password | PASS | [inputs + assertions L46–54](../../tests/auth-modal-guards.test.mjs#L46) |
| FE-AUTH-02 | FE-AUTH-02 repeating registration with case/whitespace variants does not send another request | PASS | [inputs + assertions L55–64](../../tests/auth-modal-guards.test.mjs#L55) |
| FE-AUTH-03 | FE-AUTH-03 verification guard stores only an email fingerprint | PASS | [inputs + assertions L65–74](../../tests/auth-modal-guards.test.mjs#L65) |
| FE-AUTH-04 | FE-AUTH-04 privacy restrictions on session storage retain the in-memory duplicate guard | PASS | [inputs + assertions L75–100](../../tests/auth-modal-guards.test.mjs#L75) |
| FE-AUTH-05 | FE-AUTH-05 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](../../tests/auth-modal-guards.test.mjs#L91) |
| FE-AUTH-06 | FE-AUTH-06 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](../../tests/auth-modal-guards.test.mjs#L91) |
| FE-AUTH-07 | FE-AUTH-07 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](../../tests/auth-modal-guards.test.mjs#L91) |
| FE-AUTH-08 | FE-AUTH-08 an obfuscated existing-account success response gives the same neutral guidance | PASS | [inputs + assertions L101–107](../../tests/auth-modal-guards.test.mjs#L101) |

## SGHomie/tests/auth-modal.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AUTH-MODAL-C5B82D0DAB | registration keeps a persistent verification confirmation and returns to sign in | FAIL: Expected element to be rendered | [inputs + assertions L96–115](../../tests/auth-modal.test.mjs#L96) |
| JS-AUTH-MODAL-FD5B6B0953 | failed registration keeps the form and entered email available to retry | PASS | [inputs + assertions L116–124](../../tests/auth-modal.test.mjs#L116) |
| JS-AUTH-MODAL-5C2991D01D | closing confirmation clears it before reopening registration | PASS | [inputs + assertions L125–135](../../tests/auth-modal.test.mjs#L125) |
| JS-AUTH-MODAL-894246386A | auto-confirmed registration acknowledges the session without claiming an email was sent | PASS | [inputs + assertions L136–145](../../tests/auth-modal.test.mjs#L136) |
| JS-AUTH-MODAL-B4CDB9BC66 | successful sign in still closes the modal | PASS | [inputs + assertions L146–155](../../tests/auth-modal.test.mjs#L146) |

## SGHomie/tests/buy-flow.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-BUY-FLOW-3702C61F18 | recommendation writer receives only user context and verified results without tool history | PASS | [inputs + assertions L28–55](../../tests/buy-flow.test.mjs#L28) |
| JS-BUY-FLOW-5FBBC39E65 | invalid or unavailable writing falls back without losing verified recommendations | PASS | [inputs + assertions L56–70](../../tests/buy-flow.test.mjs#L56) |
| JS-BUY-FLOW-ECD5A0383E | writer rejects stale towns and named nearby alternatives before publishing | PASS | [inputs + assertions L71–82](../../tests/buy-flow.test.mjs#L71) |
| JS-BUY-FLOW-0208D9A939 | tool specifies examples and keeps HDB room type separate from bedrooms | PASS | [inputs + assertions L83–89](../../tests/buy-flow.test.mjs#L83) |
| JS-BUY-FLOW-595B03A3D6 | normalizes town alternatives, nulls and default ranking | PASS | [inputs + assertions L90–94](../../tests/buy-flow.test.mjs#L90) |
| JS-BUY-FLOW-0A280DEE7B | rejects malformed queries instead of broadening requirements | PASS | [inputs + assertions L95–98](../../tests/buy-flow.test.mjs#L95) |
| JS-BUY-FLOW-7047EB0BFC | query ANDs requirements, ORs towns, excludes drafts and ranks deterministically | PASS | [inputs + assertions L99–114](../../tests/buy-flow.test.mjs#L99) |
| JS-BUY-FLOW-BF39590920 | 4-room filters listing text independently from a requested three bedrooms | PASS | [inputs + assertions L115–124](../../tests/buy-flow.test.mjs#L115) |
| JS-BUY-FLOW-0C01213E43 | quotes filter grammar and escapes literal SQL wildcards | PASS | [inputs + assertions L125–131](../../tests/buy-flow.test.mjs#L125) |
| JS-BUY-FLOW-2BA00DD0A8 | listing fetch preserves caller identity, caps results and returns links/count | PASS | [inputs + assertions L132–147](../../tests/buy-flow.test.mjs#L132) |
| JS-BUY-FLOW-55D3E8B19C | zero matches differ from database and network failures | PASS | [inputs + assertions L148–157](../../tests/buy-flow.test.mjs#L148) |
| JS-BUY-FLOW-819A42D242 | previous filters reach the model and tool results retain their call IDs | PASS | [inputs + assertions L158–172](../../tests/buy-flow.test.mjs#L158) |
| JS-BUY-FLOW-5BAB288515 | invalid tool arguments receive feedback with a bounded retry budget | PASS | [inputs + assertions L173–187](../../tests/buy-flow.test.mjs#L173) |
| JS-BUY-FLOW-BB7868F027 | the model can answer conversationally even when search criteria are present | PASS | [inputs + assertions L188–204](../../tests/buy-flow.test.mjs#L188) |
| JS-BUY-FLOW-EBD6EE327E | screenshot timing question stays conversational, then an explicit search uses the stated budget | PASS | [inputs + assertions L205–251](../../tests/buy-flow.test.mjs#L205) |
| JS-BUY-FLOW-A88659D642 | preferences discussed after a previous search override its snapshot when a later search is requested | PASS | [inputs + assertions L252–281](../../tests/buy-flow.test.mjs#L252) |
| JS-BUY-FLOW-B47DD19EA9 | fragmented Unicode/SSE metadata reaches the frontend and returns full text | PASS | [inputs + assertions L282–293](../../tests/buy-flow.test.mjs#L282) |
| JS-BUY-FLOW-4C96523DF2 | frontend rejects provider errors and unfinished streams | PASS | [inputs + assertions L294–297](../../tests/buy-flow.test.mjs#L294) |
| JS-BUY-FLOW-3660491932 | literal Sengkang and budget requirements survive omitted or incorrect model arguments | PASS | [inputs + assertions L298–308](../../tests/buy-flow.test.mjs#L298) |
| JS-BUY-FLOW-C7B86A9835 | town changes, alternatives, removals and budget refinements override earlier context | PASS | [inputs + assertions L309–338](../../tests/buy-flow.test.mjs#L309) |
| JS-BUY-FLOW-49591A2701 | nonliteral budget refinements replace saved bounds and survive subsequent literal searches | PASS | [inputs + assertions L339–357](../../tests/buy-flow.test.mjs#L339) |
| JS-BUY-FLOW-0CBA77C0DA | new budget extraction replaces an earlier removal while unrelated refinements retain saved ceilings | PASS | [inputs + assertions L358–374](../../tests/buy-flow.test.mjs#L358) |
| JS-BUY-FLOW-44C7C7D458 | any executives removes a stale town, retains budget and enforces executive room type | PASS | [inputs + assertions L375–396](../../tests/buy-flow.test.mjs#L375) |
| JS-BUY-FLOW-A9FFCD7054 | explicit room-type refinements and removal override old model filters | PASS | [inputs + assertions L397–405](../../tests/buy-flow.test.mjs#L397) |
| JS-BUY-FLOW-7F313D13B6 | tool updates distinguish omitted filters from explicit null or empty-array removals | PASS | [inputs + assertions L406–427](../../tests/buy-flow.test.mjs#L406) |
| JS-BUY-FLOW-C0CD787BDA | new explicit constraints remain protected, while any or removal clears only the requested preference | PASS | [inputs + assertions L428–439](../../tests/buy-flow.test.mjs#L428) |
| JS-BUY-FLOW-06187BB540 | screenshot broadening uses the model-selected filter patch and preserves the budget in JSON and SSE | PASS | [inputs + assertions L440–475](../../tests/buy-flow.test.mjs#L440) |
| JS-BUY-FLOW-9BB5DD9269 | HTTP removal of Clementi searches across towns and writes using the new result scope | PASS | [inputs + assertions L476–511](../../tests/buy-flow.test.mjs#L476) |
| JS-BUY-FLOW-DF9B0AC166 | model-selected any-town search and preserves all saved filters | PASS | [inputs + assertions L512–525](../../tests/buy-flow.test.mjs#L512) |
| JS-BUY-FLOW-0FA78B43A1 | completed tool searches retain verified cards when reply writing is unavailable | PASS | [inputs + assertions L526–567](../../tests/buy-flow.test.mjs#L526) |
| JS-BUY-FLOW-DFC2534F88 | model-selected searches preserve literal town, room type and budget constraints | PASS | [inputs + assertions L568–591](../../tests/buy-flow.test.mjs#L568) |
| JS-BUY-FLOW-BBD49256F0 | provider failure before a tool decision cannot produce automatic searches or invented cards | PASS | [inputs + assertions L592–609](../../tests/buy-flow.test.mjs#L592) |
| JS-BUY-FLOW-58B9339396 | complex searches still use the tool with server town/budget guards | PASS | [inputs + assertions L610–621](../../tests/buy-flow.test.mjs#L610) |
| JS-BUY-FLOW-60FA84040D | frontend exposes a safe rate-limit explanation without forwarding arbitrary backend errors | PASS | [inputs + assertions L622–628](../../tests/buy-flow.test.mjs#L622) |
| JS-BUY-FLOW-2990F3F939 | textual tool markup is retried privately and cannot become an assistant answer | PASS | [inputs + assertions L629–646](../../tests/buy-flow.test.mjs#L629) |
| JS-BUY-FLOW-F7B289FEFF | exclusion-only town refinements ask for a replacement without searching broadly | PASS | [inputs + assertions L647–654](../../tests/buy-flow.test.mjs#L647) |
| JS-BUY-FLOW-FB1EAC939E | streamed legacy tool markup stays hidden even when tags arrive one character at a time | PASS | [inputs + assertions L655–665](../../tests/buy-flow.test.mjs#L655) |
| JS-BUY-FLOW-A3A8A933BD | database results outside the town or budget are rejected before recommending | PASS | [inputs + assertions L666–678](../../tests/buy-flow.test.mjs#L666) |
| JS-BUY-FLOW-91FE89C6C7 | HTTP Sengkang search preserves constraints and sends only a verified result reply | PASS | [inputs + assertions L679–715](../../tests/buy-flow.test.mjs#L679) |
| JS-BUY-FLOW-9F373F347D | typed Buy clears seller intake and following requirements stay in the buy journey | PASS | [inputs + assertions L716–776](../../tests/buy-flow.test.mjs#L716) |
| JS-BUY-FLOW-D279D2AE68 | Buy opens a model-led conversation in both response modes without fixed intake or listings | PASS | [inputs + assertions L777–801](../../tests/buy-flow.test.mjs#L777) |
| JS-BUY-FLOW-E4DEA8E431 | saved profile preferences map to supported filters without inferring constraints from income or family size | PASS | [inputs + assertions L802–814](../../tests/buy-flow.test.mjs#L802) |
| JS-BUY-FLOW-6CE20B70C1 | Buy immediately searches authenticated profile preferences with either field set and explains verified results naturally | PASS | [inputs + assertions L815–882](../../tests/buy-flow.test.mjs#L815) |
| JS-BUY-FLOW-59A658C0FF | saved preferences do not auto-search advice turns or become preferences for anonymous users | PASS | [inputs + assertions L883–901](../../tests/buy-flow.test.mjs#L883) |
| JS-BUY-FLOW-EE97141DB7 | requirement reply searches three cards and cannot be trapped in the pending sell journey | PASS | [inputs + assertions L902–939](../../tests/buy-flow.test.mjs#L902) |
| JS-BUY-FLOW-B2CA7ECE9E | authenticated buyers retain caller identity and JSON response compatibility | PASS | [inputs + assertions L940–956](../../tests/buy-flow.test.mjs#L940) |
| JS-BUY-FLOW-90D03360DF | explicit no-preference reply can search broadly after the requirements question | PASS | [inputs + assertions L957–978](../../tests/buy-flow.test.mjs#L957) |
| JS-BUY-FLOW-4708C0CBBE | invalid requests never reach model/database and cannot inject tool/system roles | PASS | [inputs + assertions L979–989](../../tests/buy-flow.test.mjs#L979) |
| JS-BUY-FLOW-3C6793DAB7 | database/provider failures remain errors rather than no-match recommendations | PASS | [inputs + assertions L990–1001](../../tests/buy-flow.test.mjs#L990) |
| JS-BUY-FLOW-3FECCCEDC9 | default model uses the free router without optional parameters that exclude tool providers | PASS | [inputs + assertions L1002–1018](../../tests/buy-flow.test.mjs#L1002) |
| JS-BUY-FLOW-E3C7E495F5 | unavailable model has an actionable error without exposing the upstream payload | PASS | [inputs + assertions L1019–1028](../../tests/buy-flow.test.mjs#L1019) |
| JS-BUY-FLOW-75B8AFE412 | existing sell flow retains anonymous, non-seller and admin gates without model calls | PASS | [inputs + assertions L1029–1042](../../tests/buy-flow.test.mjs#L1029) |
| JS-BUY-FLOW-F9CB7DEA2B | seller postal verification requests the full intake before writing a draft | PASS | [inputs + assertions L1043–1060](../../tests/buy-flow.test.mjs#L1043) |

## SGHomie/tests/chat-markdown-security.test.mjs

Level: Component/render integration. Technique: Black-box untrusted-markdown partitions using real ReactMarkdown/ReactDOM. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-MARKDOWN-01 | FE-MARKDOWN-01 raw HTML script and event-handler text cannot produce executable markup | PASS | [inputs + assertions L29–34](../../tests/chat-markdown-security.test.mjs#L29) |
| FE-MARKDOWN-02 | FE-MARKDOWN-02 JavaScript link destinations are stripped by the Markdown renderer | PASS | [inputs + assertions L35–40](../../tests/chat-markdown-security.test.mjs#L35) |
| FE-MARKDOWN-03 | FE-MARKDOWN-03 internal property links use application routing | PASS | [inputs + assertions L41–47](../../tests/chat-markdown-security.test.mjs#L41) |
| FE-MARKDOWN-04 | FE-MARKDOWN-04 external links cannot access the opener window | PASS | [inputs + assertions L48–54](../../tests/chat-markdown-security.test.mjs#L48) |
| FE-MARKDOWN-05 | FE-MARKDOWN-05 protocol-relative URLs are treated as external links | PASS | [inputs + assertions L55–60](../../tests/chat-markdown-security.test.mjs#L55) |
| FE-MARKDOWN-06 | FE-MARKDOWN-06 generated image markup becomes a link rather than an embedded photo | PASS | [inputs + assertions L61–67](../../tests/chat-markdown-security.test.mjs#L61) |
| FE-MARKDOWN-07 | FE-MARKDOWN-07 internal tool markup is removed before user-visible rendering | PASS | [inputs + assertions L68–73](../../tests/chat-markdown-security.test.mjs#L68) |

## SGHomie/tests/chat-onboarding.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-ONBOARDING-BF782B80F5 | anonymous gate: missing, JSON never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-0AFD519C6F | anonymous gate: invalid, JSON never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-93D025A596 | anonymous gate: expired, JSON never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-903978D016 | anonymous gate: supabase-anonymous, JSON never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-D428F1069A | anonymous gate: missing, SSE never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-B86A070592 | anonymous gate: invalid, SSE never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-0A775BDCCA | anonymous gate: expired, SSE never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-EFD1D194FE | anonymous gate: supabase-anonymous, SSE never constructs or calls provider | PASS | [inputs + assertions L20–101](../../tests/chat-onboarding.test.mjs#L20) |
| JS-CHAT-ONBOARDING-14C5DE0C9D | anonymous actions recognize only explicit intents or exact landing phrases | PASS | [inputs + assertions L102–108](../../tests/chat-onboarding.test.mjs#L102) |
| JS-CHAT-ONBOARDING-65ACA5456B | catalog pages normalize towns, use only public bounded fields, and count all pages | PASS | [inputs + assertions L109–121](../../tests/chat-onboarding.test.mjs#L109) |
| JS-CHAT-ONBOARDING-A5E90A20CB | empty catalog is explicit; town text is escaped and truncated | PASS | [inputs + assertions L122–132](../../tests/chat-onboarding.test.mjs#L122) |
| JS-CHAT-ONBOARDING-DD73F8B427 | network | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-72F8A4B327 | http | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-58F64D8B0E | json | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-684566D37E | no-count | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-0F00360455 | bad-row | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-4B92BFE075 | bad-range | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-2F4B4F415D | too-large | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-3BA0227500 | partial | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-FF84ACC821 | changed-count | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-44AAF35CB9 | duplicate | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-0873730F44 | cap | PASS | [inputs + assertions L135–158](../../tests/chat-onboarding.test.mjs#L135) |
| JS-CHAT-ONBOARDING-86EF253EC4 | catalog timeout aborts rather than returning a partial summary | PASS | [inputs + assertions L159–168](../../tests/chat-onboarding.test.mjs#L159) |
| JS-CHAT-ONBOARDING-DC1F7BBB05 | malformed anonymous requests fail validation without service access | PASS | [inputs + assertions L169–175](../../tests/chat-onboarding.test.mjs#L169) |

## SGHomie/tests/chat-provider.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-PROVIDER-B79A97BADF | provider switch defaults to existing router, selects separate models and validates config | PASS | [inputs + assertions L30–47](../../tests/chat-provider.test.mjs#L30) |
| JS-CHAT-PROVIDER-65CACD7C35 | OpenAI preserves prompts, history and tools while adapting only provider parameters | PASS | [inputs + assertions L48–70](../../tests/chat-provider.test.mjs#L48) |
| JS-CHAT-PROVIDER-5649711F4A | model overrides handle non-reasoning models and reject incompatible GPT-6 tool models | PASS | [inputs + assertions L71–87](../../tests/chat-provider.test.mjs#L71) |
| JS-CHAT-PROVIDER-8CB748D7CD | OpenAI failures retain status and are never retried against OpenRouter | PASS | [inputs + assertions L88–99](../../tests/chat-provider.test.mjs#L88) |
| JS-CHAT-PROVIDER-2258C7F22B | OpenAI streaming retains the frontend SSE contract | PASS | [inputs + assertions L100–108](../../tests/chat-provider.test.mjs#L100) |
| JS-CHAT-PROVIDER-0C9D8F4C66 | complex buying request executes OpenAI tools, trusted DB search and generated prose | PASS | [inputs + assertions L109–139](../../tests/chat-provider.test.mjs#L109) |
| JS-CHAT-PROVIDER-47424999C2 | Edge Function sends identical system prompts and tools for both providers | PASS | [inputs + assertions L140–162](../../tests/chat-provider.test.mjs#L140) |
| JS-CHAT-PROVIDER-2362545E3E | Edge Function reports OpenAI-specific model configuration and safe rate-limit errors | PASS | [inputs + assertions L163–176](../../tests/chat-provider.test.mjs#L163) |

## SGHomie/tests/chat-session.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-SESSION-10C3FB3566 | New Chat returns only empty temporary state and invalidates active requests | PASS | [inputs + assertions L6–19](../../tests/chat-session.test.mjs#L6) |
| JS-CHAT-SESSION-67C05AFA65 | late text/cards/seller metadata/errors and finally cannot affect a fresh request | PASS | [inputs + assertions L20–42](../../tests/chat-session.test.mjs#L20) |
| JS-CHAT-SESSION-BCE1557B12 | account change/unmount invalidation is safe repeatedly and old cleanup is harmless | PASS | [inputs + assertions L43–50](../../tests/chat-session.test.mjs#L43) |
| JS-CHAT-SESSION-0F1B80FA3D | reset cancels a pending SSE read without publishing old metadata | PASS | [inputs + assertions L51–61](../../tests/chat-session.test.mjs#L51) |

## SGHomie/tests/chat-window.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-WINDOW-2D269146EA | compact starts in the corner and expanded provides a larger centered window | PASS | [inputs + assertions L5–14](../../tests/chat-window.test.mjs#L5) |
| JS-CHAT-WINDOW-E26DCD5039 | dragging cannot lose the window beyond any viewport edge | PASS | [inputs + assertions L15–19](../../tests/chat-window.test.mjs#L15) |
| JS-CHAT-WINDOW-5F56D6B513 | resizing keeps the anchor and enforces usable minimums and viewport maximums | PASS | [inputs + assertions L20–26](../../tests/chat-window.test.mjs#L20) |
| JS-CHAT-WINDOW-0548311BA3 | small mobile viewports and orientation changes keep both modes inside the screen | PASS | [inputs + assertions L27–36](../../tests/chat-window.test.mjs#L27) |

## SGHomie/tests/enquiry-behavior.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-ENQUIRY-01 | FE-ENQUIRY-01 history requests only the signed-in email and newest records first | PASS | [inputs + assertions L46–57](../../tests/enquiry-behavior.test.mjs#L46) |
| FE-ENQUIRY-02 | FE-ENQUIRY-02 empty history displays the empty state | PASS | [inputs + assertions L58–65](../../tests/enquiry-behavior.test.mjs#L58) |
| FE-ENQUIRY-03 | FE-ENQUIRY-03 history failure is reported and loading finishes | PASS | [inputs + assertions L66–74](../../tests/enquiry-behavior.test.mjs#L66) |
| FE-ENQUIRY-04 | FE-ENQUIRY-04 submission uses account email, persists pending status, resets and refreshes | PASS | [inputs + assertions L75–90](../../tests/enquiry-behavior.test.mjs#L75) |
| FE-ENQUIRY-05 | FE-ENQUIRY-05 failed insertion preserves all input for retry and never announces success | PASS | [inputs + assertions L91–103](../../tests/enquiry-behavior.test.mjs#L91) |
| FE-ENQUIRY-06 | FE-ENQUIRY-06 submission disables its button while the write is pending | PASS | [inputs + assertions L104–114](../../tests/enquiry-behavior.test.mjs#L104) |

## SGHomie/tests/enquiry-policy.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-ENQUIRY-POLICY-61A70038A5 | enquiry insert migration removes anonymous inserts and permits authenticated inserts | PASS | [inputs + assertions L8–13](../../tests/enquiry-policy.test.mjs#L8) |
| JS-ENQUIRY-POLICY-91C372BB46 | enquiry read and admin management policies remain unchanged | PASS | [inputs + assertions L14–18](../../tests/enquiry-policy.test.mjs#L14) |

## SGHomie/tests/enquiry-response-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-ENQ-01 | BE-ENQ-01 preflight is available without authentication or external operations | PASS | [inputs + assertions L36–41](../../tests/enquiry-response-endpoint.test.mjs#L36) |
| BE-ENQ-02 | BE-ENQ-02 anonymous callers cannot read enquiries write responses or send email | PASS | [inputs + assertions L42–47](../../tests/enquiry-response-endpoint.test.mjs#L42) |
| BE-ENQ-03 | BE-ENQ-03 invalid sessions and non-admins are denied before enquiry access or email | PASS | [inputs + assertions L48–56](../../tests/enquiry-response-endpoint.test.mjs#L48) |
| BE-ENQ-04 | BE-ENQ-04 authenticated admin can respond with caller validation before service-role enquiry access | PASS | [inputs + assertions L57–69](../../tests/enquiry-response-endpoint.test.mjs#L57) |
| BE-ENQ-05 | BE-ENQ-05 enquiry read or update failure prevents email and returns failure | PASS | [inputs + assertions L70–76](../../tests/enquiry-response-endpoint.test.mjs#L70) |

## SGHomie/tests/hdb-location-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-LOC-01 | BE-LOC-01 preflight and unsupported methods do not initialize clients or contact providers | PASS | [inputs + assertions L70–76](../../tests/hdb-location-endpoint.test.mjs#L70) |
| BE-LOC-02 | BE-LOC-02 missing session is rejected before SDK or provider access | PASS | [inputs + assertions L77–82](../../tests/hdb-location-endpoint.test.mjs#L77) |
| BE-LOC-03 | BE-LOC-03 invalid session and buyer roles fail before address lookup or verification writes | PASS | [inputs + assertions L83–91](../../tests/hdb-location-endpoint.test.mjs#L83) |
| BE-LOC-04 | BE-LOC-04 postal-code equivalence partitions reject malformed inputs before network access | PASS | [inputs + assertions L92–101](../../tests/hdb-location-endpoint.test.mjs#L92) |
| BE-LOC-05 | BE-LOC-05 accepted postal formats normalize and produce seller-bound authoritative verification | PASS | [inputs + assertions L102–120](../../tests/hdb-location-endpoint.test.mjs#L102) |
| BE-LOC-06 | BE-LOC-06 fuzzy postal matches are rejected without HDB queries or tokens | PASS | [inputs + assertions L121–128](../../tests/hdb-location-endpoint.test.mjs#L121) |
| BE-LOC-07 | BE-LOC-07 street abbreviation fallback still requires the same block and street | PASS | [inputs + assertions L129–137](../../tests/hdb-location-endpoint.test.mjs#L129) |
| BE-LOC-08 | BE-LOC-08 unknown and nonresidential HDB addresses issue no verification token | PASS | [inputs + assertions L138–145](../../tests/hdb-location-endpoint.test.mjs#L138) |
| BE-LOC-09 | BE-LOC-09 expired OneMap authentication refreshes once and cached fresh tokens are reused | PASS | [inputs + assertions L146–153](../../tests/hdb-location-endpoint.test.mjs#L146) |
| BE-LOC-10 | BE-LOC-10 repeated token rejection stops after one refresh and returns service unavailability | PASS | [inputs + assertions L154–160](../../tests/hdb-location-endpoint.test.mjs#L154) |
| BE-LOC-11 | BE-LOC-11 upstream authentication and dataset failures cannot become verified addresses | PASS | [inputs + assertions L161–169](../../tests/hdb-location-endpoint.test.mjs#L161) |
| BE-LOC-12 | BE-LOC-12 nonfinite coordinates and verification persistence failure fail closed | PASS | [inputs + assertions L170–177](../../tests/hdb-location-endpoint.test.mjs#L170) |
| BE-LOC-13 | BE-LOC-13 missing blank zero or geographically invalid coordinates cannot be verified as an HDB location | PASS | [inputs + assertions L178–188](../../tests/hdb-location-endpoint.test.mjs#L178) |

## SGHomie/tests/image-cleanup-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-IMG-01 | BE-IMG-01 preflight and unsupported methods never initialize storage | PASS | [inputs + assertions L40–46](../../tests/image-cleanup-endpoint.test.mjs#L40) |
| BE-IMG-02 | BE-IMG-02 anonymous and user-level callers cannot invoke privileged cleanup | PASS | [inputs + assertions L47–54](../../tests/image-cleanup-endpoint.test.mjs#L47) |
| BE-IMG-03 | BE-IMG-03 configured server keys work through apikey and Bearer authentication | PASS | [inputs + assertions L55–65](../../tests/image-cleanup-endpoint.test.mjs#L55) |
| BE-IMG-04 | BE-IMG-04 public signed encoded and legacy linked paths are preserved while external URLs do not protect unrelated files | PASS | [inputs + assertions L66–76](../../tests/image-cleanup-endpoint.test.mjs#L66) |
| BE-IMG-05 | BE-IMG-05 paginated storage traversal and 100-object deletion batches cover every orphan exactly once | PASS | [inputs + assertions L77–86](../../tests/image-cleanup-endpoint.test.mjs#L77) |
| BE-IMG-06 | BE-IMG-06 images linked by properties beyond the first database page are never deleted | PASS | [inputs + assertions L87–95](../../tests/image-cleanup-endpoint.test.mjs#L87) |
| BE-IMG-07 | BE-IMG-07 database and storage listing failures stop before any deletion | PASS | [inputs + assertions L96–102](../../tests/image-cleanup-endpoint.test.mjs#L96) |
| BE-IMG-08 | BE-IMG-08 failed deletion returns an error rather than a successful cleanup count | PASS | [inputs + assertions L103–107](../../tests/image-cleanup-endpoint.test.mjs#L103) |

## SGHomie/tests/listing-analytics.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-LISTING-ANALYTICS-B956F693DF | averages individual listing prices and uses listing counts for the popular area | PASS | [inputs + assertions L7–16](../../tests/listing-analytics.test.mjs#L7) |
| JS-LISTING-ANALYTICS-343717F7CE | normalizes town names, falls back to location and preserves ties honestly | PASS | [inputs + assertions L17–24](../../tests/listing-analytics.test.mjs#L17) |
| JS-LISTING-ANALYTICS-FFDA69C76C | empty or invalid prices show missing data rather than inventing zero averages | PASS | [inputs + assertions L25–32](../../tests/listing-analytics.test.mjs#L25) |

## SGHomie/tests/listing-counts.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-LISTING-COUNTS-AE7BDCCA1B | counts approved HDB rows and normalized distinct towns across response pages | PASS | [inputs + assertions L18–27](../../tests/listing-counts.test.mjs#L18) |
| JS-LISTING-COUNTS-878E47E006 | an empty approved catalog reports real zero counts | PASS | [inputs + assertions L28–31](../../tests/listing-counts.test.mjs#L28) |
| JS-LISTING-COUNTS-F094212B94 | failed or incomplete fetches reject instead of publishing false zero or partial totals | PASS | [inputs + assertions L32–38](../../tests/listing-counts.test.mjs#L32) |

## SGHomie/tests/property-details-lifecycle.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-PROPERTY-DETAILS-LIFECYCLE-CA6E2AF7D2 | effect replay cancels the old fetch and never subscribes after cleanup | PASS | [inputs + assertions L292–315](../../tests/property-details-lifecycle.test.mjs#L292) |
| JS-PROPERTY-DETAILS-LIFECYCLE-05E5279BBF | an unmapped amenity type still supplies a Leaflet marker icon | PASS | [inputs + assertions L316–322](../../tests/property-details-lifecycle.test.mjs#L316) |
| JS-PROPERTY-DETAILS-LIFECYCLE-30AED74B26 | revisiting a property while channel removal is pending owns a fresh subscription | PASS | [inputs + assertions L323–341](../../tests/property-details-lifecycle.test.mjs#L323) |
| JS-PROPERTY-DETAILS-LIFECYCLE-E60915C148 | navigation ignores a realtime count response arriving after the old page cleanup | PASS | [inputs + assertions L342–370](../../tests/property-details-lifecycle.test.mjs#L342) |
| JS-PROPERTY-DETAILS-LIFECYCLE-EFEECB871C | a valuation response from the previous property route is ignored | PASS | [inputs + assertions L371–404](../../tests/property-details-lifecycle.test.mjs#L371) |
| JS-PROPERTY-DETAILS-LIFECYCLE-19173CE959 | logged-out valuation requests open the existing auth modal without invoking the service | PASS | [inputs + assertions L405–423](../../tests/property-details-lifecycle.test.mjs#L405) |
| JS-PROPERTY-DETAILS-LIFECYCLE-55F77FFDBE | property content appears while independent interest lookups are pending and map mounts on approach | PASS | [inputs + assertions L424–463](../../tests/property-details-lifecycle.test.mjs#L424) |
| JS-PROPERTY-DETAILS-LIFECYCLE-9210829861 | map mounts eagerly when IntersectionObserver is unavailable | PASS | [inputs + assertions L464–473](../../tests/property-details-lifecycle.test.mjs#L464) |
| JS-PROPERTY-DETAILS-LIFECYCLE-8167E0C84C | valuation CTA prevents duplicates, shows staged copy, renders the hierarchy and clears timers | PASS | [inputs + assertions L474–523](../../tests/property-details-lifecycle.test.mjs#L474) |
| JS-PROPERTY-DETAILS-LIFECYCLE-50EBAC6DEC | below, within and above asking-price labels stay human-readable | PASS | [inputs + assertions L524–547](../../tests/property-details-lifecycle.test.mjs#L524) |
| JS-PROPERTY-DETAILS-LIFECYCLE-6DCB927711 | unmounting a pending valuation clears both timers and ignores its response | PASS | [inputs + assertions L548–567](../../tests/property-details-lifecycle.test.mjs#L548) |
| JS-PROPERTY-DETAILS-LIFECYCLE-289C16518A | valuation failure clears staged timers and leaves a retry action available | PASS | [inputs + assertions L568–589](../../tests/property-details-lifecycle.test.mjs#L568) |
| JS-PROPERTY-DETAILS-LIFECYCLE-8DD6C741DD | changing property routes clears the prior valuation stage timers | PASS | [inputs + assertions L590–607](../../tests/property-details-lifecycle.test.mjs#L590) |

## SGHomie/tests/property-valuation-frontend.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-PROPERTY-VALUATION-FRONTEND-F39607F44C | valuation sends only the property ID and passes the authenticated session token | PASS | [inputs + assertions L74–83](../../tests/property-valuation-frontend.test.mjs#L74) |
| JS-PROPERTY-VALUATION-FRONTEND-9D2FD3E6CE | empty property IDs fail before session or function calls | PASS | [inputs + assertions L84–90](../../tests/property-valuation-frontend.test.mjs#L84) |
| JS-PROPERTY-VALUATION-FRONTEND-C1C8E4DB7C | missing sessions and session lookup errors are controlled authentication failures | PASS | [inputs + assertions L91–98](../../tests/property-valuation-frontend.test.mjs#L91) |
| JS-PROPERTY-VALUATION-FRONTEND-4E3B5FF96E | function failures retain controlled authentication, network, unavailable and generic categories | PASS | [inputs + assertions L99–118](../../tests/property-valuation-frontend.test.mjs#L99) |
| JS-PROPERTY-VALUATION-FRONTEND-FE9B70E6A1 | malformed success responses are rejected instead of rendered | PASS | [inputs + assertions L119–137](../../tests/property-valuation-frontend.test.mjs#L119) |
| JS-PROPERTY-VALUATION-FRONTEND-C8165EE984 | price-position labels are customer-facing and specific | PASS | [inputs + assertions L138–143](../../tests/property-valuation-frontend.test.mjs#L138) |

## SGHomie/tests/protected-route-contract.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-ROUTE-01 | FE-ROUTE-01 pending authentication shows loading and withholds protected content | PASS | [inputs + assertions L16–22](../../tests/protected-route-contract.test.mjs#L16) |
| FE-ROUTE-02 | FE-ROUTE-02 an unauthenticated visitor is redirected with replacement history | PASS | [inputs + assertions L23–30](../../tests/protected-route-contract.test.mjs#L23) |
| FE-ROUTE-03 | FE-ROUTE-03 an incomplete authenticated profile cannot open protected content | PASS | [inputs + assertions L31–37](../../tests/protected-route-contract.test.mjs#L31) |
| FE-ROUTE-04 | FE-ROUTE-04 a complete authenticated profile receives protected content | PASS | [inputs + assertions L38–43](../../tests/protected-route-contract.test.mjs#L38) |
| FE-ROUTE-05 | FE-ROUTE-05 loading takes precedence over an existing incomplete session | PASS | [inputs + assertions L44–48](../../tests/protected-route-contract.test.mjs#L44) |

## SGHomie/tests/protected-route.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-PROTECTED-ROUTE-610D020967 | unresolved authentication renders loading state without redirecting | PASS | [inputs + assertions L8–27](../../tests/protected-route.test.mjs#L8) |
| JS-PROTECTED-ROUTE-BD5C60D9AB | fresh anonymous navigation to Profile still warns after an intentional sign-out | PASS | [inputs + assertions L17–27](../../tests/protected-route.test.mjs#L17) |
| JS-PROTECTED-ROUTE-D4B49B5B5F | fresh anonymous navigation to Search still warns after an intentional sign-out | PASS | [inputs + assertions L17–27](../../tests/protected-route.test.mjs#L17) |
| JS-PROTECTED-ROUTE-54CF0FACDB | fresh anonymous navigation to SellerDashboard still warns after an intentional sign-out | PASS | [inputs + assertions L17–27](../../tests/protected-route.test.mjs#L17) |
| JS-PROTECTED-ROUTE-57ED658866 | intentional sign-out from another mounted protected page removes content without warning | PASS | [inputs + assertions L28–52](../../tests/protected-route.test.mjs#L28) |
| JS-PROTECTED-ROUTE-0963C4DD68 | missing user cannot render PropertyDetails | PASS | [inputs + assertions L39–52](../../tests/protected-route.test.mjs#L39) |
| JS-PROTECTED-ROUTE-471AEBD6A7 | Supabase anonymous user cannot render PropertyDetails | PASS | [inputs + assertions L39–52](../../tests/protected-route.test.mjs#L39) |
| JS-PROTECTED-ROUTE-4D0A16585A | registered user can render PropertyDetails without completing the buyer profile | PASS | [inputs + assertions L53–60](../../tests/protected-route.test.mjs#L53) |
| JS-PROTECTED-ROUTE-1F96A3794E | PropertyDetails waits for profile role resolution but ignores profile completion | PASS | [inputs + assertions L61–78](../../tests/protected-route.test.mjs#L61) |
| JS-PROTECTED-ROUTE-9532D9DA3D | other protected routes continue to require profile setup | PASS | [inputs + assertions L79–88](../../tests/protected-route.test.mjs#L79) |
| JS-PROTECTED-ROUTE-E462D0BC41 | reactive sign-out removes property content and applies the guest gate on rerender | PASS | [inputs + assertions L89–103](../../tests/protected-route.test.mjs#L89) |
| JS-PROTECTED-ROUTE-7413C3011D | replayed StrictMode effects reuse the same auth toast ID and message | PASS | [inputs + assertions L104–114](../../tests/protected-route.test.mjs#L104) |
| JS-PROTECTED-ROUTE-1E18D4D770 | direct seller dashboard navigation denies a registered buyer | PASS | [inputs + assertions L115–126](../../tests/protected-route.test.mjs#L115) |
| JS-PROTECTED-ROUTE-9F13745B92 | seller route waits for profile role resolution instead of assuming buyer | PASS | [inputs + assertions L127–136](../../tests/protected-route.test.mjs#L127) |
| JS-PROTECTED-ROUTE-E56A43FA6E | resolved seller role permits the dashboard and admin is redirected to its dashboard | PASS | [inputs + assertions L137–152](../../tests/protected-route.test.mjs#L137) |
| JS-PROTECTED-ROUTE-4E6D317E7A | seller route itself applies the role guard for direct URLs | PASS | [inputs + assertions L153–155](../../tests/protected-route.test.mjs#L153) |

## SGHomie/tests/search-behavior.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-SEARCH-01 | FE-SEARCH-01 the initial search reads approved HDB rows and newest first | PASS | [inputs + assertions L34–44](../../tests/search-behavior.test.mjs#L34) |
| FE-SEARCH-02 | FE-SEARCH-02 4 ROOM filters listing room-type text without requiring four bedrooms | PASS | [inputs + assertions L45–52](../../tests/search-behavior.test.mjs#L45) |
| FE-SEARCH-03 | FE-SEARCH-03 EXECUTIVE produces a valid text filter rather than a NaN bedroom query | PASS | [inputs + assertions L53–61](../../tests/search-behavior.test.mjs#L53) |
| FE-SEARCH-04 | FE-SEARCH-04 ALL leaves town and room type unrestricted | PASS | [inputs + assertions L62–67](../../tests/search-behavior.test.mjs#L62) |
| FE-SEARCH-05 | FE-SEARCH-05 explicit town and inclusive price limits are passed to the catalog | PASS | [inputs + assertions L68–78](../../tests/search-behavior.test.mjs#L68) |
| FE-SEARCH-06 | FE-SEARCH-06 a catalog failure shows an alert rather than a false no-match result | PASS | [inputs + assertions L79–85](../../tests/search-behavior.test.mjs#L79) |
| FE-SEARCH-07 | FE-SEARCH-07 an empty successful catalog displays no matches | PASS | [inputs + assertions L86–92](../../tests/search-behavior.test.mjs#L86) |
| FE-SEARCH-08 | FE-SEARCH-08 selecting a card updates the map selection and accessible pressed state | PASS | [inputs + assertions L93–100](../../tests/search-behavior.test.mjs#L93) |
| FE-SEARCH-09 | FE-SEARCH-09 an unsupported profile flat size is rejected before a catalog query | PASS | [inputs + assertions L101–107](../../tests/search-behavior.test.mjs#L101) |

## SGHomie/tests/search-resources.test.mjs

Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-SEARCH-RESOURCES-FBE75B4D2F | Explore selects only the card and map fields and keeps query controls explicit | FAIL: The input did not match the regular expression /\.(?:eq\|gte\|lte\|order)\('bedrooms'/. Input: | [inputs + assertions L8–16](../../tests/search-resources.test.mjs#L8) |
| JS-SEARCH-RESOURCES-E58BA9A67F | Explore keeps the first two card images eager and lazily decodes later images | PASS | [inputs + assertions L17–22](../../tests/search-resources.test.mjs#L17) |
| JS-SEARCH-RESOURCES-3BD253DB8A | Explore map remains mounted as a primary search feature with its existing tile source | PASS | [inputs + assertions L23–27](../../tests/search-resources.test.mjs#L23) |

## SGHomie/tests/sell-flow.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-SELL-FLOW-D051CC47CE | complete sell flow persists confirmed details and private unit before emitting a draft card | PASS | [inputs + assertions L79–105](../../tests/sell-flow.test.mjs#L79) |
| JS-SELL-FLOW-FC3FCC038A | unknown details and no price create a partial draft without inventing a private unit | PASS | [inputs + assertions L106–121](../../tests/sell-flow.test.mjs#L106) |
| JS-SELL-FLOW-96DD6E8560 | user can choose an independent price and pricing-provider failures allow skipping | PASS | [inputs + assertions L122–130](../../tests/sell-flow.test.mjs#L122) |
| JS-SELL-FLOW-E331FAD6B2 | failInsert | PASS | [inputs + assertions L133–144](../../tests/sell-flow.test.mjs#L133) |
| JS-SELL-FLOW-2479E830AC | failPrivate | PASS | [inputs + assertions L133–144](../../tests/sell-flow.test.mjs#L133) |
| JS-SELL-FLOW-E4A6E34F6F | a seller context cannot bypass auth or validation, and Buy escapes an active seller intake | PASS | [inputs + assertions L145–163](../../tests/sell-flow.test.mjs#L145) |
| JS-SELL-FLOW-4142DAC463 | price decisions distinguish acceptance, own prices, unknowns and ambiguous messages | PASS | [inputs + assertions L164–182](../../tests/sell-flow.test.mjs#L164) |
| JS-SELL-FLOW-A135DA50AF | profile contact details remove redundant questions and survive extraction and natural price acceptance | PASS | [inputs + assertions L183–201](../../tests/sell-flow.test.mjs#L183) |
| JS-SELL-FLOW-2853FCAEF4 | intake asks only for missing or invalid profile contacts | PASS | [inputs + assertions L202–214](../../tests/sell-flow.test.mjs#L202) |
| JS-SELL-FLOW-6E9069DC29 | extraction sends only untrusted seller facts and validates unknown/invalid fields | PASS | [inputs + assertions L215–229](../../tests/sell-flow.test.mjs#L215) |
| JS-SELL-FLOW-0D7E4B800C | estimate rejects sparse details, invented extreme values and provider failures | PASS | [inputs + assertions L230–240](../../tests/sell-flow.test.mjs#L230) |

## SGHomie/tests/supabase-config.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-CONFIG-01 | FE-CONFIG-01 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](../../tests/supabase-config.test.mjs#L28) |
| FE-CONFIG-02 | FE-CONFIG-02 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](../../tests/supabase-config.test.mjs#L28) |
| FE-CONFIG-03 | FE-CONFIG-03 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](../../tests/supabase-config.test.mjs#L28) |
| FE-CONFIG-04 | FE-CONFIG-04 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](../../tests/supabase-config.test.mjs#L28) |
| FE-CONFIG-05 | FE-CONFIG-05 malformed project URL is rejected | PASS | [inputs + assertions L33–46](../../tests/supabase-config.test.mjs#L33) |
| FE-CONFIG-06 | FE-CONFIG-06 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](../../tests/supabase-config.test.mjs#L42) |
| FE-CONFIG-07 | FE-CONFIG-07 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](../../tests/supabase-config.test.mjs#L42) |
| FE-CONFIG-08 | FE-CONFIG-08 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](../../tests/supabase-config.test.mjs#L42) |
| FE-CONFIG-09 | FE-CONFIG-09 a privileged Supabase secret key is explicitly rejected in the browser | PASS | [inputs + assertions L47–65](../../tests/supabase-config.test.mjs#L47) |
| FE-CONFIG-10 | FE-CONFIG-10 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-11 | FE-CONFIG-11 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-12 | FE-CONFIG-12 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-13 | FE-CONFIG-13 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-14 | FE-CONFIG-14 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-15 | FE-CONFIG-15 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](../../tests/supabase-config.test.mjs#L61) |
| FE-CONFIG-16 | FE-CONFIG-16 publishable configuration is accepted after trimming whitespace | PASS | [inputs + assertions L66–69](../../tests/supabase-config.test.mjs#L66) |
| FE-CONFIG-17 | FE-CONFIG-17 a legacy anon-role JWT fixture is accepted | PASS | [inputs + assertions L70–73](../../tests/supabase-config.test.mjs#L70) |
| FE-CONFIG-18 | FE-CONFIG-18 a local HTTP Supabase URL is supported | PASS | [inputs + assertions L74–76](../../tests/supabase-config.test.mjs#L74) |

## SGHomie/tests/valuation-range.test.mjs

Level: Component contract (isolated JSX). Technique: Rendered output/accessibility assertions and invalid-input branches. Risk: High.
Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.
Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-VALUATION-RANGE-72F6D4F032 | ordinary scale keeps 12% padding and maps the actual estimate linearly | PASS | [inputs + assertions L27–38](../../tests/valuation-range.test.mjs#L27) |
| JS-VALUATION-RANGE-1E5ABDB453 | asking marker maps below, within, above, and at either bound without changing classification inputs | PASS | [inputs + assertions L39–52](../../tests/valuation-range.test.mjs#L39) |
| JS-VALUATION-RANGE-B13E475764 | narrow and equal ranges have a safe non-zero display domain | PASS | [inputs + assertions L53–60](../../tests/valuation-range.test.mjs#L53) |
| JS-VALUATION-RANGE-EAC92E3433 | extreme outliers compress tails while preserving a readable linear likely range and continuation | PASS | [inputs + assertions L61–84](../../tests/valuation-range.test.mjs#L61) |
| JS-VALUATION-RANGE-8511CB1BB6 | moderate outliers stay linear and positions share the same mapping | PASS | [inputs + assertions L85–91](../../tests/valuation-range.test.mjs#L85) |
| JS-VALUATION-RANGE-D6AC7FCC0B | invalid, inconsistent, non-finite and overflowing values fail safely | PASS | [inputs + assertions L92–130](../../tests/valuation-range.test.mjs#L92) |
| JS-VALUATION-RANGE-EF72994C55 | gauge anchors all three valuation labels and retains an accessible asking marker | PASS | [inputs + assertions L131–159](../../tests/valuation-range.test.mjs#L131) |
| JS-VALUATION-RANGE-D7DA6FC838 | asking marker keeps its below, within and above status text | PASS | [inputs + assertions L160–180](../../tests/valuation-range.test.mjs#L160) |
| JS-VALUATION-RANGE-5A1A8C0360 | outlier asking marker has exact value and explicit displayed-scale cue | PASS | [inputs + assertions L181–202](../../tests/valuation-range.test.mjs#L181) |
| JS-VALUATION-RANGE-F262790938 | valuation motion is reduced when the user requests less motion | PASS | [inputs + assertions L203–209](../../tests/valuation-range.test.mjs#L203) |
| JS-VALUATION-RANGE-1D494CB7D5 | invalid gauge values render an explanatory fallback instead of a broken scale | PASS | [inputs + assertions L210–215](../../tests/valuation-range.test.mjs#L210) |

## SGHomie/tests/valuation.test.mjs

Level: Handler integration (actual shared valuation handler; mocked database/upstream). Technique: Black-box request/response contracts and white-box authentication/provenance/error paths. Risk: High.
Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.
Level: Unit (valuation feature/lease helpers). Technique: Input/output boundaries, feature-order, and target-exclusion assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-VALUATION-318A7B9074 | lease reference advances by whole calendar months and rejects invalid states | PASS | [inputs + assertions L91–100](../../tests/valuation.test.mjs#L91) |
| JS-VALUATION-03E61B5980 | feature mapping follows the CatBoost contract and keeps asking price outside features | PASS | [inputs + assertions L101–110](../../tests/valuation.test.mjs#L101) |
| JS-VALUATION-B4BB3E932C | demo storey range follows the training midpoint convention | PASS | [inputs + assertions L111–118](../../tests/valuation.test.mjs#L111) |
| JS-VALUATION-A538B45E30 | local demo fixtures are eligible only with both explicit local gates | PASS | [inputs + assertions L119–157](../../tests/valuation.test.mjs#L119) |
| JS-VALUATION-496530AFE1 | Edge timing logs correlate to the returned request ID without logging request secrets or features | PASS | [inputs + assertions L158–188](../../tests/valuation.test.mjs#L158) |
| JS-VALUATION-EF299492D6 | hosted demos require the independent hosted flag, canonical provenance and approved status | PASS | [inputs + assertions L189–227](../../tests/valuation.test.mjs#L189) |
| JS-VALUATION-4FA08F7461 | verified complete seller inputs pass; incomplete and unverified rows fail closed | PASS | [inputs + assertions L228–249](../../tests/valuation.test.mjs#L228) |
| JS-VALUATION-199B21B30E | caller-scoped property lookup preserves RLS and inaccessible rows are indistinguishable | PASS | [inputs + assertions L250–264](../../tests/valuation.test.mjs#L250) |
| JS-VALUATION-B1495C9B24 | authentication, request shape, lease and upstream response are validated safely | PASS | [inputs + assertions L265–290](../../tests/valuation.test.mjs#L265) |
| JS-VALUATION-0411449CC0 | canonical seed contains both deterministic batches and removes only obsolete seed signatures | PASS | [inputs + assertions L291–342](../../tests/valuation.test.mjs#L291) |
| JS-VALUATION-2971028FD3 | valuation migrations preserve legacy inputs and validate optional storey ranges | PASS | [inputs + assertions L343–371](../../tests/valuation.test.mjs#L343) |

## Excluded Node container completions

These parent completions are preserved in JSON for auditability and excluded from leaf case totals in agreement with Node JUnit.

- catalog failures never fabricate counts or fall through to a provider: PASS (SGHomie/tests/chat-onboarding.test.mjs).
- failed property/private writes never return success or a draft card: PASS (SGHomie/tests/sell-flow.test.mjs).

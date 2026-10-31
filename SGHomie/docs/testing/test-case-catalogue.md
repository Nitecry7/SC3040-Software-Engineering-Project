# SG Homie complete test-case catalogue

> Historical pre-merge snapshot: these are the original 580 outcomes at `cb3f743`. Source links point to frozen text snapshots, so later changes on main do not alter the recorded procedures. See the [after-main verification](merge-verification.md) and [current case catalogue](test-case-catalogue-after-main.md) for the latest run.

Generated 2026-10-28T01:54:30.615614+08:00. **580 leaf cases**: 2 FAIL, 578 PASS.

Reconciliation: Node 225 leaf cases from 226 reporter records (1 container completions excluded); pytest 319 parameter-expanded cases; pgTAP 36 assertions.

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
| SGHomie/tests/auth-context-profile-dedupe.test.mjs | 1 | 1 PASS |
| SGHomie/tests/auth-modal-guards.test.mjs | 8 | 8 PASS |
| SGHomie/tests/auth-modal.test.mjs | 5 | 1 FAIL, 4 PASS |
| SGHomie/tests/buy-flow.test.mjs | 53 | 53 PASS |
| SGHomie/tests/chat-markdown-security.test.mjs | 7 | 7 PASS |
| SGHomie/tests/chat-provider.test.mjs | 8 | 8 PASS |
| SGHomie/tests/chat-window.test.mjs | 4 | 4 PASS |
| SGHomie/tests/enquiry-behavior.test.mjs | 6 | 6 PASS |
| SGHomie/tests/enquiry-response-endpoint.test.mjs | 5 | 5 PASS |
| SGHomie/tests/hdb-location-endpoint.test.mjs | 13 | 13 PASS |
| SGHomie/tests/image-cleanup-endpoint.test.mjs | 8 | 8 PASS |
| SGHomie/tests/listing-analytics.test.mjs | 3 | 3 PASS |
| SGHomie/tests/listing-counts.test.mjs | 3 | 3 PASS |
| SGHomie/tests/property-details-lifecycle.test.mjs | 13 | 13 PASS |
| SGHomie/tests/property-valuation-frontend.test.mjs | 6 | 6 PASS |
| SGHomie/tests/protected-route.test.mjs | 5 | 5 PASS |
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
| ML-API-207F0A9E5E | test_health_and_model_info_expose_only_safe_fields | PASS | [inputs + assertions L125–145](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L125) |
| ML-API-1A7E291715 | test_openapi_docs_are_enabled | PASS | [inputs + assertions L148–150](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L148) |
| ML-API-A9B483D1FC | test_prediction_defaults_to_90_percent_and_returns_typed_interval | PASS | [inputs + assertions L153–172](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L153) |
| ML-API-06062F3A60 | test_supported_non_default_coverage_levels_work[0.8] | PASS | [inputs + assertions L175–181](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L175) |
| ML-API-6CF91907EF | test_supported_non_default_coverage_levels_work[0.95] | PASS | [inputs + assertions L175–181](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L175) |
| ML-API-068237959E | test_unsupported_or_coerced_coverage_is_rejected[0.85] | PASS | [inputs + assertions L184–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L184) |
| ML-API-729F5BE795 | test_unsupported_or_coerced_coverage_is_rejected[0.99] | PASS | [inputs + assertions L184–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L184) |
| ML-API-5C5262DC2F | test_unsupported_or_coerced_coverage_is_rejected[90%] | PASS | [inputs + assertions L184–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L184) |
| ML-API-A3FE421E52 | test_unsupported_or_coerced_coverage_is_rejected[0.9] | PASS | [inputs + assertions L184–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L184) |
| ML-API-2FE84C81F9 | test_unsupported_or_coerced_coverage_is_rejected[90] | PASS | [inputs + assertions L184–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L184) |
| ML-API-494D18E2A7 | test_non_finite_coverage_returns_structured_validation_error | PASS | [inputs + assertions L192–199](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L192) |
| ML-API-7C2FF1DEC3 | test_integral_numeric_inputs_are_accepted | PASS | [inputs + assertions L202–204](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L202) |
| ML-API-81BFFCF89E | test_numeric_strings_are_rejected[floor_area_sqm-92] | PASS | [inputs + assertions L207–214](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L207) |
| ML-API-7C4DD17A53 | test_numeric_strings_are_rejected[asking_price-500000] | PASS | [inputs + assertions L207–214](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L207) |
| ML-API-747EA4F08D | test_invalid_month_is_rejected[0] | PASS | [inputs + assertions L217–221](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L217) |
| ML-API-99D3C58F0E | test_invalid_month_is_rejected[13] | PASS | [inputs + assertions L217–221](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L217) |
| ML-API-68AFF1BA91 | test_invalid_month_is_rejected[1.5] | PASS | [inputs + assertions L217–221](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L217) |
| ML-API-09284AAB44 | test_blank_required_categories_are_rejected[town-   ] | PASS | [inputs + assertions L224–237](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L224) |
| ML-API-EDE41FB931 | test_blank_required_categories_are_rejected[flat_type-] | PASS | [inputs + assertions L224–237](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L224) |
| ML-API-F0D3B31BAA | test_blank_required_categories_are_rejected[block- ] | PASS | [inputs + assertions L224–237](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L224) |
| ML-API-FB3B4CE02D | test_blank_required_categories_are_rejected[street_name-] | PASS | [inputs + assertions L224–237](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L224) |
| ML-API-7A4EAA8364 | test_blank_required_categories_are_rejected[flat_model-\t] | PASS | [inputs + assertions L224–237](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L224) |
| ML-API-7F225E6E8C | test_invalid_numeric_inputs_are_rejected[floor_area_sqm-nan] | PASS | [inputs + assertions L240–247](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L240) |
| ML-API-F5CA80C3E4 | test_invalid_numeric_inputs_are_rejected[storey_mid-inf] | PASS | [inputs + assertions L240–247](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L240) |
| ML-API-BB1458F653 | test_invalid_numeric_inputs_are_rejected[remaining_lease_months--1] | PASS | [inputs + assertions L240–247](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L240) |
| ML-API-B0EF5CE4EB | test_missing_or_unexpected_fields_are_rejected | PASS | [inputs + assertions L250–256](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L250) |
| ML-API-200D09064C | test_known_town_normalizes_case_and_whitespace_and_unknown_falls_back | PASS | [inputs + assertions L259–271](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L259) |
| ML-API-DDD32EE31B | test_timing_log_reuses_the_private_correlation_id_without_logging_features_or_secrets | PASS | [inputs + assertions L274–307](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L274) |
| ML-API-78A3A26437 | test_asking_price_is_context_only_and_uses_existing_classifier | PASS | [inputs + assertions L310–341](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L310) |
| ML-API-0E4F1D74E9 | test_prediction_lock_is_held_only_for_model_call | PASS | [inputs + assertions L344–368](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L344) |
| ML-API-641EDE7349 | test_http_matches_direct_bundle_prediction | PASS | [inputs + assertions L371–387](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L371) |
| ML-API-325489443C | test_unseen_categories_and_absent_raw_csv_do_not_block_inference | PASS | [inputs + assertions L390–410](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L390) |
| ML-API-F78CEA68EE | test_bundle_loads_once_per_application_lifespan | PASS | [inputs + assertions L413–435](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L413) |
| ML-API-7960818AC3 | test_startup_fails_clearly_when_bundle_is_missing | PASS | [inputs + assertions L438–441](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L438) |
| ML-API-4ECC633F49 | test_startup_fails_clearly_on_checksum_corruption | PASS | [inputs + assertions L444–451](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L444) |
| ML-API-E4988166EC | test_bundle_path_defaults_and_environment_override | PASS | [inputs + assertions L454–459](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L454) |
| ML-API-3B172FB36A | test_unexpected_prediction_error_is_logged_and_sanitized | PASS | [inputs + assertions L462–470](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L462) |
| ML-API-1584E40E78 | test_hosted_auth_protects_prediction_and_model_info_but_not_health | PASS | [inputs + assertions L473–512](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L473) |
| ML-API-075CAB0611 | test_authenticated_http_prediction_matches_bundle_and_discards_artifact_secret | PASS | [inputs + assertions L515–539](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L515) |
| ML-API-D10C2F0332 | test_hosted_auth_configuration_fails_closed | PASS | [inputs + assertions L542–547](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L542) |
| ML-API-BC3D3C69F8 | test_configured_model_version_must_match_bundle | PASS | [inputs + assertions L550–559](evidence/source-snapshots/MLPricePredictorV2/tests/test_api.py.txt#L550) |

## MLPricePredictorV2/tests/test_api_contract_gaps.py

Level: HTTP/component integration (in-process FastAPI TestClient). Technique: Black-box request partitions/boundaries and white-box lifecycle/error probes. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-API-CONTRACT-GAPS-D03236F595 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-2016] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-A736EC46C4 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-True] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-818D0AFA39 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_year-2026] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-9AC2DC56D2 | test_api_rejects_lower_bound_and_type_confusion_inputs[transaction_month-True] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-9C6A81002B | test_api_rejects_lower_bound_and_type_confusion_inputs[floor_area_sqm-0] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-1C90047891 | test_api_rejects_lower_bound_and_type_confusion_inputs[floor_area_sqm-False] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-7C1A1D5A3A | test_api_rejects_lower_bound_and_type_confusion_inputs[storey_mid-0] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-1D1CE51061 | test_api_rejects_lower_bound_and_type_confusion_inputs[storey_mid-True] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-593D4CD325 | test_api_rejects_lower_bound_and_type_confusion_inputs[remaining_lease_months-False] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-1631FD4B29 | test_api_rejects_lower_bound_and_type_confusion_inputs[remaining_lease_months-780] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-7C56EC8DAC | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price-0] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-C38DEF52AD | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price--1] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-503CCDFF7E | test_api_rejects_lower_bound_and_type_confusion_inputs[asking_price-True] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-C31DF5F392 | test_api_rejects_lower_bound_and_type_confusion_inputs[coverage-True] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-4D9AADAF51 | test_api_rejects_lower_bound_and_type_confusion_inputs[town-123] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-FD2281F03A | test_api_rejects_lower_bound_and_type_confusion_inputs[flat_type-value15] | PASS | [inputs + assertions L18–44](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L18) |
| ML-API-CONTRACT-GAPS-C6DF676C8B | test_api_accepts_inclusive_month_and_zero_remaining_lease_boundaries[1] | PASS | [inputs + assertions L47–54](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L47) |
| ML-API-CONTRACT-GAPS-D629F0A644 | test_api_accepts_inclusive_month_and_zero_remaining_lease_boundaries[12] | PASS | [inputs + assertions L47–54](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L47) |
| ML-API-CONTRACT-GAPS-5264FB8B9B | test_api_rejects_target_derived_and_affordability_fields[resale_price] | PASS | [inputs + assertions L57–63](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L57) |
| ML-API-CONTRACT-GAPS-AC9E17726E | test_api_rejects_target_derived_and_affordability_fields[price_per_sqm] | PASS | [inputs + assertions L57–63](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L57) |
| ML-API-CONTRACT-GAPS-440EEFA249 | test_api_rejects_target_derived_and_affordability_fields[income] | PASS | [inputs + assertions L57–63](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L57) |
| ML-API-CONTRACT-GAPS-F3D77CA1D9 | test_api_auth_rejects_malformed_or_padded_credentials[Basic service-test-token] | PASS | [inputs + assertions L66–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L66) |
| ML-API-CONTRACT-GAPS-4D08C5E6E7 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer] | PASS | [inputs + assertions L66–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L66) |
| ML-API-CONTRACT-GAPS-0E0E79EDF7 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer ] | PASS | [inputs + assertions L66–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L66) |
| ML-API-CONTRACT-GAPS-D390B17AFD | test_api_auth_rejects_malformed_or_padded_credentials[Bearer  service-test-token] | PASS | [inputs + assertions L66–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L66) |
| ML-API-CONTRACT-GAPS-B339301895 | test_api_auth_rejects_malformed_or_padded_credentials[Bearer service-test-token ] | PASS | [inputs + assertions L66–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L66) |
| ML-API-CONTRACT-GAPS-7886DF54A0 | test_api_auth_accepts_case_insensitive_bearer_scheme | PASS | [inputs + assertions L84–91](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L84) |
| ML-API-CONTRACT-GAPS-BE565E567A | test_api_health_reports_unavailable_before_lifespan_load | PASS | [inputs + assertions L94–100](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L94) |
| ML-API-CONTRACT-GAPS-348D4DAFF3 | test_api_invalid_auth_mode_stops_startup[unknown] | PASS | [inputs + assertions L103–107](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L103) |
| ML-API-CONTRACT-GAPS-07777E3C18 | test_api_invalid_auth_mode_stops_startup[REQUIRED] | PASS | [inputs + assertions L103–107](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L103) |
| ML-API-CONTRACT-GAPS-948E056C75 | test_api_invalid_auth_mode_stops_startup[ ] | PASS | [inputs + assertions L103–107](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L103) |
| ML-API-CONTRACT-GAPS-054C7B0703 | test_api_shutdown_clears_model_lock_and_service_secret | PASS | [inputs + assertions L110–120](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L110) |
| ML-API-CONTRACT-GAPS-89615F3E1B | test_api_model_failure_releases_prediction_lock_and_allows_retry | PASS | [inputs + assertions L123–137](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L123) |
| ML-API-CONTRACT-GAPS-4443F6D007 | test_api_classification_failure_is_sanitized_after_prediction | PASS | [inputs + assertions L140–152](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L140) |
| ML-API-CONTRACT-GAPS-F3C31B4DE3 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[not-a-uuid] | PASS | [inputs + assertions L155–168](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L155) |
| ML-API-CONTRACT-GAPS-2401EAC3E2 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[private-location-value] | PASS | [inputs + assertions L155–168](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L155) |
| ML-API-CONTRACT-GAPS-AFC1357E59 | test_api_invalid_correlation_hint_is_discarded_from_timing_logs[00000000-0000-0000-0000-000000000000] | PASS | [inputs + assertions L155–168](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L155) |
| ML-API-CONTRACT-GAPS-1571342F4F | test_api_relative_bundle_override_is_project_relative_not_working_directory | PASS | [inputs + assertions L171–174](evidence/source-snapshots/MLPricePredictorV2/tests/test_api_contract_gaps.py.txt#L171) |

## MLPricePredictorV2/tests/test_artifact_retrieval.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-ARTIFACT-RETRIEVAL-0B110EB002 | test_release_bundle_download_is_verified_and_atomically_published | PASS | [inputs + assertions L131–148](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L131) |
| ML-ARTIFACT-RETRIEVAL-5A84CF70B7 | test_downloaded_fixture_bundle_passes_real_bundle_loader | PASS | [inputs + assertions L151–165](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L151) |
| ML-ARTIFACT-RETRIEVAL-1D99B199DF | test_bundle_manifest_mismatch_is_rejected_before_publication | PASS | [inputs + assertions L168–183](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L168) |
| ML-ARTIFACT-RETRIEVAL-7667A56CFE | test_existing_valid_bundle_is_reused_without_token_or_network | PASS | [inputs + assertions L186–198](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L186) |
| ML-ARTIFACT-RETRIEVAL-7649BC1FF7 | test_bad_asset_digest_does_not_publish_bundle | PASS | [inputs + assertions L201–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L201) |
| ML-ARTIFACT-RETRIEVAL-43A44453C4 | test_missing_release_asset_fails_without_publishing | PASS | [inputs + assertions L220–230](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L220) |
| ML-ARTIFACT-RETRIEVAL-2E8A577313 | test_failed_release_request_is_reported_without_publishing | PASS | [inputs + assertions L233–243](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L233) |
| ML-ARTIFACT-RETRIEVAL-3F2AC6910D | test_archive_with_unexpected_path_is_rejected | PASS | [inputs + assertions L246–253](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L246) |
| ML-ARTIFACT-RETRIEVAL-4B8FDFAD65 | test_redirects_never_forward_authorization_header | PASS | [inputs + assertions L256–274](evidence/source-snapshots/MLPricePredictorV2/tests/test_artifact_retrieval.py.txt#L256) |

## MLPricePredictorV2/tests/test_baselines.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BASELINES-A5607B8021 | test_global_median_uses_only_strictly_earlier_history | PASS | [inputs + assertions L39–45](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L39) |
| ML-BASELINES-3BEB07B330 | test_town_flat_type_median_falls_back_to_global_deterministically | PASS | [inputs + assertions L48–56](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L48) |
| ML-BASELINES-625F10F061 | test_town_flat_type_median_uses_only_matching_prior_rows | PASS | [inputs + assertions L59–66](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L59) |
| ML-BASELINES-EFA96D4CDD | test_comparable_selector_uses_physical_distance_not_target_price | PASS | [inputs + assertions L69–89](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L69) |
| ML-BASELINES-7BEB6F27DF | test_candidate_prices_do_not_change_selected_comparable_indices | PASS | [inputs + assertions L92–110](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L92) |
| ML-BASELINES-8A8019F9F5 | test_same_month_and_future_candidates_are_excluded | PASS | [inputs + assertions L113–123](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L113) |
| ML-BASELINES-AB25B91790 | test_comparable_minimum_triggers_town_then_global_fallback | PASS | [inputs + assertions L126–137](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L126) |
| ML-BASELINES-CA99EED5DF | test_comparable_falls_back_to_global_when_town_flat_type_history_is_absent | PASS | [inputs + assertions L140–147](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L140) |
| ML-BASELINES-2CD681E7F7 | test_comparable_lookback_and_maximum_count_are_respected_deterministically | PASS | [inputs + assertions L150–167](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L150) |
| ML-BASELINES-A0947AE35E | test_equal_score_comparables_use_source_index_as_final_tie_breaker | PASS | [inputs + assertions L170–179](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L170) |
| ML-BASELINES-DE1816534F | test_predictors_require_target_rows_without_resale_price | PASS | [inputs + assertions L182–188](evidence/source-snapshots/MLPricePredictorV2/tests/test_baselines.py.txt#L182) |

## MLPricePredictorV2/tests/test_boosted_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BOOSTED-MODELS-16F817F5C7 | test_boosted_schema_is_fixed_and_rejects_target_leakage | PASS | [inputs + assertions L45–53](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L45) |
| ML-BOOSTED-MODELS-F62E9FF26B | test_eight_fixed_configurations_and_device_parameters | PASS | [inputs + assertions L56–67](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L56) |
| ML-BOOSTED-MODELS-4C143EF4BC | test_xgboost_category_vocabularies_are_fit_only_from_training_rows | PASS | [inputs + assertions L70–78](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L70) |
| ML-BOOSTED-MODELS-220B4F68AB | test_catboost_receives_native_categories_and_unseen_values | PASS | [inputs + assertions L81–86](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L81) |
| ML-BOOSTED-MODELS-804D155500 | test_fit_rows_are_stably_sorted_by_transaction_month_and_keep_source_indices | PASS | [inputs + assertions L89–95](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L89) |
| ML-BOOSTED-MODELS-365E98D6F5 | test_cpu_estimators_fit_small_data_and_predict | PASS | [inputs + assertions L98–112](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L98) |
| ML-BOOSTED-MODELS-3EE6412B41 | test_selector_uses_validation_metrics_and_configured_one_percent_band | PASS | [inputs + assertions L115–120](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L115) |
| ML-BOOSTED-MODELS-79D622E2C8 | test_selector_zero_mae_band_requires_exact_equality | PASS | [inputs + assertions L123–127](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L123) |
| ML-BOOSTED-MODELS-936E820FAD | test_final_fit_uses_only_supplied_rows_and_freezes_best_round_count | PASS | [inputs + assertions L130–144](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L130) |
| ML-BOOSTED-MODELS-8A4AE4CC9D | test_validation_labels_are_only_passed_as_evaluation_data | PASS | [inputs + assertions L147–183](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L147) |
| ML-BOOSTED-MODELS-541115757B | test_selection_interface_has_no_test_result_parameter | PASS | [inputs + assertions L186–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_boosted_models.py.txt#L186) |

## MLPricePredictorV2/tests/test_bundle_validation_gaps.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-BUNDLE-VALIDATION-GAPS-A0A3EED58E | test_bundle_metadata_rejects_incompatible_frozen_contract[bundle_format_version-99-Unsupported bundle format] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-18E917B7B7 | test_bundle_metadata_rejects_incompatible_frozen_contract[model_family-unreviewed_model-CatBoost] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-01B607310C | test_bundle_metadata_rejects_incompatible_frozen_contract[model_filename-other.cbm-CatBoost] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-6785BF604B | test_bundle_metadata_rejects_incompatible_frozen_contract[model_serialization_format-pickle-serialization] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-ADDEA2424F | test_bundle_metadata_rejects_incompatible_frozen_contract[model_version-../other-model-Invalid model version] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-9602E7713B | test_bundle_metadata_rejects_incompatible_frozen_contract[training_cutoff-2026-01-training cutoff] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-B092F5E077 | test_bundle_metadata_rejects_incompatible_frozen_contract[calibration_cutoff-2026-01-calibration cutoff] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-C4C55D4E5F | test_bundle_metadata_rejects_incompatible_frozen_contract[feature_schema_version-unknown-v99-feature schema] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-4C17C6BB3D | test_bundle_metadata_rejects_incompatible_frozen_contract[numeric_features-value8-numeric feature] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-7D4E957ECD | test_bundle_metadata_rejects_incompatible_frozen_contract[categorical_features-value9-categorical feature] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-09462A86EA | test_bundle_metadata_rejects_incompatible_frozen_contract[target_name-asking_price-Target] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-AC63E7FA0D | test_bundle_metadata_rejects_incompatible_frozen_contract[random_seed-0-seed or iteration] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-BC454FCD80 | test_bundle_metadata_rejects_incompatible_frozen_contract[iteration_count-1-seed or iteration] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-EB973F8DBA | test_bundle_metadata_rejects_incompatible_frozen_contract[catboost_parameters-value13-parameters must be an object] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-6D36A95D4B | test_bundle_metadata_rejects_incompatible_frozen_contract[catboost_parameters-value14-frozen model configuration] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-26FBEF8145 | test_bundle_metadata_rejects_incompatible_frozen_contract[training_row_count-0-positive integer] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-D8DD8E7099 | test_bundle_metadata_rejects_incompatible_frozen_contract[minimum_group_support-1-minimum group support] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-605F65D3BD | test_bundle_metadata_rejects_incompatible_frozen_contract[supported_coverage_levels-value17-coverage levels] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-83F3605F5E | test_bundle_metadata_rejects_incompatible_frozen_contract[default_coverage_level-0.8-default coverage] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-25F6A24E1B | test_bundle_metadata_rejects_incompatible_frozen_contract[uncertainty_method-unknown-uncertainty method] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-848B8CE803 | test_bundle_metadata_rejects_incompatible_frozen_contract[grouping_variable-income-grouping variable] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-EE1A1C1D92 | test_bundle_metadata_rejects_incompatible_frozen_contract[dataset-value21-must be an object] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-4E3D28197C | test_bundle_metadata_rejects_incompatible_frozen_contract[library_versions-value22-must be an object] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-297A155FBC | test_bundle_metadata_rejects_incompatible_frozen_contract[known_limitations-value23-non-empty list] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-1BCB01F827 | test_bundle_metadata_rejects_incompatible_frozen_contract[created_at-2026-10-08T12:00:00-timezone-aware] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-CB70ACD7E9 | test_bundle_metadata_rejects_incompatible_frozen_contract[created_at-invalid timestamp-timezone-aware] | PASS | [inputs + assertions L25–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L25) |
| ML-BUNDLE-VALIDATION-GAPS-D293C99F46 | test_bundle_metadata_requires_source_provenance_and_runtime_version_metadata | PASS | [inputs + assertions L63–76](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L63) |
| ML-BUNDLE-VALIDATION-GAPS-E5A3484428 | test_uncertainty_state_rejects_changed_calibration_policy[schema_version-99-schema version] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-0431ACD6F8 | test_uncertainty_state_rejects_changed_calibration_policy[method_name-unknown-calibration method] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-1FBF1DE102 | test_uncertainty_state_rejects_changed_calibration_policy[calibration_cutoff-2026-01-cutoff] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-92EB830884 | test_uncertainty_state_rejects_changed_calibration_policy[calibration_years-value3-2021-2025] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-CC8BCE5873 | test_uncertainty_state_rejects_changed_calibration_policy[grouping_variable-income-grouping variable] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-599AD16DEB | test_uncertainty_state_rejects_changed_calibration_policy[minimum_group_support-1-minimum group support] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-F41C58AAE1 | test_uncertainty_state_rejects_changed_calibration_policy[supported_coverage_levels-value6-coverage levels] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-F13E7DB390 | test_uncertainty_state_rejects_changed_calibration_policy[default_coverage_level-0.8-default coverage] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-C845F08ED8 | test_uncertainty_state_rejects_changed_calibration_policy[global-value8-records must be objects] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-E565FF20C7 | test_uncertainty_state_rejects_changed_calibration_policy[towns-value9-records must be objects] | PASS | [inputs + assertions L79–98](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L79) |
| ML-BUNDLE-VALIDATION-GAPS-62716E8D4F | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[-1] | PASS | [inputs + assertions L101–106](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L101) |
| ML-BUNDLE-VALIDATION-GAPS-108B4F7A02 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[nan] | PASS | [inputs + assertions L101–106](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L101) |
| ML-BUNDLE-VALIDATION-GAPS-888E968D86 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[inf] | PASS | [inputs + assertions L101–106](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L101) |
| ML-BUNDLE-VALIDATION-GAPS-0E4A33CBA6 | test_uncertainty_state_rejects_non_finite_or_negative_persisted_radius[invalid] | PASS | [inputs + assertions L101–106](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L101) |
| ML-BUNDLE-VALIDATION-GAPS-F6ABCAF6C7 | test_uncertainty_state_requires_all_coverages_and_sufficient_town_support | PASS | [inputs + assertions L109–117](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L109) |
| ML-BUNDLE-VALIDATION-GAPS-9776E0F913 | test_uncertainty_state_requires_canonical_town_keys_and_object_records | PASS | [inputs + assertions L120–128](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L120) |
| ML-BUNDLE-VALIDATION-GAPS-E456D9261B | test_bundle_write_failure_removes_partial_artifact_directory | PASS | [inputs + assertions L131–146](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L131) |
| ML-BUNDLE-VALIDATION-GAPS-FEBEE935AF | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[not JSON] | PASS | [inputs + assertions L149–155](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L149) |
| ML-BUNDLE-VALIDATION-GAPS-69170FE940 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[[]] | PASS | [inputs + assertions L149–155](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L149) |
| ML-BUNDLE-VALIDATION-GAPS-E85FE623C8 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[{"manifest_version":99,"hash_algorithm":"sha256"}] | PASS | [inputs + assertions L149–155](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L149) |
| ML-BUNDLE-VALIDATION-GAPS-8653D7B568 | test_bundle_loader_rejects_malformed_or_incomplete_manifest_before_model_loading[{"manifest_version":1,"hash_algorithm":"sha256","files":{}}] | PASS | [inputs + assertions L149–155](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L149) |
| ML-BUNDLE-VALIDATION-GAPS-B7D6CFFCC5 | test_direct_bundle_prediction_rejects_non_finite_model_outputs[nan] | PASS | [inputs + assertions L158–167](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L158) |
| ML-BUNDLE-VALIDATION-GAPS-62C08228D9 | test_direct_bundle_prediction_rejects_non_finite_model_outputs[inf] | PASS | [inputs + assertions L158–167](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L158) |
| ML-BUNDLE-VALIDATION-GAPS-C72DB0E548 | test_csv_discovery_requires_exactly_one_source_file | PASS | [inputs + assertions L170–179](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L170) |
| ML-BUNDLE-VALIDATION-GAPS-82969142FC | test_explicit_csv_load_preserves_source_rows_and_does_not_modify_file | PASS | [inputs + assertions L182–189](evidence/source-snapshots/MLPricePredictorV2/tests/test_bundle_validation_gaps.py.txt#L182) |

## MLPricePredictorV2/tests/test_chronological_split.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-CHRONOLOGICAL-SPLIT-382522E492 | test_default_boundaries_split_by_month_and_preserve_partial_period | PASS | [inputs + assertions L9–25](evidence/source-snapshots/MLPricePredictorV2/tests/test_chronological_split.py.txt#L9) |
| ML-CHRONOLOGICAL-SPLIT-578E1CB706 | test_configurable_contiguous_boundaries | PASS | [inputs + assertions L28–49](evidence/source-snapshots/MLPricePredictorV2/tests/test_chronological_split.py.txt#L28) |
| ML-CHRONOLOGICAL-SPLIT-006E323D70 | test_dates_before_configured_train_start_fail_with_index | PASS | [inputs + assertions L52–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_chronological_split.py.txt#L52) |
| ML-CHRONOLOGICAL-SPLIT-B0319FA103 | test_non_contiguous_boundaries_fail | PASS | [inputs + assertions L61–63](evidence/source-snapshots/MLPricePredictorV2/tests/test_chronological_split.py.txt#L61) |
| ML-CHRONOLOGICAL-SPLIT-FDBA8C1078 | test_misaligned_inputs_fail | PASS | [inputs + assertions L66–72](evidence/source-snapshots/MLPricePredictorV2/tests/test_chronological_split.py.txt#L66) |

## MLPricePredictorV2/tests/test_configuration_selection.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-CONFIGURATION-SELECTION-8A5A8B716A | test_validation_grid_contains_expected_twelve_configs_and_default | PASS | [inputs + assertions L15–22](evidence/source-snapshots/MLPricePredictorV2/tests/test_configuration_selection.py.txt#L15) |
| ML-CONFIGURATION-SELECTION-2C18A1C4BB | test_near_tie_prefers_lower_fallback_then_default_near_then_group_stability | PASS | [inputs + assertions L25–35](evidence/source-snapshots/MLPricePredictorV2/tests/test_configuration_selection.py.txt#L25) |
| ML-CONFIGURATION-SELECTION-4E40A1935C | test_configuration_outside_one_percent_is_not_preferred_for_fallback | PASS | [inputs + assertions L38–46](evidence/source-snapshots/MLPricePredictorV2/tests/test_configuration_selection.py.txt#L38) |
| ML-CONFIGURATION-SELECTION-D475CEB368 | test_selector_accepts_validation_summaries_only | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_configuration_selection.py.txt#L49) |

## MLPricePredictorV2/tests/test_data_validation.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-DATA-VALIDATION-4D3A922F25 | test_required_column_set_matches_hdb_source_schema | PASS | [inputs + assertions L7–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_data_validation.py.txt#L7) |
| ML-DATA-VALIDATION-40C37859C3 | test_missing_required_column_fails | PASS | [inputs + assertions L23–27](evidence/source-snapshots/MLPricePredictorV2/tests/test_data_validation.py.txt#L23) |
| ML-DATA-VALIDATION-43A42FE113 | test_valid_dataset_schema_is_accepted | PASS | [inputs + assertions L30–33](evidence/source-snapshots/MLPricePredictorV2/tests/test_data_validation.py.txt#L30) |

## MLPricePredictorV2/tests/test_diagnostics.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-DIAGNOSTICS-E3CDBDEF57 | test_diagnostics_report_all_groups_fallbacks_and_comparable_counts | PASS | [inputs + assertions L7–35](evidence/source-snapshots/MLPricePredictorV2/tests/test_diagnostics.py.txt#L7) |
| ML-DIAGNOSTICS-0CF0693B5A | test_comparable_count_summary_is_empty_when_all_predictions_fallback | PASS | [inputs + assertions L38–57](evidence/source-snapshots/MLPricePredictorV2/tests/test_diagnostics.py.txt#L38) |

## MLPricePredictorV2/tests/test_leakage_contract_gaps.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-LEAKAGE-CONTRACT-GAPS-E4E1762963 | test_split_assigns_every_inclusive_boundary_once_and_preserves_later_partial_months | PASS | [inputs + assertions L32–41](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L32) |
| ML-LEAKAGE-CONTRACT-GAPS-29043B9028 | test_split_returns_isolated_copies_for_features_targets_and_periods | PASS | [inputs + assertions L44–53](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L44) |
| ML-LEAKAGE-CONTRACT-GAPS-626DFE1B5E | test_split_missing_transaction_period_fails_instead_of_silently_dropping_row | PASS | [inputs + assertions L56–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L56) |
| ML-LEAKAGE-CONTRACT-GAPS-D794EEDDDF | test_split_rejects_period_index_misalignment_even_when_lengths_match | PASS | [inputs + assertions L63–67](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L63) |
| ML-LEAKAGE-CONTRACT-GAPS-3301162957 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides0-Train start] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-16F749799A | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides1-Validation must start] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-CC513D2E68 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides2-Validation start] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-EEE5165C1A | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides3-Test must start] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-9EDE9D427D | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides4-Test start] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-6A2FBDE092 | test_split_rejects_reversed_or_overlapping_partition_definitions[overrides5-Partial period] | PASS | [inputs + assertions L70–83](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L70) |
| ML-LEAKAGE-CONTRACT-GAPS-C4A68B624A | test_preparation_excludes_income_price_derivatives_and_unexpected_source_columns | PASS | [inputs + assertions L86–94](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L86) |
| ML-LEAKAGE-CONTRACT-GAPS-CC471BB346 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[floor_area_sqm] | PASS | [inputs + assertions L97–108](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-C07054E9D9 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[storey_mid] | PASS | [inputs + assertions L97–108](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-5698B82008 | test_comparables_include_exact_physical_tolerance_and_exclude_just_outside[remaining_lease_months] | PASS | [inputs + assertions L97–108](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L97) |
| ML-LEAKAGE-CONTRACT-GAPS-3F19BFDD17 | test_comparable_lookback_lower_month_is_included_but_month_before_is_excluded | PASS | [inputs + assertions L111–115](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L111) |
| ML-LEAKAGE-CONTRACT-GAPS-84B943A2B4 | test_comparable_index_cannot_be_reused_for_a_later_prediction_month | PASS | [inputs + assertions L118–122](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L118) |
| ML-LEAKAGE-CONTRACT-GAPS-8E45F01E77 | test_comparables_can_hide_source_ids_without_changing_estimate | PASS | [inputs + assertions L125–132](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L125) |
| ML-LEAKAGE-CONTRACT-GAPS-E92BDF8110 | test_calibration_rejects_duplicate_year_folds_instead_of_double_weighting | PASS | [inputs + assertions L141–144](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L141) |
| ML-LEAKAGE-CONTRACT-GAPS-68069B6C1F | test_calibration_requires_every_predeclared_year | PASS | [inputs + assertions L147–150](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L147) |
| ML-LEAKAGE-CONTRACT-GAPS-CF859AFEDB | test_calibration_rejects_reordered_prediction_indices | PASS | [inputs + assertions L153–157](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L153) |
| ML-LEAKAGE-CONTRACT-GAPS-5A5D62B7CA | test_calibration_rejects_missing_actual_targets | PASS | [inputs + assertions L160–163](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L160) |
| ML-LEAKAGE-CONTRACT-GAPS-0EE3302334 | test_calibration_rejects_fractional_years_before_integer_conversion[2021.5] | PASS | [inputs + assertions L166–172](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L166) |
| ML-LEAKAGE-CONTRACT-GAPS-8F19EEF290 | test_calibration_rejects_fractional_years_before_integer_conversion[2022.25] | PASS | [inputs + assertions L166–172](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L166) |
| ML-LEAKAGE-CONTRACT-GAPS-761636EBA6 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual0-predicted0] | PASS | [inputs + assertions L175–178](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L175) |
| ML-LEAKAGE-CONTRACT-GAPS-7402356426 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual1-predicted1] | PASS | [inputs + assertions L175–178](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L175) |
| ML-LEAKAGE-CONTRACT-GAPS-60ED60E909 | test_metrics_reject_non_finite_values_instead_of_reporting_misleading_scores[actual2-predicted2] | PASS | [inputs + assertions L175–178](evidence/source-snapshots/MLPricePredictorV2/tests/test_leakage_contract_gaps.py.txt#L175) |

## MLPricePredictorV2/tests/test_linear_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-LINEAR-MODELS-7258A17764 | test_model_feature_schema_is_fixed_and_excludes_redundant_fields | PASS | [inputs + assertions L49–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L49) |
| ML-LINEAR-MODELS-60D5C9584D | test_target_column_is_rejected_and_missing_base_features_fail_clearly | PASS | [inputs + assertions L63–70](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L63) |
| ML-LINEAR-MODELS-FB63A52805 | test_pipeline_keeps_ohe_sparse_and_unknown_categories_do_not_crash | PASS | [inputs + assertions L73–85](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L73) |
| ML-LINEAR-MODELS-DBD5DE9916 | test_validation_candidates_fit_vocabulary_and_scaling_on_train_only | PASS | [inputs + assertions L88–102](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L88) |
| ML-LINEAR-MODELS-7001778308 | test_validation_target_changes_metrics_but_not_fitted_preprocessing_or_coefficients | PASS | [inputs + assertions L105–122](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L105) |
| ML-LINEAR-MODELS-C93F9499E2 | test_final_fit_takes_only_train_validation_rows_and_isolated_from_test_targets | PASS | [inputs + assertions L125–155](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L125) |
| ML-LINEAR-MODELS-66EB1CAAD7 | test_validation_evaluation_is_deterministic_for_fixed_inputs | PASS | [inputs + assertions L158–169](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L158) |
| ML-LINEAR-MODELS-1E8353F437 | test_default_alpha_grid_is_small_and_explicit | PASS | [inputs + assertions L172–174](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L172) |
| ML-LINEAR-MODELS-A7AF830A6C | test_validation_selector_uses_one_percent_tie_band_then_metrics_and_simplicity | PASS | [inputs + assertions L177–183](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L177) |
| ML-LINEAR-MODELS-7FF4925468 | test_zero_mae_requires_exact_tie_and_ridge_alpha_ties_are_stable | PASS | [inputs + assertions L186–192](evidence/source-snapshots/MLPricePredictorV2/tests/test_linear_models.py.txt#L186) |

## MLPricePredictorV2/tests/test_metrics.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-METRICS-D07BF59BF3 | test_regression_metrics_match_hand_calculated_values | PASS | [inputs + assertions L6–16](evidence/source-snapshots/MLPricePredictorV2/tests/test_metrics.py.txt#L6) |
| ML-METRICS-84A0474D71 | test_r_squared_is_undefined_for_insufficient_or_constant_actuals | PASS | [inputs + assertions L19–21](evidence/source-snapshots/MLPricePredictorV2/tests/test_metrics.py.txt#L19) |
| ML-METRICS-72DDB5F144 | test_mape_is_undefined_when_actual_contains_zero | PASS | [inputs + assertions L24–25](evidence/source-snapshots/MLPricePredictorV2/tests/test_metrics.py.txt#L24) |
| ML-METRICS-848EA46D62 | test_metrics_reject_empty_or_misaligned_inputs | PASS | [inputs + assertions L28–32](evidence/source-snapshots/MLPricePredictorV2/tests/test_metrics.py.txt#L28) |

## MLPricePredictorV2/tests/test_model_robustness.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-MODEL-ROBUSTNESS-86816D3C38 | test_frozen_comparable_keeps_cutoff_history_constant_and_uses_cutoff_month | PASS | [inputs + assertions L43–57](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L43) |
| ML-MODEL-ROBUSTNESS-BD5281A9D0 | test_evaluation_year_target_mutation_cannot_change_frozen_comparable_predictions | PASS | [inputs + assertions L60–75](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L60) |
| ML-MODEL-ROBUSTNESS-9738A2ADF4 | test_frozen_comparable_rejects_rows_at_or_before_cutoff_and_partial_period | PASS | [inputs + assertions L78–90](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L78) |
| ML-MODEL-ROBUSTNESS-7D678252DC | test_expanding_year_partition_ends_training_before_year_and_excludes_other_years | PASS | [inputs + assertions L93–104](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L93) |
| ML-MODEL-ROBUSTNESS-CE5715BC5B | test_expanding_year_partition_can_stop_before_partial_month_but_rejects_it | PASS | [inputs + assertions L107–117](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L107) |
| ML-MODEL-ROBUSTNESS-2B8769410B | test_shared_frozen_year_helper_fits_only_before_evaluation_year | PASS | [inputs + assertions L120–154](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L120) |
| ML-MODEL-ROBUSTNESS-2106FC03A0 | test_fixed_catboost_fit_uses_only_supplied_labels_and_frozen_configuration | PASS | [inputs + assertions L157–208](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L157) |
| ML-MODEL-ROBUSTNESS-B32887706F | test_repeatability_summary_aggregates_runs_without_selecting_a_winner | PASS | [inputs + assertions L215–231](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L215) |
| ML-MODEL-ROBUSTNESS-96ECFE7560 | test_monthly_drift_and_group_support_summaries_match_hand_calculation | PASS | [inputs + assertions L234–251](evidence/source-snapshots/MLPricePredictorV2/tests/test_model_robustness.py.txt#L234) |

## MLPricePredictorV2/tests/test_parsers.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-PARSERS-B35921B096 | test_parse_remaining_lease[61 years 04 months-736] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-D7266B4866 | test_parse_remaining_lease[62 years 01 month-745] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-23F2F853F0 | test_parse_remaining_lease[63 years-756] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-A8356B2CFB | test_parse_remaining_lease[60 years-720] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-40AA31FD99 | test_parse_remaining_lease[  1   year   1   month -13] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-2DC588D7C0 | test_parse_remaining_lease[5 months-5] | PASS | [inputs + assertions L8–20](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L8) |
| ML-PARSERS-69DEB1F3F5 | test_malformed_remaining_lease_fails[] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-A7083CD963 | test_malformed_remaining_lease_fails[unknown] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-27F744359A | test_malformed_remaining_lease_fails[61 years 12 months] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-8AB615CC5A | test_malformed_remaining_lease_fails[3 years ago] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-9F6BAB36C0 | test_malformed_remaining_lease_fails[None] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-E730BCEFCB | test_malformed_remaining_lease_fails[nan] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-D5FF49D99E | test_malformed_remaining_lease_fails[value6] | PASS | [inputs + assertions L23–28](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L23) |
| ML-PARSERS-C5CACA98D8 | test_parse_storey_range | PASS | [inputs + assertions L31–33](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L31) |
| ML-PARSERS-AD1DA3A503 | test_malformed_storey_range_fails[10-12] | PASS | [inputs + assertions L36–39](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L36) |
| ML-PARSERS-F3C15708B7 | test_malformed_storey_range_fails[12 TO 10] | PASS | [inputs + assertions L36–39](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L36) |
| ML-PARSERS-04C80BF2EF | test_malformed_storey_range_fails[unknown] | PASS | [inputs + assertions L36–39](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L36) |
| ML-PARSERS-B5F639B10F | test_malformed_storey_range_fails[None] | PASS | [inputs + assertions L36–39](evidence/source-snapshots/MLPricePredictorV2/tests/test_parsers.py.txt#L36) |

## MLPricePredictorV2/tests/test_preprocessing.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-PREPROCESSING-B7FA45ADC8 | test_features_separate_target_and_parse_transaction_month | PASS | [inputs + assertions L26–41](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L26) |
| ML-PREPROCESSING-2CEA4BAE2F | test_malformed_values_fail_with_source_index_and_value[month-2025-13] | PASS | [inputs + assertions L44–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L44) |
| ML-PREPROCESSING-33D42F13A5 | test_malformed_values_fail_with_source_index_and_value[storey_range-upper floor] | PASS | [inputs + assertions L44–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L44) |
| ML-PREPROCESSING-20C04CB723 | test_malformed_values_fail_with_source_index_and_value[remaining_lease-about 60 years] | PASS | [inputs + assertions L44–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L44) |
| ML-PREPROCESSING-1184F6DF21 | test_duplicate_source_rows_and_indices_are_preserved | PASS | [inputs + assertions L61–71](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L61) |
| ML-PREPROCESSING-72AB0A3F40 | test_validation_and_test_target_values_do_not_influence_features | PASS | [inputs + assertions L74–81](evidence/source-snapshots/MLPricePredictorV2/tests/test_preprocessing.py.txt#L74) |

## MLPricePredictorV2/tests/test_tree_models.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-TREE-MODELS-07C8485CCE | test_tree_schemas_exclude_target_derived_and_keep_deterministic_columns | PASS | [inputs + assertions L50–64](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L50) |
| ML-TREE-MODELS-C7225E4C82 | test_search_has_six_fixed_deterministic_configurations | PASS | [inputs + assertions L67–76](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L67) |
| ML-TREE-MODELS-8E48335C14 | test_forest_pipeline_uses_sparse_one_hot_and_no_numeric_scaling | PASS | [inputs + assertions L79–91](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L79) |
| ML-TREE-MODELS-F991956644 | test_random_forest_pipeline_uses_fixed_seed | PASS | [inputs + assertions L94–99](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L94) |
| ML-TREE-MODELS-E4F010CBA8 | test_fixed_seed_tree_predictions_are_reproducible | PASS | [inputs + assertions L102–110](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L102) |
| ML-TREE-MODELS-DCF7F0B979 | test_histogram_categories_are_learned_from_training_and_unknowns_become_missing | PASS | [inputs + assertions L113–125](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L113) |
| ML-TREE-MODELS-F0EB0B3894 | test_histogram_pipeline_supports_native_categories_and_unseen_validation_categories | PASS | [inputs + assertions L128–138](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L128) |
| ML-TREE-MODELS-63E94C9407 | test_validation_target_changes_do_not_change_fitted_pipeline_or_predictions | PASS | [inputs + assertions L141–162](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L141) |
| ML-TREE-MODELS-A5A7617400 | test_final_refit_receives_only_history_and_ignores_test_only_categories | PASS | [inputs + assertions L165–188](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L165) |
| ML-TREE-MODELS-AC9F671B89 | test_model_selection_uses_only_validation_results_and_one_percent_band | PASS | [inputs + assertions L191–213](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L191) |
| ML-TREE-MODELS-0B20485A86 | test_tree_selection_requires_exact_mae_tie_when_best_mae_is_zero | PASS | [inputs + assertions L216–241](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L216) |
| ML-TREE-MODELS-C5B7C30119 | test_tree_feature_importances_aggregate_one_hot_values_to_source_features | PASS | [inputs + assertions L244–252](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L244) |
| ML-TREE-MODELS-ABD8A5E4E7 | test_partial_period_is_not_in_validation_or_test | PASS | [inputs + assertions L255–279](evidence/source-snapshots/MLPricePredictorV2/tests/test_tree_models.py.txt#L255) |

## MLPricePredictorV2/tests/test_uncertainty.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-UNCERTAINTY-FAEDF2BD16 | test_finite_sample_quantile_uses_ceiling_order_statistic_without_interpolation | PASS | [inputs + assertions L40–42](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L40) |
| ML-UNCERTAINTY-1AB67FF1E1 | test_finite_sample_quantile_returns_infinity_if_rank_exceeds_sample | PASS | [inputs + assertions L45–46](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L45) |
| ML-UNCERTAINTY-D1DC71491C | test_conformal_quantile_rejects_invalid_coverage[0.0] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-2D9BD7EAB7 | test_conformal_quantile_rejects_invalid_coverage[1.0] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-554214DCE7 | test_conformal_quantile_rejects_invalid_coverage[-0.1] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-9546D0A6E8 | test_conformal_quantile_rejects_invalid_coverage[1.1] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-80978FA901 | test_conformal_quantile_rejects_invalid_coverage[nan] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-45FD0BFABE | test_conformal_quantile_rejects_invalid_coverage[inf] | PASS | [inputs + assertions L49–52](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L49) |
| ML-UNCERTAINTY-2D3C8C64D6 | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals0] | PASS | [inputs + assertions L55–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L55) |
| ML-UNCERTAINTY-262C205B4A | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals1] | PASS | [inputs + assertions L55–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L55) |
| ML-UNCERTAINTY-0229CE3717 | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals2] | PASS | [inputs + assertions L55–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L55) |
| ML-UNCERTAINTY-0AD352DFDD | test_conformal_quantile_rejects_empty_non_finite_or_negative_residuals[residuals3] | PASS | [inputs + assertions L55–58](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L55) |
| ML-UNCERTAINTY-FE4E9B8E75 | test_symmetric_intervals_preserve_index_and_compute_bounds_and_width | PASS | [inputs + assertions L61–67](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L61) |
| ML-UNCERTAINTY-359558F491 | test_interval_metrics_match_hand_calculated_coverage_and_width | PASS | [inputs + assertions L70–85](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L70) |
| ML-UNCERTAINTY-4980613280 | test_prior_residual_selection_excludes_evaluation_and_future_years | PASS | [inputs + assertions L88–92](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L88) |
| ML-UNCERTAINTY-07EACE6726 | test_recent_window_uses_only_previous_calendar_years | PASS | [inputs + assertions L95–99](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L95) |
| ML-UNCERTAINTY-C9095A0994 | test_evaluation_target_mutation_cannot_change_frozen_intervals | PASS | [inputs + assertions L102–116](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L102) |
| ML-UNCERTAINTY-F321DA5F5F | test_group_quantiles_use_minimum_support_and_global_fallback | PASS | [inputs + assertions L119–139](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L119) |
| ML-UNCERTAINTY-9068F8D9D0 | test_group_coverage_summary_flags_evaluation_groups_below_support_threshold | PASS | [inputs + assertions L142–156](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L142) |
| ML-UNCERTAINTY-B58856BF36 | test_method_selector_is_deterministic_and_uses_simplicity_for_exact_ties | PASS | [inputs + assertions L177–178](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L177) |
| ML-UNCERTAINTY-AEB115955B | test_method_selector_rejects_final_test_results | PASS | [inputs + assertions L181–187](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L181) |
| ML-UNCERTAINTY-1C6E545ECC | test_ninety_percent_gate_uses_pooled_ninety_and_each_year_eighty_five | PASS | [inputs + assertions L190–203](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L190) |
| ML-UNCERTAINTY-028CF76ED3 | test_asking_price_interval_classification_boundaries[99.99-below_estimated_market_range] | PASS | [inputs + assertions L206–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L206) |
| ML-UNCERTAINTY-10EAA3C723 | test_asking_price_interval_classification_boundaries[100.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L206) |
| ML-UNCERTAINTY-2835097073 | test_asking_price_interval_classification_boundaries[150.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L206) |
| ML-UNCERTAINTY-8136F38CB3 | test_asking_price_interval_classification_boundaries[200.0-within_estimated_market_range] | PASS | [inputs + assertions L206–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L206) |
| ML-UNCERTAINTY-EE7647D712 | test_asking_price_interval_classification_boundaries[200.01-above_estimated_market_range] | PASS | [inputs + assertions L206–217](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L206) |
| ML-UNCERTAINTY-06E7B7ACE0 | test_asking_price_classification_rejects_invalid_inputs | PASS | [inputs + assertions L220–224](evidence/source-snapshots/MLPricePredictorV2/tests/test_uncertainty.py.txt#L220) |

## MLPricePredictorV2/tests/test_valuation_bundle.py

Level: Artifact/component integration (temporary local fixtures). Technique: Contract, integrity, malformed-input, and internal validation assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-VALUATION-BUNDLE-821A4B33A6 | test_calibration_persists_only_precomputed_supported_thresholds | PASS | [inputs + assertions L112–124](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L112) |
| ML-VALUATION-BUNDLE-4824B51F00 | test_calibration_rejects_residuals_after_cutoff | PASS | [inputs + assertions L127–138](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L127) |
| ML-VALUATION-BUNDLE-977A01CD60 | test_future_target_mutation_does_not_change_bundle_calibration | PASS | [inputs + assertions L141–167](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L141) |
| ML-VALUATION-BUNDLE-B1E4C878A1 | test_future_year_fold_is_rejected_for_calibration | PASS | [inputs + assertions L170–180](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L170) |
| ML-VALUATION-BUNDLE-7A7A7FED89 | test_town_lookup_normalizes_whitespace_and_case_with_global_fallback | PASS | [inputs + assertions L183–196](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L183) |
| ML-VALUATION-BUNDLE-2797417D45 | test_all_supported_coverages_return_half_and_full_width[0.8] | PASS | [inputs + assertions L199–204](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L199) |
| ML-VALUATION-BUNDLE-ED0AFFA384 | test_all_supported_coverages_return_half_and_full_width[0.9] | PASS | [inputs + assertions L199–204](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L199) |
| ML-VALUATION-BUNDLE-61C60F9EB4 | test_all_supported_coverages_return_half_and_full_width[0.95] | PASS | [inputs + assertions L199–204](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L199) |
| ML-VALUATION-BUNDLE-4C75595C43 | test_unsupported_coverage_is_rejected | PASS | [inputs + assertions L207–209](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L207) |
| ML-VALUATION-BUNDLE-77950D508A | test_feature_and_bundle_metadata_contract_rejects_changes | PASS | [inputs + assertions L212–231](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L212) |
| ML-VALUATION-BUNDLE-76540EC2EB | test_metadata_rejects_invalid_cutoffs_and_version | PASS | [inputs + assertions L234–241](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L234) |
| ML-VALUATION-BUNDLE-D1F7E9BEE3 | test_bundle_save_load_prediction_shape_and_threshold_round_trip | PASS | [inputs + assertions L244–272](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L244) |
| ML-VALUATION-BUNDLE-7F72ECADBE | test_prediction_requires_exact_feature_names_and_valid_values | PASS | [inputs + assertions L275–294](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L275) |
| ML-VALUATION-BUNDLE-96E6714F5C | test_loader_rejects_missing_files_and_invalid_manifest_hashes | PASS | [inputs + assertions L297–307](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L297) |
| ML-VALUATION-BUNDLE-1E25E3B7F8 | test_loader_checks_each_bundle_file_digest[model.cbm] | PASS | [inputs + assertions L310–316](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L310) |
| ML-VALUATION-BUNDLE-B560A33AB5 | test_loader_checks_each_bundle_file_digest[uncertainty.json] | PASS | [inputs + assertions L310–316](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L310) |
| ML-VALUATION-BUNDLE-AE0EAB377B | test_loader_checks_each_bundle_file_digest[metadata.json] | PASS | [inputs + assertions L310–316](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L310) |
| ML-VALUATION-BUNDLE-85A85A3541 | test_loader_rejects_metadata_even_when_manifest_matches | PASS | [inputs + assertions L319–330](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L319) |
| ML-VALUATION-BUNDLE-78479AF704 | test_bundle_version_is_immutable_and_not_overwritten | PASS | [inputs + assertions L333–338](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L333) |
| ML-VALUATION-BUNDLE-ABA36854C2 | test_town_normalization_matches_backend_canonical_form | PASS | [inputs + assertions L341–344](evidence/source-snapshots/MLPricePredictorV2/tests/test_valuation_bundle.py.txt#L341) |

## MLPricePredictorV2/tests/test_walk_forward.py

Level: Python unit/component. Technique: Input/output, boundaries, leakage mutation, and internal model/split assertions as defined in source. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| ML-WALK-FORWARD-03862357CF | test_same_month_targets_cannot_influence_each_others_predictions | PASS | [inputs + assertions L34–45](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L34) |
| ML-WALK-FORWARD-1A7E83634B | test_same_month_actual_mutation_does_not_change_comparable_prediction | PASS | [inputs + assertions L48–60](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L48) |
| ML-WALK-FORWARD-9FAFDB1C27 | test_future_actual_mutation_cannot_change_earlier_predictions | PASS | [inputs + assertions L63–72](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L63) |
| ML-WALK-FORWARD-73B8E3A9FF | test_future_missing_target_cannot_change_earlier_prediction | PASS | [inputs + assertions L75–84](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L75) |
| ML-WALK-FORWARD-4C181995D5 | test_prior_completed_month_updates_history_for_later_month | PASS | [inputs + assertions L87–97](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L87) |
| ML-WALK-FORWARD-0AB3B741CD | test_prior_completed_month_can_change_later_comparable_prediction | PASS | [inputs + assertions L100–113](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L100) |
| ML-WALK-FORWARD-A3F29CB3B2 | test_partial_period_rows_are_rejected_from_evaluation | PASS | [inputs + assertions L116–121](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L116) |
| ML-WALK-FORWARD-BDFDE2C709 | test_months_are_evaluated_in_chronological_order | PASS | [inputs + assertions L124–134](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L124) |
| ML-WALK-FORWARD-2EA2446D82 | test_comparable_grid_reuses_walk_forward_history_without_changing_predictions | PASS | [inputs + assertions L137–154](evidence/source-snapshots/MLPricePredictorV2/tests/test_walk_forward.py.txt#L137) |

## SGHomie/BackEnd/supabase/tests/database/access-control.test.sql

Level: Local PostgreSQL integration. Technique: Black-box role operations and white-box RLS/trigger assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| DB-01 | DB-01 sensitive application tables have RLS enabled | PASS | [inputs + assertions L35–39](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L35) |
| DB-02 | DB-02 authenticated users cannot read verification tokens | PASS | [inputs + assertions L40–41](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L40) |
| DB-03 | DB-03 anonymous users cannot mint verification tokens | PASS | [inputs + assertions L42–43](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L42) |
| DB-04 | DB-04 anonymous users see approved listings only | PASS | [inputs + assertions L46–46](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L46) |
| DB-05 | DB-05 anonymous users cannot read profiles | PASS | [inputs + assertions L47–47](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L47) |
| DB-06 | DB-06 anonymous users cannot read enquiries | PASS | [inputs + assertions L48–48](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L48) |
| DB-07 | DB-07 anonymous visitors can submit a pending enquiry | PASS | [inputs + assertions L49–51](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L49) |
| DB-08 | DB-08 seller reads own profile only | PASS | [inputs + assertions L56–56](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L56) |
| DB-09 | DB-09 seller cannot escalate to administrator | PASS | [inputs + assertions L57–58](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L57) |
| DB-10 | DB-10 seller sees approved and own draft | PASS | [inputs + assertions L59–59](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L59) |
| DB-11 | DB-11 seller cannot read another seller draft | PASS | [inputs + assertions L60–61](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L60) |
| DB-12 | DB-12 seller cannot update another seller listing | PASS | [inputs + assertions L62–65](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L62) |
| DB-13 | DB-13 seller can edit price on own draft without new address verification | PASS | [inputs + assertions L66–69](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L66) |
| DB-14 | DB-14 seller cannot approve own draft | PASS | [inputs + assertions L70–72](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L70) |
| DB-15 | DB-15 seller reads own private unit only | PASS | [inputs + assertions L73–73](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L73) |
| DB-16 | DB-16 unverified seller insert is rejected | PASS | [inputs + assertions L74–77](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L74) |
| DB-17 | DB-17 expired verification token is rejected | PASS | [inputs + assertions L78–80](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L78) |
| DB-18 | DB-18 valid seller-bound token applies trusted address | PASS | [inputs + assertions L81–84](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L81) |
| DB-19 | DB-19 verified address overwrites spoofed fields and clears bearer token | PASS | [inputs + assertions L85–87](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L85) |
| DB-20 | DB-20 another seller cannot reuse verification token | PASS | [inputs + assertions L92–94](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L92) |
| DB-21 | DB-21 buyer sees approved properties only | PASS | [inputs + assertions L99–99](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L99) |
| DB-22 | DB-22 buyer cannot read private unit numbers | PASS | [inputs + assertions L100–100](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L100) |
| DB-23 | DB-23 buyer sees own enquiries with case-insensitive email matching | PASS | [inputs + assertions L101–101](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L101) |
| DB-24 | DB-24 buyer cannot answer own enquiry as administrator | PASS | [inputs + assertions L102–105](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L102) |
| DB-25 | DB-25 buyer can record own property interest | PASS | [inputs + assertions L106–108](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L106) |
| DB-26 | DB-26 buyer cannot impersonate another user interest | PASS | [inputs + assertions L109–111](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L109) |
| DB-27 | DB-27 duplicate property interest is rejected | PASS | [inputs + assertions L112–114](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L112) |
| DB-28 | DB-28 administrator can review all listings | PASS | [inputs + assertions L119–119](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L119) |
| DB-29 | DB-29 administrator can inspect private units | PASS | [inputs + assertions L120–120](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L120) |
| DB-30 | DB-30 administrator can approve a pending review item | PASS | [inputs + assertions L121–124](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L121) |
| DB-31 | DB-31 administrator and seller roles remain exclusive | PASS | [inputs + assertions L125–126](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L125) |
| DB-32 | DB-32 administrator can answer enquiries | PASS | [inputs + assertions L127–130](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L127) |
| DB-33 | DB-33 4 ROOM pattern matches hyphenated listing text | PASS | [inputs + assertions L132–136](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L132) |
| DB-34 | DB-34 4 ROOM pattern accepts case and whitespace variant | PASS | [inputs + assertions L137–138](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L137) |
| DB-35 | DB-35 room-type pattern excludes numeric and word suffix false matches | PASS | [inputs + assertions L139–141](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L139) |
| DB-36 | DB-36 executive pattern is valid PostgreSQL case-insensitive regex | PASS | [inputs + assertions L142–144](evidence/source-snapshots/SGHomie/BackEnd/supabase/tests/database/access-control.test.sql.txt#L142) |

## SGHomie/tests/admin-users-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-ADM-01 | BE-ADM-01 CORS preflight does not initialize any Supabase client | PASS | [inputs + assertions L40–45](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L40) |
| BE-ADM-02 | BE-ADM-02 missing or invalid sessions cannot initialize the privileged client | PASS | [inputs + assertions L46–54](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L46) |
| BE-ADM-03 | BE-ADM-03 buyer seller and absent profile cannot enumerate users counts or auth emails | PASS | [inputs + assertions L55–63](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L55) |
| BE-ADM-04 | BE-ADM-04 admin enumeration preserves profiles joins counts and adds emails only after authorization | PASS | [inputs + assertions L64–75](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L64) |
| BE-ADM-05 | BE-ADM-05 per-user auth email errors and throws degrade to Unknown without dropping profiles | PASS | [inputs + assertions L76–87](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L76) |
| BE-ADM-06 | BE-ADM-06 required configuration role and database failures return errors instead of success | PASS | [inputs + assertions L88–95](evidence/source-snapshots/SGHomie/tests/admin-users-endpoint.test.mjs.txt#L88) |

## SGHomie/tests/amenities.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AMENITIES-85D598BDCA | amenities sort by distance and use stable name and id tie breaks | PASS | [inputs + assertions L21–27](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L21) |
| JS-AMENITIES-C24710E1B8 | category selection filters without mutating the source list | PASS | [inputs + assertions L28–36](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L28) |
| JS-AMENITIES-7E9BA9AC56 | All includes known and future categories | PASS | [inputs + assertions L37–42](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L37) |
| JS-AMENITIES-362F66C4A6 | supported categories expose shared visual metadata and unknown categories use neutral tone | PASS | [inputs + assertions L43–63](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L43) |
| JS-AMENITIES-0FC5F96E8E | distance displays metres below one kilometre and kilometres at or above it | PASS | [inputs + assertions L64–72](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L64) |
| JS-AMENITIES-4A74F47510 | demo source is explicit and non-demo sources remain distinguishable | PASS | [inputs + assertions L73–77](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L73) |
| JS-AMENITIES-2BF26548B5 | coordinate validation rejects missing, non-finite, zero and out-of-bound values | PASS | [inputs + assertions L78–93](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L78) |
| JS-AMENITIES-80D15302F6 | coordinate validation accepts inclusive Singapore sanity-bound edges | PASS | [inputs + assertions L94–98](evidence/source-snapshots/SGHomie/tests/amenities.test.mjs.txt#L94) |

## SGHomie/tests/auth-context-profile-dedupe.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AUTH-CONTEXT-PROFILE-DEDUPE-56476987BD | overlapping startup profile checks share one lookup but later auth events refresh | PASS | [inputs + assertions L81–108](evidence/source-snapshots/SGHomie/tests/auth-context-profile-dedupe.test.mjs.txt#L81) |

## SGHomie/tests/auth-modal-guards.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-AUTH-01 | FE-AUTH-01 current confirmation action returns to sign-in and clears the password | PASS | [inputs + assertions L46–54](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L46) |
| FE-AUTH-02 | FE-AUTH-02 repeating registration with case/whitespace variants does not send another request | PASS | [inputs + assertions L55–64](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L55) |
| FE-AUTH-03 | FE-AUTH-03 verification guard stores only an email fingerprint | PASS | [inputs + assertions L65–74](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L65) |
| FE-AUTH-04 | FE-AUTH-04 privacy restrictions on session storage retain the in-memory duplicate guard | PASS | [inputs + assertions L75–100](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L75) |
| FE-AUTH-05 | FE-AUTH-05 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L91) |
| FE-AUTH-06 | FE-AUTH-06 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L91) |
| FE-AUTH-07 | FE-AUTH-07 an existing-account response gives guidance without claiming another email send | PASS | [inputs + assertions L91–100](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L91) |
| FE-AUTH-08 | FE-AUTH-08 an obfuscated existing-account success response gives the same neutral guidance | PASS | [inputs + assertions L101–107](evidence/source-snapshots/SGHomie/tests/auth-modal-guards.test.mjs.txt#L101) |

## SGHomie/tests/auth-modal.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-AUTH-MODAL-C5B82D0DAB | registration keeps a persistent verification confirmation and returns to sign in | FAIL: Expected element to be rendered | [inputs + assertions L96–115](evidence/source-snapshots/SGHomie/tests/auth-modal.test.mjs.txt#L96) |
| JS-AUTH-MODAL-FD5B6B0953 | failed registration keeps the form and entered email available to retry | PASS | [inputs + assertions L116–124](evidence/source-snapshots/SGHomie/tests/auth-modal.test.mjs.txt#L116) |
| JS-AUTH-MODAL-5C2991D01D | closing confirmation clears it before reopening registration | PASS | [inputs + assertions L125–135](evidence/source-snapshots/SGHomie/tests/auth-modal.test.mjs.txt#L125) |
| JS-AUTH-MODAL-894246386A | auto-confirmed registration acknowledges the session without claiming an email was sent | PASS | [inputs + assertions L136–145](evidence/source-snapshots/SGHomie/tests/auth-modal.test.mjs.txt#L136) |
| JS-AUTH-MODAL-B4CDB9BC66 | successful sign in still closes the modal | PASS | [inputs + assertions L146–155](evidence/source-snapshots/SGHomie/tests/auth-modal.test.mjs.txt#L146) |

## SGHomie/tests/buy-flow.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-BUY-FLOW-3702C61F18 | recommendation writer receives only user context and verified results without tool history | PASS | [inputs + assertions L22–49](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L22) |
| JS-BUY-FLOW-5FBBC39E65 | invalid or unavailable writing falls back without losing verified recommendations | PASS | [inputs + assertions L50–64](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L50) |
| JS-BUY-FLOW-ECD5A0383E | writer rejects stale towns and named nearby alternatives before publishing | PASS | [inputs + assertions L65–76](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L65) |
| JS-BUY-FLOW-0208D9A939 | tool specifies examples and keeps HDB room type separate from bedrooms | PASS | [inputs + assertions L77–83](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L77) |
| JS-BUY-FLOW-595B03A3D6 | normalizes town alternatives, nulls and default ranking | PASS | [inputs + assertions L84–88](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L84) |
| JS-BUY-FLOW-0A280DEE7B | rejects malformed queries instead of broadening requirements | PASS | [inputs + assertions L89–92](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L89) |
| JS-BUY-FLOW-7047EB0BFC | query ANDs requirements, ORs towns, excludes drafts and ranks deterministically | PASS | [inputs + assertions L93–108](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L93) |
| JS-BUY-FLOW-BF39590920 | 4-room filters listing text independently from a requested three bedrooms | PASS | [inputs + assertions L109–118](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L109) |
| JS-BUY-FLOW-0C01213E43 | quotes filter grammar and escapes literal SQL wildcards | PASS | [inputs + assertions L119–125](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L119) |
| JS-BUY-FLOW-2BA00DD0A8 | listing fetch preserves caller identity, caps results and returns links/count | PASS | [inputs + assertions L126–141](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L126) |
| JS-BUY-FLOW-55D3E8B19C | zero matches differ from database and network failures | PASS | [inputs + assertions L142–151](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L142) |
| JS-BUY-FLOW-819A42D242 | previous filters reach the model and tool results retain their call IDs | PASS | [inputs + assertions L152–166](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L152) |
| JS-BUY-FLOW-5BAB288515 | invalid tool arguments receive feedback with a bounded retry budget | PASS | [inputs + assertions L167–181](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L167) |
| JS-BUY-FLOW-BB7868F027 | the model can answer conversationally even when search criteria are present | PASS | [inputs + assertions L182–198](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L182) |
| JS-BUY-FLOW-EBD6EE327E | screenshot timing question stays conversational, then an explicit search uses the stated budget | PASS | [inputs + assertions L199–245](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L199) |
| JS-BUY-FLOW-A88659D642 | preferences discussed after a previous search override its snapshot when a later search is requested | PASS | [inputs + assertions L246–275](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L246) |
| JS-BUY-FLOW-B47DD19EA9 | fragmented Unicode/SSE metadata reaches the frontend and returns full text | PASS | [inputs + assertions L276–287](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L276) |
| JS-BUY-FLOW-4C96523DF2 | frontend rejects provider errors and unfinished streams | PASS | [inputs + assertions L288–291](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L288) |
| JS-BUY-FLOW-3660491932 | literal Sengkang and budget requirements survive omitted or incorrect model arguments | PASS | [inputs + assertions L292–302](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L292) |
| JS-BUY-FLOW-C7B86A9835 | town changes, alternatives, removals and budget refinements override earlier context | PASS | [inputs + assertions L303–332](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L303) |
| JS-BUY-FLOW-49591A2701 | nonliteral budget refinements replace saved bounds and survive subsequent literal searches | PASS | [inputs + assertions L333–351](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L333) |
| JS-BUY-FLOW-0CBA77C0DA | new budget extraction replaces an earlier removal while unrelated refinements retain saved ceilings | PASS | [inputs + assertions L352–368](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L352) |
| JS-BUY-FLOW-44C7C7D458 | any executives removes a stale town, retains budget and enforces executive room type | PASS | [inputs + assertions L369–390](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L369) |
| JS-BUY-FLOW-A9FFCD7054 | explicit room-type refinements and removal override old model filters | PASS | [inputs + assertions L391–399](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L391) |
| JS-BUY-FLOW-7F313D13B6 | tool updates distinguish omitted filters from explicit null or empty-array removals | PASS | [inputs + assertions L400–421](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L400) |
| JS-BUY-FLOW-C0CD787BDA | new explicit constraints remain protected, while any or removal clears only the requested preference | PASS | [inputs + assertions L422–433](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L422) |
| JS-BUY-FLOW-06187BB540 | screenshot broadening uses the model-selected filter patch and preserves the budget in JSON and SSE | PASS | [inputs + assertions L434–469](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L434) |
| JS-BUY-FLOW-9BB5DD9269 | HTTP removal of Clementi searches across towns and writes using the new result scope | PASS | [inputs + assertions L470–505](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L470) |
| JS-BUY-FLOW-DF9B0AC166 | model-selected any-town search and preserves all saved filters | PASS | [inputs + assertions L506–519](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L506) |
| JS-BUY-FLOW-0FA78B43A1 | completed tool searches retain verified cards when reply writing is unavailable | PASS | [inputs + assertions L520–561](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L520) |
| JS-BUY-FLOW-DFC2534F88 | model-selected searches preserve literal town, room type and budget constraints | PASS | [inputs + assertions L562–585](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L562) |
| JS-BUY-FLOW-BBD49256F0 | provider failure before a tool decision cannot produce automatic searches or invented cards | PASS | [inputs + assertions L586–603](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L586) |
| JS-BUY-FLOW-58B9339396 | complex searches still use the tool with server town/budget guards | PASS | [inputs + assertions L604–615](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L604) |
| JS-BUY-FLOW-60FA84040D | frontend exposes a safe rate-limit explanation without forwarding arbitrary backend errors | PASS | [inputs + assertions L616–622](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L616) |
| JS-BUY-FLOW-2990F3F939 | textual tool markup is retried privately and cannot become an assistant answer | PASS | [inputs + assertions L623–640](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L623) |
| JS-BUY-FLOW-F7B289FEFF | exclusion-only town refinements ask for a replacement without searching broadly | PASS | [inputs + assertions L641–648](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L641) |
| JS-BUY-FLOW-FB1EAC939E | streamed legacy tool markup stays hidden even when tags arrive one character at a time | PASS | [inputs + assertions L649–659](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L649) |
| JS-BUY-FLOW-A3A8A933BD | database results outside the town or budget are rejected before recommending | PASS | [inputs + assertions L660–672](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L660) |
| JS-BUY-FLOW-91FE89C6C7 | HTTP Sengkang search preserves constraints and sends only a verified result reply | PASS | [inputs + assertions L673–709](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L673) |
| JS-BUY-FLOW-9F373F347D | typed Buy clears seller intake and following requirements stay in the buy journey | PASS | [inputs + assertions L710–770](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L710) |
| JS-BUY-FLOW-D279D2AE68 | Buy opens a model-led conversation in both response modes without fixed intake or listings | PASS | [inputs + assertions L771–795](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L771) |
| JS-BUY-FLOW-E4DEA8E431 | saved profile preferences map to supported filters without inferring constraints from income or family size | PASS | [inputs + assertions L796–808](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L796) |
| JS-BUY-FLOW-6CE20B70C1 | Buy immediately searches authenticated profile preferences with either field set and explains verified results naturally | PASS | [inputs + assertions L809–876](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L809) |
| JS-BUY-FLOW-59A658C0FF | saved preferences do not auto-search advice turns or become preferences for anonymous users | PASS | [inputs + assertions L877–895](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L877) |
| JS-BUY-FLOW-EE97141DB7 | requirement reply searches three cards and cannot be trapped in the pending sell journey | PASS | [inputs + assertions L896–933](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L896) |
| JS-BUY-FLOW-4083A88401 | anonymous buyers use anon role and JSON responses retain response compatibility | PASS | [inputs + assertions L934–950](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L934) |
| JS-BUY-FLOW-90D03360DF | explicit no-preference reply can search broadly after the requirements question | PASS | [inputs + assertions L951–972](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L951) |
| JS-BUY-FLOW-4708C0CBBE | invalid requests never reach model/database and cannot inject tool/system roles | PASS | [inputs + assertions L973–983](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L973) |
| JS-BUY-FLOW-3C6793DAB7 | database/provider failures remain errors rather than no-match recommendations | PASS | [inputs + assertions L984–994](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L984) |
| JS-BUY-FLOW-3FECCCEDC9 | default model uses the free router without optional parameters that exclude tool providers | PASS | [inputs + assertions L995–1011](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L995) |
| JS-BUY-FLOW-E3C7E495F5 | unavailable model has an actionable error without exposing the upstream payload | PASS | [inputs + assertions L1012–1021](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L1012) |
| JS-BUY-FLOW-75B8AFE412 | existing sell flow retains anonymous, non-seller and admin gates without model calls | PASS | [inputs + assertions L1022–1035](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L1022) |
| JS-BUY-FLOW-F9CB7DEA2B | seller postal verification requests the full intake before writing a draft | PASS | [inputs + assertions L1036–1053](evidence/source-snapshots/SGHomie/tests/buy-flow.test.mjs.txt#L1036) |

## SGHomie/tests/chat-markdown-security.test.mjs

Level: Component/render integration. Technique: Black-box untrusted-markdown partitions using real ReactMarkdown/ReactDOM. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-MARKDOWN-01 | FE-MARKDOWN-01 raw HTML script and event-handler text cannot produce executable markup | PASS | [inputs + assertions L29–34](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L29) |
| FE-MARKDOWN-02 | FE-MARKDOWN-02 JavaScript link destinations are stripped by the Markdown renderer | PASS | [inputs + assertions L35–40](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L35) |
| FE-MARKDOWN-03 | FE-MARKDOWN-03 internal property links use application routing | PASS | [inputs + assertions L41–47](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L41) |
| FE-MARKDOWN-04 | FE-MARKDOWN-04 external links cannot access the opener window | PASS | [inputs + assertions L48–54](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L48) |
| FE-MARKDOWN-05 | FE-MARKDOWN-05 protocol-relative URLs are treated as external links | PASS | [inputs + assertions L55–60](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L55) |
| FE-MARKDOWN-06 | FE-MARKDOWN-06 generated image markup becomes a link rather than an embedded photo | PASS | [inputs + assertions L61–67](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L61) |
| FE-MARKDOWN-07 | FE-MARKDOWN-07 internal tool markup is removed before user-visible rendering | PASS | [inputs + assertions L68–73](evidence/source-snapshots/SGHomie/tests/chat-markdown-security.test.mjs.txt#L68) |

## SGHomie/tests/chat-provider.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-PROVIDER-B79A97BADF | provider switch defaults to existing router, selects separate models and validates config | PASS | [inputs + assertions L21–38](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L21) |
| JS-CHAT-PROVIDER-65CACD7C35 | OpenAI preserves prompts, history and tools while adapting only provider parameters | PASS | [inputs + assertions L39–61](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L39) |
| JS-CHAT-PROVIDER-5649711F4A | model overrides handle non-reasoning models and reject incompatible GPT-6 tool models | PASS | [inputs + assertions L62–78](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L62) |
| JS-CHAT-PROVIDER-8CB748D7CD | OpenAI failures retain status and are never retried against OpenRouter | PASS | [inputs + assertions L79–90](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L79) |
| JS-CHAT-PROVIDER-2258C7F22B | OpenAI streaming retains the frontend SSE contract | PASS | [inputs + assertions L91–99](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L91) |
| JS-CHAT-PROVIDER-0C9D8F4C66 | complex buying request executes OpenAI tools, trusted DB search and generated prose | PASS | [inputs + assertions L100–130](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L100) |
| JS-CHAT-PROVIDER-47424999C2 | Edge Function sends identical system prompts and tools for both providers | PASS | [inputs + assertions L131–153](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L131) |
| JS-CHAT-PROVIDER-2362545E3E | Edge Function reports OpenAI-specific model configuration and safe rate-limit errors | PASS | [inputs + assertions L154–167](evidence/source-snapshots/SGHomie/tests/chat-provider.test.mjs.txt#L154) |

## SGHomie/tests/chat-window.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-CHAT-WINDOW-2D269146EA | compact starts in the corner and expanded provides a larger centered window | PASS | [inputs + assertions L5–14](evidence/source-snapshots/SGHomie/tests/chat-window.test.mjs.txt#L5) |
| JS-CHAT-WINDOW-E26DCD5039 | dragging cannot lose the window beyond any viewport edge | PASS | [inputs + assertions L15–19](evidence/source-snapshots/SGHomie/tests/chat-window.test.mjs.txt#L15) |
| JS-CHAT-WINDOW-5F56D6B513 | resizing keeps the anchor and enforces usable minimums and viewport maximums | PASS | [inputs + assertions L20–26](evidence/source-snapshots/SGHomie/tests/chat-window.test.mjs.txt#L20) |
| JS-CHAT-WINDOW-0548311BA3 | small mobile viewports and orientation changes keep both modes inside the screen | PASS | [inputs + assertions L27–36](evidence/source-snapshots/SGHomie/tests/chat-window.test.mjs.txt#L27) |

## SGHomie/tests/enquiry-behavior.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-ENQUIRY-01 | FE-ENQUIRY-01 history requests only the signed-in email and newest records first | PASS | [inputs + assertions L46–57](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L46) |
| FE-ENQUIRY-02 | FE-ENQUIRY-02 empty history displays the empty state | PASS | [inputs + assertions L58–65](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L58) |
| FE-ENQUIRY-03 | FE-ENQUIRY-03 history failure is reported and loading finishes | PASS | [inputs + assertions L66–74](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L66) |
| FE-ENQUIRY-04 | FE-ENQUIRY-04 submission uses account email, persists pending status, resets and refreshes | PASS | [inputs + assertions L75–90](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L75) |
| FE-ENQUIRY-05 | FE-ENQUIRY-05 failed insertion preserves all input for retry and never announces success | PASS | [inputs + assertions L91–103](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L91) |
| FE-ENQUIRY-06 | FE-ENQUIRY-06 submission disables its button while the write is pending | PASS | [inputs + assertions L104–114](evidence/source-snapshots/SGHomie/tests/enquiry-behavior.test.mjs.txt#L104) |

## SGHomie/tests/enquiry-response-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-ENQ-01 | BE-ENQ-01 preflight is available without authentication or external operations | PASS | [inputs + assertions L36–41](evidence/source-snapshots/SGHomie/tests/enquiry-response-endpoint.test.mjs.txt#L36) |
| BE-ENQ-02 | BE-ENQ-02 anonymous callers cannot read enquiries write responses or send email | PASS | [inputs + assertions L42–47](evidence/source-snapshots/SGHomie/tests/enquiry-response-endpoint.test.mjs.txt#L42) |
| BE-ENQ-03 | BE-ENQ-03 invalid sessions and non-admins are denied before enquiry access or email | PASS | [inputs + assertions L48–56](evidence/source-snapshots/SGHomie/tests/enquiry-response-endpoint.test.mjs.txt#L48) |
| BE-ENQ-04 | BE-ENQ-04 authenticated admin can respond with caller validation before service-role enquiry access | PASS | [inputs + assertions L57–69](evidence/source-snapshots/SGHomie/tests/enquiry-response-endpoint.test.mjs.txt#L57) |
| BE-ENQ-05 | BE-ENQ-05 enquiry read or update failure prevents email and returns failure | PASS | [inputs + assertions L70–76](evidence/source-snapshots/SGHomie/tests/enquiry-response-endpoint.test.mjs.txt#L70) |

## SGHomie/tests/hdb-location-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-LOC-01 | BE-LOC-01 preflight and unsupported methods do not initialize clients or contact providers | PASS | [inputs + assertions L70–76](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L70) |
| BE-LOC-02 | BE-LOC-02 missing session is rejected before SDK or provider access | PASS | [inputs + assertions L77–82](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L77) |
| BE-LOC-03 | BE-LOC-03 invalid session and buyer roles fail before address lookup or verification writes | PASS | [inputs + assertions L83–91](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L83) |
| BE-LOC-04 | BE-LOC-04 postal-code equivalence partitions reject malformed inputs before network access | PASS | [inputs + assertions L92–101](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L92) |
| BE-LOC-05 | BE-LOC-05 accepted postal formats normalize and produce seller-bound authoritative verification | PASS | [inputs + assertions L102–120](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L102) |
| BE-LOC-06 | BE-LOC-06 fuzzy postal matches are rejected without HDB queries or tokens | PASS | [inputs + assertions L121–128](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L121) |
| BE-LOC-07 | BE-LOC-07 street abbreviation fallback still requires the same block and street | PASS | [inputs + assertions L129–137](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L129) |
| BE-LOC-08 | BE-LOC-08 unknown and nonresidential HDB addresses issue no verification token | PASS | [inputs + assertions L138–145](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L138) |
| BE-LOC-09 | BE-LOC-09 expired OneMap authentication refreshes once and cached fresh tokens are reused | PASS | [inputs + assertions L146–153](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L146) |
| BE-LOC-10 | BE-LOC-10 repeated token rejection stops after one refresh and returns service unavailability | PASS | [inputs + assertions L154–160](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L154) |
| BE-LOC-11 | BE-LOC-11 upstream authentication and dataset failures cannot become verified addresses | PASS | [inputs + assertions L161–169](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L161) |
| BE-LOC-12 | BE-LOC-12 nonfinite coordinates and verification persistence failure fail closed | PASS | [inputs + assertions L170–177](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L170) |
| BE-LOC-13 | BE-LOC-13 missing blank zero or geographically invalid coordinates cannot be verified as an HDB location | PASS | [inputs + assertions L178–188](evidence/source-snapshots/SGHomie/tests/hdb-location-endpoint.test.mjs.txt#L178) |

## SGHomie/tests/image-cleanup-endpoint.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| BE-IMG-01 | BE-IMG-01 preflight and unsupported methods never initialize storage | PASS | [inputs + assertions L40–46](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L40) |
| BE-IMG-02 | BE-IMG-02 anonymous and user-level callers cannot invoke privileged cleanup | PASS | [inputs + assertions L47–54](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L47) |
| BE-IMG-03 | BE-IMG-03 configured server keys work through apikey and Bearer authentication | PASS | [inputs + assertions L55–65](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L55) |
| BE-IMG-04 | BE-IMG-04 public signed encoded and legacy linked paths are preserved while external URLs do not protect unrelated files | PASS | [inputs + assertions L66–76](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L66) |
| BE-IMG-05 | BE-IMG-05 paginated storage traversal and 100-object deletion batches cover every orphan exactly once | PASS | [inputs + assertions L77–86](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L77) |
| BE-IMG-06 | BE-IMG-06 images linked by properties beyond the first database page are never deleted | PASS | [inputs + assertions L87–95](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L87) |
| BE-IMG-07 | BE-IMG-07 database and storage listing failures stop before any deletion | PASS | [inputs + assertions L96–102](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L96) |
| BE-IMG-08 | BE-IMG-08 failed deletion returns an error rather than a successful cleanup count | PASS | [inputs + assertions L103–107](evidence/source-snapshots/SGHomie/tests/image-cleanup-endpoint.test.mjs.txt#L103) |

## SGHomie/tests/listing-analytics.test.mjs

Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-LISTING-ANALYTICS-B956F693DF | averages individual listing prices and uses listing counts for the popular area | PASS | [inputs + assertions L7–16](evidence/source-snapshots/SGHomie/tests/listing-analytics.test.mjs.txt#L7) |
| JS-LISTING-ANALYTICS-343717F7CE | normalizes town names, falls back to location and preserves ties honestly | PASS | [inputs + assertions L17–24](evidence/source-snapshots/SGHomie/tests/listing-analytics.test.mjs.txt#L17) |
| JS-LISTING-ANALYTICS-FFDA69C76C | empty or invalid prices show missing data rather than inventing zero averages | PASS | [inputs + assertions L25–32](evidence/source-snapshots/SGHomie/tests/listing-analytics.test.mjs.txt#L25) |

## SGHomie/tests/listing-counts.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-LISTING-COUNTS-AE7BDCCA1B | counts approved HDB rows and normalized distinct towns across response pages | PASS | [inputs + assertions L18–27](evidence/source-snapshots/SGHomie/tests/listing-counts.test.mjs.txt#L18) |
| JS-LISTING-COUNTS-878E47E006 | an empty approved catalog reports real zero counts | PASS | [inputs + assertions L28–31](evidence/source-snapshots/SGHomie/tests/listing-counts.test.mjs.txt#L28) |
| JS-LISTING-COUNTS-F094212B94 | failed or incomplete fetches reject instead of publishing false zero or partial totals | PASS | [inputs + assertions L32–38](evidence/source-snapshots/SGHomie/tests/listing-counts.test.mjs.txt#L32) |

## SGHomie/tests/property-details-lifecycle.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-PROPERTY-DETAILS-LIFECYCLE-CA6E2AF7D2 | effect replay cancels the old fetch and never subscribes after cleanup | PASS | [inputs + assertions L292–315](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L292) |
| JS-PROPERTY-DETAILS-LIFECYCLE-05E5279BBF | an unmapped amenity type still supplies a Leaflet marker icon | PASS | [inputs + assertions L316–322](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L316) |
| JS-PROPERTY-DETAILS-LIFECYCLE-30AED74B26 | revisiting a property while channel removal is pending owns a fresh subscription | PASS | [inputs + assertions L323–341](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L323) |
| JS-PROPERTY-DETAILS-LIFECYCLE-E60915C148 | navigation ignores a realtime count response arriving after the old page cleanup | PASS | [inputs + assertions L342–370](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L342) |
| JS-PROPERTY-DETAILS-LIFECYCLE-EFEECB871C | a valuation response from the previous property route is ignored | PASS | [inputs + assertions L371–404](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L371) |
| JS-PROPERTY-DETAILS-LIFECYCLE-19173CE959 | logged-out valuation requests open the existing auth modal without invoking the service | PASS | [inputs + assertions L405–423](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L405) |
| JS-PROPERTY-DETAILS-LIFECYCLE-55F77FFDBE | property content appears while independent interest lookups are pending and map mounts on approach | PASS | [inputs + assertions L424–463](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L424) |
| JS-PROPERTY-DETAILS-LIFECYCLE-9210829861 | map mounts eagerly when IntersectionObserver is unavailable | PASS | [inputs + assertions L464–473](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L464) |
| JS-PROPERTY-DETAILS-LIFECYCLE-8167E0C84C | valuation CTA prevents duplicates, shows staged copy, renders the hierarchy and clears timers | PASS | [inputs + assertions L474–523](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L474) |
| JS-PROPERTY-DETAILS-LIFECYCLE-50EBAC6DEC | below, within and above asking-price labels stay human-readable | PASS | [inputs + assertions L524–547](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L524) |
| JS-PROPERTY-DETAILS-LIFECYCLE-6DCB927711 | unmounting a pending valuation clears both timers and ignores its response | PASS | [inputs + assertions L548–567](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L548) |
| JS-PROPERTY-DETAILS-LIFECYCLE-289C16518A | valuation failure clears staged timers and leaves a retry action available | PASS | [inputs + assertions L568–589](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L568) |
| JS-PROPERTY-DETAILS-LIFECYCLE-8DD6C741DD | changing property routes clears the prior valuation stage timers | PASS | [inputs + assertions L590–607](evidence/source-snapshots/SGHomie/tests/property-details-lifecycle.test.mjs.txt#L590) |

## SGHomie/tests/property-valuation-frontend.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-PROPERTY-VALUATION-FRONTEND-F39607F44C | valuation sends only the property ID and passes the authenticated session token | PASS | [inputs + assertions L74–83](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L74) |
| JS-PROPERTY-VALUATION-FRONTEND-9D2FD3E6CE | empty property IDs fail before session or function calls | PASS | [inputs + assertions L84–90](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L84) |
| JS-PROPERTY-VALUATION-FRONTEND-C1C8E4DB7C | missing sessions and session lookup errors are controlled authentication failures | PASS | [inputs + assertions L91–98](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L91) |
| JS-PROPERTY-VALUATION-FRONTEND-4E3B5FF96E | function failures retain controlled authentication, network, unavailable and generic categories | PASS | [inputs + assertions L99–118](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L99) |
| JS-PROPERTY-VALUATION-FRONTEND-FE9B70E6A1 | malformed success responses are rejected instead of rendered | PASS | [inputs + assertions L119–137](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L119) |
| JS-PROPERTY-VALUATION-FRONTEND-C8165EE984 | price-position labels are customer-facing and specific | PASS | [inputs + assertions L138–143](evidence/source-snapshots/SGHomie/tests/property-valuation-frontend.test.mjs.txt#L138) |

## SGHomie/tests/protected-route.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-ROUTE-01 | FE-ROUTE-01 pending authentication shows loading and withholds protected content | PASS | [inputs + assertions L16–22](evidence/source-snapshots/SGHomie/tests/protected-route.test.mjs.txt#L16) |
| FE-ROUTE-02 | FE-ROUTE-02 an unauthenticated visitor is redirected with replacement history | PASS | [inputs + assertions L23–30](evidence/source-snapshots/SGHomie/tests/protected-route.test.mjs.txt#L23) |
| FE-ROUTE-03 | FE-ROUTE-03 an incomplete authenticated profile cannot open protected content | PASS | [inputs + assertions L31–37](evidence/source-snapshots/SGHomie/tests/protected-route.test.mjs.txt#L31) |
| FE-ROUTE-04 | FE-ROUTE-04 a complete authenticated profile receives protected content | PASS | [inputs + assertions L38–43](evidence/source-snapshots/SGHomie/tests/protected-route.test.mjs.txt#L38) |
| FE-ROUTE-05 | FE-ROUTE-05 loading takes precedence over an existing incomplete session | PASS | [inputs + assertions L44–48](evidence/source-snapshots/SGHomie/tests/protected-route.test.mjs.txt#L44) |

## SGHomie/tests/search-behavior.test.mjs

Level: Component contract (VM hooks/service doubles). Technique: User-event/output contracts and white-box lifecycle/error branch selection. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-SEARCH-01 | FE-SEARCH-01 the initial search reads approved HDB rows and newest first | PASS | [inputs + assertions L34–44](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L34) |
| FE-SEARCH-02 | FE-SEARCH-02 4 ROOM filters listing room-type text without requiring four bedrooms | PASS | [inputs + assertions L45–52](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L45) |
| FE-SEARCH-03 | FE-SEARCH-03 EXECUTIVE produces a valid text filter rather than a NaN bedroom query | PASS | [inputs + assertions L53–61](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L53) |
| FE-SEARCH-04 | FE-SEARCH-04 ALL leaves town and room type unrestricted | PASS | [inputs + assertions L62–67](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L62) |
| FE-SEARCH-05 | FE-SEARCH-05 explicit town and inclusive price limits are passed to the catalog | PASS | [inputs + assertions L68–78](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L68) |
| FE-SEARCH-06 | FE-SEARCH-06 a catalog failure shows an alert rather than a false no-match result | PASS | [inputs + assertions L79–85](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L79) |
| FE-SEARCH-07 | FE-SEARCH-07 an empty successful catalog displays no matches | PASS | [inputs + assertions L86–92](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L86) |
| FE-SEARCH-08 | FE-SEARCH-08 selecting a card updates the map selection and accessible pressed state | PASS | [inputs + assertions L93–100](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L93) |
| FE-SEARCH-09 | FE-SEARCH-09 an unsupported profile flat size is rejected before a catalog query | PASS | [inputs + assertions L101–107](evidence/source-snapshots/SGHomie/tests/search-behavior.test.mjs.txt#L101) |

## SGHomie/tests/search-resources.test.mjs

Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-SEARCH-RESOURCES-FBE75B4D2F | Explore selects only the card and map fields and keeps query controls explicit | FAIL: The input did not match the regular expression /\.(?:eq\|gte\|lte\|order)\('bedrooms'/. Input: | [inputs + assertions L8–16](evidence/source-snapshots/SGHomie/tests/search-resources.test.mjs.txt#L8) |
| JS-SEARCH-RESOURCES-E58BA9A67F | Explore keeps the first two card images eager and lazily decodes later images | PASS | [inputs + assertions L17–22](evidence/source-snapshots/SGHomie/tests/search-resources.test.mjs.txt#L17) |
| JS-SEARCH-RESOURCES-3BD253DB8A | Explore map remains mounted as a primary search feature with its existing tile source | PASS | [inputs + assertions L23–27](evidence/source-snapshots/SGHomie/tests/search-resources.test.mjs.txt#L23) |

## SGHomie/tests/sell-flow.test.mjs

Level: Handler/flow integration (mocked external services). Technique: Black-box request/state partitions and white-box authorization/provider/error paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-SELL-FLOW-D051CC47CE | complete sell flow persists confirmed details and private unit before emitting a draft card | PASS | [inputs + assertions L79–105](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L79) |
| JS-SELL-FLOW-FC3FCC038A | unknown details and no price create a partial draft without inventing a private unit | PASS | [inputs + assertions L106–121](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L106) |
| JS-SELL-FLOW-96DD6E8560 | user can choose an independent price and pricing-provider failures allow skipping | PASS | [inputs + assertions L122–130](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L122) |
| JS-SELL-FLOW-E331FAD6B2 | failInsert | PASS | [inputs + assertions L133–144](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L133) |
| JS-SELL-FLOW-2479E830AC | failPrivate | PASS | [inputs + assertions L133–144](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L133) |
| JS-SELL-FLOW-E4A6E34F6F | a seller context cannot bypass auth or validation, and Buy escapes an active seller intake | PASS | [inputs + assertions L145–163](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L145) |
| JS-SELL-FLOW-4142DAC463 | price decisions distinguish acceptance, own prices, unknowns and ambiguous messages | PASS | [inputs + assertions L164–182](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L164) |
| JS-SELL-FLOW-A135DA50AF | profile contact details remove redundant questions and survive extraction and natural price acceptance | PASS | [inputs + assertions L183–201](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L183) |
| JS-SELL-FLOW-2853FCAEF4 | intake asks only for missing or invalid profile contacts | PASS | [inputs + assertions L202–214](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L202) |
| JS-SELL-FLOW-6E9069DC29 | extraction sends only untrusted seller facts and validates unknown/invalid fields | PASS | [inputs + assertions L215–229](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L215) |
| JS-SELL-FLOW-0D7E4B800C | estimate rejects sparse details, invented extreme values and provider failures | PASS | [inputs + assertions L230–240](evidence/source-snapshots/SGHomie/tests/sell-flow.test.mjs.txt#L230) |

## SGHomie/tests/supabase-config.test.mjs

Level: Unit/service contract (dependency doubles). Technique: Black-box input/output partitions and white-box validation/failure paths. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| FE-CONFIG-01 | FE-CONFIG-01 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L28) |
| FE-CONFIG-02 | FE-CONFIG-02 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L28) |
| FE-CONFIG-03 | FE-CONFIG-03 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L28) |
| FE-CONFIG-04 | FE-CONFIG-04 missing or blank project configuration gives setup guidance | PASS | [inputs + assertions L28–32](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L28) |
| FE-CONFIG-05 | FE-CONFIG-05 malformed project URL is rejected | PASS | [inputs + assertions L33–46](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L33) |
| FE-CONFIG-06 | FE-CONFIG-06 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L42) |
| FE-CONFIG-07 | FE-CONFIG-07 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L42) |
| FE-CONFIG-08 | FE-CONFIG-08 unsupported or placeholder project URL is rejected | PASS | [inputs + assertions L42–46](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L42) |
| FE-CONFIG-09 | FE-CONFIG-09 a privileged Supabase secret key is explicitly rejected in the browser | PASS | [inputs + assertions L47–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L47) |
| FE-CONFIG-10 | FE-CONFIG-10 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-11 | FE-CONFIG-11 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-12 | FE-CONFIG-12 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-13 | FE-CONFIG-13 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-14 | FE-CONFIG-14 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-15 | FE-CONFIG-15 non-anonymous or unreadable legacy key is rejected | PASS | [inputs + assertions L61–65](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L61) |
| FE-CONFIG-16 | FE-CONFIG-16 publishable configuration is accepted after trimming whitespace | PASS | [inputs + assertions L66–69](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L66) |
| FE-CONFIG-17 | FE-CONFIG-17 a legacy anon-role JWT fixture is accepted | PASS | [inputs + assertions L70–73](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L70) |
| FE-CONFIG-18 | FE-CONFIG-18 a local HTTP Supabase URL is supported | PASS | [inputs + assertions L74–76](evidence/source-snapshots/SGHomie/tests/supabase-config.test.mjs.txt#L74) |

## SGHomie/tests/valuation-range.test.mjs

Level: Component contract (isolated JSX). Technique: Rendered output/accessibility assertions and invalid-input branches. Risk: High.
Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.
Level: Unit. Technique: Behavioral/boundary assertions on executable functions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-VALUATION-RANGE-72F6D4F032 | ordinary scale keeps 12% padding and maps the actual estimate linearly | PASS | [inputs + assertions L27–38](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L27) |
| JS-VALUATION-RANGE-1E5ABDB453 | asking marker maps below, within, above, and at either bound without changing classification inputs | PASS | [inputs + assertions L39–52](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L39) |
| JS-VALUATION-RANGE-B13E475764 | narrow and equal ranges have a safe non-zero display domain | PASS | [inputs + assertions L53–60](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L53) |
| JS-VALUATION-RANGE-EAC92E3433 | extreme outliers compress tails while preserving a readable linear likely range and continuation | PASS | [inputs + assertions L61–84](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L61) |
| JS-VALUATION-RANGE-8511CB1BB6 | moderate outliers stay linear and positions share the same mapping | PASS | [inputs + assertions L85–91](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L85) |
| JS-VALUATION-RANGE-D6AC7FCC0B | invalid, inconsistent, non-finite and overflowing values fail safely | PASS | [inputs + assertions L92–130](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L92) |
| JS-VALUATION-RANGE-EF72994C55 | gauge anchors all three valuation labels and retains an accessible asking marker | PASS | [inputs + assertions L131–159](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L131) |
| JS-VALUATION-RANGE-D7DA6FC838 | asking marker keeps its below, within and above status text | PASS | [inputs + assertions L160–180](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L160) |
| JS-VALUATION-RANGE-5A1A8C0360 | outlier asking marker has exact value and explicit displayed-scale cue | PASS | [inputs + assertions L181–202](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L181) |
| JS-VALUATION-RANGE-F262790938 | valuation motion is reduced when the user requests less motion | PASS | [inputs + assertions L203–209](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L203) |
| JS-VALUATION-RANGE-1D494CB7D5 | invalid gauge values render an explanatory fallback instead of a broken scale | PASS | [inputs + assertions L210–215](evidence/source-snapshots/SGHomie/tests/valuation-range.test.mjs.txt#L210) |

## SGHomie/tests/valuation.test.mjs

Level: Handler integration (actual shared valuation handler; mocked database/upstream). Technique: Black-box request/response contracts and white-box authentication/provenance/error paths. Risk: High.
Level: Static source contract. Technique: White-box source/SQL/CSS inspection assertions. Risk: Medium.
Level: Unit (valuation feature/lease helpers). Technique: Input/output boundaries, feature-order, and target-exclusion assertions. Risk: High.

Fixture/setup reference: the complete source suite and imported helpers. Each linked declaration includes its assertion oracle; Python links include parameterization decorators. Outcomes apply to the recorded local run only.

| Case ID | Objective / executed case | Actual outcome | Executable inputs and expected oracle |
|---|---|---|---|
| JS-VALUATION-318A7B9074 | lease reference advances by whole calendar months and rejects invalid states | PASS | [inputs + assertions L91–100](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L91) |
| JS-VALUATION-03E61B5980 | feature mapping follows the CatBoost contract and keeps asking price outside features | PASS | [inputs + assertions L101–110](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L101) |
| JS-VALUATION-B4BB3E932C | demo storey range follows the training midpoint convention | PASS | [inputs + assertions L111–118](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L111) |
| JS-VALUATION-A538B45E30 | local demo fixtures are eligible only with both explicit local gates | PASS | [inputs + assertions L119–157](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L119) |
| JS-VALUATION-496530AFE1 | Edge timing logs correlate to the returned request ID without logging request secrets or features | PASS | [inputs + assertions L158–188](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L158) |
| JS-VALUATION-EF299492D6 | hosted demos require the independent hosted flag, canonical provenance and approved status | PASS | [inputs + assertions L189–227](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L189) |
| JS-VALUATION-4FA08F7461 | verified complete seller inputs pass; incomplete and unverified rows fail closed | PASS | [inputs + assertions L228–249](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L228) |
| JS-VALUATION-199B21B30E | caller-scoped property lookup preserves RLS and inaccessible rows are indistinguishable | PASS | [inputs + assertions L250–264](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L250) |
| JS-VALUATION-B1495C9B24 | authentication, request shape, lease and upstream response are validated safely | PASS | [inputs + assertions L265–290](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L265) |
| JS-VALUATION-0411449CC0 | canonical seed contains both deterministic batches and removes only obsolete seed signatures | PASS | [inputs + assertions L291–342](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L291) |
| JS-VALUATION-2971028FD3 | valuation migrations preserve legacy inputs and validate optional storey ranges | PASS | [inputs + assertions L343–371](evidence/source-snapshots/SGHomie/tests/valuation.test.mjs.txt#L343) |

## Excluded Node container completions

These parent completions are preserved in JSON for auditability and excluded from leaf case totals in agreement with Node JUnit.

- failed property/private writes never return success or a draft card: PASS (SGHomie/tests/sell-flow.test.mjs).
